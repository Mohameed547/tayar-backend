import { Router } from "express";
import {
    createShipment,
    getMyShipments,
    getShipmentById,
    cancelShipment,
    getAllShipments,
    getAvailableShipments,
    getMyAssignedShipments,
} from "./shipments.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { ROLES } from "../../shared/constants/roles.js";
import { createShipmentSchema } from "./shipments.validation.js";

const router = Router();

router.use(authenticate);

router.get("/admin/all", authorize(ROLES.ADMIN), getAllShipments);
router.get(
    "/available",
    authorize(ROLES.DRIVER, ROLES.OFFICE),
    getAvailableShipments,
);
router.get(
    "/mine/assigned",
    authorize(ROLES.DRIVER, ROLES.OFFICE),
    getMyAssignedShipments,
);

router.post(
    "/",
    authorize(ROLES.CUSTOMER),
    validate(createShipmentSchema),
    createShipment,
);
router.get("/", authorize(ROLES.CUSTOMER), getMyShipments);
router.get("/:id", authorize(ROLES.CUSTOMER), getShipmentById);
router.patch("/:id/cancel", authorize(ROLES.CUSTOMER), cancelShipment);

export default router;
