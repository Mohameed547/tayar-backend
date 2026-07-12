import { Router } from "express";
import {
    uploadDocument,
    getStatus,
    getAllVerifications,
    reviewVerification,
} from "./verification.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { ROLES } from "../../shared/constants/roles.js";
import {
    uploadDocumentSchema,
    reviewVerificationSchema,
} from "./verification.validation.js";

const router = Router();

router.post(
    "/captain/verification/upload",
    authenticate,
    authorize(ROLES.CAPTAIN, ROLES.OFFICE, ROLES.CUSTOMER),
    validate(uploadDocumentSchema),
    uploadDocument,
);

router.get(
    "/captain/verification/status",
    authenticate,
    authorize(ROLES.CAPTAIN, ROLES.OFFICE, ROLES.CUSTOMER),
    getStatus,
);

// ?status=all|pending|approved|rejected (default: all)
router.get(
    "/captain/verification/all",
    authenticate,
    authorize(ROLES.ADMIN),
    getAllVerifications,
);

router.patch(
    "/captain/verification/review",
    authenticate,
    authorize(ROLES.ADMIN),
    validate(reviewVerificationSchema),
    reviewVerification,
);

export default router;
