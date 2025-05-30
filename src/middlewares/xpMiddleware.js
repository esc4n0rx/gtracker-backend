// src/middlewares/xpMiddleware.js
const LevelService = require('../services/levelService');

// Middleware para processar XP após ações
const processXPGain = (actionType) => {
    return async (req, res, next) => {
        const originalJson = res.json;
        
        res.json = function(data) {
            // Se a resposta foi bem-sucedida, processar XP
            if (data.success && req.user) {
                setImmediate(async () => {
                    try {
                        let xpResult;
                        const userId = req.user.id;
                        
                        switch (actionType) {
                            case 'post_created':
                                if (data.data && data.data.id) {
                                    xpResult = await LevelService.awardPostCreated(userId, data.data.id);
                                }
                                break;
                                
                            case 'comment_created':
                                if (data.data && data.data.id && data.data.post_id) {
                                    xpResult = await LevelService.awardCommentCreated(
                                        userId, 
                                        data.data.post_id, 
                                        data.data.id
                                    );
                                }
                                break;
                        }
                        
                        // Se houve level up, notificar via socket
                        if (xpResult && xpResult.success && xpResult.data.level_up && global.socketManager) {
                            global.socketManager.sendNotificationToUser(userId, {
                               type: 'level_up',
                               title: '🎉 Parabéns! Você subiu de nível!',
                               message: `Você alcançou o nível ${xpResult.data.new_level}!`,
                               data: xpResult.data
                           });
                       }
                       
                   } catch (error) {
                       console.error('Erro ao processar XP:', error);
                   }
               });
           }
           
           return originalJson.call(this, data);
       };
       
       next();
   };
};

module.exports = {
   processXPGain
};