import { Router } from "express";
import { authenticate } from "../../../shared/middleware/authenticate.js";
import { authorize } from "../../../shared/middleware/authorize.js";
import disputesController from "./disputes.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorize("admin"));

router.get("/", disputesController.getDisputes);
router.patch("/:id/resolve", disputesController.resolveDispute);
router.post("/:id/messages", disputesController.addAdminTicketMessage);

export default router;
