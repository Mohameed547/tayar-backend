import { Router } from "express";
import * as Y from "./offers.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { validate } from "../../shared/middleware/validate.js";
import { createOfferSchema, acceptOfferSchema } from "./offers.validation.js";

const router = Router();

router.get("/shipment/:shipmentId", authenticate, Y.getShipmentOffers);
router.post(
  "/create",
  authenticate,
  validate(createOfferSchema),
  Y.createOffer,
);
router.patch("/:offerId/accept", authenticate, validate(acceptOfferSchema, "params"), Y.acceptOffer);

export default router;
