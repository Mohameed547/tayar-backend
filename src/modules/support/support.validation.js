import Joi from "joi";
import { TICKET_CATEGORY } from "../../database/models/Support.model.js";

export const createTicketSchema = Joi.object({
    subject: Joi.string().trim().min(5).max(150).required().messages({
        "string.empty": "validation.subject.required",
        "any.required": "validation.subject.required",
        "string.min": "validation.subject.min",
        "string.max": "validation.subject.max",
    }),

    category: Joi.string()
        .valid(...Object.values(TICKET_CATEGORY))
        .required()
        .messages({
            "any.only": "validation.category.invalid",
            "any.required": "validation.category.required",
        }),

    message: Joi.string().trim().min(10).max(1000).required().messages({
        "string.empty": "validation.message.required",
        "any.required": "validation.message.required",
        "string.min": "validation.message.min",
        "string.max": "validation.message.max",
    }),

    relatedShipment: Joi.string().hex().length(24).optional().messages({
        "string.hex": "validation.relatedShipment.invalid",
        "string.length": "validation.relatedShipment.invalid",
    }),
});
