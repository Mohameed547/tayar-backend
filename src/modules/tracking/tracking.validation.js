import Joi from "joi";
import { TRACKING_STATUS } from "../../database/models/Tracking.model.js";

export const shipmentIdParamSchema = Joi.object({
    shipmentId: Joi.string().required(),
});

export const locationPingSchema = Joi.object({
    lng: Joi.number().min(-180).max(180).required(),
    lat: Joi.number().min(-90).max(90).required(),
});

export const statusUpdateSchema = Joi.object({
    status: Joi.string()
        .valid(...Object.values(TRACKING_STATUS))
        .required(),
    note: Joi.string().max(300).optional(),
    lat: Joi.number().min(-90).max(90).optional(),
    lng: Joi.number().min(-180).max(180).optional(),
    otpCode: Joi.string().length(6).when("status", {
        is: "delivered",
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),
    recipientName: Joi.string().max(100).when("status", {
        is: "delivered",
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),
    signatureImage: Joi.string().optional().allow(null, ""),
    packageImage: Joi.string().optional().allow(null, ""),
});

export const verifyOTPSchema = Joi.object({
    otpCode: Joi.string().length(6).required(),
});
