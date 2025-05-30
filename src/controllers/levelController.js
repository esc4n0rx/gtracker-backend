// src/controllers/levelController.js
const LevelService = require('../services/levelService');

class LevelController {
    // GET /api/levels/my-level - Informações do nível do usuário atual
    static async getMyLevel(req, res) {
        try {
            const userId = req.user.id;
            const result = await LevelService.getUserLevelInfo(userId);

            const statusCode = result.success ? 200 : 404;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de nível:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // GET /api/levels/ranking - Ranking de usuários por XP
    static async getRanking(req, res) {
        try {
            const { page = 1, limit = 50 } = req.query;

            const result = await LevelService.getXPRanking(
                parseInt(page),
                parseInt(limit)
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de ranking:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // GET /api/levels/all - Listar todos os níveis
    static async getAllLevels(req, res) {
        try {
            const result = await LevelService.getAllLevels();

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de níveis:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // GET /api/levels/user/:id - Informações de nível de um usuário específico
    static async getUserLevel(req, res) {
        try {
            const { id } = req.params;
            const result = await LevelService.getUserLevelInfo(id);

            const statusCode = result.success ? 200 : 404;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de nível de usuário:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // POST /api/levels/award-xp - Endpoint administrativo para dar XP manualmente
    static async awardManualXP(req, res) {
        try {
            const { user_id, xp_amount, reason } = req.body;

            if (!user_id || !xp_amount || !reason) {
                return res.status(400).json({
                    success: false,
                    message: 'user_id, xp_amount e reason são obrigatórios'
                });
            }

            const result = await LevelService.addUserXP(
                user_id,
                'manual_award',
                parseInt(xp_amount),
                { 
                    awarded_by: req.user.id,
                    reason: reason,
                    manual: true
                }
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao dar XP manual:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = LevelController;