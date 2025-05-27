
const supabase = require('../config/supabase');

class UserService {
    // Buscar perfil completo do usuário
    static async getUserProfile(userId) {
        try {
            const { data: user, error } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    nickname,
                    email,
                    nome,
                    created_at,
                    last_login,
                    gtracker_roles!inner(name, display_name, level),
                    gtracker_profiles!inner(
                        total_posts,
                        total_comments,
                        total_likes,
                        warnings,
                        avatar_url,
                        bio,
                        location,
                        website
                    )
                `)
                .eq('id', userId)
                .eq('is_active', true)
                .single();

            if (error || !user) {
                return {
                    success: false,
                    message: 'Usuário não encontrado'
                };
            }

            return {
                success: true,
                data: {
                    id: user.id,
                    nickname: user.nickname,
                    email: user.email,
                    nome: user.nome,
                    role: user.gtracker_roles,
                    profile: user.gtracker_profiles,
                    created_at: user.created_at,
                    last_login: user.last_login
                }
            };

        } catch (error) {
            console.error('Erro ao buscar perfil:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Atualizar perfil do usuário
    static async updateUserProfile(userId, updateData) {
        try {
            const { nome, nickname } = updateData;
            const updateFields = {};

            if (nome) updateFields.nome = nome;
            if (nickname) {
                // Verificar se nickname já está em uso por outro usuário
                const { data: existingUser, error: checkError } = await supabase
                    .from('gtracker_users')
                    .select('id')
                    .eq('nickname', nickname)
                    .neq('id', userId)
                    .single();

                if (checkError && checkError.code !== 'PGRST116') {
                    throw new Error('Erro ao verificar nickname: ' + checkError.message);
                }

                if (existingUser) {
                    return {
                        success: false,
                        message: 'Nickname já está em uso'
                    };
                }

                updateFields.nickname = nickname;
            }

            if (Object.keys(updateFields).length === 0) {
                return {
                    success: false,
                    message: 'Nenhum dado para atualizar'
                };
            }

            const { data: updatedUser, error: updateError } = await supabase
               .from('gtracker_users')
               .update(updateFields)
               .eq('id', userId)
               .select(`
                   id,
                   nickname,
                   nome,
                   email,
                   gtracker_roles!inner(name, display_name, level)
               `)
               .single();

           if (updateError) {
               throw new Error('Erro ao atualizar usuário: ' + updateError.message);
           }

           return {
               success: true,
               message: 'Perfil atualizado com sucesso',
               data: {
                   id: updatedUser.id,
                   nickname: updatedUser.nickname,
                   nome: updatedUser.nome,
                   email: updatedUser.email,
                   role: updatedUser.gtracker_roles
               }
           };

       } catch (error) {
           console.error('Erro ao atualizar perfil:', error);
           return {
               success: false,
               message: 'Erro interno do servidor'
           };
       }
   }
}

module.exports = UserService;