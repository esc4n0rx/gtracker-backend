
const express = require('express');
const AuthController = require('../controllers/authController');
const { validate } = require('../middlewares/validation');
const { registerSchema, loginSchema } = require('../utils/validators');
const { loginLimiter, bruteForceProtection } = require('../middlewares/rateLimiter');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// POST /auth/register - Registro de usuário
router.post('/register', 
    validate(registerSchema),
    AuthController.register
);

// POST /auth/login - Login de usuário
router.post('/login',
    loginLimiter,
    bruteForceProtection,
    validate(loginSchema),
    AuthController.login
);

// GET /auth/verify - Verificar token (opcional, para debug)
router.get('/verify',
    authenticateToken,
    AuthController.verifyToken
);

module.exports = router;