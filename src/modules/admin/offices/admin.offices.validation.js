import Joi from "joi";

export const updateOfficeStatusSchema = Joi.object({
    status: Joi.string().valid("active", "suspended").required(),
});
