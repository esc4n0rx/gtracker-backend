// src/services/commentService.js
const supabase = require('../config/supabase');
const NotificationService = require('./notificationService');

class CommentService {
    // Criar comentário
    static async createComment(commentData, userId) {
        try {
            const { post_id, parent_comment_id, content } = commentData;

            // Verificar se o usuário pode comentar
            const { data: user, error: userError } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    gtracker_roles!inner(name, pode_comentar)
                `)
                .eq('id', userId)
                .single();

            if (userError || !user || !user.gtracker_roles.pode_comentar) {
                return {
                    success: false,
                    message: 'Você não tem permissão para comentar'
                };
            }

            // Verificar se o post existe e não está bloqueado
            const { data: post, error: postError } = await supabase
                .from('gtracker_posts')
                .select('id, is_locked, comment_count')
                .eq('id', post_id)
                .eq('is_active', true)
                .single();

            if (postError || !post) {
                return {
                    success: false,
                    message: 'Post não encontrado'
                };
            }

            if (post.is_locked) {
                return {
                    success: false,
                    message: 'Este post está bloqueado para comentários'
                };
            }

            // Se é resposta, verificar se o comentário pai existe
            if (parent_comment_id) {
                const { data: parentComment, error: parentError } = await supabase
                    .from('gtracker_comments')
                    .select('id')
                    .eq('id', parent_comment_id)
                    .eq('post_id', post_id)
                    .eq('is_active', true)
                    .single();

                if (parentError || !parentComment) {
                    return {
                        success: false,
                        message: 'Comentário pai não encontrado'
                    };
                }
            }

            // Criar comentário
            const { data: newComment, error: commentError } = await supabase
                .from('gtracker_comments')
                .insert({
                    post_id,
                    author_id: userId,
                    parent_comment_id,
                    content,
                    created_by: userId,
                    updated_by: userId
                })
                .select(`
                    *,
                    gtracker_users!author_id(
                        id,
                        nickname,
                        nome,
                        gtracker_roles!inner(name, display_name, color)
                    )
                `)
                .single();

            if (commentError) {
                throw new Error('Erro ao criar comentário: ' + commentError.message);
            }

            // Atualizar contagem de comentários do post
            await supabase
                .from('gtracker_posts')
                .update({ 
                    comment_count: post.comment_count + 1,
                    last_activity_at: new Date().toISOString()
                })
                .eq('id', post_id);

            // Atualizar contagem de comentários do usuário
            await supabase.rpc('increment_user_comment_count', { user_id: userId });

            const LevelService = require('./levelService');
            await LevelService.awardCommentCreated(userId, post_id, newComment.id);

            const { data: commenter, error: commenterError } = await supabase
                .from('gtracker_users')
                .select('nickname, nome')
                .eq('id', userId)
                .single();

            if (!commenterError && commenter) {
                // Processar menções no conteúdo do comentário
                await NotificationService.processMentions(
                    content,
                    userId,
                    commenter.nickname,
                    post_id,
                    newComment.id
                );

                // Notificar o autor do post (se não for resposta a comentário)
                if (!parent_comment_id) {
                    await NotificationService.notifyPostReply(
                        post_id,
                        userId,
                        commenter.nickname
                    );
                } else {
                    // Notificar o autor do comentário pai
                    await NotificationService.notifyCommentReply(
                        parent_comment_id,
                        userId,
                        commenter.nickname
                    );
                }
            }

            return {
                success: true,
                message: 'Comentário criado com sucesso',
                data: {
                    ...newComment,
                    author: newComment.gtracker_users
                }

                
            };


        } catch (error) {
            console.error('Erro ao criar comentário:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Buscar comentários de um post
    static async getCommentsByPost(postId, page = 1, limit = 50, userId = null) {
        try {
            const offset = (page - 1) * limit;

            const { data: comments, error, count } = await supabase
                .from('gtracker_comments')
                .select(`
                    *,
                    gtracker_users!author_id(
                        id,
                        nickname,
                        nome,
                        gtracker_roles!inner(name, display_name, color)
                    )
                `, { count: 'exact' })
                .eq('post_id', postId)
                .eq('is_active', true)
                .order('created_at', { ascending: true })
                .range(offset, offset + limit - 1);

            if (error) {
                throw new Error('Erro ao buscar comentários: ' + error.message);
            }

            // Verificar likes do usuário se logado
            let userLikes = [];
            if (userId && comments.length > 0) {
                const { data: likes } = await supabase
                    .from('gtracker_post_reactions')
                    .select('comment_id')
                    .eq('user_id', userId)
                    .in('comment_id', comments.map(c => c.id));

                userLikes = likes ? likes.map(l => l.comment_id) : [];
            }

            // Organizar comentários em árvore
            const commentTree = this.buildCommentTree(comments, userLikes);

            return {
                success: true,
                data: {
                    comments: commentTree,
                    pagination: {
                        page,
                        limit,
                        total: count,
                        totalPages: Math.ceil(count / limit)
                    }
                }
            };

        } catch (error) {
            console.error('Erro ao buscar comentários:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Construir árvore de comentários
    static buildCommentTree(comments, userLikes = []) {
        const commentMap = new Map();
        const rootComments = [];

        // Primeiro, criar um mapa de todos os comentários
        comments.forEach(comment => {
            commentMap.set(comment.id, {
                ...comment,
                author: comment.gtracker_users,
                user_liked: userLikes.includes(comment.id),
                replies: []
            });
        });

        // Depois, organizar em árvore
        comments.forEach(comment => {
            const commentObj = commentMap.get(comment.id);
            
            if (comment.parent_comment_id) {
                const parent = commentMap.get(comment.parent_comment_id);
                if (parent) {
                    parent.replies.push(commentObj);
                }
            } else {
                rootComments.push(commentObj);
            }
        });

        return rootComments;
    }

    // Atualizar comentário
    static async updateComment(commentId, updateData, userId) {
        try {
            const { content } = updateData;

            // Verificar se o comentário existe e permissões
            const { data: comment, error: commentError } = await supabase
                .from('gtracker_comments')
                .select(`
                    id,
                    author_id,
                    post_id
                `)
                .eq('id', commentId)
                .eq('is_active', true)
                .single();

            if (commentError || !comment) {
                return {
                    success: false,
                    message: 'Comentário não encontrado'
                };
            }

            // Verificar permissões
            const { data: currentUser, error: userError } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    gtracker_roles!inner(name, pode_editar_posts_outros)
                `)
                .eq('id', userId)
                .single();

            if (userError || !currentUser) {
                return {
                    success: false,
                    message: 'Usuário não encontrado'
                };
            }

            const isAuthor = comment.author_id === userId;
            const canEditOthers = currentUser.gtracker_roles.pode_editar_posts_outros;

            if (!isAuthor && !canEditOthers) {
                return {
                    success: false,
                    message: 'Você não tem permissão para editar este comentário'
                };
            }

            // Atualizar comentário
            const { data: updatedComment, error: updateError } = await supabase
                .from('gtracker_comments')
                .update({
                    content,
                    updated_by: userId
                })
                .eq('id', commentId)
                .select(`
                    *,
                    gtracker_users!author_id(
                        id,
                        nickname,
                        nome,
                        gtracker_roles!inner(name, display_name, color)
                    )
                `)
                .single();

            if (updateError) {
                throw new Error('Erro ao atualizar comentário: ' + updateError.message);
            }

            return {
                success: true,
                message: 'Comentário atualizado com sucesso',
                data: {
                    ...updatedComment,
                    author: updatedComment.gtracker_users
                }
            };

        } catch (error) {
            console.error('Erro ao atualizar comentário:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Deletar comentário
    static async deleteComment(commentId, userId) {
        try {
            // Verificar se o comentário existe e permissões
            const { data: comment, error: commentError } = await supabase
                .from('gtracker_comments')
                .select('id, author_id, post_id')
                .eq('id', commentId)
                .eq('is_active', true)
                .single();

            if (commentError || !comment) {
                return {
                    success: false,
                    message: 'Comentário não encontrado'
                };
            }

            // Verificar permissões
            const { data: currentUser, error: userError } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    gtracker_roles!inner(name, pode_deletar_posts_outros)
                `)
                .eq('id', userId)
                .single();

            if (userError || !currentUser) {
                return {
                    success: false,
                    message: 'Usuário não encontrado'
                };
            }

            const isAuthor = comment.author_id === userId;
            const canDeleteOthers = currentUser.gtracker_roles.pode_deletar_posts_outros;

            if (!isAuthor && !canDeleteOthers) {
                return {
                    success: false,
                    message: 'Você não tem permissão para deletar este comentário'
                };
            }

            // Soft delete do comentário
            const { error: deleteError } = await supabase
                .from('gtracker_comments')
                .update({ 
                    is_active: false,
                    updated_by: userId
                })
                .eq('id', commentId);

            if (deleteError) {
                throw new Error('Erro ao deletar comentário: ' + deleteError.message);
            }

            // Atualizar contagem de comentários do post
            await supabase.rpc('decrement_post_comment_count', { 
                post_id: comment.post_id 
            });

            // Decrementar contagem de comentários do autor
            await supabase.rpc('decrement_user_comment_count', { 
                user_id: comment.author_id 
            });

            return {
                success: true,
                message: 'Comentário deletado com sucesso'
            };

        } catch (error) {
            console.error('Erro ao deletar comentário:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Toggle like em comentário
    static async toggleCommentLike(commentId, userId) {
        try {
            // Verificar se o comentário existe
            const { data: comment, error: commentError } = await supabase
                .from('gtracker_comments')
                .select('id, like_count')
                .eq('id', commentId)
                .eq('is_active', true)
                .single();

            if (commentError || !comment) {
                return {
                    success: false,
                    message: 'Comentário não encontrado'
                };
            }

            // Verificar se já curtiu
            const { data: existingLike, error: likeError } = await supabase
                .from('gtracker_post_reactions')
                .select('id')
                .eq('comment_id', commentId)
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
                    .from('gtracker_comments')
                    .update({ like_count: Math.max(0, comment.like_count - 1) })
                    .eq('id', commentId);

                return {
                    success: true,
                    message: 'Like removido',
                    data: { liked: false, like_count: Math.max(0, comment.like_count - 1) }
                };
            } else {
                // Adicionar like
                await supabase
                    .from('gtracker_post_reactions')
                    .insert({
                        comment_id: commentId,
                        user_id: userId,
                        reaction_type: 'like'
                    });

                await supabase
                    .from('gtracker_comments')
                    .update({ like_count: comment.like_count + 1 })
                    .eq('id', commentId);

                 if (!likerError && liker) {
                    await NotificationService.notifyCommentLike(
                        commentId,
                        userId,
                        liker.nickname
                    );
                }

                const LevelService = require('./levelService');
    
                await LevelService.awardLikeGiven(userId, comment.author_id, null, commentId);
                
                if (comment.author_id !== userId) {
                    await LevelService.awardLikeReceived(comment.author_id, userId, null, commentId);
                }

                return {
                    success: true,
                    message: 'Like adicionado',
                    data: { liked: true, like_count: comment.like_count + 1 }
                };
            }

        } catch (error) {
            console.error('Erro ao curtir comentário:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }
}

module.exports = CommentService;