// src/services/forumService.js
const supabase = require('../config/supabase');

class ForumService {
    // Criar fórum
    static async createForum(forumData, userId) {
        try {
            const { name, description, category_id, parent_forum_id, display_order = 0 } = forumData;

            // Verificar se a categoria existe
            const { data: category, error: categoryError } = await supabase
                .from('gtracker_categories')
                .select('id')
                .eq('id', category_id)
                .eq('is_active', true)
                .single();

            if (categoryError || !category) {
                return {
                    success: false,
                    message: 'Categoria não encontrada ou inativa'
                };
            }

            // Se é subfórum, verificar se o fórum pai existe
            if (parent_forum_id) {
                const { data: parentForum, error: parentError } = await supabase
                    .from('gtracker_forums')
                    .select('id, category_id')
                    .eq('id', parent_forum_id)
                    .eq('is_active', true)
                    .single();

                if (parentError || !parentForum) {
                    return {
                        success: false,
                        message: 'Fórum pai não encontrado ou inativo'
                    };
                }

                // Verificar se o fórum pai está na mesma categoria
                if (parentForum.category_id !== category_id) {
                    return {
                        success: false,
                        message: 'Subfórum deve estar na mesma categoria do fórum pai'
                    };
                }
            }

            // Verificar se já existe fórum com esse nome na categoria
            const { data: existing, error: checkError } = await supabase
                .from('gtracker_forums')
                .select('id')
                .eq('name', name)
                .eq('category_id', category_id)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw new Error('Erro ao verificar fórum existente: ' + checkError.message);
            }

            if (existing) {
                return {
                    success: false,
                    message: 'Já existe um fórum com este nome nesta categoria'
                };
            }

            const { data: forum, error } = await supabase
                .from('gtracker_forums')
                .insert({
                    name,
                    description,
                    category_id,
                    parent_forum_id,
                    display_order,
                    created_by: userId,
                    updated_by: userId
                })
                .select(`
                    *,
                    gtracker_categories!inner(name, description)
                `)
                .single();

            if (error) {
                throw new Error('Erro ao criar fórum: ' + error.message);
            }

            return {
                success: true,
                message: 'Fórum criado com sucesso',
                data: forum
            };
        } catch (error) {
            console.error('Erro ao criar fórum:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Buscar fórum por ID
    static async getForumById(forumId) {
        try {
            const { data: forum, error } = await supabase
                .from('gtracker_forums')
                .select(`
                    *,
                    gtracker_categories!inner(id, name, description),
                    parent_forum:gtracker_forums!parent_forum_id(id, name),
                    subforums:gtracker_forums!parent_forum_id(
                        id,
                        name,
                        description,
                        total_topics,
                        total_posts,
                        display_order,
                        is_active
                    )
                `)
                .eq('id', forumId)
                .eq('is_active', true)
                .single();

            if (error || !forum) {
                return {
                    success: false,
                    message: 'Fórum não encontrado'
                };
            }

            // Organizar subfóruns
            forum.subforums = forum.subforums
                .filter(sub => sub.is_active)
                .sort((a, b) => a.display_order - b.display_order);

            return {
                success: true,
                data: forum
            };
        } catch (error) {
            console.error('Erro ao buscar fórum:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Atualizar fórum
    static async updateForum(forumId, updateData, userId) {
        try {
            const { name, description, category_id, parent_forum_id, display_order, is_active } = updateData;
            const updateFields = { updated_by: userId };

            // Verificar se o fórum existe
            const { data: currentForum, error: currentError } = await supabase
                .from('gtracker_forums')
                .select('id, category_id, parent_forum_id')
                .eq('id', forumId)
                .single();

            if (currentError || !currentForum) {
                return {
                    success: false,
                    message: 'Fórum não encontrado'
                };
            }

            if (name !== undefined) {
                const checkCategoryId = category_id || currentForum.category_id;
                
                // Verificar se já existe outro fórum com esse nome na categoria
                const { data: existing, error: checkError } = await supabase
                    .from('gtracker_forums')
                    .select('id')
                    .eq('name', name)
                    .eq('category_id', checkCategoryId)
                    .neq('id', forumId)
                    .single();

                if (checkError && checkError.code !== 'PGRST116') {
                    throw new Error('Erro ao verificar fórum existente: ' + checkError.message);
                }

                if (existing) {
                    return {
                        success: false,
                        message: 'Já existe um fórum com este nome nesta categoria'
                    };
                }

                updateFields.name = name;
            }

            if (category_id !== undefined) {
                // Verificar se a nova categoria existe
                const { data: category, error: categoryError } = await supabase
                    .from('gtracker_categories')
                    .select('id')
                    .eq('id', category_id)
                    .eq('is_active', true)
                    .single();

                if (categoryError || !category) {
                    return {
                        success: false,
                        message: 'Categoria não encontrada ou inativa'
                    };
                }

                updateFields.category_id = category_id;
            }

            if (parent_forum_id !== undefined) {
                if (parent_forum_id) {
                    // Verificar se o fórum pai existe
                    const { data: parentForum, error: parentError } = await supabase
                        .from('gtracker_forums')
                        .select('id, category_id')
                        .eq('id', parent_forum_id)
                        .eq('is_active', true)
                        .single();

                    if (parentError || !parentForum) {
                        return {
                            success: false,
                            message: 'Fórum pai não encontrado ou inativo'
                        };
                    }

                    // Verificar se não está tentando ser pai de si mesmo
                    if (parent_forum_id === forumId) {
                        return {
                            success: false,
                            message: 'Fórum não pode ser pai de si mesmo'
                        };
                    }

                    const checkCategoryId = category_id || currentForum.category_id;
                    if (parentForum.category_id !== checkCategoryId) {
                        return {
                            success: false,
                            message: 'Subfórum deve estar na mesma categoria do fórum pai'
                        };
                    }
                }

                updateFields.parent_forum_id = parent_forum_id;
            }

            if (description !== undefined) updateFields.description = description;
            if (display_order !== undefined) updateFields.display_order = display_order;
            if (is_active !== undefined) updateFields.is_active = is_active;

            const { data: forum, error } = await supabase
                .from('gtracker_forums')
                .update(updateFields)
                .eq('id', forumId)
                .select(`
                    *,
                    gtracker_categories!inner(name, description)
                `)
                .single();

            if (error) {
                throw new Error('Erro ao atualizar fórum: ' + error.message);
            }

            return {
                success: true,
                message: 'Fórum atualizado com sucesso',
                data: forum
            };
        } catch (error) {
            console.error('Erro ao atualizar fórum:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Deletar fórum
    static async deleteForum(forumId) {
        try {
            // Verificar se existem subfóruns
            const { data: subforums, error: subforumsError } = await supabase
                .from('gtracker_forums')
                .select('id')
                .eq('parent_forum_id', forumId)
                .limit(1);

            if (subforumsError) {
                throw new Error('Erro ao verificar subfóruns: ' + subforumsError.message);
            }

            if (subforums && subforums.length > 0) {
                return {
                    success: false,
                    message: 'Não é possível deletar fórum que possui subfóruns'
                };
            }

            // TODO: Verificar se existem tópicos neste fórum quando implementarmos o sistema de posts

            const { error } = await supabase
                .from('gtracker_forums')
                .delete()
                .eq('id', forumId);

            if (error) {
                throw new Error('Erro ao deletar fórum: ' + error.message);
            }

            return {
                success: true,
                message: 'Fórum deletado com sucesso'
            };
        } catch (error) {
            console.error('Erro ao deletar fórum:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }
}

module.exports = ForumService;