// src/controllers/forumController.js
const ForumService = require('../services/forumService');

class ForumController {
    // Criar fórum
    static async createForum(req, res) {
        try {
            const userId = req.user.id;
            const result = await ForumService.createForum(req.body, userId);
            
            const statusCode = result.success ? 201 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de criação de fórum:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Buscar fórum por ID
    static async getForumById(req, res) {
        try {
            const { id } = req.params;
            const result = await ForumService.getForumById(id);
            
            const statusCode = result.success ? 200 : 404;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de busca de fórum:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Atualizar fórum
    static async updateForum(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            
            const result = await ForumService.updateForum(id, req.body, userId);
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de atualização de fórum:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Deletar fórum
    static async deleteForum(req, res) {
        try {
            const { id } = req.params;
            
            const result = await ForumService.deleteForum(id);
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de exclusão de fórum:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = ForumController;