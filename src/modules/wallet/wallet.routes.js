import { Router } from "express";
import {
    getWallet,
    topup,
    withdraw,
    getTransactions,
} from "./wallet.controller.js";
import { validate } from "../../shared/middleware/validate.js";
import { topupSchema, withdrawSchema } from "./wallet.validation.js";

const router = Router();

router.use((req, res, next) => {
    req.user = { _id: "676f1234567890abcdef1234", role: "customer" };
    next();
});

router.get("/", getWallet);
router.post("/topup", validate(topupSchema), topup);
router.post("/withdraw", validate(withdrawSchema), withdraw);
router.get("/transactions", getTransactions);

export default router;
