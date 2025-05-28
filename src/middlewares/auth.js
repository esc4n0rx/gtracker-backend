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
        
        // Verificar se o usuário ainda existe e está ativo, incluindo dados completos do cargo
        const { data: user, error } = await supabase
            .from('gtracker_users')
            .select(`
                id,
                nickname,
                email,
                nome,
                is_active,
                role_id,
                gtracker_roles!inner(
                    id,
                    name,
                    display_name,
                    nivel,
                    color,
                    pode_postar,
                    pode_comentar,
                    pode_curtir,
                    pode_criar_topicos,
                    pode_upload,
                    pode_moderar,
                    pode_editar_posts_outros,
                    pode_deletar_posts_outros,
                    pode_banir_usuarios,
                    pode_mover_topicos,
                    pode_fechar_topicos,
                    acesso_admin,
                    pode_gerenciar_usuarios,
                    pode_gerenciar_cargos,
                    pode_ver_logs,
                    pode_configurar_forum
                )
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

        // Estruturar dados do usuário com permissões
        req.user = {
            id: user.id,
            nickname: user.nickname,
            email: user.email,
            nome: user.nome,
            role: {
                id: user.gtracker_roles.id,
                name: user.gtracker_roles.name,
                display_name: user.gtracker_roles.display_name,
                nivel: user.gtracker_roles.nivel,
                color: user.gtracker_roles.color,
                permissions: {
                    pode_postar: user.gtracker_roles.pode_postar,
                    pode_comentar: user.gtracker_roles.pode_comentar,
                    pode_curtir: user.gtracker_roles.pode_curtir,
                    pode_criar_topicos: user.gtracker_roles.pode_criar_topicos,
                    pode_upload: user.gtracker_roles.pode_upload,
                    pode_moderar: user.gtracker_roles.pode_moderar,
                    pode_editar_posts_outros: user.gtracker_roles.pode_editar_posts_outros,
                    pode_deletar_posts_outros: user.gtracker_roles.pode_deletar_posts_outros,
                    pode_banir_usuarios: user.gtracker_roles.pode_banir_usuarios,
                    pode_mover_topicos: user.gtracker_roles.pode_mover_topicos,
                    pode_fechar_topicos: user.gtracker_roles.pode_fechar_topicos,
                    acesso_admin: user.gtracker_roles.acesso_admin,
                    pode_gerenciar_usuarios: user.gtracker_roles.pode_gerenciar_usuarios,
                    pode_gerenciar_cargos: user.gtracker_roles.pode_gerenciar_cargos,
                    pode_ver_logs: user.gtracker_roles.pode_ver_logs,
                    pode_configurar_forum: user.gtracker_roles.pode_configurar_forum
                }
            }
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