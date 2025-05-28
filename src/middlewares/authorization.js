const supabase = require('../config/supabase');

// Middleware para verificar nível mínimo do cargo
const authorizeRole = (nivelMinimo) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.role) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado: cargo não encontrado'
                });
            }

            if (req.user.role.nivel < nivelMinimo) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado: nível de cargo insuficiente'
                });
            }

            next();
        } catch (error) {
            console.error('Erro no middleware de autorização:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    };
};

// Middleware para verificar acesso administrativo
const isAdmin = () => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.role) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado: cargo não encontrado'
                });
            }

            if (!req.user.role.permissions || !req.user.role.permissions.acesso_admin) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado: privilégios administrativos requeridos'
                });
            }

            next();
        } catch (error) {
            console.error('Erro no middleware de admin:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    };
};

// Middleware para verificar permissão específica
const hasPermission = (permissao) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.role || !req.user.role.permissions) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado: permissões não encontradas'
                });
            }

            if (!req.user.role.permissions[permissao]) {
                return res.status(403).json({
                    success: false,
                    message: `Acesso negado: permissão '${permissao}' requerida`
                });
            }

            next();
        } catch (error) {
            console.error('Erro no middleware de permissão:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    };
};

// Middleware para verificar se o usuário pode alterar cargo de outro usuário
const canManageUserRole = async (req, res, next) => {
    try {
        const { id: targetUserId } = req.params;
        const currentUser = req.user;

        // Master pode alterar qualquer cargo
        if (currentUser.role.name === 'master') {
            return next();
        }

        // Buscar dados do usuário alvo
        const { data: targetUser, error } = await supabase
            .from('gtracker_users')
            .select(`
                id,
                role_id,
                gtracker_roles!inner(name, display_name, nivel)
            `)
            .eq('id', targetUserId)
            .single();

        if (error || !targetUser) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        // Usuário não pode alterar o próprio cargo (exceto Master)
        if (targetUserId === currentUser.id) {
            return res.status(403).json({
                success: false,
                message: 'Você não pode alterar seu próprio cargo'
            });
        }

        // Usuário não pode alterar cargo de alguém com nível igual ou superior
        if (targetUser.gtracker_roles.nivel >= currentUser.role.nivel) {
            return res.status(403).json({
                success: false,
                message: 'Você não pode alterar o cargo de usuários com nível igual ou superior'
            });
        }

        // Adicionar dados do usuário alvo na requisição
        req.targetUser = targetUser;
        next();
    } catch (error) {
        console.error('Erro no middleware de gerenciamento de cargo:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
};

module.exports = {
    authorizeRole,
    isAdmin,
    hasPermission,
    canManageUserRole
};