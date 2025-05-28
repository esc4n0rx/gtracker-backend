// src/middlewares/postPermissions.js
const supabase = require('../config/supabase');

// Middleware para verificar se o usuário pode criar posts no fórum específico
const canPostInForum = async (req, res, next) => {
    try {
        const { forum_id } = req.body;
        const user = req.user;

        if (!forum_id) {
            return res.status(400).json({
                success: false,
                message: 'ID do fórum é obrigatório'
            });
        }

        // Verificar se o fórum existe e está ativo
        const { data: forum, error: forumError } = await supabase
            .from('gtracker_forums')
            .select(`
                id,
                name,
                is_active,
                gtracker_categories!inner(id, name)
            `)
            .eq('id', forum_id)
            .eq('is_active', true)
            .single();

        if (forumError || !forum) {
            return res.status(404).json({
                success: false,
                message: 'Fórum não encontrado ou inativo'
            });
        }

        // Verificar permissões básicas de postagem
        if (!user.role.permissions.pode_postar) {
            return res.status(403).json({
                success: false,
                message: 'Você não tem permissão para criar posts'
            });
        }

        // Verificar se o usuário tem nível suficiente (não é member básico ou banned)
        const restrictedRoles = ['banned', 'member'];
        if (restrictedRoles.includes(user.role.name)) {
            return res.status(403).json({
                success: false,
                message: 'Usuários com cargo "Member" não podem criar posts'
            });
        }

        // Adicionar informações do fórum na requisição
        req.forumInfo = forum;
        next();

    } catch (error) {
        console.error('Erro no middleware de permissão de fórum:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
};

// Middleware para verificar se o post não está bloqueado
const checkPostLocked = async (req, res, next) => {
    try {
        const { post_id } = req.body;

        if (!post_id) {
            return next(); // Se não há post_id, não é necessário verificar
        }

        const { data: post, error } = await supabase
            .from('gtracker_posts')
            .select('id, is_locked')
            .eq('id', post_id)
            .eq('is_active', true)
            .single();

        if (error || !post) {
            return res.status(404).json({
                success: false,
                message: 'Post não encontrado'
            });
        }

        if (post.is_locked) {
            return res.status(403).json({
                success: false,
                message: 'Este post está bloqueado para comentários'
            });
        }

        next();
    } catch (error) {
        console.error('Erro no middleware de verificação de post bloqueado:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
};

module.exports = {
    canPostInForum,
    checkPostLocked
};