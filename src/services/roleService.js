const supabase = require('../config/supabase');

class RoleService {
    // Buscar todos os cargos disponíveis
    static async getAllRoles() {
        try {
            const { data: roles, error } = await supabase
                .from('gtracker_roles')
                .select('*')
                .eq('is_active', true)
                .order('nivel', { ascending: false });

            if (error) {
                throw new Error('Erro ao buscar cargos: ' + error.message);
            }

            return {
                success: true,
                data: roles
            };
        } catch (error) {
            console.error('Erro ao buscar cargos:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Buscar cargo por ID
    static async getRoleById(roleId) {
        try {
            const { data: role, error } = await supabase
                .from('gtracker_roles')
                .select('*')
                .eq('id', roleId)
                .eq('is_active', true)
                .single();

            if (error || !role) {
                return {
                    success: false,
                    message: 'Cargo não encontrado'
                };
            }

            return {
                success: true,
                data: role
            };
        } catch (error) {
            console.error('Erro ao buscar cargo:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Alterar cargo de um usuário
    static async changeUserRole(userId, newRoleId, changedBy) {
        try {
            // Verificar se o novo cargo existe e está ativo
            const roleCheck = await this.getRoleById(newRoleId);
            if (!roleCheck.success) {
                return roleCheck;
            }

            const newRole = roleCheck.data;

            // Verificar se quem está alterando tem nível suficiente
            if (changedBy.role.nivel <= newRole.nivel && changedBy.role.name !== 'master') {
                return {
                    success: false,
                    message: 'Você não pode promover usuários para cargos de nível igual ou superior ao seu'
                };
            }

            // Atualizar o cargo do usuário
            const { data: updatedUser, error: updateError } = await supabase
                .from('gtracker_users')
                .update({ 
                    role_id: newRoleId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select(`
                    id,
                    nickname,
                    nome,
                    email,
                    gtracker_roles!inner(id, name, display_name, nivel, color)
                `)
                .single();

            if (updateError) {
                throw new Error('Erro ao atualizar cargo: ' + updateError.message);
            }

            // Registrar a mudança de cargo (para auditoria)
            await this.logRoleChange(userId, changedBy.id, newRoleId);

            return {
                success: true,
                message: 'Cargo alterado com sucesso',
                data: {
                    user: {
                        id: updatedUser.id,
                        nickname: updatedUser.nickname,
                        nome: updatedUser.nome,
                        email: updatedUser.email,
                        role: updatedUser.gtracker_roles
                    }
                }
            };
        } catch (error) {
            console.error('Erro ao alterar cargo:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Registrar mudança de cargo para auditoria
    static async logRoleChange(userId, changedBy, newRoleId) {
        try {
            // Criar tabela de logs se não existir
            await supabase.rpc('create_role_change_log_if_not_exists');

            const { error } = await supabase
                .from('gtracker_role_changes')
                .insert({
                    user_id: userId,
                    changed_by: changedBy,
                    new_role_id: newRoleId,
                    changed_at: new Date().toISOString()
                });

            if (error) {
                console.error('Erro ao registrar log de mudança de cargo:', error);
            }
        } catch (error) {
            console.error('Erro no log de mudança de cargo:', error);
        }
    }

    // Buscar usuários com um cargo específico
    static async getUsersByRole(roleName) {
        try {
            const { data: users, error } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    nickname,
                    nome,
                    email,
                    created_at,
                    last_login,
                    gtracker_roles!inner(name, display_name, nivel, color)
                `)
                .eq('gtracker_roles.name', roleName)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) {
                throw new Error('Erro ao buscar usuários por cargo: ' + error.message);
            }

            return {
                success: true,
                data: users
            };
        } catch (error) {
            console.error('Erro ao buscar usuários por cargo:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }
}

module.exports = RoleService;