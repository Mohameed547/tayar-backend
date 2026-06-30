import { Router } from "express";
import { authenticate } from "../../../shared/middleware/authenticate.js";
import { authorize } from "../../../shared/middleware/authorize.js";
import settingsController from "./settings.controller.js";

const router = Router();

router.use(authenticate, authorize("admin", "moderator"));
router.get("/", settingsController.getSettings);
router.patch("/", settingsController.updateSettings);

router.get("/admins", settingsController.listAdmins);
router.delete("/admins/:id", settingsController.removeAdmin);

export default router;
