// src/routes/privateChat.js
const express = require('express');
const PrivateChatController = require('../controllers/privateChatController');
const { validate } = require('../middlewares/validation');
const { privateMessageSchema } = require('../utils/validators');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// GET /private/getusers - Listar usuários para seleção (dropdown)
router.get('/getusers',
    authenticateToken,
    PrivateChatController.getUsersForChat
);

// POST /private/send - Enviar mensagem privada
router.post('/send',
    authenticateToken,
    validate(privateMessageSchema),
    PrivateChatController.sendPrivateMessage
);

// GET /private/receive/:otherUserId - Listar mensagens de uma conversa
router.get('/receive/:otherUserId',
    authenticateToken,
    PrivateChatController.getConversationMessages
);

// PATCH /private/messages/:messageId/read - Marcar mensagem específica como lida
router.patch('/messages/:messageId/read',
    authenticateToken,
    PrivateChatController.markMessageAsRead
);

// PATCH /private/conversations/:otherUserId/read - Marcar conversa como lida
router.patch('/conversations/:otherUserId/read',
    authenticateToken,
    PrivateChatController.markConversationAsRead
);

module.exports = router;