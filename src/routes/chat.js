// src/routes/chat.js
const express = require('express');
const ChatController = require('../controllers/chatController');
const { authenticateToken } = require('../middlewares/auth');
const { hasPermission } = require('../middlewares/authorization');

const router = express.Router();

// GET /chat/messages - Buscar mensagens do chat
router.get('/messages',
    authenticateToken,
    ChatController.getMessages
);

// POST /chat/messages - Enviar mensagem (fallback HTTP)
router.post('/messages',
    authenticateToken,
    hasPermission('pode_comentar'),
    ChatController.sendMessage
);

// DELETE /chat/messages/:id - Deletar mensagem
router.delete('/messages/:id',
    authenticateToken,
    ChatController.deleteMessage
);

module.exports = router;