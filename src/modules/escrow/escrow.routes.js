import { Router } from "express";
import * as Y from "./escrow.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { ROLES } from "../../shared/constants/roles.js";

const router = Router();

router.use(authenticate);

router.get("/admin/all", authorize(ROLES.ADMIN), Y.getAllEscrow);
router.patch("/admin/:id/release", authorize(ROLES.ADMIN), Y.releaseEscrow);
router.patch("/admin/:id/refund", authorize(ROLES.ADMIN), Y.refundEscrow);

export default router;
