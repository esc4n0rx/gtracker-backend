const express = require('express');
const UserController = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/auth');
const { authorizeRole } = require('../middlewares/authorization');

const router = express.Router();

// GET /users/:id - Buscar usuário por ID (público para usuários autenticados)
router.get('/:id',
    authenticateToken,
    UserController.getUserById
);

// GET /users - Listar usuários (Admin+ apenas)
router.get('/',
    authenticateToken,
    authorizeRole(90), // Nível 90+ (Admin ou Master)
    UserController.getAllUsers
);

module.exports = router;