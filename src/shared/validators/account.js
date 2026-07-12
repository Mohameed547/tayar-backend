import Joi from "joi";

/**
 * @typedef {Object} ScheduleDeletionPayload
 * @property {string} reason - The reason for account deletion request
 */

/**
 * @typedef {Object} SuspendAccountPayload
 * @property {string} reason - The reason for suspending the account
 */

export const scheduleDeletionSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required().messages({
    "string.empty": "Deletion reason is required",
    "string.min": "Deletion reason must be at least 5 characters long",
    "string.max": "Deletion reason cannot exceed 500 characters",
  }),
});

export const suspendAccountSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required().messages({
    "string.empty": "Suspension reason is required",
    "string.min": "Suspension reason must be at least 5 characters long",
    "string.max": "Suspension reason cannot exceed 500 characters",
  }),
});
