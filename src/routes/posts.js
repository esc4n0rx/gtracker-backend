// src/routes/posts.js (versão atualizada)
const express = require('express');
const PostController = require('../controllers/postController');
const { validate } = require('../middlewares/validation');
const { postSchema, updatePostSchema, movePostSchema } = require('../utils/validators');
const { authenticateToken } = require('../middlewares/auth');
const { hasPermission } = require('../middlewares/authorization');
const { canPostInForum } = require('../middlewares/postPermissions');

const router = express.Router();

// GET /posts/templates - Obter templates disponíveis
router.get('/templates', PostController.getPostTemplates);

// GET /posts/forum/:forumId - Listar posts de um fórum
router.get('/forum/:forumId', PostController.getPostsByForum);

// GET /posts/:slug - Buscar post por slug
router.get('/:slug', PostController.getPostBySlug);

// POST /posts - Criar post (usuários com permissão)
router.post('/',
    authenticateToken,
    validate(postSchema),
    canPostInForum,
    PostController.createPost
);

// PATCH /posts/:id - Atualizar post
router.patch('/:id',
    authenticateToken,
    validate(updatePostSchema),
    PostController.updatePost
);

// DELETE /posts/:id - Deletar post
router.delete('/:id',
    authenticateToken,
    PostController.deletePost
);

// POST /posts/:id/like - Curtir/descurtir post
router.post('/:id/like',
    authenticateToken,
    hasPermission('pode_curtir'),
    PostController.toggleLike
);

// PATCH /posts/:id/move - Mover post (moderadores+)
router.patch('/:id/move',
    authenticateToken,
    hasPermission('pode_mover_topicos'),
    validate(movePostSchema),
    PostController.movePost
);

module.exports = router;