const UserService = require('../services/userService');

class UserController {
    // Buscar usuário por ID (com cargo)
    static async getUserById(req, res) {
        try {
            const { id } = req.params;
            const result = await UserService.getUserById(id);
            
            const statusCode = result.success ? 200 : 404;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de usuário:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Listar todos os usuários (apenas admins)
    static async getAllUsers(req, res) {
        try {
            const { page = 1, limit = 20, role } = req.query;
            const result = await UserService.getAllUsers(parseInt(page), parseInt(limit), role);
            
            const statusCode = result.success ? 200 : 500;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de listagem de usuários:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = UserController;