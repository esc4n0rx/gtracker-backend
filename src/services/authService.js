const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { generateToken } = require('../utils/jwt');

class AuthService {
    static generateInviteCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = 'GT-';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    static async isRegistrationOpen() {
        const { data, error } = await supabase
            .from('gtracker_settings')
            .select('value')
            .eq('key', 'registration_open')
            .single();

        if (error) {
            console.error('Erro ao verificar configuração de registro:', error);
            return true; 
        }

        return data.value === 'true';
    }

    static async validateInviteCode(code) {
        if (!code) return { valid: false, message: 'Código de convite é obrigatório' };

        const { data: invite, error } = await supabase
            .from('gtracker_invites')
            .select('*')
            .eq('code', code)
            .eq('status', 'available')
            .gt('expires_at', new Date().toISOString())
            .single();

        if (error || !invite) {
            return { valid: false, message: 'Código de convite inválido ou expirado' };
        }

        return { valid: true, invite };
    }

    // Registrar usuário
    static async registerUser(userData) {
        const { nickname, email, password, nome, codigo_convite } = userData;

        try {
            // Verificar se registro está aberto
            const registrationOpen = await this.isRegistrationOpen();
            
            if (!registrationOpen && !codigo_convite) {
                return {
                    success: false,
                    message: 'Código de convite é obrigatório no momento'
                };
            }

            // Validar código de convite se fornecido
            let inviteData = null;
            if (codigo_convite) {
                const inviteValidation = await this.validateInviteCode(codigo_convite);
                if (!inviteValidation.valid) {
                    return {
                        success: false,
                        message: inviteValidation.message
                    };
                }
                inviteData = inviteValidation.invite;
            }

            // Verificar se email ou nickname já existem
            const { data: existingUser, error: checkError } = await supabase
                .from('gtracker_users')
                .select('email, nickname')
                .or(`email.eq.${email},nickname.eq.${nickname}`);

            if (checkError) {
                throw new Error('Erro ao verificar usuário existente: ' + checkError.message);
            }

            if (existingUser && existingUser.length > 0) {
                const existing = existingUser[0];
                if (existing.email === email) {
                    return { success: false, message: 'Email já está em uso' };
                }
                if (existing.nickname === nickname) {
                    return { success: false, message: 'Nickname já está em uso' };
                }
            }

            // Hash da senha
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Buscar role padrão (member)
            const { data: memberRole, error: roleError } = await supabase
                .from('gtracker_roles')
                .select('id')
                .eq('name', 'member')
                .eq('is_active', true)
                .single();

            if (roleError) {
                throw new Error('Erro ao buscar cargo padrão: ' + roleError.message);
            }

            // Criar usuário
            const { data: newUser, error: userError } = await supabase
                .from('gtracker_users')
                .insert({
                    nickname,
                    email,
                    password_hash: passwordHash,
                    nome,
                    role_id: memberRole.id
                })
                .select()
                .single();

            if (userError) {
                throw new Error('Erro ao criar usuário: ' + userError.message);
            }

            // Criar perfil do usuário
            const { error: profileError } = await supabase
                .from('gtracker_profiles')
                .insert({
                    user_id: newUser.id
                });

            if (profileError) {
                throw new Error('Erro ao criar perfil: ' + profileError.message);
            }

            // Marcar código de convite como usado (se fornecido)
            if (inviteData) {
                const { error: inviteUpdateError } = await supabase
                    .from('gtracker_invites')
                    .update({
                        status: 'used',
                        used_by: newUser.id,
                        used_at: new Date().toISOString()
                    })
                    .eq('id', inviteData.id);

                if (inviteUpdateError) {
                    console.error('Erro ao marcar convite como usado:', inviteUpdateError);
                }
            }

            // Gerar código de convite para o novo usuário
            const newInviteCode = this.generateInviteCode();
            const { error: newInviteError } = await supabase
                .from('gtracker_invites')
                .insert({
                    code: newInviteCode,
                    created_by: newUser.id
                });

            if (newInviteError) {
                console.error('Erro ao criar código de convite:', newInviteError);
            }

            // Inicializar usuário com nível 1 e 0 XP
                const { error: levelError } = await supabase
                    .from('gtracker_users')
                    .update({
                        total_xp: 0,
                        current_level: 1,
                        last_xp_action: new Date().toISOString()
                    })
                    .eq('id', newUser.id);

                if (levelError) {
                    console.error('Erro ao inicializar nível do usuário:', levelError);
                }

                const { error: progressError } = await supabase
                    .from('gtracker_profiles')
                    .update({
                        level_progress: {
                            current_level: 1,
                            level_name: 'Iniciante',
                            xp_to_next: 100,
                            percentage: 0
                        }
                    })
                    .eq('user_id', newUser.id);

                if (progressError) {
                    console.error('Erro ao inicializar progresso:', progressError);
                }

            return {
                success: true,
                message: 'Usuário registrado com sucesso',
                data: {
                    id: newUser.id,
                    nickname: newUser.nickname,
                    email: newUser.email,
                    nome: newUser.nome,
                    invite_code: newInviteCode
                }
            };

        } catch (error) {
            console.error('Erro no registro de usuário:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Login do usuário - VERSÃO CORRIGIDA COM RELACIONAMENTO
    static async loginUser(email, password, ip) {
        try {
            // Buscar usuário com role usando JOIN explícito
            const { data: user, error: userError } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    nickname,
                    email,
                    password_hash,
                    nome,
                    is_active,
                    role_id,
                    gtracker_roles (
                        id,
                        name,
                        display_name,
                        nivel,
                        color,
                        pode_postar,
                        pode_comentar,
                        pode_curtir,
                        pode_criar_topicos,
                        pode_upload,
                        pode_moderar,
                        pode_editar_posts_outros,
                        pode_deletar_posts_outros,
                        pode_banir_usuarios,
                        pode_mover_topicos,
                        pode_fechar_topicos,
                        acesso_admin,
                        pode_gerenciar_usuarios,
                        pode_gerenciar_cargos,
                        pode_ver_logs,
                        pode_configurar_forum
                    )
                `)
                .eq('email', email)
                .single();

            if (userError || !user) {
                console.error('Erro ao buscar usuário:', userError);
                // Registrar tentativa falhada
                await this.recordFailedAttempt(ip, email);
                return {
                    success: false,
                    message: 'Email ou senha incorretos'
                };
            }

            // Verificar se encontrou o role
            if (!user.gtracker_roles) {
                console.error('Usuário sem role associado:', user.id);
                return {
                    success: false,
                    message: 'Erro na configuração do usuário. Entre em contato com o suporte.'
                };
            }

            if (!user.is_active) {
                return {
                    success: false,
                    message: 'Conta desativada. Entre em contato com o suporte.'
                };
            }

            // Verificar senha
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            if (!passwordMatch) {
                // Registrar tentativa falhada
                await this.recordFailedAttempt(ip, email);
                return {
                    success: false,
                    message: 'Email ou senha incorretos'
                };
            }

            // Limpar tentativas de login após sucesso
            await this.clearFailedAttempts(ip, email);

            // Atualizar último login
            await supabase
                .from('gtracker_users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', user.id);

            // Gerar token JWT
            const token = generateToken({
                userId: user.id,
                nickname: user.nickname,
                email: user.email,
                role: user.gtracker_roles.name
            });

            return {
                success: true,
                message: 'Login realizado com sucesso',
                data: {
                    token,
                    user: {
                        id: user.id,
                        nickname: user.nickname,
                        nome: user.nome,
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
                                pode_criar_topicos: user.gtracker_roles.pode_criar_topicos,
                                pode_upload: user.gtracker_roles.pode_upload,
                                pode_moderar: user.gtracker_roles.pode_moderar,
                                pode_editar_posts_outros: user.gtracker_roles.pode_editar_posts_outros,
                                pode_deletar_posts_outros: user.gtracker_roles.pode_deletar_posts_outros,
                                pode_banir_usuarios: user.gtracker_roles.pode_banir_usuarios,
                                pode_mover_topicos: user.gtracker_roles.pode_mover_topicos,
                                pode_fechar_topicos: user.gtracker_roles.pode_fechar_topicos,
                                acesso_admin: user.gtracker_roles.acesso_admin,
                                pode_gerenciar_usuarios: user.gtracker_roles.pode_gerenciar_usuarios,
                                pode_gerenciar_cargos: user.gtracker_roles.pode_gerenciar_cargos,
                                pode_ver_logs: user.gtracker_roles.pode_ver_logs,
                                pode_configurar_forum: user.gtracker_roles.pode_configurar_forum
                            }
                        }
                    }
                }
            };

        } catch (error) {
            console.error('Erro no login:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Registrar tentativa de login falhada
    static async recordFailedAttempt(ip, email) {
        try {
            const { data: existing, error: findError } = await supabase
                .from('gtracker_login_attempts')
                .select('*')
                .eq('ip_address', ip)
                .eq('email', email)
                .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
                .single();

            if (findError && findError.code !== 'PGRST116') {
                console.error('Erro ao buscar tentativas:', findError);
                return;
            }

            if (existing) {
                const newAttempts = existing.attempts + 1;
                const blockedUntil = newAttempts >= 5 ? 
                    new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

                await supabase
                    .from('gtracker_login_attempts')
                    .update({
                        attempts: newAttempts,
                        blocked_until: blockedUntil,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('gtracker_login_attempts')
                    .insert({
                        ip_address: ip,
                        email,
                        attempts: 1
                    });
            }
        } catch (error) {
            console.error('Erro ao registrar tentativa falhada:', error);
        }
    }

    // Limpar tentativas de login após sucesso
    static async clearFailedAttempts(ip, email) {
        try {
            await supabase
                .from('gtracker_login_attempts')
                .delete()
                .eq('ip_address', ip)
                .eq('email', email);
        } catch (error) {
            console.error('Erro ao limpar tentativas:', error);
        }
    }
}

module.exports = AuthService;