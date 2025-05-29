// src/app.js (versão final atualizada)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Importar rotas
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const roleRoutes = require('./routes/roles');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');
const forumRoutes = require('./routes/forums');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const searchRoutes = require('./routes/search');
const notificationRoutes = require('./routes/notifications');
const customizationRoutes = require('./routes/customization');

// Importar middlewares
const { generalLimiter } = require('./middlewares/rateLimiter');

const app = express();

// Middlewares de segurança
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Middleware para parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy para obter o IP real em produção
app.set('trust proxy', 1);

// Rate limiting geral
app.use(generalLimiter);

// Middleware de log de requisições (apenas em desenvolvimento)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
        next();
    });
}

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/forums', forumRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/customization', customizationRoutes);

// Rota de health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'GTracker Backend está funcionando',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Rota não encontrada'
    });
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
    console.error('Erro não tratado:', error);
    
    res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
});

module.exports = app;