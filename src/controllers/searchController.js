// src/controllers/searchController.js
const SearchService = require('../services/searchService');

class SearchController {
    // Buscar posts
    static async searchPosts(req, res) {
        try {
            const { 
                q: query, 
                page = 1, 
                limit = 20,
                forum_id,
                category_id,
                post_type,
                author_id,
                date_from,
                date_to
            } = req.query;

            const filters = {
                forum_id,
                category_id,
                post_type,
                author_id,
                date_from,
                date_to
            };

            const result = await SearchService.searchPosts(
                query,
                filters,
                parseInt(page),
                parseInt(limit)
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de busca:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Posts recentes
    static async getRecentPosts(req, res) {
        try {
            const { limit = 10 } = req.query;

            const result = await SearchService.getRecentPosts(parseInt(limit));

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de posts recentes:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Posts populares
    static async getPopularPosts(req, res) {
        try {
            const { period = '7d', limit = 10 } = req.query;

            const result = await SearchService.getPopularPosts(period, parseInt(limit));

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de posts populares:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = SearchController;