import Joi from "joi";

export const createShipmentSchema = Joi.object({
  pickupAddress: Joi.string().trim().min(5).required().messages({
    "string.empty": "validation.pickupAddress.required",
    "any.required": "validation.pickupAddress.required",
    "string.min": "validation.pickupAddress.min",
  }),

  deliveryAddress: Joi.string().trim().min(5).required().messages({
    "string.empty": "validation.deliveryAddress.required",
    "any.required": "validation.deliveryAddress.required",
    "string.min": "validation.deliveryAddress.min",
  }),

  weight: Joi.number().positive().max(1000).required().messages({
    "number.base": "validation.weight.number",
    "number.positive": "validation.weight.positive",
    "number.max": "validation.weight.max",
    "any.required": "validation.weight.required",
  }),

  packageType: Joi.string()
    .valid("small_box", "medium_box", "large_box", "pallet")
    .required()
    .messages({
      "any.only": "validation.packageType.invalid",
      "any.required": "validation.packageType.required",
    }),

  deliverySpeed: Joi.string()
    .valid("standard", "express", "scheduled")
    .required()
    .messages({
      "any.only": "validation.deliverySpeed.invalid",
      "any.required": "validation.deliverySpeed.required",
    }),

  scheduledDate: Joi.when("deliverySpeed", {
    is: "scheduled",
    then: Joi.date().greater("now").required().messages({
      "date.base": "validation.scheduledDate.invalid",
      "date.greater": "validation.scheduledDate.future",
      "any.required": "validation.scheduledDate.required",
    }),
    otherwise: Joi.forbidden(),
  }),

  notes: Joi.string().trim().max(500).optional().allow("").messages({
    "string.max": "validation.notes.max",
  }),

  price: Joi.number().positive().optional().messages({
    "number.base": "validation.price.number",
    "number.positive": "validation.price.positive",
  }),
});

export const updateShipmentStatusSchema = Joi.object({
  status: Joi.string()
    .valid(
      "pending_offers",
      "captain_assignment",
      "picked_up",
      "in_transit",
      "delivered",
      "cancelled",
    )
    .required(),
});
