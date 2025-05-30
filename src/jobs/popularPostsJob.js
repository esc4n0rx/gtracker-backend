// src/jobs/popularPostsJob.js
const supabase = require('../config/supabase');
const LevelService = require('../services/levelService');

class PopularPostsJob {
    // Executar job para verificar posts populares
    static async checkPopularPosts() {
        try {
            console.log('Verificando posts populares para bônus de XP...');

            // Buscar posts que atingiram múltiplos de 10 comentários
            const { data: posts, error } = await supabase
                .from('gtracker_posts')
                .select(`
                    id,
                    author_id,
                    comment_count,
                    title
                `)
                .eq('is_active', true)
                .gte('comment_count', 10);

            if (error) {
                console.error('Erro ao buscar posts populares:', error);
                return;
            }

            for (const post of posts) {
                // Verificar se já recebeu bônus para este nível de comentários
                const bonusLevel = Math.floor(post.comment_count / 10) * 10;
                
                const { data: existingBonus, error: bonusError } = await supabase
                    .from('gtracker_xp_logs')
                    .select('id')
                    .eq('user_id', post.author_id)
                    .eq('action_type', 'post_popular')
                    .eq('related_post_id', post.id)
                    .gte('metadata->comment_count', bonusLevel)
                    .limit(1);

                if (bonusError) {
                    console.error('Erro ao verificar bônus existente:', bonusError);
                    continue;
                }

                // Se não recebeu bônus para este nível, dar XP
                if (!existingBonus || existingBonus.length === 0) {
                    await LevelService.awardPostPopular(
                        post.author_id,
                        post.id,
                        post.comment_count
                    );
                    
                    console.log(`Bônus de popularidade dado para post "${post.title}" (${post.comment_count} comentários)`);
                }
            }

        } catch (error) {
            console.error('Erro no job de posts populares:', error);
        }
    }

    // Iniciar job que roda a cada hora
    static startJob() {
        const INTERVAL = 60 * 60 * 1000; // 1 hora

        setInterval(async () => {
            await this.checkPopularPosts();
        }, INTERVAL);

        // Executar uma vez na inicialização (após 1 minuto)
        setTimeout(async () => {
            await this.checkPopularPosts();
        }, 60000);

        console.log('Job de posts populares iniciado (executa a cada hora)');
    }
}

module.exports = PopularPostsJob;