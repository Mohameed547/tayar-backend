import Joi from "joi";

export const topupSchema = Joi.object({
    amount: Joi.number().positive().min(10).max(50000).required().messages({
        "number.base": "validation.amount.number",
        "number.positive": "validation.amount.positive",
        "number.min": "validation.amount.min",
        "number.max": "validation.amount.max",
        "any.required": "validation.amount.required",
    }),
});

export const withdrawSchema = Joi.object({
    amount: Joi.number().positive().min(10).max(50000).required().messages({
        "number.base": "validation.amount.number",
        "number.positive": "validation.amount.positive",
        "number.min": "validation.amount.min",
        "number.max": "validation.amount.max",
        "any.required": "validation.amount.required",
    }),
});
