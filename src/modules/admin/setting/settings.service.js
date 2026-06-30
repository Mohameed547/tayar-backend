import Setting from "../../../database/models/Setting.model.js";
import User from "../../../database/models/User.model.js";
import ApiError from "../../../shared/utils/ApiError.js";

const ADMIN_ROLES = ["super_admin", "moderator"];

const getSettings = async (adminId) => {
    const settings = await Setting.getForAdmin(adminId);
    return settings;
};

const updateSettings = async (adminId, payload) => {
    const {
        commissionRate,
        subscriptionFee,
        featuredListingFee,
        newDisputeAlerts,
        newOfficeRegistrations,
        dailyRevenueReport,
    } = payload;

    const updates = {};

    if (commissionRate !== undefined) {
        if (commissionRate < 0 || commissionRate > 100) {
            throw ApiError.badRequest(
                "commissionRate must be between 0 and 100",
            );
        }
        updates.commissionRate = commissionRate;
    }
    if (subscriptionFee !== undefined) {
        if (subscriptionFee < 0) {
            throw ApiError.badRequest("subscriptionFee cannot be negative");
        }
        updates.subscriptionFee = subscriptionFee;
    }
    if (featuredListingFee !== undefined) {
        if (featuredListingFee < 0) {
            throw ApiError.badRequest("featuredListingFee cannot be negative");
        }
        updates.featuredListingFee = featuredListingFee;
    }
    if (typeof newDisputeAlerts === "boolean") {
        updates.newDisputeAlerts = newDisputeAlerts;
    }
    if (typeof newOfficeRegistrations === "boolean") {
        updates.newOfficeRegistrations = newOfficeRegistrations;
    }
    if (typeof dailyRevenueReport === "boolean") {
        updates.dailyRevenueReport = dailyRevenueReport;
    }

    await Setting.getForAdmin(adminId);
    const settings = await Setting.findOneAndUpdate(
        { adminId },
        { $set: updates },
        { new: true, runValidators: true },
    );

    return settings;
};

const listAdmins = async () => {
    const admins = await User.find({ role: { $in: ADMIN_ROLES } })
        .select("name email role isActive createdAt")
        .sort({ createdAt: 1 });

    return admins;
};

const removeAdmin = async (currentAdminId, targetAdminId) => {
    if (String(currentAdminId) === String(targetAdminId)) {
        throw ApiError.badRequest("You cannot remove your own admin account");
    }

    const target = await User.findOne({
        _id: targetAdminId,
        role: { $in: ADMIN_ROLES },
    });

    if (!target) {
        throw ApiError.notFound("Admin account not found");
    }

    target.isActive = false;
    await target.save();

    return target;
};

export default {
    getSettings,
    updateSettings,
    listAdmins,
    removeAdmin,
};
