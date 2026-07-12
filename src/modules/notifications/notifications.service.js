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
        const DriverModel = (await import("../../database/models/Driver.js")).default;
        const driver = await DriverModel.findOne({ user: userId });
        
        let shouldEmit = true;
        if (driver) {
            const workingMode = driver.workingMode || "independent";
            const activeOfficeId = driver.activeOfficeId ? driver.activeOfficeId.toString() : null;
            
            let shipmentAssignedOffice = null;
            if (relatedShipmentId) {
                const ShipmentModel = (await import("../../database/models/Shipment.model.js")).default;
                const shipment = await ShipmentModel.findById(relatedShipmentId);
                if (shipment && shipment.assignedOffice) {
                    shipmentAssignedOffice = shipment.assignedOffice.toString();
                }
            }

            const isOfficeInviteOrRelation = [
                "office_invite",
                "office_invite_accepted",
                "office_invite_rejected",
                "office_relation_update"
            ].includes(type);

            if (workingMode === "office") {
                if (shipmentAssignedOffice) {
                    shouldEmit = (shipmentAssignedOffice === activeOfficeId);
                } else {
                    shouldEmit = isOfficeInviteOrRelation;
                }
            } else {
                if (shipmentAssignedOffice) {
                    shouldEmit = false;
                } else {
                    shouldEmit = !isOfficeInviteOrRelation || type === "office_invite";
                }
            }
        }

        if (shouldEmit) {
            getIO().to(`user:${userId}`).emit("newNotification", notification);
        }
    } catch {
        return notification;
    }

    return notification;
};

const getNotificationsForUser = async (userId, { status, page, limit }) => {
    const { skip, take } = getPagination(page, limit);

    const query = { user: userId };
    if (status === "unread") query.isRead = false;

    const rawNotifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .populate({
            path: "relatedShipment",
            populate: { path: "captain", select: "fullName" }
        });

    const DriverModel = (await import("../../database/models/Driver.js")).default;
    const driver = await DriverModel.findOne({ user: userId });

    let filtered = rawNotifications;
    if (driver) {
        const workingMode = driver.workingMode || "independent";
        const activeOfficeId = driver.activeOfficeId ? driver.activeOfficeId.toString() : null;

        filtered = rawNotifications.filter(n => {
            const isOfficeInviteOrRelation = [
                "office_invite",
                "office_invite_accepted",
                "office_invite_rejected",
                "office_relation_update"
            ].includes(n.type);

            const shipmentAssignedOffice = n.relatedShipment && n.relatedShipment.assignedOffice
                ? n.relatedShipment.assignedOffice.toString()
                : null;

            if (workingMode === "office") {
                if (shipmentAssignedOffice) {
                    return shipmentAssignedOffice === activeOfficeId;
                }
                return isOfficeInviteOrRelation;
            } else {
                if (shipmentAssignedOffice) {
                    return false;
                }
                return !isOfficeInviteOrRelation || n.type === "office_invite";
            }
        });
    }

    const total = filtered.length;
    const paginatedNotifications = filtered.slice(skip, skip + take);

    return { notifications: paginatedNotifications, total, page: Number(page) || 1, limit: take };
};

const getUnreadCount = async (userId) => {
    const rawUnread = await Notification.find({ user: userId, isRead: false })
        .populate("relatedShipment");

    const DriverModel = (await import("../../database/models/Driver.js")).default;
    const driver = await DriverModel.findOne({ user: userId });

    if (!driver) {
        return rawUnread.length;
    }

    const workingMode = driver.workingMode || "independent";
    const activeOfficeId = driver.activeOfficeId ? driver.activeOfficeId.toString() : null;

    const filtered = rawUnread.filter(n => {
        const isOfficeInviteOrRelation = [
            "office_invite",
            "office_invite_accepted",
            "office_invite_rejected",
            "office_relation_update"
        ].includes(n.type);

        const shipmentAssignedOffice = n.relatedShipment && n.relatedShipment.assignedOffice
            ? n.relatedShipment.assignedOffice.toString()
            : null;

        if (workingMode === "office") {
            if (shipmentAssignedOffice) {
                return shipmentAssignedOffice === activeOfficeId;
            }
            return isOfficeInviteOrRelation;
        } else {
            if (shipmentAssignedOffice) {
                return false;
            }
            return !isOfficeInviteOrRelation || n.type === "office_invite";
        }
    });

    return filtered.length;
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
