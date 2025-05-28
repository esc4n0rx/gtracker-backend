// src/controllers/postController.js
const PostService = require('../services/postService');

class PostController {
    // Criar post
    static async createPost(req, res) {
        try {
            const userId = req.user.id;
            const result = await PostService.createPost(req.body, userId);
            
            const statusCode = result.success ? 201 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de criação de post:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Listar posts por fórum
    static async getPostsByForum(req, res) {
        try {
            const { forumId } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const userId = req.user ? req.user.id : null;

            const result = await PostService.getPostsByForum(
                forumId, 
                parseInt(page), 
                parseInt(limit),
                userId
            );
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de listagem de posts:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Buscar post por slug
    static async getPostBySlug(req, res) {
        try {
            const { slug } = req.params;
            const userId = req.user ? req.user.id : null;

            const result = await PostService.getPostBySlug(slug, userId);
            
            const statusCode = result.success ? 200 : 404;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de busca de post:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Atualizar post
    static async updatePost(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = await PostService.updatePost(id, req.body, userId);
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de atualização de post:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Deletar post
    static async deletePost(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = await PostService.deletePost(id, userId);
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de exclusão de post:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Mover post
    static async movePost(req, res) {
        try {
            const { id } = req.params;
            const { forum_id: newForumId, reason } = req.body;
            const userId = req.user.id;

            if (!newForumId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID do fórum de destino é obrigatório'
                });
            }

            const result = await PostService.movePost(id, newForumId, userId, reason);
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de movimentação de post:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Toggle like no post
    static async toggleLike(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = await PostService.togglePostLike(id, userId);
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de like de post:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Obter templates disponíveis
    static async getPostTemplates(req, res) {
        try {
            const templates = require('../../templatefile.json').templates;
            
            return res.json({
                success: true,
                data: templates
            });
        } catch (error) {
            console.error('Erro ao buscar templates:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = PostController;