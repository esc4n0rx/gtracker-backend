// src/controllers/commentController.js
const CommentService = require('../services/commentService');

class CommentController {
    // Criar comentário
    static async createComment(req, res) {
        try {
            const userId = req.user.id;
            const result = await CommentService.createComment(req.body, userId);
            
            const statusCode = result.success ? 201 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de criação de comentário:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Listar comentários de um post
    static async getCommentsByPost(req, res) {
        try {
            const { postId } = req.params;
            const { page = 1, limit = 50 } = req.query;
            const userId = req.user ? req.user.id : null;

            const result = await CommentService.getCommentsByPost(
                postId,
                parseInt(page),
                parseInt(limit),
                userId
            );
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de listagem de comentários:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Atualizar comentário
    static async updateComment(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = await CommentService.updateComment(id, req.body, userId);
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de atualização de comentário:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Deletar comentário
    static async deleteComment(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = await CommentService.deleteComment(id, userId);
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de exclusão de comentário:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Toggle like em comentário
    static async toggleLike(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = await CommentService.toggleCommentLike(id, userId);
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de like de comentário:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = CommentController;