import { Router } from "express";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { ROLES } from "../../shared/constants/roles.js";
import {
    createCaptainSchema,
    updateCaptainSchema,
    captainStatusSchema,
    captainListQuerySchema,
    idParamSchema,
} from "./office.validation.js";
import {
    createCaptain,
    getCaptains,
    getCaptainById,
    updateCaptain,
    deactivateCaptain,
    updateCaptainStatus,
    getCaptainTracking,
    getCaptainPerformance,
    getCaptainRatings,
    getCaptainOrders,
    getCaptainDeliveries,
} from "./office.controller.js";
import {
    getPendingOffers,
    getAssignedOffers,
    assignOffer,
    reassignOffer,
    rejectOffer,
    getDashboard,
} from "./office-offers.controller.js";

const router = Router();

router.use(authenticate, authorize(ROLES.OFFICE));

router.post("/captains", validate(createCaptainSchema), createCaptain);
router.get("/captains", validate(captainListQuerySchema, "query"), getCaptains);
router.get("/captains/:id", validate(idParamSchema, "params"), getCaptainById);
router.patch(
    "/captains/:id",
    validate(idParamSchema, "params"),
    validate(updateCaptainSchema),
    updateCaptain,
);
router.delete("/captains/:id", validate(idParamSchema, "params"), deactivateCaptain);
router.get(
    "/captains/:id/tracking",
    validate(idParamSchema, "params"),
    getCaptainTracking,
);
router.get(
    "/captains/:id/performance",
    validate(idParamSchema, "params"),
    getCaptainPerformance,
);
router.get(
    "/captains/:id/ratings",
    validate(idParamSchema, "params"),
    getCaptainRatings,
);
router.get(
    "/captains/:id/orders",
    validate(idParamSchema, "params"),
    getCaptainOrders,
);
router.get(
    "/captains/:id/deliveries",
    validate(idParamSchema, "params"),
    getCaptainDeliveries,
);
router.patch(
    "/captains/:id/status",
    validate(idParamSchema, "params"),
    validate(captainStatusSchema),
    updateCaptainStatus,
);

router.get("/dashboard", getDashboard);
router.get("/offers", getPendingOffers);
router.get("/offers/assigned", getAssignedOffers);
router.patch("/offers/:offerId/assign/:captainId", assignOffer);
router.patch("/offers/:offerId/reassign/:captainId", reassignOffer);
router.patch("/offers/:offerId/reject", rejectOffer);

export default router;
