// Importando as paradas que a gente vai precisar
const CustomizationService = require('../services/customizationService'); 
const supabase = require('../config/supabase');

class CustomizationController {
    // Controller pra lidar com as customizações de perfil, tipo fotinha e capa maneira
    // Bora fazer o upload do avatar do usuário, vulgo fotinha de perfil
    static async uploadAvatar(req, res) {
        // Esse try/catch é tipo um cinto de segurança, se der ruim, a gente não quebra tudo
        try {
            // Checando se o middleware de upload fez o trabalho dele e jogou a URL da imagem aqui
            // Se não tiver req.uploadedAvatarUrl, quer dizer que o middleware falhou ou o usuário não mandou nada... vacilão!
            if (!req.uploadedAvatarUrl) {
                return res.status(400).json({ // HTTP 400: Bad Request, tipo "Ô meu chapa, manda o arquivo direito!"
                    success: false,
                    message: 'Nenhum arquivo foi processado com sucesso... Culpa sua ou minha? 🤫'
                });
            }

            // Pegando o ID do usuário que tá logado. Isso vem lá do nosso middleware de autenticação, confia.
            const userId = req.user.id;

            // Antes de salvar a nova, vamos ver se já não tem uma foto antiga pra gente poder deletar ela do storage.
            // Senão daqui a pouco tem mais foto órfã que gatinho na rua.
            const { data: currentProfile } = await supabase
                .from('gtracker_profiles') // Nossa tabela de perfis, espero que o nome esteja certo
                .select('avatar_url') // Só quero a URL do avatar antigo mesmo
                .eq('user_id', userId) // Do usuário específico, claro
                .single(); // single() porque só pode ter um perfil por usuário, né? Se tiver mais, deu ruim na modelagem! 😬

            // Chamando o service pra fazer o trabalho sujo: atualizar o avatar no banco e deletar o antigo do storage
            const result = await CustomizationService.updateAvatar(
                userId, // ID do usuário
                req.uploadedAvatarUrl, // URL da imagem nova que o middleware upou e comprimiu lindamente
                currentProfile?.avatar_url // URL da imagem antiga, se existir. Esse "?" é pra não dar erro se currentProfile for null, malandro!
            );

            // Se o service deu bom, a gente manda um 200 (OK), senão um 400 (Bad Request) porque algo deu errado lá no service.
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json({
                ...result, // Espalhando o resultado do service (que já tem success e message)
                info: { // Mandando umas infos extras pro frontend, só pra mostrar que a gente é daora
                    original_size: req.file ? `${(req.file.size / 1024 / 1024).toFixed(2)}MB` : 'N/A', // Tamanho original, se tiver... senão, "N/A" pra não quebrar
                    compressed: true, // Avisando que a imagem foi comprimida, porque a gente é eficiente
                    format: 'webp' // E o formato que a gente converteu, pra ficar moderninho e leve
                }
            });

        } catch (error) { // Opa, deu algum erro inesperado aqui no controller!
            console.error('Erro no controller de upload de avatar:', error); // Printa o erro no console pra gente poder debugar depois (ou fingir que vai)
            return res.status(500).json({ // HTTP 500: Internal Server Error. Clássico "Deu ruim e a culpa não é sua (eu acho)"
                success: false,
                message: 'Erro interno do servidor. Relaxa, a gente já tá correndo atrás do prejuízo (ou não 🤪)'
            });
        }
    }

    // Agora a imagem de capa, aquela que fica atrás da fotinha de perfil. Quase igual ao avatar.
    static async uploadCover(req, res) {
        try {
            // Mesma lógica do avatar: se não veio a URL da capa, algo deu errado antes.
            if (!req.uploadedCoverUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'Nenhum arquivo de capa foi processado com sucesso. Já tentou reiniciar? 😂'
                });
            }

            const userId = req.user.id; // ID do usuário, sempre importante

            // Buscando a capa atual pra deletar depois, igualzinho ao avatar. DRY? Que é isso? Um biscoito?
            const { data: currentProfile } = await supabase
                .from('gtracker_profiles')
                .select('cover_image_url') // Só muda o nome da coluna aqui
                .eq('user_id', userId)
                .single();

            // Chama o service pra atualizar a imagem de capa
            const result = await CustomizationService.updateCoverImage(
                userId,
                req.uploadedCoverUrl, // A nova URL da capa
                currentProfile?.cover_image_url // A URL antiga da capa, se tiver
            );

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json({
                ...result,
                info: { // Mais infos legais pro frontend
                    original_size: req.file ? `${(req.file.size / 1024 / 1024).toFixed(2)}MB` : 'N/A',
                    compressed: true,
                    format: 'webp',
                    dimensions: '1200x400px (ou menor se necessário)' // Uma dica de dimensões, porque a gente se importa com o design (às vezes)
                }
            });

        } catch (error) {
            console.error('Erro no controller de upload de capa:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao subir a capa. Foi quase!'
            });
        }
    }

    // Atualizar outras customizações do perfil, tipo cor do tema, sei lá o que mais o PO vai inventar
    static async updateCustomization(req, res) {
        try {
            const userId = req.user.id; // Usuário de novo
            // Aqui o req.body deve vir com um objeto tipo { theme: 'dark', showFeaturedGame: true }
            // E o service que se vire pra validar e salvar isso! 😂
            const result = await CustomizationService.updateProfileCustomization(userId, req.body);

            const statusCode = result.success ? 200 : 400; // Se o service falar que deu bom, a gente acredita
            return res.status(statusCode).json(result); // Retorna o resultado do service direto

        } catch (error) {
            console.error('Erro no controller de customização:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao customizar. Customizou tanto que quebrou!'
            });
        }
    }

    // Buscar as estatísticas maneiras do usuário pra mostrar no perfil dele
    static async getUserStats(req, res) {
        try {
            const userId = req.user.id; // De quem são as stats? Dele mesmo!
            const result = await CustomizationService.getUserStats(userId); // Service, me vê umas estatísticas aí, por favor!

            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);

        } catch (error) {
            console.error('Erro no controller de estatísticas:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao buscar estatísticas. Os números não mentem, mas às vezes eles bugam.'
            });
        }
    }

    // E se o usuário cansar da fotinha de perfil e quiser tirar? A gente remove!
    static async removeAvatar(req, res) {
        try {
            const userId = req.user.id;

            // Primeiro, vamos ver se ele realmente TEM um avatar pra remover, né?
            const { data: currentProfile } = await supabase
                .from('gtracker_profiles')
                .select('avatar_url')
                .eq('user_id', userId)
                .single();

            // Se tiver uma URL de avatar lá...
            if (currentProfile?.avatar_url) {
                // ...a gente manda o service deletar o arquivo do storage. Não queremos lixo digital!
                await CustomizationService.deleteOldAvatar(currentProfile.avatar_url);
            } else {
                // Se não tem avatar, não precisa fazer nada no storage, mas tudo bem, segue o baile.
                // Poderia mandar um 404 aqui? Talvez... mas vamos simplificar.
            }

            // Agora, limpamos a URL do avatar no banco de dados. Adeus, fotinha!
            const { error } = await supabase
                .from('gtracker_profiles')
                .update({
                    avatar_url: null, // Nulificando o campo, chique né?
                    updated_at: new Date().toISOString() // Sempre bom atualizar quando a gente mexeu
                })
                .eq('user_id', userId); // Só pro usuário certo, claro

            // Se o Supabase reclamou de alguma coisa...
            if (error) {
                // ...a gente joga um erro pra cima, pro nosso catch pegar. "Deu ruim no Supabase, chefe!"
                throw new Error('Erro ao remover avatar do banco: ' + error.message);
            }

            // Se chegou até aqui, é porque deu tudo certo! 🎉
            return res.json({
                success: true,
                message: 'Avatar removido com sucesso! Agora você é um usuário misterioso. 😎'
            });

        } catch (error) {
            console.error('Erro ao remover avatar:', error); // Deu ruim em algum lugar...
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao tentar remover o avatar. Ele se apegou demais!'
            });
        }
    }

    // E a capa? Mesma coisa, se o usuário não quer mais, a gente tira.
    static async removeCover(req, res) {
        try {
            const userId = req.user.id;

            // Verifica se existe uma capa pra ser removida
            const { data: currentProfile } = await supabase
                .from('gtracker_profiles')
                .select('cover_image_url')
                .eq('user_id', userId)
                .single();

            // Se tinha uma URL de capa...
            if (currentProfile?.cover_image_url) {
                // ...manda o service deletar o arquivo físico. Xô, capa velha!
                await CustomizationService.deleteOldCover(currentProfile.cover_image_url);
            }

            // E agora limpa a URL da capa no banco.
            const { error } = await supabase
                .from('gtracker_profiles')
                .update({
                    cover_image_url: null, // Bye bye, capa!
                    updated_at: new Date().toISOString() // Atualiza a data de modificação
                })
                .eq('user_id', userId);

            // Se o Supabase deu xilique...
            if (error) {
                // ...a gente avisa que deu problema.
                throw new Error('Erro ao remover capa do banco: ' + error.message);
            }

            // Sucesso! Pode comemorar!
            return res.json({
                success: true,
                message: 'Imagem de capa removida com sucesso! Um perfil mais minimalista agora.'
            });

        } catch (error) {
            console.error('Erro ao remover capa:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao tentar remover a capa. Parece que ela gostou de ficar aí.'
            });
        }
    }
}

// Exportando a classe pra poder usar em outro lugar, tipo nas rotas. Isso é padrão, né?
module.exports = CustomizationController;