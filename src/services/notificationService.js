// src/services/notificationService.js
const supabase = require('../config/supabase');

class NotificationService {
    // Tipos de notificação
    static TYPES = {
        POST_REPLY: 'post_reply',
        COMMENT_REPLY: 'comment_reply',
        POST_LIKE: 'post_like',
        COMMENT_LIKE: 'comment_like',
        MENTION: 'mention',
        ROLE_CHANGED: 'role_changed',
        POST_MOVED: 'post_moved',
        PRIVATE_MESSAGE: 'private_message',
        CHAT_MENTION: 'chat_mention',
        PRIVATE_MESSAGE: 'private_message'
    };

    // Verificar configurações de notificação do usuário
    static async getUserNotificationSettings(userId) {
        try {
            const { data: settings, error } = await supabase
                .from('gtracker_notification_settings')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code === 'PGRST116') {
                // Criar configurações padrão se não existirem
                const { data: newSettings, error: createError } = await supabase
                    .from('gtracker_notification_settings')
                    .insert({ user_id: userId })
                    .select()
                    .single();

                if (createError) {
                    throw new Error('Erro ao criar configurações: ' + createError.message);
                }

                return newSettings;
            }

            if (error) {
                throw new Error('Erro ao buscar configurações: ' + error.message);
            }

            return settings;
        } catch (error) {
            console.error('Erro ao buscar configurações de notificação:', error);
            return null;
        }
    }

    // Verificar se o usuário deve receber determinado tipo de notificação
    static async shouldNotifyUser(userId, notificationType) {
        const settings = await this.getUserNotificationSettings(userId);
        if (!settings) return false;

        const settingsMap = {
            [this.TYPES.POST_REPLY]: settings.post_replies,
            [this.TYPES.COMMENT_REPLY]: settings.comment_replies,
            [this.TYPES.POST_LIKE]: settings.post_likes,
            [this.TYPES.COMMENT_LIKE]: settings.comment_likes,
            [this.TYPES.MENTION]: settings.mentions,
            [this.TYPES.ROLE_CHANGED]: settings.administrative,
            [this.TYPES.POST_MOVED]: settings.administrative,
            [this.TYPES.PRIVATE_MESSAGE]: settings.private_messages
        };

        return settingsMap[notificationType] || false;
    }

    // Criar notificação
    static async createNotification(notificationData) {
        try {
            const {
                userId,
                type,
                title,
                message,
                actionUrl = null,
                relatedPostId = null,
                relatedCommentId = null,
                relatedUserId = null,
                metadata = {}
            } = notificationData;

            // Verificar se o usuário deve receber este tipo de notificação
            const shouldNotify = await this.shouldNotifyUser(userId, type);
            if (!shouldNotify) {
                return { success: true, message: 'Notificação bloqueada pelas configurações do usuário' };
            }

            // Evitar auto-notificação (usuário não deve ser notificado de suas próprias ações)
            if (relatedUserId === userId) {
                return { success: true, message: 'Auto-notificação evitada' };
            }

            const { data: notification, error } = await supabase
                .from('gtracker_notifications')
                .insert({
                    user_id: userId,
                    type,
                    title,
                    message,
                    action_url: actionUrl,
                    related_post_id: relatedPostId,
                    related_comment_id: relatedCommentId,
                    related_user_id: relatedUserId,
                    metadata
                })
                .select()
                .single();

            if (error) {
                throw new Error('Erro ao criar notificação: ' + error.message);
            }

            return {
                success: true,
                data: notification
            };

        } catch (error) {
            console.error('Erro ao criar notificação:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Notificar resposta em post
    static async notifyPostReply(postId, commentAuthorId, replierNickname) {
        try {
            // Buscar dados do post e autor
            const { data: post, error: postError } = await supabase
                .from('gtracker_posts')
                .select(`
                    id,
                    title,
                    slug,
                    author_id,
                    gtracker_users!author_id(nickname)
                `)
                .eq('id', postId)
                .single();

            if (postError || !post) {
                console.error('Post não encontrado para notificação');
                return;
            }

            const postAuthorId = post.author_id;
            
            // Não notificar se o autor do comentário é o mesmo do post
            if (postAuthorId === commentAuthorId) {
                return;
            }

            await this.createNotification({
                userId: postAuthorId,
                type: this.TYPES.POST_REPLY,
                title: 'Nova resposta no seu post',
                message: `${replierNickname} respondeu ao seu post "${post.title}"`,
                actionUrl: `/post/${post.slug}`,
                relatedPostId: postId,
                relatedUserId: commentAuthorId,
                metadata: {
                    post_title: post.title,
                    replier_nickname: replierNickname
                }
            });

        } catch (error) {
            console.error('Erro ao notificar resposta em post:', error);
        }
    }

    static async notifyChatMention(userId, mentionerNickname, messageContent, messageId) {
            try {
                await this.createNotification({
                    userId,
                    type: this.TYPES.CHAT_MENTION,
                    title: 'Você foi mencionado no chat',
                    message: `${mentionerNickname} mencionou você no chat: "${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}"`,
                    actionUrl: '/chat',
                    metadata: {
                        message_id: messageId,
                        message_preview: messageContent.substring(0, 200),
                        mentioner_nickname: mentionerNickname
                    }
                });
            } catch (error) {
                console.error('Erro ao notificar menção no chat:', error);
            }
        }

    // Notificar resposta em comentário
    static async notifyCommentReply(commentId, replyAuthorId, replierNickname) {
        try {
            // Buscar dados do comentário pai
            const { data: comment, error: commentError } = await supabase
                .from('gtracker_comments')
                .select(`
                    id,
                    author_id,
                    post_id,
                    gtracker_users!author_id(nickname),
                    gtracker_posts!post_id(title, slug)
                `)
                .eq('id', commentId)
                .single();

            if (commentError || !comment) {
                console.error('Comentário não encontrado para notificação');
                return;
            }

            const commentAuthorId = comment.author_id;
            
            // Não notificar se o autor da resposta é o mesmo do comentário
            if (commentAuthorId === replyAuthorId) {
                return;
            }

            await this.createNotification({
                userId: commentAuthorId,
                type: this.TYPES.COMMENT_REPLY,
                title: 'Nova resposta ao seu comentário',
                message: `${replierNickname} respondeu ao seu comentário em "${comment.gtracker_posts.title}"`,
                actionUrl: `/post/${comment.gtracker_posts.slug}`,
                relatedPostId: comment.post_id,
                relatedCommentId: commentId,
                relatedUserId: replyAuthorId,
                metadata: {
                    post_title: comment.gtracker_posts.title,
                    replier_nickname: replierNickname
                }
            });

        } catch (error) {
            console.error('Erro ao notificar resposta em comentário:', error);
        }
    }

    // Notificar like em post
    static async notifyPostLike(postId, likerUserId, likerNickname) {
        try {
            // Buscar dados do post
            const { data: post, error: postError } = await supabase
                .from('gtracker_posts')
                .select('id, title, slug, author_id')
                .eq('id', postId)
                .single();

            if (postError || !post) {
                console.error('Post não encontrado para notificação de like');
                return;
            }

            await this.createNotification({
                userId: post.author_id,
                type: this.TYPES.POST_LIKE,
                title: 'Seu post foi curtido',
                message: `${likerNickname} curtiu seu post "${post.title}"`,
                actionUrl: `/post/${post.slug}`,
                relatedPostId: postId,
                relatedUserId: likerUserId,
                metadata: {
                    post_title: post.title,
                    liker_nickname: likerNickname
                }
            });

        } catch (error) {
            console.error('Erro ao notificar like em post:', error);
        }
    }

    // Notificar like em comentário
    static async notifyCommentLike(commentId, likerUserId, likerNickname) {
        try {
            // Buscar dados do comentário
            const { data: comment, error: commentError } = await supabase
                .from('gtracker_comments')
                .select(`
                    id,
                    author_id,
                    post_id,
                    gtracker_posts!post_id(title, slug)
                `)
                .eq('id', commentId)
                .single();

            if (commentError || !comment) {
                console.error('Comentário não encontrado para notificação de like');
                return;
            }

            await this.createNotification({
                userId: comment.author_id,
                type: this.TYPES.COMMENT_LIKE,
                title: 'Seu comentário foi curtido',
                message: `${likerNickname} curtiu seu comentário em "${comment.gtracker_posts.title}"`,
                actionUrl: `/post/${comment.gtracker_posts.slug}`,
                relatedPostId: comment.post_id,
                relatedCommentId: commentId,
                relatedUserId: likerUserId,
                metadata: {
                    post_title: comment.gtracker_posts.title,
                    liker_nickname: likerNickname
                }
            });

        } catch (error) {
            console.error('Erro ao notificar like em comentário:', error);
        }
    }

    // Detectar e notificar menções
    static async processMentions(content, authorId, authorNickname, postId, commentId = null) {
        try {
            // Regex para detectar menções no formato @usuario
            const mentionRegex = /@([a-zA-Z0-9_]+)/g;
            const mentions = [...content.matchAll(mentionRegex)];

            if (mentions.length === 0) return;

            // Buscar usuários mencionados
            const mentionedNicknames = [...new Set(mentions.map(match => match[1]))];
            
            const { data: mentionedUsers, error } = await supabase
                .from('gtracker_users')
                .select('id, nickname')
                .in('nickname', mentionedNicknames)
                .eq('is_active', true);

            if (error || !mentionedUsers) {
                console.error('Erro ao buscar usuários mencionados:', error);
                return;
            }

            // Buscar dados do post para contexto
            const { data: post, error: postError } = await supabase
                .from('gtracker_posts')
                .select('title, slug')
                .eq('id', postId)
                .single();

            if (postError || !post) return;

            // Criar notificações para cada usuário mencionado
            for (const user of mentionedUsers) {
                await this.createNotification({
                    userId: user.id,
                    type: this.TYPES.MENTION,
                    title: 'Você foi mencionado',
                    message: commentId 
                        ? `${authorNickname} mencionou você em um comentário em "${post.title}"`
                        : `${authorNickname} mencionou você no post "${post.title}"`,
                    actionUrl: `/post/${post.slug}`,
                    relatedPostId: postId,
                    relatedCommentId: commentId,
                    relatedUserId: authorId,
                    metadata: {
                        post_title: post.title,
                        mentioner_nickname: authorNickname,
                        mentioned_in: commentId ? 'comment' : 'post'
                    }
                });
            }

        } catch (error) {
            console.error('Erro ao processar menções:', error);
        }
    }

    // Notificar mudança de cargo
    static async notifyRoleChange(userId, newRoleName, newRoleDisplayName, changedByNickname) {
        try {
            await this.createNotification({
                userId,
                type: this.TYPES.ROLE_CHANGED,
                title: 'Seu cargo foi alterado',
                message: `Seu cargo foi alterado para "${newRoleDisplayName}" por ${changedByNickname}`,
                actionUrl: '/profile/me',
                relatedUserId: userId,
                metadata: {
                    new_role: newRoleName,
                    new_role_display: newRoleDisplayName,
                    changed_by: changedByNickname
                }
            });

        } catch (error) {
            console.error('Erro ao notificar mudança de cargo:', error);
        }
    }

    // Notificar post movido
    static async notifyPostMoved(postId, authorId, fromForumName, toForumName, movedByNickname, reason = null) {
        try {
            // Buscar dados do post
            const { data: post, error: postError } = await supabase
                .from('gtracker_posts')
                .select('title, slug')
                .eq('id', postId)
                .single();

            if (postError || !post) return;

            const reasonText = reason ? ` Motivo: ${reason}` : '';

            await this.createNotification({
                userId: authorId,
                type: this.TYPES.POST_MOVED,
                title: 'Seu post foi movido',
                message: `Seu post "${post.title}" foi movido de "${fromForumName}" para "${toForumName}" por ${movedByNickname}.${reasonText}`,
                actionUrl: `/post/${post.slug}`,
                relatedPostId: postId,
                metadata: {
                    post_title: post.title,
                    from_forum: fromForumName,
                    to_forum: toForumName,
                    moved_by: movedByNickname,
                    reason: reason
                }
            });

        } catch (error) {
            console.error('Erro ao notificar post movido:', error);
        }
    }

    // Notificar mensagem privada (mockado para implementação futura)
    static async notifyPrivateMessage(recipientId, senderNickname, messagePreview) {
        try {
            await this.createNotification({
                userId: recipientId,
                type: this.TYPES.PRIVATE_MESSAGE,
                title: 'Nova mensagem privada',
                message: `${senderNickname} enviou uma mensagem: "${messagePreview.substring(0, 100)}..."`,
                actionUrl: '/messages',
                metadata: {
                    sender_nickname: senderNickname,
                    preview: messagePreview.substring(0, 100)
                }
            });

        } catch (error) {
            console.error('Erro ao notificar mensagem privada:', error);
        }
    }

    // Buscar notificações do usuário
    static async getUserNotifications(userId, page = 1, limit = 20, unreadOnly = false) {
        try {
            const offset = (page - 1) * limit;

            let query = supabase
                .from('gtracker_notifications')
                .select(`
                    *,
                    related_user:gtracker_users!related_user_id(id, nickname, nome),
                    related_post:gtracker_posts!related_post_id(id, title, slug),
                    related_comment:gtracker_comments!related_comment_id(id)
                `, { count: 'exact' })
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (unreadOnly) {
                query = query.eq('is_read', false);
            }

            const { data: notifications, error, count } = await query;

            if (error) {
                throw new Error('Erro ao buscar notificações: ' + error.message);
            }

            return {
                success: true,
                data: {
                    notifications,
                    pagination: {
                        page,
                        limit,
                        total: count,
                        totalPages: Math.ceil(count / limit)
                    }
                }
            };

        } catch (error) {
            console.error('Erro ao buscar notificações:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Marcar notificação como lida
    static async markAsRead(notificationId, userId) {
        try {
            const { data, error } = await supabase
                .from('gtracker_notifications')
                .update({ is_read: true })
                .eq('id', notificationId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                throw new Error('Erro ao marcar notificação: ' + error.message);
            }

            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('Erro ao marcar notificação como lida:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Marcar todas as notificações como lidas
    static async markAllAsRead(userId) {
        try {
            const { error } = await supabase
                .from('gtracker_notifications')
                .update({ is_read: true })
                .eq('user_id', userId)
                .eq('is_read', false);

            if (error) {
                throw new Error('Erro ao marcar todas as notificações: ' + error.message);
            }

            return {
                success: true,
                message: 'Todas as notificações foram marcadas como lidas'
            };

        } catch (error) {
            console.error('Erro ao marcar todas as notificações:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Contar notificações não lidas
    static async getUnreadCount(userId) {
        try {
            const { count, error } = await supabase
                .from('gtracker_notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('is_read', false);

            if (error) {
                throw new Error('Erro ao contar notificações: ' + error.message);
            }

            return {
                success: true,
                data: { unread_count: count }
            };

        } catch (error) {
            console.error('Erro ao contar notificações não lidas:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Atualizar configurações de notificação
    static async updateNotificationSettings(userId, settings) {
        try {
            const allowedSettings = [
                'post_replies', 'comment_replies', 'post_likes', 'comment_likes',
                'mentions', 'administrative', 'private_messages',
                'email_notifications', 'push_notifications'
            ];

            const updateData = {};
            for (const [key, value] of Object.entries(settings)) {
                if (allowedSettings.includes(key) && typeof value === 'boolean') {
                    updateData[key] = value;
                }
            }

            if (Object.keys(updateData).length === 0) {
                return {
                    success: false,
                    message: 'Nenhuma configuração válida fornecida'
                };
            }

            const { data, error } = await supabase
                .from('gtracker_notification_settings')
                .update(updateData)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                throw new Error('Erro ao atualizar configurações: ' + error.message);
            }

            return {
                success: true,
                message: 'Configurações atualizadas com sucesso',
                data
            };

        } catch (error) {
            console.error('Erro ao atualizar configurações:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }
}

module.exports = NotificationService;