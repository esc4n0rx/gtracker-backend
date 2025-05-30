// src/routes/levels.js
const express = require('express');
const LevelController = require('../controllers/levelController');
const { authenticateToken } = require('../middlewares/auth');
const { authorizeRole } = require('../middlewares/authorization');

const router = express.Router();

// GET /api/levels/my-level - Informações do nível do usuário atual
router.get('/my-level',
    authenticateToken,
    LevelController.getMyLevel
);

// GET /api/levels/ranking - Ranking de usuários por XP
router.get('/ranking',
    LevelController.getRanking
);

// GET /api/levels/all - Listar todos os níveis
router.get('/all',
    LevelController.getAllLevels
);

// GET /api/levels/user/:id - Informações de nível de um usuário específico
router.get('/user/:id',
    authenticateToken,
    LevelController.getUserLevel
);

// POST /api/levels/award-xp - Dar XP manualmente (Admin+)
router.post('/award-xp',
    authenticateToken,
    authorizeRole(90), // Admin ou Master
    LevelController.awardManualXP
);

module.exports = router;