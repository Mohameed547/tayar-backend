import { Router } from "express";
import {
    getWallet,
    topup,
    withdraw,
    getTransactions,
} from "./wallet.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { validate } from "../../shared/middleware/validate.js";
import { topupSchema, withdrawSchema } from "./wallet.validation.js";

const router = Router();

router.use(authenticate);

router.get("/", getWallet);
router.post("/topup", validate(topupSchema), topup);
router.post("/withdraw", validate(withdrawSchema), withdraw);
router.get("/transactions", getTransactions);

export default router;
