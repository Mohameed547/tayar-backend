import notificationsService from "./notifications.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

export const getMyNotifications = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { status, page, limit } = req.query;

        const result = await notificationsService.getNotificationsForUser(userId, {
            status,
            page,
            limit,
        });

        return res.status(200).json(ApiResponse.success(result));
    } catch (err) {
        next(err);
    }
};

export const getUnreadCount = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const count = await notificationsService.getUnreadCount(userId);
        return res.status(200).json(ApiResponse.success({ count }));
    } catch (err) {
        next(err);
    }
};

export const markAsRead = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;

        const notification = await notificationsService.markAsRead(userId, id);

        return res
            .status(200)
            .json(ApiResponse.success(notification, "Notification marked as read"));
    } catch (err) {
        next(err);
    }
};

export const markAllAsRead = async (req, res, next) => {
    try {
        const userId = req.user._id;
        await notificationsService.markAllAsRead(userId);

        return res
            .status(200)
            .json(ApiResponse.success(null, "All notifications marked as read"));
    } catch (err) {
        next(err);
    }
};
