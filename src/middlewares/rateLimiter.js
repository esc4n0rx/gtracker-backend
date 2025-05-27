
const rateLimit = require('express-rate-limit');
const supabase = require('../config/supabase');

// Rate limiter geral
const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        success: false,
        message: 'Muitas requisições. Tente novamente em alguns minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter específico para login (mais restritivo)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
    message: {
        success: false,
        message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.ip + ':' + (req.body.email || '');
    }
});

// Middleware personalizado para controle de brute force no banco
const bruteForceProtection = async (req, res, next) => {
    try {
        const ip = req.ip;
        const email = req.body.email;

        if (!email) {
            return next();
        }

        // Verificar tentativas recentes
        const { data: attempts, error } = await supabase
            .from('gtracker_login_attempts')
            .select('*')
            .eq('ip_address', ip)
            .eq('email', email)
            .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()) // Últimos 15 minutos
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('Erro ao verificar tentativas de login:', error);
            return next();
        }

        if (attempts && attempts.blocked_until && new Date(attempts.blocked_until) > new Date()) {
            return res.status(429).json({
                success: false,
                message: 'IP temporariamente bloqueado devido a muitas tentativas falhas'
            });
        }

        req.loginAttempts = attempts;
        next();
    } catch (error) {
        console.error('Erro no middleware de brute force:', error);
        next();
    }
};

module.exports = {
    generalLimiter,
    loginLimiter,
    bruteForceProtection
};