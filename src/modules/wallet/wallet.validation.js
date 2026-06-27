import Joi from "joi";
import { GATEWAY, TRANSACTION_PURPOSE, TRANSACTION_STATUS, TRANSACTION_TYPE, USER_TYPE } from "../../database/models/Wallet.model.js";

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
    "string.pattern.base": "Invalid id format",
});

const amountField = Joi.number().positive().min(1).max(100000).required().messages({
    "number.base": "Amount must be a number",
    "number.positive": "Amount must be greater than zero",
    "number.min": "Amount must be at least 1",
    "number.max": "Amount cannot exceed 100,000",
    "any.required": "Amount is required",
});

export const topUpSchema = Joi.object({
    amount: amountField,
    gateway: Joi.string()
        .valid(...Object.values(GATEWAY).filter((g) => g !== GATEWAY.INTERNAL))
        .required()
        .messages({
            "any.only": "Unsupported payment gateway",
            "any.required": "Gateway is required",
        }),
    referenceId: Joi.string().max(120).optional(),
    metadata: Joi.object({
        phone: Joi.string().pattern(/^01[0125][0-9]{8}$/).required().messages({
            "any.required": "Phone number is required for wallet transactions",
            "string.pattern.base": "Enter a valid Egyptian mobile number for payment",
        }),
        email: Joi.string().email().optional(),
        firstName: Joi.string().optional(),
        lastName: Joi.string().optional()
    }).required()
});

export const internalPaymentSchema = Joi.object({
    toUserId: objectId.required().messages({ "any.required": "Recipient id is required" }),
    toUserType: Joi.string()
        .valid(USER_TYPE.DRIVER, USER_TYPE.OFFICE)
        .required()
        .messages({
            "any.only": "Recipient must be a Driver or Office",
            "any.required": "Recipient type is required",
        }),
    amount: amountField,
    purpose: Joi.string()
        .valid(TRANSACTION_PURPOSE.PAYMENT, TRANSACTION_PURPOSE.DELIVERY_FEE)
        .required()
        .messages({
            "any.only": "Purpose must be Payment or DeliveryFee",
            "any.required": "Purpose is required",
        }),
    referenceId: Joi.string().max(120).optional(),
    metadata: Joi.object().optional(),
});

export const withdrawalSchema = Joi.object({
    amount: amountField,
    destination: Joi.string().valid("Bank", "Wallet").required().messages({
        "any.only": "Destination must be Bank or Wallet",
        "any.required": "Destination is required",
    }),
    bankAccount: Joi.object({
        accountHolderName: Joi.string().min(3).max(120).required(),
        bankName: Joi.string().min(2).max(120).required(),
        iban: Joi.string().min(10).max(34).required(),
    }).optional(),
    mobileWalletNumber: Joi.string()
        .pattern(/^01[0125][0-9]{8}$/)
        .when("destination", {
            is: "Wallet",
            then: Joi.required().messages({
                "any.required": "Mobile wallet number is required for wallet withdrawals",
                "string.pattern.base": "Enter a valid Egyptian mobile number",
            }),
            otherwise: Joi.forbidden(),
        }),
}).custom((value, helpers) => {
    if (value.destination === "Bank" && !value.bankAccount) {
        return helpers.error("any.custom", { message: "Bank account details are required for bank withdrawals" });
    }
    return value;
}).messages({
    "any.custom": "{{#message}}",
});

export const transactionHistoryQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(50).optional(),
    type: Joi.string().valid(...Object.values(TRANSACTION_TYPE)).optional(),
    purpose: Joi.string().valid(...Object.values(TRANSACTION_PURPOSE)).optional(),
    status: Joi.string().valid(...Object.values(TRANSACTION_STATUS)).optional(),
});