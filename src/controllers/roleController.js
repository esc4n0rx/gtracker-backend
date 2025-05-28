const RoleService = require('../services/roleService');

class RoleController {
    // Listar todos os cargos
    static async getAllRoles(req, res) {
        try {
            const result = await RoleService.getAllRoles();
            
            const statusCode = result.success ? 200 : 500;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de cargos:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Alterar cargo de um usuário
    static async changeUserRole(req, res) {
        try {
            const { id: userId } = req.params;
            const { role_id: newRoleId } = req.body;
            const changedBy = req.user;

            if (!newRoleId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID do cargo é obrigatório'
                });
            }

            const result = await RoleService.changeUserRole(userId, newRoleId, changedBy);
            
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de alteração de cargo:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Buscar usuários por cargo
    static async getUsersByRole(req, res) {
        try {
            const { roleName } = req.params;

            const result = await RoleService.getUsersByRole(roleName);
            
            const statusCode = result.success ? 200 : 500;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de busca por cargo:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = RoleController;