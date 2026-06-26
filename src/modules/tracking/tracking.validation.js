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
});
