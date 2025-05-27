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

module.exports = {
    registerSchema,
    loginSchema,
    updateProfileSchema
};