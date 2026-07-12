import { Router } from "express";
import { authenticate } from "../../../shared/middleware/authenticate.js";
import { authorize } from "../../../shared/middleware/authorize.js";
import {
  getOffices,
  getCaptains,
  getRelationships,
  getRemovedCaptains,
  getSuspendedCaptains,
  getInvitationHistory,
  getAuditLogs,
} from "./admin.relationships.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorize("admin"));

router.get("/offices", getOffices);
router.get("/captains", getCaptains);
router.get("/relations", getRelationships);
router.get("/removed", getRemovedCaptains);
router.get("/suspended", getSuspendedCaptains);
router.get("/invitations", getInvitationHistory);
router.get("/audit-logs", getAuditLogs);

export default router;
