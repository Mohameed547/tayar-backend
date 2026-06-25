import { Router } from "express";
import { getAllDrivers, updateDriverStatus } from "./drivers.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { ROLES } from "../../shared/constants/roles.js";
import { updateDriverStatusSchema } from "./drivers.validation.js";

const router = Router();

router.use(authenticate);

router.get("/admin/all", authorize(ROLES.ADMIN), getAllDrivers);
router.patch(
  "/admin/:id/status",
  authorize(ROLES.ADMIN),
  validate(updateDriverStatusSchema),
  updateDriverStatus,
);

export default router;
