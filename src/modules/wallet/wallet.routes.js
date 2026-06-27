import { Router } from "express";
import {
    getWalletBalance,
    getTransactionHistory,
    handleTopUp,
    handlePaymobWebhook,
    handleInternalPayment,
    requestWithdrawal,
} from "./wallet.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import {
    topUpSchema,
    internalPaymentSchema,
    withdrawalSchema,
    transactionHistoryQuerySchema,
} from "./wallet.validation.js";

const router = Router();

// ⚠️ مسار الـ Webhook عام ولا يحتاج لتوكن العميل لأن سيرفر الدفع الخارجي هو من يستدعيه
router.post("/webhook/paymob", handlePaymobWebhook);

// بقية المسارات تتطلب الحماية والتوكن الخاص بالعميل
router.use(authenticate);

router.get("/", getWalletBalance);
router.get("/transactions", validate(transactionHistoryQuerySchema, "query"), getTransactionHistory);

router.post("/topup", validate(topUpSchema), handleTopUp);

router.post(
    "/pay",
    authorize("customer"),
    validate(internalPaymentSchema),
    handleInternalPayment,
);

router.post(
    "/withdraw",
    authorize("driver", "office"),
    validate(withdrawalSchema),
    requestWithdrawal,
);

export default router;