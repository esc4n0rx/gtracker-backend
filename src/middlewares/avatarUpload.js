// src/middlewares/avatarUpload.js
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');

// Configuração do multer para usar memória (sem limite rígido inicialmente)
const storage = multer.memoryStorage();

// Filtro para aceitar apenas imagens
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não suportado. Use JPG, PNG, WebP ou GIF.'), false);
    }
};

// Configuração do multer com limite mais alto para permitir compressão
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB temporário para permitir compressão
        files: 1
    }
});

// Middleware para processar e fazer upload do avatar
const processAvatarUpload = async (req, res, next) => {
    try {
        if (!req.file) {
            return next();
        }

        const userId = req.user.id;
        const fileExtension = 'webp';
        const fileName = `${userId}/${uuidv4()}.${fileExtension}`;

        console.log(`Processando avatar - Tamanho original: ${(req.file.buffer.length / 1024 / 1024).toFixed(2)}MB`);

        // Processar imagem com Sharp - compressão agressiva para avatares
        const processedImageBuffer = await sharp(req.file.buffer)
            .resize(500, 500, {
                fit: 'cover',
                position: 'center'
            })
            .webp({
                quality: 80,
                effort: 6,
                smartSubsample: true
            })
            .toBuffer();

        console.log(`Avatar processado - Tamanho final: ${(processedImageBuffer.length / 1024 / 1024).toFixed(2)}MB`);

        // Verificar se ainda está muito grande após compressão
        const finalSizeMB = processedImageBuffer.length / 1024 / 1024;
        if (finalSizeMB > 5) {
            return res.status(400).json({
                success: false,
                message: 'Imagem muito grande mesmo após compressão. Tente uma imagem menor.'
            });
        }

        // Upload para Supabase Storage
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(fileName, processedImageBuffer, {
                contentType: 'image/webp',
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            throw new Error(`Erro ao fazer upload: ${error.message}`);
        }

        // Obter URL pública
        const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        req.uploadedAvatarUrl = publicUrlData.publicUrl;
        req.uploadedFileName = fileName;

        next();
    } catch (error) {
        console.error('Erro no processamento do avatar:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Erro ao processar avatar'
        });
    }
};

// Middleware para upload de cover image com compressão mais agressiva
const processCoverUpload = async (req, res, next) => {
    try {
        if (!req.file) {
            return next();
        }

        const userId = req.user.id;
        const fileExtension = 'webp';
        const fileName = `${userId}/cover/${uuidv4()}.${fileExtension}`;

        console.log(`Processando cover - Tamanho original: ${(req.file.buffer.length / 1024 / 1024).toFixed(2)}MB`);

        // Processar cover image com Sharp - compressão muito agressiva
        let processedImageBuffer = await sharp(req.file.buffer)
            .resize(1200, 400, {
                fit: 'cover',
                position: 'center'
            })
            .webp({
                quality: 75,
                effort: 6,
                smartSubsample: true
            })
            .toBuffer();

        console.log(`Cover processado (primeira tentativa) - Tamanho: ${(processedImageBuffer.length / 1024 / 1024).toFixed(2)}MB`);

        // Se ainda estiver muito grande, comprimir mais agressivamente
        let finalSizeMB = processedImageBuffer.length / 1024 / 1024;
        if (finalSizeMB > 5) {
            console.log('Cover ainda muito grande, aplicando compressão extra...');
            
            processedImageBuffer = await sharp(req.file.buffer)
                .resize(1200, 400, {
                    fit: 'cover',
                    position: 'center'
                })
                .webp({
                    quality: 60, // Reduzir qualidade
                    effort: 6,
                    smartSubsample: true
                })
                .toBuffer();

            finalSizeMB = processedImageBuffer.length / 1024 / 1024;
            console.log(`Cover processado (segunda tentativa) - Tamanho: ${finalSizeMB.toFixed(2)}MB`);
        }

        // Se ainda estiver muito grande, reduzir resolução
        if (finalSizeMB > 5) {
            console.log('Cover ainda muito grande, reduzindo resolução...');
            
            processedImageBuffer = await sharp(req.file.buffer)
                .resize(900, 300, { // Resolução menor
                    fit: 'cover',
                    position: 'center'
                })
                .webp({
                    quality: 50, // Qualidade ainda menor
                    effort: 6,
                    smartSubsample: true
                })
                .toBuffer();

            finalSizeMB = processedImageBuffer.length / 1024 / 1024;
            console.log(`Cover processado (terceira tentativa) - Tamanho: ${finalSizeMB.toFixed(2)}MB`);
        }

        // Verificação final
        if (finalSizeMB > 5) {
            return res.status(400).json({
                success: false,
                message: 'Imagem muito grande mesmo após múltiplas compressões. Tente uma imagem menor ou com menos detalhes.'
            });
        }

        // Upload para Supabase Storage
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(fileName, processedImageBuffer, {
                contentType: 'image/webp',
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            throw new Error(`Erro ao fazer upload: ${error.message}`);
        }

        // Obter URL pública
        const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        req.uploadedCoverUrl = publicUrlData.publicUrl;
        req.uploadedCoverFileName = fileName;

        console.log(`Upload concluído - URL: ${publicUrlData.publicUrl}`);

        next();
    } catch (error) {
        console.error('Erro no processamento da cover:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Erro ao processar imagem de capa'
        });
    }
};

// Middleware para tratar erros do Multer
const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    success: false,
                    message: 'Arquivo muito grande. O limite temporário é de 20MB, mas a imagem será comprimida automaticamente.'
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    success: false,
                    message: 'Muitos arquivos. Envie apenas um arquivo por vez.'
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    success: false,
                    message: 'Campo de arquivo inesperado.'
                });
            default:
                return res.status(400).json({
                    success: false,
                    message: `Erro no upload: ${error.message}`
                });
        }
    }
    
    next(error);
};

module.exports = {
    uploadAvatar: upload.single('avatar'),
    uploadCover: upload.single('cover'),
    processAvatarUpload,
    processCoverUpload,
    handleMulterError
};