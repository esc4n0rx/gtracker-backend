// src/controllers/customizationController.js
const CustomizationService = require('../services/customizationService');
const supabase = require('../config/supabase'); // Importar cliente Supabase

class CustomizationController {
    // Upload de avatar
    static async uploadAvatar(req, res) {
        try {
            if (!req.uploadedAvatarUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'Nenhum arquivo foi processado com sucesso'
                });
            }

            const userId = req.user.id;
            
            // Buscar avatar atual para deletar depois
            const { data: currentProfile } = await supabase
                .from('gtracker_profiles')
                .select('avatar_url')
                .eq('user_id', userId)
                .single();

            const result = await CustomizationService.updateAvatar(
                userId,
                req.uploadedAvatarUrl,
                currentProfile?.avatar_url
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json({
                ...result,
                info: {
                    original_size: req.file ? `${(req.file.size / 1024 / 1024).toFixed(2)}MB` : 'N/A',
                    compressed: true,
                    format: 'webp'
                }
            });

        } catch (error) {
            console.error('Erro no controller de upload de avatar:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    static async uploadCover(req, res) {
        try {
            if (!req.uploadedCoverUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'Nenhum arquivo foi processado com sucesso'
                });
            }

            const userId = req.user.id;
            
            // Buscar cover atual para deletar depois
            const { data: currentProfile } = await supabase
                .from('gtracker_profiles')
                .select('cover_image_url')
                .eq('user_id', userId)
                .single();

            const result = await CustomizationService.updateCoverImage(
                userId,
                req.uploadedCoverUrl,
                currentProfile?.cover_image_url
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json({
                ...result,
                info: {
                    original_size: req.file ? `${(req.file.size / 1024 / 1024).toFixed(2)}MB` : 'N/A',
                    compressed: true,
                    format: 'webp',
                    dimensions: '1200x400px (ou menor se necessário)'
                }
            });

        } catch (error) {
            console.error('Erro no controller de upload de capa:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Atualizar customizações do perfil
    static async updateCustomization(req, res) {
        try {
            const userId = req.user.id;
            const result = await CustomizationService.updateProfileCustomization(userId, req.body);

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de customização:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Buscar estatísticas do usuário
    static async getUserStats(req, res) {
        try {
            const userId = req.user.id;
            const result = await CustomizationService.getUserStats(userId);

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de estatísticas:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Remover avatar
    static async removeAvatar(req, res) {
        try {
            const userId = req.user.id;
            
            // Buscar avatar atual
            const { data: currentProfile } = await supabase
                .from('gtracker_profiles')
                .select('avatar_url')
                .eq('user_id', userId)
                .single();

            if (currentProfile?.avatar_url) {
                await CustomizationService.deleteOldAvatar(currentProfile.avatar_url);
            }

            // Remover URL do avatar no banco
            const { error } = await supabase
                .from('gtracker_profiles')
                .update({ 
                    avatar_url: null,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (error) {
                throw new Error('Erro ao remover avatar: ' + error.message);
            }

            return res.json({
                success: true,
                message: 'Avatar removido com sucesso'
            });

        } catch (error) {
            console.error('Erro ao remover avatar:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Remover imagem de capa
    static async removeCover(req, res) {
        try {
            const userId = req.user.id;
            
            // Buscar cover atual
            const { data: currentProfile } = await supabase
                .from('gtracker_profiles')
                .select('cover_image_url')
                .eq('user_id', userId)
                .single();

            if (currentProfile?.cover_image_url) {
                await CustomizationService.deleteOldCover(currentProfile.cover_image_url);
            }

            // Remover URL da cover no banco
            const { error } = await supabase
                .from('gtracker_profiles')
                .update({ 
                    cover_image_url: null,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (error) {
                throw new Error('Erro ao remover capa: ' + error.message);
            }

            return res.json({
                success: true,
                message: 'Imagem de capa removida com sucesso'
            });

        } catch (error) {
            console.error('Erro ao remover capa:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = CustomizationController;