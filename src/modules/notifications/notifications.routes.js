import { Router } from "express";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { validate } from "../../shared/middleware/validate.js";
import { checkVerified } from "../../shared/middleware/checkVerified.js";
import {
    listNotificationsQuerySchema,
    notificationIdParamSchema,
} from "./notifications.validation.js";
import {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
} from "./notifications.controller.js";

const router = Router();

router.use(authenticate, checkVerified);

router.get("/", validate(listNotificationsQuerySchema, "query"), getMyNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", validate(notificationIdParamSchema, "params"), markAsRead);

export default router;
