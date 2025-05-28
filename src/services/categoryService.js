// src/services/categoryService.js
const supabase = require('../config/supabase');

class CategoryService {
    // Listar todas as categorias com fóruns
    static async getAllCategories(includeInactive = false) {
        try {
            let categoryQuery = supabase
                .from('gtracker_categories')
                .select(`
                    id,
                    name,
                    description,
                    display_order,
                    is_active,
                    created_at
                `)
                .order('display_order', { ascending: true });

            if (!includeInactive) {
                categoryQuery = categoryQuery.eq('is_active', true);
            }

            const { data: categories, error: catError } = await categoryQuery;

            if (catError) {
                throw new Error('Erro ao buscar categorias: ' + catError.message);
            }

            // Buscar todos os fóruns de uma vez
            let forumsQuery = supabase
                .from('gtracker_forums')
                .select(`
                    id,
                    name,
                    description,
                    display_order,
                    parent_forum_id,
                    category_id,
                    total_topics,
                    total_posts,
                    last_post_at,
                    last_post_user_id,
                    is_active
                `)
                .order('display_order', { ascending: true });

            if (!includeInactive) {
                forumsQuery = forumsQuery.eq('is_active', true);
            }

            const { data: allForums, error: forumsError } = await forumsQuery;

            if (forumsError) {
                throw new Error('Erro ao buscar fóruns: ' + forumsError.message);
            }

            // Organizar fóruns por categoria com hierarquia correta
            const organizedCategories = categories.map(category => {
                // Filtrar fóruns desta categoria
                const categoryForums = allForums.filter(forum => forum.category_id === category.id);
                
                // Separar fóruns principais e subfóruns
                const mainForums = categoryForums.filter(forum => !forum.parent_forum_id);
                const subforums = categoryForums.filter(forum => forum.parent_forum_id);

                // Organizar fóruns com seus subfóruns
                const forumsWithSubforums = mainForums.map(forum => {
                    const forumSubforums = subforums
                        .filter(sub => sub.parent_forum_id === forum.id)
                        .sort((a, b) => a.display_order - b.display_order);

                    return {
                        ...forum,
                        subforums: forumSubforums
                    };
                }).sort((a, b) => a.display_order - b.display_order);

                return {
                    ...category,
                    forums: forumsWithSubforums
                };
            });

            return {
                success: true,
                data: organizedCategories
            };
        } catch (error) {
            console.error('Erro ao buscar categorias:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Criar categoria
    static async createCategory(categoryData, userId) {
        try {
            const { name, description, display_order = 0 } = categoryData;

            // Verificar se já existe categoria com esse nome
            const { data: existing, error: checkError } = await supabase
                .from('gtracker_categories')
                .select('id')
                .eq('name', name)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw new Error('Erro ao verificar categoria existente: ' + checkError.message);
            }

            if (existing) {
                return {
                    success: false,
                    message: 'Já existe uma categoria com este nome'
                };
            }

            const { data: category, error } = await supabase
                .from('gtracker_categories')
                .insert({
                    name,
                    description,
                    display_order,
                    created_by: userId,
                    updated_by: userId
                })
                .select()
                .single();

            if (error) {
                throw new Error('Erro ao criar categoria: ' + error.message);
            }

            return {
                success: true,
                message: 'Categoria criada com sucesso',
                data: category
            };
        } catch (error) {
            console.error('Erro ao criar categoria:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Atualizar categoria
    static async updateCategory(categoryId, updateData, userId) {
        try {
            const { name, description, display_order, is_active } = updateData;
            const updateFields = { updated_by: userId };

            if (name !== undefined) {
                // Verificar se já existe outra categoria com esse nome
                const { data: existing, error: checkError } = await supabase
                    .from('gtracker_categories')
                    .select('id')
                    .eq('name', name)
                    .neq('id', categoryId)
                    .single();

                if (checkError && checkError.code !== 'PGRST116') {
                    throw new Error('Erro ao verificar categoria existente: ' + checkError.message);
                }

                if (existing) {
                    return {
                        success: false,
                        message: 'Já existe uma categoria com este nome'
                    };
                }

                updateFields.name = name;
            }

            if (description !== undefined) updateFields.description = description;
            if (display_order !== undefined) updateFields.display_order = display_order;
            if (is_active !== undefined) updateFields.is_active = is_active;

            const { data: category, error } = await supabase
                .from('gtracker_categories')
                .update(updateFields)
                .eq('id', categoryId)
                .select()
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return {
                        success: false,
                        message: 'Categoria não encontrada'
                    };
                }
                throw new Error('Erro ao atualizar categoria: ' + error.message);
            }

            return {
                success: true,
                message: 'Categoria atualizada com sucesso',
                data: category
            };
        } catch (error) {
            console.error('Erro ao atualizar categoria:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Deletar categoria
    static async deleteCategory(categoryId) {
        try {
            // Verificar se existem fóruns nesta categoria
            const { data: forums, error: forumsError } = await supabase
                .from('gtracker_forums')
                .select('id')
                .eq('category_id', categoryId)
                .limit(1);

            if (forumsError) {
                throw new Error('Erro ao verificar fóruns: ' + forumsError.message);
            }

            if (forums && forums.length > 0) {
                return {
                    success: false,
                    message: 'Não é possível deletar categoria que possui fóruns'
                };
            }

            const { error } = await supabase
                .from('gtracker_categories')
                .delete()
                .eq('id', categoryId);

            if (error) {
                throw new Error('Erro ao deletar categoria: ' + error.message);
            }

            return {
                success: true,
                message: 'Categoria deletada com sucesso'
            };
        } catch (error) {
            console.error('Erro ao deletar categoria:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }
}

module.exports = CategoryService;