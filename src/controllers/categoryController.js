
const CategoryService = require('../services/categoryService');

class CategoryController {
    // Controller pra lidar com as categorias dos posts, jogos, ou seja lá o que for que a gente tá categorizando.

    // Listar todas as categorias. O básico do básico.
    static async getAllCategories(req, res) {
        try {
            // Um query param pra decidir se a gente traz as categorias inativas também.
            // Por padrão, é `false`, porque ninguém quer ver coisa velha... a menos que queira.
            const { include_inactive = false } = req.query;
            // Convertendo a string 'true' (ou qualquer outra coisa) para booleano de verdade.
            // Se não for 'true', vai ser false. JavaScript sendo JavaScript.
            const includeInactive = include_inactive === 'true';

            // Chama o service, ele que se vire pra filtrar ou não as inativas.
            const result = await CategoryService.getAllCategories(includeInactive);

            // Aqui tem uma pequena divergência: se o service der `success: false`,
            // a gente tá mandando 500. Idealmente, o service já indicaria um erro mais específico (tipo 404 se não achar nada).
            // Mas por enquanto, se o service diz que não deu 'success', a gente assume que é erro nosso. #GambiarraDoBem?
            const statusCode = result.success ? 200 : 500; // 200 (OK) ou 500 (Erro interno genérico)
            return res.status(statusCode).json(result);
        } catch (error) {
            // Se o trem descarrilhar feio aqui...
            console.error('Erro no controller de categorias:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao listar categorias. As prateleiras caíram.'
            });
        }
    }

    // Criar uma nova categoria. Alguém tem que organizar a bagunça.
    static async createCategory(req, res) {
        try {
            // Quem tá criando? O usuário logado, claro. (Confia no middleware de auth , se der ruim, é culpa dele.)
            const userId = req.user.id;
            // Os dados da nova categoria (nome, talvez uma cor, ícone?) vêm no corpo da requisição.
            // O service que valide se tá tudo nos conformes.
            const result = await CategoryService.createCategory(req.body, userId);

            // 201 (Created) se o service confirmar a criação.
            // 400 (Bad Request) se os dados forem ruins ou a regra de negócio não deixar criar.
            const statusCode = result.success ? 201 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de criação de categoria:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao criar categoria. Faltou a etiqueta, talvez?'
            });
        }
    }

    // Atualizar uma categoria que já existe. Porque nomes mudam, ideias evoluem.
    static async updateCategory(req, res) {
        try {
            // Qual categoria vamos bulir? Pega o ID da URL.
            const { id } = req.params;
            // Quem tá fuçando? O usuário logado.
            // O service deve checar se esse user tem permissão pra editar (ex: só admin ou o criador).
            const userId = req.user.id;

            // Manda bala: ID da categoria, os novos dados do `req.body` e o `userId` pro service.
            const result = await CategoryService.updateCategory(id, req.body, userId);

            // 200 (OK) se a atualização foi um sucesso.
            // 400 (Bad Request) se algo deu errado (ID não existe, dados inválidos, sem permissão).
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de atualização de categoria:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao atualizar categoria. A tinta ainda estava fresca.'
            });
        }
    }

    // Deletar uma categoria. RIP categoria.
    // Cuidado: o service precisa tratar o que acontece com os itens que usavam essa categoria.
    static async deleteCategory(req, res) {
        try {
            // ID da categoria que vai pra vala.
            const { id } = req.params;
            // Aqui não estamos passando userId. O service tem uma lógica pra isso,

            const result = await CategoryService.deleteCategory(id);

            // 200 (OK) se a categoria foi pro além com sucesso.
            // 400 (Bad Request) se não pôde ser deletada (talvez ainda tem posts nela? Ou não existe?).
            const statusCode = result.success ? 200 : 400;
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error('Erro no controller de exclusão de categoria:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao deletar categoria. Ela se agarrou à existência.'
            });
        }
    }
}

// Exporta a classe, porque é assim que o NodeJS funciona. Sem surpresas aqui.
module.exports = CategoryController;