import { Router } from "express";
import {
    createTicket,
    getMyTickets,
    getTicketById,
} from "./support.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { validate } from "../../shared/middleware/validate.js";
import { createTicketSchema } from "./support.validation.js";
import { authenticate } from "../../shared/middleware/authenticate.js";

const router = Router();

router.use(authenticate);

router.post("/", validate(createTicketSchema), createTicket);
router.get("/", getMyTickets);
router.get("/:id", getTicketById);

export default router;
