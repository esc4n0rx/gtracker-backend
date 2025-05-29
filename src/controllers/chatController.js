// src/controllers/chatController.js
const ChatService = require('../services/chatService');

class ChatController {
    // Buscar mensagens do chat
    static async getMessages(req, res) {
        try {
            const { limit = 50, before } = req.query;
            const result = await ChatService.getChatMessages(
                parseInt(limit),
                before
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de chat:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Enviar mensagem (via HTTP para fallback)
    static async sendMessage(req, res) {
        try {
            const userId = req.user.id;
            const { content, reply_to } = req.body;

            const result = await ChatService.sendChatMessage(
                userId,
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

    // Deletar mensagem
    static async deleteMessage(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = await ChatService.deleteChatMessage(id, userId);

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro ao deletar mensagem:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = ChatController;