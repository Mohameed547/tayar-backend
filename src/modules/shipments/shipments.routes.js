import { Router } from "express";
import * as Y from "./shipments.controller.js";

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

router.get("/admin/all", authorize(ROLES.ADMIN), Y.getAllShipments);
router.patch(
  "/admin/:id/status",
  authorize(ROLES.ADMIN),
  validate(updateShipmentStatusSchema),
  Y.updateShipmentStatus,
);
router.get(
  "/available",
  authorize(ROLES.DRIVER, ROLES.OFFICE),
  Y.getAvailableShipments,
);
router.get(
  "/mine/assigned",
  authorize(ROLES.DRIVER, ROLES.OFFICE),
  Y.getMyAssignedShipments,
);
router.patch(
  "/:id/accept-assignment",
  authorize(ROLES.DRIVER),
  Y.acceptAssignment,
);
router.patch(
  "/:id/reject-assignment",
  authorize(ROLES.DRIVER),
  Y.rejectAssignment,
);

router.post(
  "/",
  authorize(ROLES.CUSTOMER),
  validate(createShipmentSchema),
  Y.createShipment,
);
router.get("/", authorize(ROLES.CUSTOMER), Y.getMyShipments);
router.get("/:id", authorize(ROLES.CUSTOMER), Y.getShipmentById);
router.patch("/:id/cancel", authorize(ROLES.CUSTOMER), Y.cancelShipment);

export default router;
