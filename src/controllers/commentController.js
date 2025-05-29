// src/controllers/commentController.js

// Puxando o CommentService, que é quem realmente bota a mão na massa.
const CommentService = require('../services/commentService');

class CommentController {
    // Controller para gerenciar os comentários. Basicamente o CRUD e um like maroto.

    // Endpoint para criar um novo comentário. Simples e direto.
    static async createComment(req, res) {
        try {
            // O ID do usuário vem lá do middleware de autenticação, teoricamente.
            const userId = req.user.id;
            // O corpo da requisição (req.body) deve ter o texto do comentário e o postId.
            // Passando tudo pro service resolver. Que ele se vire com a lógica.
            const result = await CommentService.createComment(req.body, userId);

            // Se o service retornar sucesso, a gente manda um 201 (Created).
            // Senão, 400 (Bad Request) porque provavelmente faltou algo ou deu ruim na validação lá no service.
            const statusCode = result.success ? 201 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            // Se a coisa explodir aqui no controller, é cagada nossa (ou do JS, sei lá).
            console.error('Erro no controller de criação de comentário:', error);
            return res.status(500).json({ // Erro 500, o clássico "deu ruim e não sei onde".
                success: false,
                message: 'Erro interno do servidor ao tentar criar comentário. Tenta de novo, vai que...'
            });
        }
    }

    // Endpoint para listar os comentários de um post específico.
    static async getCommentsByPost(req, res) {
        try {
            // O ID do post vem pela URL (tipo /posts/123/comments).
            const { postId } = req.params;
            // Paginação básica: ?page=1&limit=10. Se não vier, tem uns defaults aqui.
            const { page = 1, limit = 50 } = req.query; // 50 é um limite generoso, hein? Performance que lute.
            // O userId é opcional aqui, pode ser um usuário logado vendo os likes ou um anônimo.
            // Se req.user existir, pega o id, senão é null e o service decide o que fazer.
            const userId = req.user ? req.user.id : null;

            // Chama o service pra buscar os comentários, convertendo page e limit pra número.
            // Vai que alguém manda "batata" como página, né? parseInt resolve (ou vira NaN, mas o service deve tratar).
            const result = await CommentService.getCommentsByPost(
                postId,
                parseInt(page),
                parseInt(limit),
                userId
            );

            const statusCode = result.success ? 200 : 400; // 200 (OK) se achou, 400 se deu ruim a busca.
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de listagem de comentários:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao listar comentários. Alguém tropeçou nos bits.'
            });
        }
    }

    // Endpoint para atualizar um comentário existente. Só o dono pode, espero.
    static async updateComment(req, res) {
        try {
            // ID do comentário a ser atualizado, vem da URL.
            const { id } = req.params;
            // ID do usuário que tá tentando editar. O service vai checar se ele pode.
            const userId = req.user.id;

            // Manda o ID do comentário, os novos dados (req.body) e o userId pro service.
            // O service que lute pra ver se o usuário é o dono e se os dados são válidos.
            const result = await CommentService.updateComment(id, req.body, userId);

            const statusCode = result.success ? 200 : 400; // 200 se atualizou, 400 se não rolou (permissão, dados inválidos etc).
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de atualização de comentário:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao atualizar comentário. Às vezes, é melhor deixar como tá.'
            });
        }
    }

    // Endpoint para deletar um comentário. Cuidado pra não apagar o comentário errado!
    static async deleteComment(req, res) {
        try {
            // ID do comentário a ser enviado para o além.
            const { id } = req.params;
            // ID do usuário tentando a exclusão. Novamente, o service valida a permissão.
            const userId = req.user.id;

            // Chama o service pra fazer o trabalho sujo.
            const result = await CommentService.deleteComment(id, userId);

            const statusCode = result.success ? 200 : 400; // 200 se foi pro beleléu, 400 se não deu.
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de exclusão de comentário:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao deletar comentário. Ele se recusa a partir!'
            });
        }
    }

    // Endpoint pra dar like ou deslike num comentário. O famoso "curtir".
    static async toggleLike(req, res) {
        try {
            // ID do comentário que vai ganhar um coração (ou perder).
            const { id } = req.params;
            // ID do usuário que tá interagindo.
            const userId = req.user.id;

            // O service cuida da lógica de adicionar/remover o like.
            const result = await CommentService.toggleCommentLike(id, userId);

            const statusCode = result.success ? 200 : 400; // 200 se o like foi computado, 400 se algo deu errado.
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de like de comentário:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao processar o like. O amor nem sempre é fácil.'
            });
        }
    }
}

// Exporta o controller pra ser usado nas rotas. Nada de novo sob o sol.
module.exports = CommentController;