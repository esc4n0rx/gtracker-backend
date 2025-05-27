
const express = require('express');
const ProfileController = require('../controllers/profileController');
const { validate } = require('../middlewares/validation');
const { updateProfileSchema } = require('../utils/validators');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// GET /profile/me - Buscar perfil do usuário autenticado
router.get('/me',
    authenticateToken,
    ProfileController.getMyProfile
);

// PATCH /profile/update - Atualizar perfil do usuário autenticado
router.patch('/update',
    authenticateToken,
    validate(updateProfileSchema),
    ProfileController.updateProfile
);

module.exports = router;