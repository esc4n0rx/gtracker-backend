// src/services/postService.js
const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const NotificationService = require('./notificationService');

class PostService {
    // Verificar se usuário pode criar posts
    static async canUserCreatePost(user) {
        // Usuários banned ou members básicos não podem criar posts
        const restrictedRoles = ['banned', 'member'];
        return !restrictedRoles.includes(user.role.name);
    }

    // Gerar slug único para o post
    static async generateSlug(title, postId = null) {
        let baseSlug = title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
            .replace(/\s+/g, '-') // Substitui espaços por hífens
            .replace(/-+/g, '-') // Remove hífens duplicados
            .substring(0, 100); // Limita tamanho

        let slug = baseSlug;
        let counter = 1;

        while (true) {
            let query = supabase
                .from('gtracker_posts')
                .select('id')
                .eq('slug', slug);

            if (postId) {
                query = query.neq('id', postId);
            }

            const { data, error } = await query.single();

            if (error && error.code === 'PGRST116') {
                // Slug disponível
                break;
            }

            if (error) {
                throw new Error('Erro ao verificar slug: ' + error.message);
            }

            // Slug já existe, tentar com contador
            counter++;
            slug = `${baseSlug}-${counter}`;
        }

        return slug;
    }

    // Validar dados do template baseado no tipo
    static validateTemplateData(postType, templateData) {
        // Aqui implementamos a validação baseada no arquivo templatefile.json
        const templates = require('../../templatefile.json').templates;
        const template = templates.find(t => t.tipo === postType);

        if (!template) {
            return { valid: false, message: 'Tipo de post inválido' };
        }

        // Validação básica dos campos obrigatórios
        const requiredFields = template.campos.filter(campo => 
            !['informações_extra', 'link_referencia_opcional'].includes(campo)
        );

        for (const field of requiredFields) {
            if (!templateData[field] || templateData[field].toString().trim() === '') {
                return { 
                    valid: false, 
                    message: `Campo obrigatório não preenchido: ${field}` 
                };
            }
        }

        return { valid: true };
    }

    // Criar post
    static async createPost(postData, userId) {
        try {
            const { title, content, forum_id, post_type = 'general', template_data = {} } = postData;

            // Verificar se o usuário pode criar posts
            const { data: user, error: userError } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    nickname,
                    gtracker_roles!inner(name, nivel, pode_postar)
                `)
                .eq('id', userId)
                .single();

            if (userError || !user) {
                return {
                    success: false,
                    message: 'Usuário não encontrado'
                };
            }

            if (!user.gtracker_roles.pode_postar) {
                return {
                    success: false,
                    message: 'Você não tem permissão para criar posts'
                };
            }

            // Verificar se o fórum existe e está ativo
            const { data: forum, error: forumError } = await supabase
                .from('gtracker_forums')
                .select(`
                    id,
                    name,
                    category_id,
                    is_active,
                    gtracker_categories!inner(name)
                `)
                .eq('id', forum_id)
                .eq('is_active', true)
                .single();

            if (forumError || !forum) {
                return {
                    success: false,
                    message: 'Fórum não encontrado ou inativo'
                };
            }

            // Validar dados do template se não for post geral
            if (post_type !== 'general') {
                const validation = this.validateTemplateData(post_type, template_data);
                if (!validation.valid) {
                    return {
                        success: false,
                        message: validation.message
                    };
                }
            }

            // Validação específica para anúncio oficial
            if (post_type === 'anuncio_oficial') {
                const requiredFields = ['titulo', 'mensagem'];
                for (const field of requiredFields) {
                    if (!template_data[field] && !title && !content) {
                        return { 
                            success: false, 
                            message: `Dados obrigatórios para anúncio oficial não preenchidos` 
                        };
                    }
                }
            }

            // Gerar slug único
            const slug = await this.generateSlug(title);

            // Criar o post
            const { data: newPost, error: postError } = await supabase
                .from('gtracker_posts')
                .insert({
                    title,
                    content,
                    slug,
                    author_id: userId,
                    forum_id,
                    post_type,
                    template_data,
                    created_by: userId,
                    updated_by: userId
                })
                .select(`
                    *,
                    gtracker_users!author_id(id, nickname, nome),
                    gtracker_forums!inner(
                        id,
                        name,
                        gtracker_categories!inner(id, name)
                    )
                `)
                .single();

            if (postError) {
                throw new Error('Erro ao criar post: ' + postError.message);
            }

            // Atualizar contagem de posts do usuário
            await supabase.rpc('increment_user_post_count', { user_id: userId });

            const LevelService = require('./levelService');
            await LevelService.awardPostCreated(userId, newPost.id);

            // Processar menções no conteúdo
            if (content) {
                await NotificationService.processMentions(
                    content, 
                    userId, 
                    user.nickname, 
                    newPost.id
                );
            }

            // Atualizar estatísticas do fórum
            await supabase.rpc('update_forum_stats', { 
                forum_id: forum_id,
                last_post_user_id: userId
            });

            return {
                success: true,
                message: 'Post criado com sucesso',
                data: newPost
            };

        } catch (error) {
            console.error('Erro ao criar post:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Buscar posts por fórum com paginação
    static async getPostsByForum(forumId, page = 1, limit = 20, userId = null) {
        try {
            const offset = (page - 1) * limit;

            // Query principal
            let query = supabase
                .from('gtracker_posts')
                .select(`
                    id,
                    title,
                    slug,
                    post_type,
                    is_pinned,
                    is_locked,
                    view_count,
                    like_count,
                    comment_count,
                    last_activity_at,
                    created_at,
                    gtracker_users!author_id(id, nickname, nome),
                    template_data
                `, { count: 'exact' })
                .eq('forum_id', forumId)
                .eq('is_active', true)
                .order('is_pinned', { ascending: false })
                .order('last_activity_at', { ascending: false })
                .range(offset, offset + limit - 1);

            const { data: posts, error, count } = await query;

            if (error) {
                throw new Error('Erro ao buscar posts: ' + error.message);
            }

            // Se o usuário está logado, verificar quais posts ele curtiu
            let userLikes = [];
            if (userId) {
                const { data: likes } = await supabase
                    .from('gtracker_post_reactions')
                    .select('post_id')
                    .eq('user_id', userId)
                    .in('post_id', posts.map(p => p.id));

                userLikes = likes ? likes.map(l => l.post_id) : [];
            }

            const enrichedPosts = posts.map(post => ({
                ...post,
                author: post.gtracker_users,
                user_liked: userLikes.includes(post.id)
            }));

            return {
                success: true,
                data: {
                    posts: enrichedPosts,
                    pagination: {
                        page,
                        limit,
                        total: count,
                        totalPages: Math.ceil(count / limit)
                    }
                }
            };

        } catch (error) {
            console.error('Erro ao buscar posts:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Buscar post por slug ou ID
    static async getPostBySlug(slug, userId = null) {
        try {
            const { data: post, error } = await supabase
                .from('gtracker_posts')
                .select(`
                    *,
                    gtracker_users!author_id(
                        id,
                        nickname,
                        nome,
                        gtracker_roles!inner(name, display_name, color)
                    ),
                    gtracker_forums!inner(
                        id,
                        name,
                        gtracker_categories!inner(id, name)
                    )
                `)
                .eq('slug', slug)
                .eq('is_active', true)
                .single();

            if (error || !post) {
                return {
                    success: false,
                    message: 'Post não encontrado'
                };
            }

            // Incrementar contador de visualizações
            await supabase
                .from('gtracker_posts')
                .update({ view_count: post.view_count + 1 })
                .eq('id', post.id);

            // Verificar se o usuário curtiu o post
            let userLiked = false;
            if (userId) {
                const { data: like } = await supabase
                    .from('gtracker_post_reactions')
                    .select('id')
                    .eq('post_id', post.id)
                    .eq('user_id', userId)
                    .single();

                userLiked = !!like;
            }

            return {
                success: true,
                data: {
                    ...post,
                    author: post.gtracker_users,
                    forum: post.gtracker_forums,
                    user_liked: userLiked,
                    view_count: post.view_count + 1
                }
            };

        } catch (error) {
            console.error('Erro ao buscar post:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Atualizar post
    static async updatePost(postId, updateData, userId) {
        try {
            const { title, content, template_data } = updateData;

            // Verificar se o post existe e o usuário tem permissão
            const { data: post, error: postError } = await supabase
                .from('gtracker_posts')
                .select(`
                    id,
                    author_id,
                    title,
                    post_type,
                    gtracker_users!author_id(
                        gtracker_roles!inner(name, nivel, pode_editar_posts_outros)
                    )
                `)
                .eq('id', postId)
                .eq('is_active', true)
                .single();

            if (postError || !post) {
                return {
                    success: false,
                    message: 'Post não encontrado'
                };
            }

            // Verificar permissões
            const { data: currentUser, error: userError } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    gtracker_roles!inner(name, nivel, pode_editar_posts_outros)
                `)
                .eq('id', userId)
                .single();

            if (userError || !currentUser) {
                return {
                    success: false,
                    message: 'Usuário não encontrado'
                };
            }

            const isAuthor = post.author_id === userId;
            const canEditOthers = currentUser.gtracker_roles.pode_editar_posts_outros;

            if (!isAuthor && !canEditOthers) {
                return {
                    success: false,
                    message: 'Você não tem permissão para editar este post'
                };
            }

            const updateFields = { updated_by: userId };

            if (title !== undefined) {
                if (title !== post.title) {
                    updateFields.slug = await this.generateSlug(title, postId);
                }
                updateFields.title = title;
            }

            if (content !== undefined) {
                updateFields.content = content;
            }

            if (template_data !== undefined) {
                if (post.post_type !== 'general') {
                    const validation = this.validateTemplateData(post.post_type, template_data);
                    if (!validation.valid) {
                        return {
                            success: false,
                            message: validation.message
                        };
                    }
                }
                updateFields.template_data = template_data;
            }

            const { data: updatedPost, error: updateError } = await supabase
                .from('gtracker_posts')
                .update(updateFields)
                .eq('id', postId)
                .select(`
                    *,
                    gtracker_users!author_id(id, nickname, nome),
                    gtracker_forums!inner(
                        id,
                        name,
                        gtracker_categories!inner(id, name)
                    )
                `)
                .single();

            if (updateError) {
                throw new Error('Erro ao atualizar post: ' + updateError.message);
            }

            return {
                success: true,
                message: 'Post atualizado com sucesso',
                data: updatedPost
            };

        } catch (error) {
            console.error('Erro ao atualizar post:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Deletar post
    static async deletePost(postId, userId) {
        try {
            // Verificar se o post existe e o usuário tem permissão
            const { data: post, error: postError } = await supabase
                .from('gtracker_posts')
                .select(`
                    id,
                    author_id,
                    forum_id
                `)
                .eq('id', postId)
                .eq('is_active', true)
                .single();

            if (postError || !post) {
                return {
                    success: false,
                    message: 'Post não encontrado'
                };
            }

            // Verificar permissões
            const { data: currentUser, error: userError } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    gtracker_roles!inner(name, nivel, pode_deletar_posts_outros)
                `)
                .eq('id', userId)
                .single();

            if (userError || !currentUser) {
                return {
                    success: false,
                    message: 'Usuário não encontrado'
                };
            }

            const isAuthor = post.author_id === userId;
            const canDeleteOthers = currentUser.gtracker_roles.pode_deletar_posts_outros;

            if (!isAuthor && !canDeleteOthers) {
                return {
                    success: false,
                    message: 'Você não tem permissão para deletar este post'
                };
            }

            // Soft delete
            const { error: deleteError } = await supabase
                .from('gtracker_posts')
                .update({ 
                    is_active: false,
                    updated_by: userId
                })
                .eq('id', postId);

            if (deleteError) {
                throw new Error('Erro ao deletar post: ' + deleteError.message);
            }

            // Decrementar contagem de posts do autor
            await supabase.rpc('decrement_user_post_count', { user_id: post.author_id });

            // Atualizar estatísticas do fórum
            await supabase.rpc('update_forum_stats_after_delete', { forum_id: post.forum_id });

            const LevelService = require('./levelService');
            await LevelService.penalizePostRemoved(userId, postId);

            return {
                success: true,
                message: 'Post deletado com sucesso'
            };

            

        } catch (error) {
            console.error('Erro ao deletar post:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Mover post para outro fórum
    static async movePost(postId, newForumId, userId, reason = null) {
        try {
            // Verificar permissões
            const { data: user, error: userError } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    nickname,
                    gtracker_roles!inner(name, nivel, pode_mover_topicos)
                `)
                .eq('id', userId)
                .single();

            if (userError || !user || !user.gtracker_roles.pode_mover_topicos) {
                return {
                    success: false,
                    message: 'Você não tem permissão para mover posts'
                };
            }

            // Verificar se o post e fórum existem
            const { data: post, error: postError } = await supabase
                .from('gtracker_posts')
                .select('id, forum_id, author_id')
                .eq('id', postId)
                .eq('is_active', true)
                .single();

            if (postError || !post) {
                return {
                    success: false,
                    message: 'Post não encontrado'
                };
            }

            const { data: newForum, error: forumError } = await supabase
                .from('gtracker_forums')
                .select('id, name')
                .eq('id', newForumId)
                .eq('is_active', true)
                .single();

            if (forumError || !newForum) {
                return {
                    success: false,
                    message: 'Fórum de destino não encontrado'
                };
            }

            if (post.forum_id === newForumId) {
                return {
                    success: false,
                    message: 'Post já está neste fórum'
                };
            }

            // Buscar nome do fórum de origem
            const { data: fromForum, error: fromError } = await supabase
                .from('gtracker_forums')
                .select('name')
                .eq('id', post.forum_id)
                .single();

            // Mover o post
            const { error: moveError } = await supabase
                .from('gtracker_posts')
                .update({ 
                    forum_id: newForumId,
                    updated_by: userId
                })
                .eq('id', postId);

            if (moveError) {
                throw new Error('Erro ao mover post: ' + moveError.message);
            }

            // Registrar a movimentação
            await supabase
                .from('gtracker_post_movements')
                .insert({
                    post_id: postId,
                    from_forum_id: post.forum_id,
                    to_forum_id: newForumId,
                    moved_by: userId,
                    reason
                });

            // Notificar autor do post sobre a movimentação
            if (!fromError && fromForum) {
                await NotificationService.notifyPostMoved(
                    postId,
                    post.author_id,
                    fromForum.name,
                    newForum.name,
                    user.nickname,
                    reason
                );
            }

            // Atualizar estatísticas dos fóruns
            await supabase.rpc('update_forum_stats_after_move', {
                old_forum_id: post.forum_id,
                new_forum_id: newForumId
            });

            return {
                success: true,
                message: 'Post movido com sucesso'
            };

        } catch (error) {
            console.error('Erro ao mover post:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Toggle like no post
    static async togglePostLike(postId, userId) {
        try {
            // Verificar se o post existe
            const { data: post, error: postError } = await supabase
                .from('gtracker_posts')
                .select('id, like_count, author_id')
                .eq('id', postId)
                .eq('is_active', true)
                .single();

            if (postError || !post) {
                return {
                    success: false,
                    message: 'Post não encontrado'
                };
            }

            // Verificar se já curtiu
            const { data: existingLike, error: likeError } = await supabase
                .from('gtracker_post_reactions')
                .select('id')
                .eq('post_id', postId)
                .eq('user_id', userId)
                .single();

            if (likeError && likeError.code !== 'PGRST116') {
                throw new Error('Erro ao verificar like: ' + likeError.message);
            }

            if (existingLike) {
                // Remover like
                await supabase
                    .from('gtracker_post_reactions')
                    .delete()
                    .eq('id', existingLike.id);

                await supabase
                    .from('gtracker_posts')
                    .update({ like_count: Math.max(0, post.like_count - 1) })
                    .eq('id', postId);

                return {
                    success: true,
                    message: 'Like removido',
                    data: { liked: false, like_count: Math.max(0, post.like_count - 1) }
                };
            } else {
                // Adicionar like
                await supabase
                    .from('gtracker_post_reactions')
                    .insert({
                        post_id: postId,
                        user_id: userId,
                        reaction_type: 'like'
                    });

                await supabase
                    .from('gtracker_posts')
                    .update({ like_count: post.like_count + 1 })
                    .eq('id', postId);

                // Buscar dados do usuário que curtiu para notificação
                const { data: liker, error: likerError } = await supabase
                    .from('gtracker_users')
                    .select('nickname, nome')
                    .eq('id', userId)
                    .single();

                if (!likerError && liker) {
                    await NotificationService.notifyPostLike(
                        postId,
                        userId,
                        liker.nickname
                    );
                }

                const LevelService = require('./levelService');
                await LevelService.awardLikeGiven(userId, post.author_id, postId);

                if (post.author_id !== userId) {
                    await LevelService.awardLikeReceived(post.author_id, userId, postId);
                }

                return {
                    success: true,
                    message: 'Like adicionado',
                    data: { liked: true, like_count: post.like_count + 1 }
                };
            }

        } catch (error) {
            console.error('Erro ao curtir post:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }
}

module.exports = PostService;