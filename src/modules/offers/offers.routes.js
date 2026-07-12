import { Router } from "express";
import * as Y from "./offers.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { validate } from "../../shared/middleware/validate.js";
import { createOfferSchema, acceptOfferSchema } from "./offers.validation.js";

import { checkVerified } from "../../shared/middleware/checkVerified.js";
import { checkIndependentMode } from "../../shared/middleware/authorize.js";

const router = Router();

router.use(authenticate, checkVerified, checkIndependentMode);

router.get("/mine", Y.getMyOffers);
router.get("/shipment/:shipmentId", Y.getShipmentOffers);
router.post(
  "/create",
  validate(createOfferSchema),
  Y.createOffer,
);
router.patch("/:offerId/accept", validate(acceptOfferSchema, "params"), Y.acceptOffer);

export default router;
