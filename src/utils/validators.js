const Joi = require('joi');

const registerSchema = Joi.object({
    nickname: Joi.string()
        .alphanum()
        .min(3)
        .max(20)
        .required()
        .messages({
            'string.alphanum': 'Nickname deve conter apenas letras e números',
            'string.min': 'Nickname deve ter pelo menos 3 caracteres',
            'string.max': 'Nickname deve ter no máximo 20 caracteres'
        }),
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Email deve ter um formato válido'
        }),
    password: Joi.string()
        .min(8)
        .required()
        .messages({
            'string.min': 'Senha deve ter pelo menos 8 caracteres'
        }),
    nome: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.min': 'Nome deve ter pelo menos 2 caracteres',
            'string.max': 'Nome deve ter no máximo 100 caracteres'
        }),
    codigo_convite: Joi.string()
        .optional()
        .allow('')
});

const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Email deve ter um formato válido'
        }),
    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Senha é obrigatória'
        })
});

const updateProfileSchema = Joi.object({
    nome: Joi.string()
        .min(2)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Nome deve ter pelo menos 2 caracteres',
            'string.max': 'Nome deve ter no máximo 100 caracteres'
        }),
    nickname: Joi.string()
        .alphanum()
        .min(3)
        .max(20)
        .optional()
        .messages({
            'string.alphanum': 'Nickname deve conter apenas letras e números',
            'string.min': 'Nickname deve ter pelo menos 3 caracteres',
            'string.max': 'Nickname deve ter no máximo 20 caracteres'
        })
});


const changeRoleSchema = Joi.object({
    role_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.uuid': 'ID do cargo deve ser um UUID válido',
            'any.required': 'ID do cargo é obrigatório'
        }),
    reason: Joi.string()
        .max(500)
        .optional()
        .messages({
            'string.max': 'Motivo deve ter no máximo 500 caracteres'
        })
});

const categorySchema = Joi.object({
    name: Joi.string()
        .min(3)
        .max(100)
        .required()
        .messages({
            'string.min': 'Nome da categoria deve ter pelo menos 3 caracteres',
            'string.max': 'Nome da categoria deve ter no máximo 100 caracteres'
        }),
    description: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Descrição deve ter no máximo 500 caracteres'
        }),
    display_order: Joi.number()
        .integer()
        .min(0)
        .optional()
        .messages({
            'number.min': 'Ordem de exibição deve ser um número positivo'
        })
});

const forumSchema = Joi.object({
    name: Joi.string()
        .min(3)
        .max(100)
        .required()
        .messages({
            'string.min': 'Nome do fórum deve ter pelo menos 3 caracteres',
            'string.max': 'Nome do fórum deve ter no máximo 100 caracteres'
        }),
    description: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Descrição deve ter no máximo 500 caracteres'
        }),
    category_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.uuid': 'ID da categoria deve ser um UUID válido'
        }),
    parent_forum_id: Joi.string()
        .uuid()
        .optional()
        .allow(null)
        .messages({
            'string.uuid': 'ID do fórum pai deve ser um UUID válido'
        }),
    display_order: Joi.number()
        .integer()
        .min(0)
        .optional()
        .messages({
            'number.min': 'Ordem de exibição deve ser um número positivo'
        })
});

const updateCategorySchema = Joi.object({
    name: Joi.string()
        .min(3)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Nome da categoria deve ter pelo menos 3 caracteres',
            'string.max': 'Nome da categoria deve ter no máximo 100 caracteres'
        }),
    description: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Descrição deve ter no máximo 500 caracteres'
        }),
    display_order: Joi.number()
        .integer()
        .min(0)
        .optional()
        .messages({
            'number.min': 'Ordem de exibição deve ser um número positivo'
        }),
    is_active: Joi.boolean()
        .optional()
});

const updateForumSchema = Joi.object({
    name: Joi.string()
        .min(3)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Nome do fórum deve ter pelo menos 3 caracteres',
            'string.max': 'Nome do fórum deve ter no máximo 100 caracteres'
        }),
    description: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Descrição deve ter no máximo 500 caracteres'
        }),
    category_id: Joi.string()
        .uuid()
        .optional()
        .messages({
            'string.uuid': 'ID da categoria deve ser um UUID válido'
        }),
    parent_forum_id: Joi.string()
        .uuid()
        .optional()
        .allow(null)
        .messages({
            'string.uuid': 'ID do fórum pai deve ser um UUID válido'
        }),
    display_order: Joi.number()
        .integer()
        .min(0)
        .optional()
        .messages({
            'number.min': 'Ordem de exibição deve ser um número positivo'
        }),
    is_active: Joi.boolean()
        .optional()
});

const postSchema = Joi.object({
    title: Joi.string()
        .min(5)
        .max(255)
        .required()
        .messages({
            'string.min': 'Título deve ter pelo menos 5 caracteres',
            'string.max': 'Título deve ter no máximo 255 caracteres'
        }),
    content: Joi.string()
        .max(50000)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Conteúdo deve ter no máximo 50.000 caracteres'
        }),
    forum_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.uuid': 'ID do fórum deve ser um UUID válido'
        }),
    post_type: Joi.string()
        .valid('general', 'filme', 'série', 'jogo', 'software', 'curso', 'ebook', 
              'pedido_arquivo', 'candidatura', 'regras', 'anuncio_oficial', 
              'sugestao', 'fale_conosco', 'apresentacao', 'duvida_suporte')
        .default('general'),
    template_data: Joi.object()
        .optional()
        .default({})
});

const updatePostSchema = Joi.object({
    title: Joi.string()
        .min(5)
        .max(255)
        .optional()
        .messages({
            'string.min': 'Título deve ter pelo menos 5 caracteres',
            'string.max': 'Título deve ter no máximo 255 caracteres'
        }),
    content: Joi.string()
        .max(50000)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Conteúdo deve ter no máximo 50.000 caracteres'
        }),
    template_data: Joi.object()
        .optional()
});

const movePostSchema = Joi.object({
    forum_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.uuid': 'ID do fórum deve ser um UUID válido'
        }),
    reason: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Motivo deve ter no máximo 500 caracteres'
        })
});

const commentSchema = Joi.object({
    post_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.uuid': 'ID do post deve ser um UUID válido'
        }),
    parent_comment_id: Joi.string()
        .uuid()
        .optional()
        .allow(null)
        .messages({
            'string.uuid': 'ID do comentário pai deve ser um UUID válido'
        }),
    content: Joi.string()
        .min(1)
        .max(10000)
        .required()
        .messages({
            'string.min': 'Comentário não pode estar vazio',
            'string.max': 'Comentário deve ter no máximo 10.000 caracteres'
        })
});

const updateCommentSchema = Joi.object({
    content: Joi.string()
        .min(1)
        .max(10000)
        .required()
        .messages({
            'string.min': 'Comentário não pode estar vazio',
            'string.max': 'Comentário deve ter no máximo 10.000 caracteres'
        })
});

const notificationSettingsSchema = Joi.object({
    post_replies: Joi.boolean().optional(),
    comment_replies: Joi.boolean().optional(),
    post_likes: Joi.boolean().optional(),
    comment_likes: Joi.boolean().optional(),
    mentions: Joi.boolean().optional(),
    administrative: Joi.boolean().optional(),
    private_messages: Joi.boolean().optional(),
    email_notifications: Joi.boolean().optional(),
    push_notifications: Joi.boolean().optional()
});




module.exports = {
    registerSchema,
    loginSchema,
    updateProfileSchema,
    changeRoleSchema,
    categorySchema,
    forumSchema,
    updateCategorySchema,
    updateForumSchema,
    postSchema,
    updatePostSchema,
    movePostSchema,
    commentSchema,
    updateCommentSchema,
    notificationSettingsSchema
};