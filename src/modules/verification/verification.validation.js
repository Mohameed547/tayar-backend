import Joi from "joi";
import { VERIFICATION_STATUS } from "../../database/models/Verification.model.js";

export const uploadDocumentSchema = Joi.object({
    documentType: Joi.string()
        .valid("national_id", "driving_license", "vehicle_license", "commercial_register")
        .required(),
    documentUrl: Joi.string().required(),
});

export const reviewVerificationSchema = Joi.object({
    userId: Joi.string().hex().length(24).required(),
    status: Joi.string()
        .valid(...Object.values(VERIFICATION_STATUS))
        .required(),
    reviewNote: Joi.string().trim().max(500).optional(),
});
