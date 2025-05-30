// src/services/levelService.js
const supabase = require('../config/supabase');

class LevelService {
    // Tipos de ações que geram XP
    static XP_ACTIONS = {
        POST_CREATED: 'post_created',
        POST_REMOVED: 'post_removed', // XP negativo
        COMMENT_CREATED: 'comment_created',
        LIKE_GIVEN: 'like_given',
        LIKE_RECEIVED: 'like_received',
        POST_PINNED: 'post_pinned',
        POST_POPULAR: 'post_popular', // Bônus por comentários
        DONATION: 'donation'
    };

    // Valores de XP por ação
    static XP_VALUES = {
        [this.XP_ACTIONS.POST_CREATED]: 50,
        [this.XP_ACTIONS.POST_REMOVED]: -50,
        [this.XP_ACTIONS.COMMENT_CREATED]: 20,
        [this.XP_ACTIONS.LIKE_GIVEN]: 5,
        [this.XP_ACTIONS.LIKE_RECEIVED]: 10,
        [this.XP_ACTIONS.POST_PINNED]: 100,
        [this.XP_ACTIONS.POST_POPULAR]: 1, // Por cada 10 comentários
        [this.XP_ACTIONS.DONATION]: 1000
    };

    // Cooldowns para prevenir spam (em minutos)
    static COOLDOWNS = {
        [this.XP_ACTIONS.COMMENT_CREATED]: 1, // 1 minuto entre comentários
        [this.XP_ACTIONS.LIKE_GIVEN]: 0.1, // 6 segundos entre likes
        [this.XP_ACTIONS.POST_CREATED]: 5 // 5 minutos entre posts
    };

    // Verificar se ação está em cooldown
    static async isActionInCooldown(userId, actionType) {
        try {
            const cooldownMinutes = this.COOLDOWNS[actionType];
            if (!cooldownMinutes) return false;

            const cooldownTime = new Date(Date.now() - (cooldownMinutes * 60 * 1000));

            const { data, error } = await supabase
                .from('gtracker_xp_logs')
                .select('created_at')
                .eq('user_id', userId)
                .eq('action_type', actionType)
                .gte('created_at', cooldownTime.toISOString())
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) {
                console.error('Erro ao verificar cooldown:', error);
                return false;
            }

            return data && data.length > 0;
        } catch (error) {
            console.error('Erro na verificação de cooldown:', error);
            return false;
        }
    }

    // Verificar antifraude para comentários
    static async checkCommentSpam(userId, postId) {
        try {
            // Verificar se já comentou neste post recentemente (últimos 30 minutos)
            const recentTime = new Date(Date.now() - (30 * 60 * 1000));

            const { data, error } = await supabase
                .from('gtracker_xp_logs')
                .select('id')
                .eq('user_id', userId)
                .eq('action_type', this.XP_ACTIONS.COMMENT_CREATED)
                .eq('related_post_id', postId)
                .gte('created_at', recentTime.toISOString());

            if (error) {
                console.error('Erro ao verificar spam de comentários:', error);
                return false;
            }

            // Se já comentou mais de 3 vezes no mesmo post em 30 min, é spam
            return data && data.length >= 3;
        } catch (error) {
            console.error('Erro na verificação de spam:', error);
            return false;
        }
    }

    // Adicionar XP ao usuário
    static async addUserXP(userId, actionType, xpAmount, metadata = {}) {
        try {
            // Verificar cooldown
            if (await this.isActionInCooldown(userId, actionType)) {
                return {
                    success: false,
                    message: 'Ação em cooldown, aguarde um pouco'
                };
            }

            // Verificar spam para comentários
            if (actionType === this.XP_ACTIONS.COMMENT_CREATED && metadata.related_post_id) {
                if (await this.checkCommentSpam(userId, metadata.related_post_id)) {
                    return {
                        success: false,
                        message: 'Muitos comentários no mesmo post recentemente'
                    };
                }
            }

            // Iniciar transação
            const { data: user, error: userError } = await supabase
                .from('gtracker_users')
                .select('total_xp, current_level')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                return {
                    success: false,
                    message: 'Usuário não encontrado'
                };
            }

            const oldXP = user.total_xp;
            const oldLevel = user.current_level;
            const newXP = Math.max(0, oldXP + xpAmount); // XP não pode ser negativo

            // Atualizar XP do usuário
            const { error: updateError } = await supabase
                .from('gtracker_users')
                .update({ 
                    total_xp: newXP,
                    last_xp_action: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) {
                throw new Error('Erro ao atualizar XP: ' + updateError.message);
            }

            // Registrar log de XP
            const { error: logError } = await supabase
                .from('gtracker_xp_logs')
                .insert({
                    user_id: userId,
                    action_type: actionType,
                    xp_amount: xpAmount,
                    related_post_id: metadata.related_post_id || null,
                    related_comment_id: metadata.related_comment_id || null,
                    related_user_id: metadata.related_user_id || null,
                    metadata
                });

            if (logError) {
                console.error('Erro ao registrar log de XP:', logError);
            }

            // Verificar se subiu de nível
            const { data: updatedUser, error: levelError } = await supabase
                .from('gtracker_users')
                .select('current_level, gtracker_profiles!inner(level_progress)')
                .eq('id', userId)
                .single();

            if (levelError) {
                console.error('Erro ao buscar nível atualizado:', levelError);
            }

            const levelUp = updatedUser && updatedUser.current_level > oldLevel;

            return {
                success: true,
                data: {
                    old_xp: oldXP,
                    new_xp: newXP,
                    xp_gained: xpAmount,
                    old_level: oldLevel,
                    new_level: updatedUser?.current_level || oldLevel,
                    level_up: levelUp,
                    level_progress: updatedUser?.gtracker_profiles?.level_progress
                }
            };

        } catch (error) {
            console.error('Erro ao adicionar XP:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Obter informações de nível de um usuário
    static async getUserLevelInfo(userId) {
        try {
            const { data: user, error } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    total_xp,
                    current_level,
                    gtracker_profiles!inner(level_progress)
                `)
                .eq('id', userId)
                .single();

            if (error || !user) {
                return {
                    success: false,
                    message: 'Usuário não encontrado'
                };
            }

            // Buscar detalhes do nível atual
            const { data: levelDetails, error: levelError } = await supabase
                .from('gtracker_levels')
                .select('*')
                .eq('level_number', user.current_level)
                .single();

            if (levelError || !levelDetails) {
                return {
                    success: false,
                    message: 'Informações de nível não encontradas'
                };
            }

            return {
                success: true,
                data: {
                    total_xp: user.total_xp,
                    current_level: user.current_level,
                    level_details: levelDetails,
                    progress: user.gtracker_profiles.level_progress
                }
            };

        } catch (error) {
            console.error('Erro ao buscar informações de nível:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Buscar ranking de usuários por XP
    static async getXPRanking(page = 1, limit = 50) {
        try {
            const offset = (page - 1) * limit;

            const { data: users, error, count } = await supabase
                .from('gtracker_users')
                .select(`
                    id,
                    nickname,
                    nome,
                    total_xp,
                    current_level,
                    gtracker_profiles!inner(avatar_url),
                    gtracker_levels!current_level(name, emoji, color)
                `, { count: 'exact' })
                .eq('is_active', true)
                .order('total_xp', { ascending: false })
                .order('nickname', { ascending: true })
                .range(offset, offset + limit - 1);

            if (error) {
                throw new Error('Erro ao buscar ranking: ' + error.message);
            }

            return {
                success: true,
                data: {
                    ranking: users.map((user, index) => ({
                        position: offset + index + 1,
                        id: user.id,
                        nickname: user.nickname,
                        nome: user.nome,
                        total_xp: user.total_xp,
                        current_level: user.current_level,
                        level_info: user.gtracker_levels,
                        avatar_url: user.gtracker_profiles.avatar_url
                    })),
                    pagination: {
                        page,
                        limit,
                        total: count,
                        totalPages: Math.ceil(count / limit)
                    }
                }
            };

        } catch (error) {
            console.error('Erro ao buscar ranking:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Listar todos os níveis disponíveis
    static async getAllLevels() {
        try {
            const { data: levels, error } = await supabase
                .from('gtracker_levels')
                .select('*')
                .order('level_number', { ascending: true });

            if (error) {
                throw new Error('Erro ao buscar níveis: ' + error.message);
            }

            return {
                success: true,
                data: levels
            };

        } catch (error) {
            console.error('Erro ao buscar níveis:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Métodos específicos para cada ação

    static async awardPostCreated(userId, postId) {
        return this.addUserXP(
            userId,
            this.XP_ACTIONS.POST_CREATED,
            this.XP_VALUES[this.XP_ACTIONS.POST_CREATED],
            { related_post_id: postId }
        );
    }

    static async penalizePostRemoved(userId, postId) {
        return this.addUserXP(
            userId,
            this.XP_ACTIONS.POST_REMOVED,
            this.XP_VALUES[this.XP_ACTIONS.POST_REMOVED],
            { related_post_id: postId }
        );
    }

    static async awardCommentCreated(userId, postId, commentId) {
        return this.addUserXP(
            userId,
            this.XP_ACTIONS.COMMENT_CREATED,
            this.XP_VALUES[this.XP_ACTIONS.COMMENT_CREATED],
            { related_post_id: postId, related_comment_id: commentId }
        );
    }

    static async awardLikeGiven(userId, targetUserId, postId = null, commentId = null) {
        return this.addUserXP(
            userId,
            this.XP_ACTIONS.LIKE_GIVEN,
            this.XP_VALUES[this.XP_ACTIONS.LIKE_GIVEN],
            { 
                related_user_id: targetUserId,
                related_post_id: postId,
                related_comment_id: commentId
            }
        );
    }

    static async awardLikeReceived(userId, likerUserId, postId = null, commentId = null) {
        return this.addUserXP(
            userId,
            this.XP_ACTIONS.LIKE_RECEIVED,
            this.XP_VALUES[this.XP_ACTIONS.LIKE_RECEIVED],
            { 
                related_user_id: likerUserId,
                related_post_id: postId,
                related_comment_id: commentId
            }
        );
    }

    static async awardPostPinned(userId, postId) {
        return this.addUserXP(
            userId,
            this.XP_ACTIONS.POST_PINNED,
            this.XP_VALUES[this.XP_ACTIONS.POST_PINNED],
            { related_post_id: postId }
        );
    }

    static async awardPostPopular(userId, postId, commentCount) {
        const bonusXP = Math.floor(commentCount / 10) * this.XP_VALUES[this.XP_ACTIONS.POST_POPULAR];
        if (bonusXP <= 0) return { success: true, data: { xp_gained: 0 } };

        return this.addUserXP(
            userId,
            this.XP_ACTIONS.POST_POPULAR,
            bonusXP,
            { related_post_id: postId, comment_count: commentCount }
        );
    }

    static async awardDonation(userId, donationAmount) {
        return this.addUserXP(
            userId,
            this.XP_ACTIONS.DONATION,
            this.XP_VALUES[this.XP_ACTIONS.DONATION],
            { donation_amount: donationAmount }
        );
    }
}

module.exports = LevelService;