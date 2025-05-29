// src/controllers/privateMessageController.js
const PrivateMessageService = require('../services/privateMessageService');

class PrivateMessageController {
    // Buscar conversas do usuário
    static async getConversations(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20 } = req.query;

            const result = await PrivateMessageService.getUserConversations(
                userId,
                parseInt(page),
                parseInt(limit)
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao buscar conversas:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Buscar mensagens de uma conversa
    static async getMessages(req, res) {
        try {
            const userId = req.user.id;
            const { otherUserId } = req.params;
            const { page = 1, limit = 50 } = req.query;

            const result = await PrivateMessageService.getConversationMessages(
                userId,
                otherUserId,
                parseInt(page),
                parseInt(limit)
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao buscar mensagens:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Enviar mensagem privada
    static async sendMessage(req, res) {
        try {
            const senderId = req.user.id;
            const { recipient_id, content, reply_to } = req.body;

            const result = await PrivateMessageService.sendPrivateMessage(
                senderId,
                recipient_id,
                content,
                reply_to
            );

            const statusCode = result.success ? 201 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Marcar mensagem como lida
    static async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = await PrivateMessageService.markMessageAsRead(id, userId);

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao marcar como lida:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Marcar conversa como lida
    static async markConversationAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { otherUserId } = req.params;

            const result = await PrivateMessageService.markConversationAsRead(
                userId,
                otherUserId
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao marcar conversa:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Contar mensagens não lidas
    static async getUnreadCount(req, res) {
        try {
            const userId = req.user.id;
            const result = await PrivateMessageService.getUnreadCount(userId);

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao contar mensagens:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = PrivateMessageController;