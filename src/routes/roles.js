const express = require('express');
const RoleController = require('../controllers/roleController');
const { authenticateToken } = require('../middlewares/auth');
const { authorizeRole, canManageUserRole } = require('../middlewares/authorization');

const router = express.Router();

// GET /roles - Listar todos os cargos (usuários autenticados)
router.get('/',
    authenticateToken,
    RoleController.getAllRoles
);

// PATCH /roles/users/:id/role - Alterar cargo de um usuário (Admin+ apenas)
router.patch('/users/:id/role',
    authenticateToken,
    authorizeRole(90), // Nível 90+ (Admin ou Master)
    canManageUserRole,
    RoleController.changeUserRole
);

// GET /roles/:roleName/users - Buscar usuários por cargo (Admin+ apenas)
router.get('/:roleName/users',
    authenticateToken,
    authorizeRole(90),
    RoleController.getUsersByRole
);

module.exports = router;