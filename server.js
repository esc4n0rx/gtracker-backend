
const app = require('./src/app');
const { createServer } = require('http');
const SocketManager = require('./src/socket/socketManager');
const PopularPostsJob = require('./src/jobs/popularPostsJob');

const PORT = process.env.PORT || 3001;

// Criar servidor HTTP
const server = createServer(app);

// Inicializar Socket.IO
const socketManager = new SocketManager(server);

PopularPostsJob.startJob();

// Tornar socketManager disponível globalmente para notificações
global.socketManager = socketManager;

server.listen(PORT, () => {
    console.log(`
🚀 GTracker Backend iniciado!
📡 Servidor rodando na porta ${PORT}
💬 Chat em tempo real ativo
🌍 Ambiente: ${process.env.NODE_ENV || 'development'}
⏰ ${new Date().toISOString()}
    `);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('Erro não capturado:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promise rejeitada não tratada:', reason);
    process.exit(1);
});