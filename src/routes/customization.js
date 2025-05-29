// src/routes/customization.js
const express = require('express');
const CustomizationController = require('../controllers/customizationController');
const { validate } = require('../middlewares/validation');
const { profileCustomizationSchema } = require('../utils/validators');
const { authenticateToken } = require('../middlewares/auth');
const { 
    uploadAvatar, 
    uploadCover, 
    processAvatarUpload, 
    processCoverUpload,
    handleMulterError 
} = require('../middlewares/avatarUpload');

const router = express.Router();

// POST /customization/avatar - Upload de avatar
router.post('/avatar',
    authenticateToken,
    uploadAvatar,
    handleMulterError, // Adicionar tratamento de erro
    processAvatarUpload,
    CustomizationController.uploadAvatar
);

// POST /customization/cover - Upload de imagem de capa
router.post('/cover',
    authenticateToken,
    uploadCover,
    handleMulterError, // Adicionar tratamento de erro
    processCoverUpload,
    CustomizationController.uploadCover
);

// PATCH /customization/profile - Atualizar customizações do perfil
router.patch('/profile',
    authenticateToken,
    validate(profileCustomizationSchema),
    CustomizationController.updateCustomization
);

// GET /customization/stats - Buscar estatísticas do usuário
router.get('/stats',
    authenticateToken,
    CustomizationController.getUserStats
);

// DELETE /customization/avatar - Remover avatar
router.delete('/avatar',
    authenticateToken,
    CustomizationController.removeAvatar
);

// DELETE /customization/cover - Remover imagem de capa
router.delete('/cover',
    authenticateToken,
    CustomizationController.removeCover
);

module.exports = router;