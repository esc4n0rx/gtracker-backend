
const UserService = require('../services/userService');

class ProfileController {
    // Buscar perfil do usuário autenticado
    static async getMyProfile(req, res) {
        try {
            const userId = req.user.id;
            const result = await UserService.getUserProfile(userId);
            
            const statusCode = result.success ? 200 : 404;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de perfil:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Atualizar perfil do usuário autenticado
    static async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const result = await UserService.updateUserProfile(userId, req.body);
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de atualização de perfil:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = ProfileController;