
const { verifyToken } = require('../utils/jwt');
const supabase = require('../config/supabase');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token de acesso requerido'
            });
        }

        const decoded = verifyToken(token);
        
        // Verificar se o usuário ainda existe e está ativo
        const { data: user, error } = await supabase
            .from('gtracker_users')
            .select(`
                id,
                nickname,
                email,
                nome,
                is_active,
                role_id,
                gtracker_roles!inner(name, display_name, level, permissions)
            `)
            .eq('id', decoded.userId)
            .eq('is_active', true)
            .single();

        if (error || !user) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido ou usuário inativo'
            });
        }

        req.user = {
            id: user.id,
            nickname: user.nickname,
            email: user.email,
            nome: user.nome,
            role: user.gtracker_roles
        };

        next();
    } catch (error) {
        console.error('Erro na autenticação:', error);
        return res.status(401).json({
            success: false,
            message: 'Token inválido'
        });
    }
};

module.exports = {
    authenticateToken
};