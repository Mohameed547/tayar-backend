import Joi from "joi";

export const updateDriverStatusSchema = Joi.object({
  status: Joi.string().valid("active", "suspended", "banned").required(),
});

export const updateDriverAvailabilitySchema = Joi.object({
  status: Joi.string().valid("available", "busy", "offline", "delivering", "on_break", "suspended").required(),
});
