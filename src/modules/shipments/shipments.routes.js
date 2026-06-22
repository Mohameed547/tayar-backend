import { Router } from "express";
import {
  createShipment,
  getMyShipments,
  getShipmentById,
  cancelShipment,
  getAllShipments,
  updateShipmentStatus,
} from "./shipments.controller.js";

import {
  createShipmentSchema,
  updateShipmentStatusSchema,
} from "./shipments.validation.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { ROLES } from "../../shared/constants/roles.js";

const router = Router();

router.use(authenticate);

router.get("/admin/all", authorize(ROLES.ADMIN), getAllShipments);
router.patch(
  "/admin/:id/status",
  authorize(ROLES.ADMIN),
  validate(updateShipmentStatusSchema),
  updateShipmentStatus,
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
