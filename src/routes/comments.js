// src/routes/comments.js (versão atualizada)
const express = require('express');
const CommentController = require('../controllers/commentController');
const { validate } = require('../middlewares/validation');
const { commentSchema, updateCommentSchema } = require('../utils/validators');
const { authenticateToken } = require('../middlewares/auth');
const { hasPermission } = require('../middlewares/authorization');
const { checkPostLocked } = require('../middlewares/postPermissions');

const router = express.Router();

// GET /comments/post/:postId - Listar comentários de um post
router.get('/post/:postId', CommentController.getCommentsByPost);

// POST /comments - Criar comentário
router.post('/',
    authenticateToken,
    hasPermission('pode_comentar'),
    validate(commentSchema),
    checkPostLocked,
    CommentController.createComment
);

// PATCH /comments/:id - Atualizar comentário
router.patch('/:id',
    authenticateToken,
    validate(updateCommentSchema),
    CommentController.updateComment
);

// DELETE /comments/:id - Deletar comentário
router.delete('/:id',
    authenticateToken,
    CommentController.deleteComment
);

// POST /comments/:id/like - Curtir/descurtir comentário
router.post('/:id/like',
    authenticateToken,
    hasPermission('pode_curtir'),
    CommentController.toggleLike
);

module.exports = router;