// src/routes/privateMessages.js
const express = require('express');
const PrivateMessageController = require('../controllers/privateMessageController');
const { validate } = require('../middlewares/validation');
const { privateMessageSchema } = require('../utils/validators');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// GET /messages/conversations - Buscar conversas
router.get('/conversations',
    authenticateToken,
    PrivateMessageController.getConversations
);

// GET /messages/conversations/:otherUserId - Buscar mensagens de uma conversa
router.get('/conversations/:otherUserId',
    authenticateToken,
    PrivateMessageController.getMessages
);

// POST /messages - Enviar mensagem privada
router.post('/',
    authenticateToken,
    validate(privateMessageSchema),
    PrivateMessageController.sendMessage
);

// PATCH /messages/:id/read - Marcar mensagem como lida
router.patch('/:id/read',
    authenticateToken,
    PrivateMessageController.markAsRead
);

// PATCH /messages/conversations/:otherUserId/read - Marcar conversa como lida
router.patch('/conversations/:otherUserId/read',
    authenticateToken,
    PrivateMessageController.markConversationAsRead
);

// GET /messages/unread-count - Contar mensagens não lidas
router.get('/unread-count',
    authenticateToken,
    PrivateMessageController.getUnreadCount
);

module.exports = router;