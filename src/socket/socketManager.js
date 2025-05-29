// src/socket/socketManager.js
const { Server } = require('socket.io');
const socketAuth = require('./socketAuth');
const ChatService = require('../services/chatService');
const PrivateMessageService = require('../services/privateMessageService');
const supabase = require('../config/supabase');

class SocketManager {
    constructor(server) {
        this.io = new Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });

        this.connectedUsers = new Map(); // Map de userId -> socket.id
        this.userRooms = new Map(); // Map de userId -> Set de rooms
        
        this.setupMiddleware();
        this.setupEventHandlers();
        this.startCleanupJob();
    }

    setupMiddleware() {
        // Middleware de autenticação
        this.io.use(socketAuth);
        
        // Middleware de logging
        this.io.use((socket, next) => {
            console.log(`Socket conectando: ${socket.user.nickname} (${socket.id})`);
            next();
        });
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });
    }

    async handleConnection(socket) {
        const user = socket.user;
        
        // Registrar usuário online
        this.connectedUsers.set(user.id, socket.id);
        await this.updateUserStatus(user.id, 'online', socket.id);

        // Entrar na sala geral do chat
        socket.join('general_chat');
        
        // Entrar na sala pessoal para mensagens privadas
        socket.join(`user_${user.id}`);

        console.log(`✅ ${user.nickname} conectado ao chat`);

        // Notificar outros usuários sobre conexão (opcional)
        socket.to('general_chat').emit('user_joined', {
            user: {
                id: user.id,
                nickname: user.nickname,
                role: user.role
            },
            timestamp: new Date().toISOString()
        });

        // Event handlers do chat público
        this.setupChatHandlers(socket);
        
        // Event handlers de mensagens privadas
        this.setupPrivateMessageHandlers(socket);
        
        // Event handlers gerais
        this.setupGeneralHandlers(socket);

        // Handler de desconexão
        socket.on('disconnect', () => {
            this.handleDisconnection(socket);
        });
    }

    setupChatHandlers(socket) {
        const user = socket.user;

        // Enviar mensagem no chat público
        socket.on('chat_message', async (data) => {
            try {
                const { content, reply_to } = data;

                if (!content || content.trim().length === 0) {
                    socket.emit('error', { message: 'Mensagem não pode estar vazia' });
                    return;
                }

                if (content.length > 1000) {
                    socket.emit('error', { message: 'Mensagem muito longa (máximo 1000 caracteres)' });
                    return;
                }

                // Verificar se pode postar
                if (!user.role.permissions.pode_comentar) {
                    socket.emit('error', { message: 'Você não tem permissão para enviar mensagens' });
                    return;
                }

                // Salvar mensagem
                const result = await ChatService.sendChatMessage(user.id, content, reply_to);

                if (result.success) {
                    // Broadcast para todos na sala
                    this.io.to('general_chat').emit('new_chat_message', result.data);
                } else {
                    socket.emit('error', { message: result.message });
                }

            } catch (error) {
                console.error('Erro ao enviar mensagem do chat:', error);
                socket.emit('error', { message: 'Erro interno do servidor' });
            }
        });

        // Deletar mensagem do chat
        socket.on('delete_chat_message', async (data) => {
            try {
                const { message_id } = data;

                const result = await ChatService.deleteChatMessage(message_id, user.id);

                if (result.success) {
                    this.io.to('general_chat').emit('chat_message_deleted', {
                        message_id,
                        deleted_by: user.nickname
                    });
                } else {
                    socket.emit('error', { message: result.message });
                }

            } catch (error) {
                console.error('Erro ao deletar mensagem:', error);
                socket.emit('error', { message: 'Erro interno do servidor' });
            }
        });

        // Usuário está digitando
        socket.on('typing_start', () => {
            socket.to('general_chat').emit('user_typing', {
                user: {
                    id: user.id,
                    nickname: user.nickname
                },
                typing: true
            });
        });

        socket.on('typing_stop', () => {
            socket.to('general_chat').emit('user_typing', {
                user: {
                    id: user.id,
                    nickname: user.nickname
                },
                typing: false
            });
        });
    }

    setupPrivateMessageHandlers(socket) {
        const user = socket.user;

        // Enviar mensagem privada
        socket.on('private_message', async (data) => {
            try {
                const { recipient_id, content, reply_to } = data;

                if (!content || content.trim().length === 0) {
                    socket.emit('error', { message: 'Mensagem não pode estar vazia' });
                    return;
                }

                if (content.length > 5000) {
                    socket.emit('error', { message: 'Mensagem muito longa (máximo 5000 caracteres)' });
                    return;
                }

                const result = await PrivateMessageService.sendPrivateMessage(
                    user.id,
                    recipient_id,
                    content,
                    reply_to
                );

                if (result.success) {
                    // Enviar para o remetente
                    socket.emit('private_message_sent', result.data);

                    // Enviar para o destinatário se estiver online
                    this.io.to(`user_${recipient_id}`).emit('new_private_message', result.data);
                } else {
                    socket.emit('error', { message: result.message });
                }

            } catch (error) {
                console.error('Erro ao enviar mensagem privada:', error);
                socket.emit('error', { message: 'Erro interno do servidor' });
            }
        });

        // Marcar mensagem como lida
        socket.on('mark_message_read', async (data) => {
            try {
                const { message_id } = data;

                const result = await PrivateMessageService.markMessageAsRead(message_id, user.id);

                if (result.success) {
                    socket.emit('message_marked_read', { message_id });
                    
                    // Notificar o remetente que a mensagem foi lida
                    const { data: message } = await supabase
                        .from('gtracker_private_messages')
                        .select('sender_id')
                        .eq('id', message_id)
                        .single();

                    if (message) {
                        this.io.to(`user_${message.sender_id}`).emit('message_read', {
                            message_id,
                            read_by: user.id
                        });
                    }
                }

            } catch (error) {
                console.error('Erro ao marcar mensagem como lida:', error);
            }
        });

        // Marcar conversa como lida
        socket.on('mark_conversation_read', async (data) => {
            try {
                const { other_user_id } = data;

                const result = await PrivateMessageService.markConversationAsRead(user.id, other_user_id);

                if (result.success) {
                    socket.emit('conversation_marked_read', { other_user_id });
                }

            } catch (error) {
                console.error('Erro ao marcar conversa como lida:', error);
            }
        });
    }

    setupGeneralHandlers(socket) {
        const user = socket.user;

        // Buscar usuários online
        socket.on('get_online_users', () => {
            const onlineUsers = Array.from(this.connectedUsers.keys());
            socket.emit('online_users', onlineUsers);
        });

        // Atualizar status
        socket.on('update_status', async (data) => {
            try {
                const { status } = data;
                const validStatuses = ['online', 'away', 'busy'];

                if (validStatuses.includes(status)) {
                    await this.updateUserStatus(user.id, status);
                    
                    // Notificar mudança de status
                    socket.broadcast.emit('user_status_changed', {
                        user_id: user.id,
                        status
                    });
                }

            } catch (error) {
                console.error('Erro ao atualizar status:', error);
            }
        });

        // Ping/Pong para manter conexão
        socket.on('ping', () => {
            socket.emit('pong');
        });
    }

    async handleDisconnection(socket) {
        const user = socket.user;
        
        console.log(`❌ ${user.nickname} desconectado do chat`);

        // Remover da lista de conectados
        this.connectedUsers.delete(user.id);

        // Atualizar status para offline
        await this.updateUserStatus(user.id, 'offline');

        // Notificar outros usuários
        socket.to('general_chat').emit('user_left', {
            user: {
                id: user.id,
                nickname: user.nickname
            },
            timestamp: new Date().toISOString()
        });
    }

    async updateUserStatus(userId, status, socketId = null) {
        try {
            await supabase
                .from('gtracker_user_status')
                .upsert({
                    user_id: userId,
                    status,
                    socket_id: socketId,
                    last_seen: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
        } catch (error) {
            console.error('Erro ao atualizar status do usuário:', error);
        }
    }

    // Job de limpeza das mensagens do chat a cada 3 horas
    startCleanupJob() {
        const CLEANUP_INTERVAL = 3 * 60 * 60 * 1000; // 3 horas em ms

        setInterval(async () => {
            console.log('Executando limpeza das mensagens do chat...');
            await ChatService.cleanupExpiredMessages();
        }, CLEANUP_INTERVAL);

        // Executar uma vez na inicialização
        setTimeout(() => {
            ChatService.cleanupExpiredMessages();
        }, 30000); // 30 segundos após inicialização
    }

    // Método para enviar notificação em tempo real
    sendNotificationToUser(userId, notification) {
        this.io.to(`user_${userId}`).emit('new_notification', notification);
    }

    // Método para obter usuários online
    getOnlineUsers() {
        return Array.from(this.connectedUsers.keys());
    }

    // Método para verificar se usuário está online
    isUserOnline(userId) {
        return this.connectedUsers.has(userId);
    }
}

module.exports = SocketManager;