// src/controllers/categoryController.js
const CategoryService = require('../services/categoryService');

class CategoryController {
    // Listar todas as categorias
    static async getAllCategories(req, res) {
        try {
            const { include_inactive = false } = req.query;
            const includeInactive = include_inactive === 'true';
            
            const result = await CategoryService.getAllCategories(includeInactive);
            
            const statusCode = result.success ? 200 : 500;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de categorias:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Criar categoria
    static async createCategory(req, res) {
        try {
            const userId = req.user.id;
            const result = await CategoryService.createCategory(req.body, userId);
            
            const statusCode = result.success ? 201 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de criação de categoria:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Atualizar categoria
    static async updateCategory(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            
            const result = await CategoryService.updateCategory(id, req.body, userId);
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de atualização de categoria:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Deletar categoria
    static async deleteCategory(req, res) {
        try {
            const { id } = req.params;
            
            const result = await CategoryService.deleteCategory(id);
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de exclusão de categoria:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = CategoryController;