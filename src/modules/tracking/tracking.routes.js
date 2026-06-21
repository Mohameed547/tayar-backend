import { Router } from "express";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { ROLES } from "../../shared/constants/roles.js";
import {
    shipmentIdParamSchema,
    locationPingSchema,
    statusUpdateSchema,
} from "./tracking.validation.js";
import { getTracking, postLocationPing, postStatusUpdate } from "./tracking.controller.js";

const router = Router();

router.use(authenticate);

router.get("/:shipmentId", validate(shipmentIdParamSchema, "params"), getTracking);

router.post(
    "/:shipmentId/location",
    authorize(ROLES.CAPTAIN),
    validate(shipmentIdParamSchema, "params"),
    validate(locationPingSchema, "body"),
    postLocationPing
);

router.post(
    "/:shipmentId/status",
    authorize(ROLES.CAPTAIN),
    validate(shipmentIdParamSchema, "params"),
    validate(statusUpdateSchema, "body"),
    postStatusUpdate
);

export default router;
