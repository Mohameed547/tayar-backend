import Joi from "joi";

export const updateDriverStatusSchema = Joi.object({
  status: Joi.string().valid("active", "suspended", "banned").required(),
});
