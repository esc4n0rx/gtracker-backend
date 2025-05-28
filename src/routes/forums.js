// src/routes/forums.js
const express = require('express');
const ForumController = require('../controllers/forumController');
const { validate } = require('../middlewares/validation');
const { forumSchema, updateForumSchema } = require('../utils/validators');
const { authenticateToken } = require('../middlewares/auth');
const { authorizeRole } = require('../middlewares/authorization');

const router = express.Router();

// GET /forums/:id - Buscar fórum por ID (público para usuários autenticados)
router.get('/:id',
    authenticateToken,
    ForumController.getForumById
);

// POST /forums - Criar fórum (Master e Admin apenas)
router.post('/',
    authenticateToken,
    authorizeRole(90), // Nível 90+ (Admin ou Master)
    validate(forumSchema),
    ForumController.createForum
);

// PATCH /forums/:id - Atualizar fórum (Master e Admin apenas)
router.patch('/:id',
    authenticateToken,
    authorizeRole(90),
    validate(updateForumSchema),
    ForumController.updateForum
);

// DELETE /forums/:id - Deletar fórum (Master e Admin apenas)
router.delete('/:id',
    authenticateToken,
    authorizeRole(90),
    ForumController.deleteForum
);

module.exports = router;