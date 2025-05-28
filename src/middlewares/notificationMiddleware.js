// src/middlewares/notificationMiddleware.js
const NotificationService = require('../services/notificationService');

// Middleware para processar notificações em tempo real
const processNotifications = async (req, res, next) => {
    // Este middleware pode ser usado para integrar com WebSockets
    // ou Server-Sent Events para notificações em tempo real
    
    const originalJson = res.json;
    
    res.json = function(data) {
        // Se a resposta foi bem-sucedida e contém dados de notificação
        if (data.success && req.notificationTrigger) {
            // Aqui você pode adicionar lógica para WebSockets
            // Exemplo: io.to(userId).emit('notification', notificationData)
        }
        
        return originalJson.call(this, data);
    };
    
    next();
};

module.exports = {
    processNotifications
};