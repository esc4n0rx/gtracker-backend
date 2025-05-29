// src/services/privateMessageService.js
const supabase = require('../config/supabase');
const NotificationService = require('./notificationService');

class PrivateMessageService {
    // Buscar conversas do usuário
    static async getUserConversations(userId, page = 1, limit = 20) {
        try {
            const offset = (page - 1) * limit;

            const { data: conversations, error, count } = await supabase
                .from('gtracker_conversations')
                .select(`
                    id,
                    last_message_at,
                    participant1:gtracker_users!participant_1(
                        id, nickname, nome,
                        gtracker_profiles!inner(avatar_url)
                    ),
                    participant2:gtracker_users!participant_2(
                        id, nickname, nome,
                        gtracker_profiles!inner(avatar_url)
                    ),
                    last_message:gtracker_private_messages!last_message_id(
                        id, content, created_at, sender_id
                    )
                `, { count: 'exact' })
                .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
                .order('last_message_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                throw new Error('Erro ao buscar conversas: ' + error.message);
            }

            // Processar conversas para mostrar o outro participante
            const processedConversations = conversations.map(conv => {
                const otherParticipant = conv.participant1.id === userId ? 
                    conv.participant2 : conv.participant1;

                return {
                    id: conv.id,
                    other_user: otherParticipant,
                    last_message: conv.last_message,
                    last_message_at: conv.last_message_at
                };
            });

            return {
                success: true,
                data: {
                    conversations: processedConversations,
                    pagination: {
                        page,
                        limit,
                        total: count,
                        totalPages: Math.ceil(count / limit)
                    }
                }
            };

        } catch (error) {
            console.error('Erro ao buscar conversas:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Buscar mensagens de uma conversa
    static async getConversationMessages(userId, otherUserId, page = 1, limit = 50, before = null) {
        try {
            const offset = (page - 1) * limit;

            let query = supabase
                .from('gtracker_private_messages')
                .select(`
                    id,
                    content,
                    is_read,
                    read_at,
                    reply_to,
                    created_at,
                    sender:gtracker_users!sender_id(
                        id, nickname, nome,
                        gtracker_profiles!inner(avatar_url)
                    ),
                    recipient:gtracker_users!recipient_id(
                        id, nickname, nome
                    ),
                    reply_message:gtracker_private_messages!reply_to(
                        id, content,
                        gtracker_users!sender_id(nickname)
                    )
                `, { count: 'exact' })
                .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false });

            // Filtro 'before' para paginação temporal
            if (before) {
                // Se 'before' for uma data ISO
                if (before.includes('T') || before.includes('-')) {
                    query = query.lt('created_at', before);
                }
                // Se 'before' for um ID de mensagem, buscar a data dessa mensagem primeiro
                else {
                    const { data: beforeMessage, error: beforeError } = await supabase
                        .from('gtracker_private_messages')
                        .select('created_at')
                        .eq('id', before)
                        .single();

                    if (!beforeError && beforeMessage) {
                        query = query.lt('created_at', beforeMessage.created_at);
                    }
                }
            }

            query = query.range(offset, offset + limit - 1);

            const { data: messages, error, count } = await query;

            if (error) {
                throw new Error('Erro ao buscar mensagens: ' + error.message);
            }

            return {
                success: true,
                message: 'Mensagens da conversa carregadas.',
                data: {
                    messages: messages.reverse(), // Inverter para ordem cronológica
                    pagination: {
                        page,
                        limit,
                        total: count,
                        totalPages: Math.ceil(count / limit)
                    }
                }
            };

        } catch (error) {
            console.error('Erro ao buscar mensagens da conversa:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Enviar mensagem privada
    static async sendPrivateMessage(senderId, recipientId, content, replyTo = null) {
        try {
            // Verificar se o destinatário existe
            const { data: recipient, error: recipientError } = await supabase
                .from('gtracker_users')
                .select('id, nickname')
                .eq('id', recipientId)
                .eq('is_active', true)
                .single();

            if (recipientError || !recipient) {
                return {
                    success: false,
                    message: 'Destinatário não encontrado'
                };
            }

            // Criar ou encontrar conversa
            const conversationResult = await this.getOrCreateConversation(senderId, recipientId);
            if (!conversationResult.success) {
                return conversationResult;
            }

            // Criar mensagem
            const { data: message, error: messageError } = await supabase
                .from('gtracker_private_messages')
                .insert({
                    sender_id: senderId,
                    recipient_id: recipientId,
                    content,
                    reply_to: replyTo
                })
                .select(`
                    *,
                    sender:gtracker_users!sender_id(
                        id, nickname, nome,
                        gtracker_profiles!inner(avatar_url)
                    )
                `)
                .single();

            if (messageError) {
                throw new Error('Erro ao enviar mensagem: ' + messageError.message);
            }

            // Atualizar conversa
            await supabase
                .from('gtracker_conversations')
                .update({
                    last_message_id: message.id,
                    last_message_at: message.created_at
                })
                .eq('id', conversationResult.data.id);

            // Buscar sender para notificação
            const { data: sender, error: senderError } = await supabase
                .from('gtracker_users')
                .select('nickname')
                .eq('id', senderId)
                .single();

            if (!senderError && sender) {
                // Criar notificação
                await NotificationService.createNotification({
                    userId: recipientId,
                    type: NotificationService.TYPES.PRIVATE_MESSAGE,
                    title: 'Nova mensagem privada',
                    message: `${sender.nickname} enviou uma mensagem: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
                    actionUrl: '/messages',
                    relatedUserId: senderId,
                    metadata: {
                        conversation_id: conversationResult.data.id,
                        message_preview: content.substring(0, 200),
                        sender_nickname: sender.nickname
                    }
                });
            }

            return {
                success: true,
                data: message
            };

        } catch (error) {
            console.error('Erro ao enviar mensagem privada:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Marcar mensagem como lida
    static async markMessageAsRead(messageId, userId) {
        try {
            const { data, error } = await supabase
                .from('gtracker_private_messages')
                .update({
                    is_read: true,
                    read_at: new Date().toISOString()
                })
                .eq('id', messageId)
                .eq('recipient_id', userId)
                .eq('is_read', false)
                .select()
                .single();

            if (error && error.code !== 'PGRST116') {
                throw new Error('Erro ao marcar como lida: ' + error.message);
            }

            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('Erro ao marcar mensagem como lida:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Marcar todas as mensagens de uma conversa como lidas
    static async markConversationAsRead(userId, otherUserId) {
        try {
            const { error } = await supabase
                .from('gtracker_private_messages')
                .update({
                    is_read: true,
                    read_at: new Date().toISOString()
                })
                .eq('sender_id', otherUserId)
                .eq('recipient_id', userId)
                .eq('is_read', false);

            if (error) {
                throw new Error('Erro ao marcar conversa como lida: ' + error.message);
            }

            return {
                success: true,
                message: 'Conversa marcada como lida'
            };

        } catch (error) {
            console.error('Erro ao marcar conversa como lida:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Obter ou criar conversa
    static async getOrCreateConversation(user1Id, user2Id) {
        try {
            // Garantir ordem consistente dos participantes
            const [participant1, participant2] = [user1Id, user2Id].sort();

            // Tentar encontrar conversa existente
            let { data: conversation, error } = await supabase
                .from('gtracker_conversations')
                .select('*')
                .eq('participant_1', participant1)
                .eq('participant_2', participant2)
                .single();

            if (error && error.code === 'PGRST116') {
                // Conversa não existe, criar nova
                const { data: newConversation, error: createError } = await supabase
                    .from('gtracker_conversations')
                    .insert({
                        participant_1: participant1,
                        participant_2: participant2
                    })
                    .select()
                    .single();

                if (createError) {
                    throw new Error('Erro ao criar conversa: ' + createError.message);
                }

                conversation = newConversation;
            } else if (error) {
                throw new Error('Erro ao buscar conversa: ' + error.message);
            }

            return {
                success: true,
                data: conversation
            };

        } catch (error) {
            console.error('Erro ao obter/criar conversa:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Contar mensagens não lidas
    static async getUnreadCount(userId) {
        try {
            const { count, error } = await supabase
                .from('gtracker_private_messages')
                .select('*', { count: 'exact', head: true })
                .eq('recipient_id', userId)
                .eq('is_read', false)
                .eq('is_deleted', false);

            if (error) {
                throw new Error('Erro ao contar mensagens: ' + error.message);
            }

            return {
                success: true,
                data: { unread_count: count }
            };

        } catch (error) {
            console.error('Erro ao contar mensagens não lidas:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }
}

module.exports = PrivateMessageService;