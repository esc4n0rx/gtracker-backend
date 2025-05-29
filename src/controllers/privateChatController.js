// src/controllers/privateChatController.js
const PrivateMessageService = require('../services/privateMessageService');
const UserService = require('../services/userService');

class PrivateChatController {
    // GET /private/getusers - Listar usuários para seleção
    static async getUsersForChat(req, res) {
        try {
            const { 
                page = 1, 
                limit = 100, 
                search = '' 
            } = req.query;

            const currentUserId = req.user.id;

            const result = await UserService.getUsersForChat(
                currentUserId,
                parseInt(page),
                parseInt(limit),
                search.trim()
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de usuários para chat:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao buscar usuários'
            });
        }
    }

    // POST /private/send - Enviar mensagem privada
    static async sendPrivateMessage(req, res) {
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
            console.error('Erro ao enviar mensagem privada:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao enviar mensagem'
            });
        }
    }

    // GET /private/receive/:otherUserId - Buscar mensagens de uma conversa
    static async getConversationMessages(req, res) {
        try {
            const userId = req.user.id;
            const { otherUserId } = req.params;
            const { 
                page = 1, 
                limit = 50, 
                before 
            } = req.query;

            // Validar se otherUserId é um UUID válido
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(otherUserId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID do usuário inválido'
                });
            }

            const result = await PrivateMessageService.getConversationMessages(
                userId,
                otherUserId,
                parseInt(page),
                parseInt(limit),
                before
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao buscar mensagens da conversa:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao buscar mensagens'
            });
        }
    }

    // PATCH /private/messages/:messageId/read - Marcar mensagem como lida
    static async markMessageAsRead(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;

            // Validar UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(messageId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID da mensagem inválido'
                });
            }

            const result = await PrivateMessageService.markMessageAsRead(messageId, userId);

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao marcar mensagem como lida:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // PATCH /private/conversations/:otherUserId/read - Marcar conversa como lida
    static async markConversationAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { otherUserId } = req.params;

            // Validar UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(otherUserId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID do usuário inválido'
                });
            }

            const result = await PrivateMessageService.markConversationAsRead(
                userId,
                otherUserId
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao marcar conversa como lida:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = PrivateChatController;