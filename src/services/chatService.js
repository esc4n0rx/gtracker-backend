// src/services/chatService.js
const supabase = require('../config/supabase');
const NotificationService = require('./notificationService');

class ChatService {
    // Buscar mensagens do chat público
    static async getChatMessages(limit = 50, before = null) {
        try {
            let query = supabase
                .from('gtracker_chat_messages')
                .select(`
                    id,
                    content,
                    message_type,
                    mentions,
                    reply_to,
                    is_deleted,
                    created_at,
                    gtracker_users!author_id(
                        id,
                        nickname,
                        nome,
                        gtracker_roles!inner(name, display_name, color)
                    ),
                    reply_message:gtracker_chat_messages!reply_to(
                        id,
                        content,
                        gtracker_users!author_id(nickname)
                    )
                `)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (before) {
                query = query.lt('created_at', before);
            }

            const { data: messages, error } = await query;

            if (error) {
                throw new Error('Erro ao buscar mensagens: ' + error.message);
            }

            return {
                success: true,
                data: messages.reverse().map(msg => ({
                    ...msg,
                    author: msg.gtracker_users,
                    reply_to_message: msg.reply_message
                }))
            };

        } catch (error) {
            console.error('Erro ao buscar mensagens do chat:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Enviar mensagem no chat público
    static async sendChatMessage(userId, content, replyTo = null) {
        try {
            // Processar menções
            const mentions = this.extractMentions(content);

            // Criar mensagem
            const { data: message, error } = await supabase
                .from('gtracker_chat_messages')
                .insert({
                    author_id: userId,
                    content,
                    mentions,
                    reply_to: replyTo
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

            if (error) {
                throw new Error('Erro ao enviar mensagem: ' + error.message);
            }

            // Processar notificações de menções
            if (mentions && mentions.length > 0) {
                await this.processChatMentions(mentions, userId, content, message.id);
            }

            return {
                success: true,
                data: {
                    ...message,
                    author: message.gtracker_users
                }
            };

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Deletar mensagem do chat
    static async deleteChatMessage(messageId, userId) {
        try {
            // Verificar se é o autor ou tem permissão
            const { data: message, error: msgError } = await supabase
                .from('gtracker_chat_messages')
                .select('author_id')
                .eq('id', messageId)
                .single();

            if (msgError || !message) {
                return {
                    success: false,
                    message: 'Mensagem não encontrada'
                };
            }

            // Verificar permissões
            const { data: user, error: userError } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    gtracker_roles!inner(pode_moderar)
                `)
                .eq('id', userId)
                .single();

            if (userError || !user) {
                return {
                    success: false,
                    message: 'Usuário não encontrado'
                };
            }

            const isAuthor = message.author_id === userId;
            const canModerate = user.gtracker_roles.pode_moderar;

            if (!isAuthor && !canModerate) {
                return {
                    success: false,
                    message: 'Sem permissão para deletar esta mensagem'
                };
            }

            // Soft delete
            const { error: deleteError } = await supabase
                .from('gtracker_chat_messages')
                .update({ is_deleted: true })
                .eq('id', messageId);

            if (deleteError) {
                throw new Error('Erro ao deletar mensagem: ' + deleteError.message);
            }

            return {
                success: true,
                message: 'Mensagem deletada'
            };

        } catch (error) {
            console.error('Erro ao deletar mensagem:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Extrair menções do texto
    static extractMentions(content) {
        const mentionRegex = /@([a-zA-Z0-9_]+)/g;
        const mentions = [];
        let match;

        while ((match = mentionRegex.exec(content)) !== null) {
            mentions.push(match[1]);
        }

        return [...new Set(mentions)]; // Remove duplicatas
    }

    // Processar notificações de menções no chat
    static async processChatMentions(mentionedNicknames, authorId, content, messageId) {
        try {
            // Buscar usuários mencionados
            const { data: mentionedUsers, error } = await supabase
                .from('gtracker_users')
                .select('id, nickname')
                .in('nickname', mentionedNicknames)
                .eq('is_active', true);

            if (error || !mentionedUsers) return;

            // Buscar autor
            const { data: author, error: authorError } = await supabase
                .from('gtracker_users')
                .select('nickname')
                .eq('id', authorId)
                .single();

            if (authorError || !author) return;

            // Criar notificações
            for (const user of mentionedUsers) {
                if (user.id !== authorId) { // Não notificar a si mesmo
                    await NotificationService.createNotification({
                        userId: user.id,
                        type: 'chat_mention',
                        title: 'Você foi mencionado no chat',
                        message: `${author.nickname} mencionou você no chat: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
                        actionUrl: '/chat',
                        relatedUserId: authorId,
                        metadata: {
                            message_id: messageId,
                            message_preview: content.substring(0, 200),
                            author_nickname: author.nickname
                        }
                    });
                }
            }

        } catch (error) {
            console.error('Erro ao processar menções do chat:', error);
        }
    }

    // Limpar mensagens expiradas
    static async cleanupExpiredMessages() {
        try {
            const { error } = await supabase.rpc('cleanup_expired_chat_messages');
            
            if (error) {
                console.error('Erro na limpeza de mensagens:', error);
            } else {
                console.log('Limpeza de mensagens do chat executada com sucesso');
            }
        } catch (error) {
            console.error('Erro ao executar limpeza:', error);
        }
    }
}

module.exports = ChatService;