import { Router } from "express";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { ROLES } from "../../shared/constants/roles.js";
import {
    shipmentIdParamSchema,
    locationPingSchema,
    statusUpdateSchema,
    verifyOTPSchema,
} from "./tracking.validation.js";
import {
    getTracking,
    postLocationPing,
    postStatusUpdate,
    postGenerateOTP,
    postVerifyOTP,
} from "./tracking.controller.js";

import { checkVerified } from "../../shared/middleware/checkVerified.js";

const router = Router();

router.use(authenticate);

router.get("/:shipmentId", validate(shipmentIdParamSchema, "params"), getTracking);

router.post(
    "/:shipmentId/location",
    authorize(ROLES.CAPTAIN),
    checkVerified,
    validate(shipmentIdParamSchema, "params"),
    validate(locationPingSchema, "body"),
    postLocationPing
);

router.post(
    "/:shipmentId/status",
    authorize(ROLES.CAPTAIN),
    checkVerified,
    validate(shipmentIdParamSchema, "params"),
    validate(statusUpdateSchema, "body"),
    postStatusUpdate
);

router.post(
    "/:shipmentId/otp/generate",
    validate(shipmentIdParamSchema, "params"),
    postGenerateOTP
);

router.post(
    "/:shipmentId/otp/verify",
    validate(shipmentIdParamSchema, "params"),
    validate(verifyOTPSchema, "body"),
    postVerifyOTP
);

export default router;
