const supabase = require('../config/supabase');

class UserService {
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
                    total_xp,
                    current_level,
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
                    ),
                    gtracker_profiles!inner(
                        total_posts,
                        total_comments,
                        total_likes,
                        warnings,
                        avatar_url,
                        bio,
                        location,
                        website,
                        level_progress
                    ),
                    gtracker_levels!current_level(
                        level_number,
                        name,
                        min_xp,
                        max_xp,
                        emoji,
                        color,
                        is_legendary
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
                    total_xp: user.total_xp,
                    current_level: user.current_level,
                    level_info: user.gtracker_levels,
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
                    },
                    profile: {
                        ...user.gtracker_profiles,
                        level_progress: user.gtracker_profiles.level_progress
                    },
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

    static async getUserById(userId) {
        try {
            const { data: user, error } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    nickname,
                    nome,
                    created_at,
                    last_login,
                    gtracker_roles!inner(
                        id,
                        name,
                        display_name,
                        nivel,
                        color
                    ),
                    gtracker_profiles!inner(
                        total_posts,
                        total_comments,
                        total_likes,
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
                    nome: user.nome,
                    role: {
                        id: user.gtracker_roles.id,
                        name: user.gtracker_roles.name,
                        display_name: user.gtracker_roles.display_name,
                        nivel: user.gtracker_roles.nivel,
                        color: user.gtracker_roles.color
                    },
                    profile: user.gtracker_profiles,
                    created_at: user.created_at,
                    last_login: user.last_login
                }
            };

        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    static async getAllUsers(page = 1, limit = 20, roleFilter = null) {
        try {
            const offset = (page - 1) * limit;
            
            let query = supabase
                .from('gtracker_users')
                .select(`
                    id,
                    nickname,
                    nome,
                    email,
                    created_at,
                    last_login,
                    is_active,
                    gtracker_roles!inner(
                        id,
                        name,
                        display_name,
                        nivel,
                        color
                    ),
                    gtracker_profiles!inner(
                        total_posts,
                        total_comments,
                        total_likes
                    )
                `, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (roleFilter) {
                query = query.eq('gtracker_roles.name', roleFilter);
            }

            const { data: users, error, count } = await query;

            if (error) {
                throw new Error('Erro ao buscar usuários: ' + error.message);
            }

            return {
                success: true,
                data: {
                    users: users.map(user => ({
                        id: user.id,
                        nickname: user.nickname,
                        nome: user.nome,
                        email: user.email,
                        is_active: user.is_active,
                        role: {
                            id: user.gtracker_roles.id,
                            name: user.gtracker_roles.name,
                            display_name: user.gtracker_roles.display_name,
                            nivel: user.gtracker_roles.nivel,
                            color: user.gtracker_roles.color
                        },
                        stats: {
                            total_posts: user.gtracker_profiles.total_posts,
                            total_comments: user.gtracker_profiles.total_comments,
                            total_likes: user.gtracker_profiles.total_likes
                        },
                        created_at: user.created_at,
                        last_login: user.last_login
                    })),
                    pagination: {
                        page,
                        limit,
                        total: count,
                        totalPages: Math.ceil(count / limit)
                    }
                }
            };

        } catch (error) {
            console.error('Erro ao listar usuários:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }


    static async getUsersForChat(currentUserId, page = 1, limit = 100, search = '') {
        try {
            const offset = (page - 1) * limit;
            
            let query = supabase
                .from('gtracker_users')
                .select(`
                    id,
                    nickname,
                    nome,
                    gtracker_profiles!inner(avatar_url)
                `, { count: 'exact' })
                .eq('is_active', true)
                .neq('id', currentUserId) // Excluir o usuário atual
                .order('nickname', { ascending: true })
                .range(offset, offset + limit - 1);

            // Filtro de busca por nickname ou nome
            if (search && search.length > 0) {
                query = query.or(`nickname.ilike.%${search}%,nome.ilike.%${search}%`);
            }

            const { data: users, error, count } = await query;

            if (error) {
                throw new Error('Erro ao buscar usuários: ' + error.message);
            }

            // Formatar resposta
            const formattedUsers = users.map(user => ({
                id: user.id,
                nickname: user.nickname,
                nome: user.nome,
                gtracker_profiles: {
                    avatar_url: user.gtracker_profiles.avatar_url
                }
            }));

            return {
                success: true,
                message: 'Usuários listados com sucesso.',
                data: formattedUsers,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            console.error('Erro ao buscar usuários para chat:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    static async updateUserProfile(userId, updateData) {
        try {
            const { nome, nickname } = updateData;
            const updateFields = {};

            if (nome) updateFields.nome = nome;
            if (nickname) {
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
                   gtracker_roles!inner(name, display_name, nivel)
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