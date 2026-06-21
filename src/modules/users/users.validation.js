import Joi from "joi";

export const updateProfileSchema = Joi.object({
    fullName: Joi.string().trim().min(2).max(100).optional(),
    name: Joi.string().trim().min(2).max(100).optional(),
    phone: Joi.string().trim().min(8).max(20).optional(),
    profileImage: Joi.string().uri().optional(),
    avatarUrl: Joi.string().uri().optional(),
}).min(1);

export const pushTokenSchema = Joi.object({
    token: Joi.string().trim().min(10).required(),
});
