// src/socket/socketAuth.js
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

// Middleware de autenticação para Socket.IO
const socketAuth = async (socket, next) => {
   try {
       // Pegar token do handshake (pode vir via query ou auth)
       const token = socket.handshake.auth?.token || socket.handshake.query?.token;

       if (!token) {
           return next(new Error('Token de autenticação requerido'));
       }

       // Remover "Bearer " se existir
       const cleanToken = token.replace(/^Bearer\s+/, '');

       // Verificar token JWT
       const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);

       // Buscar dados completos do usuário no banco
       const { data: user, error } = await supabase
           .from('gtracker_users')
           .select(`
               id,
               nickname,
               nome,
               email,
               is_active,
               gtracker_roles!inner(
                   id,
                   name,
                   display_name,
                   nivel,
                   color,
                   pode_postar,
                   pode_comentar,
                   pode_curtir,
                   pode_moderar
               )
           `)
           .eq('id', decoded.userId)
           .eq('is_active', true)
           .single();

       if (error || !user) {
           return next(new Error('Usuário inválido ou inativo'));
       }

       // Adicionar dados do usuário ao socket
       socket.user = {
           id: user.id,
           nickname: user.nickname,
           nome: user.nome,
           email: user.email,
           role: {
               id: user.gtracker_roles.id,
               name: user.gtracker_roles.name,
               display_name: user.gtracker_roles.display_name,
               nivel: user.gtracker_roles.nivel,
               color: user.gtracker_roles.color,
               permissions: {
                   pode_postar: user.gtracker_roles.pode_postar,
                   pode_comentar: user.gtracker_roles.pode_comentar,
                   pode_curtir: user.gtracker_roles.pode_curtir,
                   pode_moderar: user.gtracker_roles.pode_moderar
               }
           }
       };

       next();
   } catch (error) {
       console.error('Erro na autenticação do socket:', error);
       next(new Error('Token inválido'));
   }
};

module.exports = socketAuth;