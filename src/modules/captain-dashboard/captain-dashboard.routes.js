import { Router } from "express";
import {
  getCaptainDashboard,
  getInvitations,
  acceptInvitation,
  rejectInvitation,
  getMyOffices,
  leaveOffice,
  setDefaultOffice,
  switchActiveOffice,
} from "./captain-dashboard.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { ROLES } from "../../shared/constants/roles.js";
import { checkVerified } from "../../shared/middleware/checkVerified.js";

const router = Router();

router.use(authenticate, checkVerified);

// ROLES.CAPTAIN currently aliases to the stored value "driver" — see
// shared/constants/roles.js. Using the constant here (not the literal
// string) so this route stays correct if that mapping ever changes.
router.get("/", authorize(ROLES.CAPTAIN), getCaptainDashboard);

router.get("/invitations", authorize(ROLES.CAPTAIN), getInvitations);
router.post("/invitations/:invitationId/accept", authorize(ROLES.CAPTAIN), acceptInvitation);
router.post("/invitations/:invitationId/reject", authorize(ROLES.CAPTAIN), rejectInvitation);

router.get("/offices", authorize(ROLES.CAPTAIN), getMyOffices);
router.post("/offices/active", authorize(ROLES.CAPTAIN), switchActiveOffice);
router.post("/offices/:officeId/leave", authorize(ROLES.CAPTAIN), leaveOffice);
router.post("/offices/:officeId/default", authorize(ROLES.CAPTAIN), setDefaultOffice);

export default router;
