
const app = require('./src/app');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`
🚀 GTracker Backend iniciado!
📡 Servidor rodando na porta ${PORT}
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