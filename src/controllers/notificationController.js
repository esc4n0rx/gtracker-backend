// src/controllers/notificationController.js
const NotificationService = require('../services/notificationService');

class NotificationController {
    // Buscar notificações do usuário
    static async getNotifications(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20, unread_only = false } = req.query;

            const result = await NotificationService.getUserNotifications(
                userId,
                parseInt(page),
                parseInt(limit),
                unread_only === 'true'
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de notificações:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Contar notificações não lidas
    static async getUnreadCount(req, res) {
        try {
            const userId = req.user.id;
            const result = await NotificationService.getUnreadCount(userId);

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de contagem:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Marcar notificação como lida
    static async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = await NotificationService.markAsRead(id, userId);

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao marcar notificação:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Marcar todas as notificações como lidas
    static async markAllAsRead(req, res) {
        try {
            const userId = req.user.id;
            const result = await NotificationService.markAllAsRead(userId);

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao marcar todas as notificações:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Buscar configurações de notificação
    static async getSettings(req, res) {
        try {
            const userId = req.user.id;
            const settings = await NotificationService.getUserNotificationSettings(userId);

            if (!settings) {
                return res.status(500).json({
                    success: false,
                    message: 'Erro ao buscar configurações'
                });
            }

            return res.json({
                success: true,
                data: settings
            });

        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Atualizar configurações de notificação
    static async updateSettings(req, res) {
        try {
            const userId = req.user.id;
            const result = await NotificationService.updateNotificationSettings(userId, req.body);

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao atualizar configurações:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = NotificationController;