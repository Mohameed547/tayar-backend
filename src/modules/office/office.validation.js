import Joi from "joi";
import { CAPTAIN_STATUS } from "../../database/models/Driver.js";

const phonePattern = /^01[0125][0-9]{8}$/;

export const idParamSchema = Joi.object({
    id: Joi.string().hex().length(24).required(),
});

export const createCaptainSchema = Joi.object({
    fullName: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(phonePattern).required().messages({
        "string.pattern.base": "Phone must be a valid Egyptian mobile number (e.g. 01012345678)",
    }),
    vehicleType: Joi.string().valid("motorcycle", "car", "van", "truck").required(),
    plateNumber: Joi.string().trim().required(),
});

export const updateCaptainSchema = Joi.object({
    fullName: Joi.string().trim().min(2).max(100).optional(),
    phone: Joi.string().pattern(phonePattern).optional(),
    vehicleType: Joi.string().valid("motorcycle", "car", "van", "truck").optional(),
    plateNumber: Joi.string().trim().optional(),
}).min(1);

export const captainStatusSchema = Joi.object({
    status: Joi.string()
        .valid(...Object.values(CAPTAIN_STATUS))
        .required(),
});

export const captainListQuerySchema = Joi.object({
    status: Joi.string().valid(...Object.values(CAPTAIN_STATUS)).optional(),
    relationshipStatus: Joi.string().valid("active", "suspended", "all").optional(),
    search: Joi.string().trim().allow("").optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(50).optional(),
});


export const updateOfficeAvailabilitySchema = Joi.object({
    status: Joi.string().valid("available", "offline").required(),
});

export const inviteCaptainSchema = Joi.object({
    email: Joi.string().email().optional(),
    phone: Joi.string().pattern(phonePattern).optional().messages({
        "string.pattern.base": "Phone must be a valid Egyptian mobile number (e.g. 01012345678)",
    }),
    captainId: Joi.string().hex().length(24).optional(),
}).or("email", "phone", "captainId");

export const suspendCaptainSchema = Joi.object({
    reason: Joi.string().max(500).allow("").optional(),
});

export const deactivateCaptainSchema = Joi.object({
    removedReason: Joi.string().max(500).allow("").optional(),
    hardDelete: Joi.boolean().optional(),
});
