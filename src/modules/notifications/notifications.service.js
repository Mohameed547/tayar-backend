import Notification from "../../database/models/Notification.model.js";
import ApiError from "../../shared/utils/ApiError.js";
import { getPagination } from "../../shared/utils/pagination.js";
import { getIO } from "../../config/socket.js";

const createNotification = async ({ userId, type, title, message, relatedShipmentId }) => {
    const notification = await Notification.create({
        user: userId,
        type,
        title,
        message,
        relatedShipment: relatedShipmentId,
        isRead: false,
    });

    try {
        getIO().to(`user:${userId}`).emit("newNotification", notification);
    } catch {
        return notification;
    }

    return notification;
};

const getNotificationsForUser = async (userId, { status, page, limit }) => {
    const { skip, take } = getPagination(page, limit);

    const query = { user: userId };
    if (status === "unread") query.isRead = false;

    const [notifications, total] = await Promise.all([
        Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(take),
        Notification.countDocuments(query),
    ]);

    return { notifications, total, page: Number(page) || 1, limit: take };
};

const getUnreadCount = async (userId) => {
    return Notification.countDocuments({ user: userId, isRead: false });
};

const markAsRead = async (userId, notificationId) => {
    const notification = await Notification.findOne({ _id: notificationId, user: userId });
    if (!notification) throw new ApiError(404, "Notification not found");

    notification.isRead = true;
    await notification.save();
    return notification;
};

const markAllAsRead = async (userId) => {
    await Notification.updateMany({ user: userId, isRead: false }, { $set: { isRead: true } });
};

export default {
    createNotification,
    getNotificationsForUser,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
};
