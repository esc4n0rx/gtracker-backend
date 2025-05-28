// src/routes/notifications.js
const express = require('express');
const NotificationController = require('../controllers/notificationController');
const { validate } = require('../middlewares/validation');
const { notificationSettingsSchema } = require('../utils/validators');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// GET /notifications - Buscar notificações do usuário
router.get('/',
    authenticateToken,
    NotificationController.getNotifications
);

// GET /notifications/unread-count - Contar notificações não lidas
router.get('/unread-count',
    authenticateToken,
    NotificationController.getUnreadCount
);

// PATCH /notifications/:id/read - Marcar notificação como lida
router.patch('/:id/read',
    authenticateToken,
    NotificationController.markAsRead
);

// PATCH /notifications/mark-all-read - Marcar todas como lidas
router.patch('/mark-all-read',
    authenticateToken,
    NotificationController.markAllAsRead
);

// GET /notifications/settings - Buscar configurações
router.get('/settings',
    authenticateToken,
    NotificationController.getSettings
);

// PATCH /notifications/settings - Atualizar configurações
router.patch('/settings',
    authenticateToken,
    validate(notificationSettingsSchema),
    NotificationController.updateSettings
);

module.exports = router;