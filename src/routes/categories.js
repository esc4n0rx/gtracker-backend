// src/routes/categories.js (continuação)
const express = require('express');
const CategoryController = require('../controllers/categoryController');
const { validate } = require('../middlewares/validation');
const { categorySchema, updateCategorySchema } = require('../utils/validators');
const { authenticateToken } = require('../middlewares/auth');
const { authorizeRole } = require('../middlewares/authorization');

const router = express.Router();

// GET /categories - Listar todas as categorias (público para usuários autenticados)
router.get('/',
    authenticateToken,
    CategoryController.getAllCategories
);

// POST /categories - Criar categoria (Master e Admin apenas)
router.post('/',
    authenticateToken,
    authorizeRole(90), // Nível 90+ (Admin ou Master)
    validate(categorySchema),
    CategoryController.createCategory
);

// PATCH /categories/:id - Atualizar categoria (Master e Admin apenas)
router.patch('/:id',
    authenticateToken,
    authorizeRole(90),
    validate(updateCategorySchema),
    CategoryController.updateCategory
);

// DELETE /categories/:id - Deletar categoria (Master e Admin apenas)
router.delete('/:id',
    authenticateToken,
    authorizeRole(90),
    CategoryController.deleteCategory
);

module.exports = router;