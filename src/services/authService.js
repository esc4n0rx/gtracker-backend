
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { generateToken } = require('../utils/jwt');

class AuthService {
    // Gerar código de convite único
    static generateInviteCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = 'GT-';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Verificar se registro está aberto
    static async isRegistrationOpen() {
        const { data, error } = await supabase
            .from('gtracker_settings')
            .select('value')
            .eq('key', 'registration_open')
            .single();

        if (error) {
            console.error('Erro ao verificar configuração de registro:', error);
            return true; // Default para aberto em caso de erro
        }

        return data.value === 'true';
    }

    // Validar código de convite
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

    // Login do usuário
    static async loginUser(email, password, ip) {
        try {
            // Buscar usuário com role
            const { data: user, error: userError } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    nickname,
                    email,
                    password_hash,
                    nome,
                    is_active,
                    gtracker_roles!inner(name, display_name, level, permissions)
                `)
                .eq('email', email)
                .single();

            if (userError || !user) {
                // Registrar tentativa falhada
                await this.recordFailedAttempt(ip, email);
                return {
                    success: false,
                    message: 'Email ou senha incorretos'
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
                        role: user.gtracker_roles
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