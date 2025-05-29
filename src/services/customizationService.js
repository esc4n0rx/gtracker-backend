// src/services/customizationService.js
const supabase = require('../config/supabase');

class CustomizationService {
    // Atualizar avatar do usuário
    static async updateAvatar(userId, avatarUrl, oldAvatarUrl = null) {
        try {
            // Deletar avatar antigo se existir
            if (oldAvatarUrl) {
                await this.deleteOldAvatar(oldAvatarUrl);
            }

            // Atualizar URL do avatar no perfil
            const { data, error } = await supabase
                .from('gtracker_profiles')
                .update({ 
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                throw new Error('Erro ao atualizar avatar: ' + error.message);
            }

            return {
                success: true,
                message: 'Avatar atualizado com sucesso',
                data: { avatar_url: avatarUrl }
            };

        } catch (error) {
            console.error('Erro ao atualizar avatar:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Atualizar imagem de capa
    static async updateCoverImage(userId, coverUrl, oldCoverUrl = null) {
        try {
            // Deletar cover antigo se existir
            if (oldCoverUrl) {
                await this.deleteOldCover(oldCoverUrl);
            }

            // Atualizar URL da cover no perfil
            const { data, error } = await supabase
                .from('gtracker_profiles')
                .update({ 
                    cover_image_url: coverUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                throw new Error('Erro ao atualizar capa: ' + error.message);
            }

            return {
                success: true,
                message: 'Imagem de capa atualizada com sucesso',
                data: { cover_image_url: coverUrl }
            };

        } catch (error) {
            console.error('Erro ao atualizar capa:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Atualizar customizações do perfil
    static async updateProfileCustomization(userId, customData) {
        try {
            const {
                theme_color,
                custom_title,
                signature,
                social_links,
                birthday,
                timezone,
                status,
                bio,
                location,
                website
            } = customData;

            const updateFields = {};

            // Validações e sanitização
            if (theme_color !== undefined) {
                // Validar cor hexadecimal
                if (!/^#[0-9A-F]{6}$/i.test(theme_color)) {
                    return {
                        success: false,
                        message: 'Cor do tema deve ser um código hexadecimal válido'
                    };
                }
                updateFields.theme_color = theme_color;
            }

            if (custom_title !== undefined) {
                if (custom_title && custom_title.length > 100) {
                    return {
                        success: false,
                        message: 'Título personalizado deve ter no máximo 100 caracteres'
                    };
                }
                updateFields.custom_title = custom_title;
            }

            if (signature !== undefined) {
                if (signature && signature.length > 500) {
                    return {
                        success: false,
                        message: 'Assinatura deve ter no máximo 500 caracteres'
                    };
                }
                updateFields.signature = signature;
            }

            if (social_links !== undefined) {
                // Validar estrutura dos links sociais
                const validPlatforms = ['twitter', 'instagram', 'facebook', 'linkedin', 'github', 'youtube', 'discord'];
                const sanitizedLinks = {};
                
                for (const [platform, url] of Object.entries(social_links)) {
                    if (validPlatforms.includes(platform) && url) {
                        // Validação básica de URL
                        try {
                            new URL(url);
                            sanitizedLinks[platform] = url;
                        } catch {
                            return {
                                success: false,
                                message: `URL inválida para ${platform}`
                            };
                        }
                    }
                }
                updateFields.social_links = sanitizedLinks;
            }

            if (birthday !== undefined) {
                if (birthday) {
                    const birthDate = new Date(birthday);
                    const today = new Date();
                    const age = today.getFullYear() - birthDate.getFullYear();
                    
                    if (age < 13 || age > 120) {
                        return {
                            success: false,
                            message: 'Data de nascimento inválida'
                        };
                    }
                }
                updateFields.birthday = birthday;
            }

            if (timezone !== undefined) {
                updateFields.timezone = timezone;
            }

            if (status !== undefined) {
                const validStatuses = ['online', 'away', 'busy', 'invisible', 'offline'];
                if (!validStatuses.includes(status)) {
                    return {
                        success: false,
                        message: 'Status inválido'
                    };
                }
                updateFields.status = status;
            }

            // Campos básicos do perfil
            if (bio !== undefined) {
                if (bio && bio.length > 1000) {
                    return {
                        success: false,
                        message: 'Bio deve ter no máximo 1000 caracteres'
                    };
                }
                updateFields.bio = bio;
            }

            if (location !== undefined) {
                if (location && location.length > 100) {
                    return {
                        success: false,
                        message: 'Localização deve ter no máximo 100 caracteres'
                    };
                }
                updateFields.location = location;
            }

            if (website !== undefined) {
                if (website) {
                    try {
                        new URL(website);
                    } catch {
                        return {
                            success: false,
                            message: 'URL do website inválida'
                        };
                    }
                }
                updateFields.website = website;
            }

            if (Object.keys(updateFields).length === 0) {
                return {
                    success: false,
                    message: 'Nenhum campo para atualizar'
                };
            }

            updateFields.updated_at = new Date().toISOString();

            // Atualizar no banco
            const { data, error } = await supabase
                .from('gtracker_profiles')
                .update(updateFields)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                throw new Error('Erro ao atualizar perfil: ' + error.message);
            }

            return {
                success: true,
                message: 'Perfil atualizado com sucesso',
                data
            };

        } catch (error) {
            console.error('Erro ao atualizar customização:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }

    // Deletar avatar antigo
    static async deleteOldAvatar(avatarUrl) {
        try {
            // Extrair nome do arquivo da URL
            const fileName = this.extractFileNameFromUrl(avatarUrl, 'avatars');
            if (fileName) {
                await supabase.storage
                    .from('avatars')
                    .remove([fileName]);
            }
        } catch (error) {
            console.error('Erro ao deletar avatar antigo:', error);
        }
    }

    // Deletar cover antigo
    static async deleteOldCover(coverUrl) {
        try {
            const fileName = this.extractFileNameFromUrl(coverUrl, 'avatars');
            if (fileName) {
                await supabase.storage
                    .from('avatars')
                    .remove([fileName]);
            }
        } catch (error) {
            console.error('Erro ao deletar cover antigo:', error);
        }
    }

    // Extrair nome do arquivo da URL do Supabase
    static extractFileNameFromUrl(url, bucketName) {
        try {
            const urlPattern = new RegExp(`/storage/v1/object/public/${bucketName}/(.+)$`);
            const match = url.match(urlPattern);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    // Buscar estatísticas do usuário para o perfil
    static async getUserStats(userId) {
        try {
            const { data: profile, error } = await supabase
                .from('gtracker_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                throw new Error('Erro ao buscar estatísticas: ' + error.message);
            }

            return {
                success: true,
                data: profile
            };

        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            return {
                success: false,
                message: 'Erro interno do servidor'
            };
        }
    }
}

module.exports = CustomizationService;