
const AuthService = require('../services/authService');

class AuthController {
    // Registro de usuário
    static async register(req, res) {
        try {
            const result = await AuthService.registerUser(req.body);
            
            const statusCode = result.success ? 201 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de registro:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Login de usuário
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            const ip = req.ip;

            const result = await AuthService.loginUser(email, password, ip);
            
            const statusCode = result.success ? 200 : 401;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de login:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Verificar token (opcional, para debug)
    static async verifyToken(req, res) {
        try {
            return res.json({
                success: true,
                message: 'Token válido',
                data: {
                    user: req.user
                }
            });
        } catch (error) {
            console.error('Erro na verificação de token:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = AuthController;