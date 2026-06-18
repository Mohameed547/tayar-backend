import Joi from "joi";

const createOfferSchema = Joi.object({
  shipmentId: Joi.string().hex().length(24).required().messages({
    "string.hex": "Invalid shipment ID",
    "any.required": "Shipment ID is required",
  }),

  price: Joi.number().min(0).required().messages({
    "number.min": "Price cannot be negative",
    "any.required": "Price is required",
  }),

  estimatedDelivery: Joi.string().trim().required().messages({
    "any.required": "Estimated delivery is required",
  }),

  coverage: Joi.string().valid("Insured", "None").default("None"),

  description: Joi.string().trim().max(500).optional(),
});

const acceptOfferSchema = Joi.object({
  offerId: Joi.string().hex().length(24).required().messages({
    "string.hex": "Invalid offer ID",
    "any.required": "Offer ID is required",
  }),
});
export { createOfferSchema, acceptOfferSchema };
