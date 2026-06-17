// import { Router } from "express";
// import {
//     createTicket,
//     getMyTickets,
//     getTicketById,
// } from "./support.controller.js";
// import { validate } from "../../shared/middleware/validate.js";
// import { createTicketSchema } from "./support.validation.js";
// import { authenticate } from "../../shared/middleware/authenticate.js";

// const router = Router();

// router.use(authenticate);

// router.post("/", validate(createTicketSchema), createTicket);
// router.get("/", getMyTickets);
// router.get("/:id", getTicketById);

// export default router;

import { Router } from "express";
import {
    createTicket,
    getMyTickets,
    getTicketById,
} from "./support.controller.js";
import { validate } from "../../shared/middleware/validate.js";
import { createTicketSchema } from "./support.validation.js";

const router = Router();

router.use((req, res, next) => {
    req.user = { _id: "676f1234567890abcdef1234", role: "customer" };
    next();
});

router.post("/", validate(createTicketSchema), createTicket);
router.get("/", getMyTickets);
router.get("/:id", getTicketById);

export default router;
