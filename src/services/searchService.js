// src/services/searchService.js
const supabase = require('../config/supabase');

class SearchService {
    // Buscar posts por termo
    static async searchPosts(query, filters = {}, page = 1, limit = 20) {
        try {
            const { 
                forum_id, 
                category_id, 
                post_type, 
                author_id,
                date_from,
                date_to 
            } = filters;

            const offset = (page - 1) * limit;

            let searchQuery = supabase
                .from('gtracker_posts')
                .select(`
                    id,
                    title,
                    slug,
                    post_type,
                    view_count,
                    like_count,
                    comment_count,
                    created_at,
                    gtracker_users!author_id(id, nickname, nome),
                    gtracker_forums!inner(
                        id,
                        name,
                        gtracker_categories!inner(id, name)
                    )
                `, { count: 'exact' })
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            // Filtro de busca por texto
            if (query && query.trim()) {
                searchQuery = searchQuery.or(`title.ilike.%${query}%,content.ilike.%${query}%`);
            }

            // Filtros específicos
            if (forum_id) {
                searchQuery = searchQuery.eq('forum_id', forum_id);
            }

            if (category_id) {
                searchQuery = searchQuery.eq('gtracker_forums.category_id', category_id);
            }

            if (post_type) {
                searchQuery = searchQuery.eq('post_type', post_type);
            }

            if (author_id) {
                searchQuery = searchQuery.eq('author_id', author_id);
            }

            if (date_from) {
                searchQuery = searchQuery.gte('created_at', date_from);
            }

            if (date_to) {
                searchQuery = searchQuery.lte('created_at', date_to);
            }

            const { data: posts, error, count } = await searchQuery;

            if (error) {
                throw new Error('Erro na busca: ' + error.message);
            }

            return {
                success: true,
                data: {
                    posts: posts.map(post => ({
                        ...post,
                        author: post.gtracker_users,
                        forum: post.gtracker_forums
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
            console.error('Erro no serviço de busca:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Buscar posts recentes
    static async getRecentPosts(limit = 10) {
        try {
            const { data: posts, error } = await supabase
                .from('gtracker_posts')
                .select(`
                    id,
                    title,
                    slug,
                    post_type,
                    created_at,
                    gtracker_users!author_id(id, nickname, nome),
                    gtracker_forums!inner(
                        id,
                        name,
                        gtracker_categories!inner(id, name)
                    )
                `)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                throw new Error('Erro ao buscar posts recentes: ' + error.message);
            }

            return {
                success: true,
                data: posts.map(post => ({
                    ...post,
                    author: post.gtracker_users,
                    forum: post.gtracker_forums
                }))
            };

        } catch (error) {
            console.error('Erro ao buscar posts recentes:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Buscar posts mais populares
    static async getPopularPosts(period = '7d', limit = 10) {
        try {
            let dateFilter;
            const now = new Date();

            switch (period) {
                case '24h':
                    dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            }

            const { data: posts, error } = await supabase
                .from('gtracker_posts')
                .select(`
                    id,
                    title,
                    slug,
                    post_type,
                    view_count,
                    like_count,
                    comment_count,
                    created_at,
                    gtracker_users!author_id(id, nickname, nome),
                    gtracker_forums!inner(
                        id,
                        name,
                        gtracker_categories!inner(id, name)
                    )
                `)
                .eq('is_active', true)
                .gte('created_at', dateFilter.toISOString())
                .order('like_count', { ascending: false })
                .order('comment_count', { ascending: false })
                .order('view_count', { ascending: false })
                .limit(limit);

            if (error) {
                throw new Error('Erro ao buscar posts populares: ' + error.message);
            }

            return {
                success: true,
                data: posts.map(post => ({
                    ...post,
                    author: post.gtracker_users,
                    forum: post.gtracker_forums
                }))
            };

        } catch (error) {
            console.error('Erro ao buscar posts populares:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }
}

module.exports = SearchService;