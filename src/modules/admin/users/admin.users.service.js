import User from "../../../database/models/User.model.js";
import Shipment from "../../../database/models/Shipment.model.js";
import ApiError from "../../../shared/utils/ApiError.js";
import { ACCOUNT_STATUS } from "../../../shared/constants/accountStatus.js";

const VALID_USER_STATUSES = new Set(["active", "suspended"]);

// ─── Formatter ───────────────────────────────────────────────────────────────
const formatUser = (u, ordersCount = 0) => ({
    id: u._id,
    name: u.fullName,
    initials: u.fullName
        ?.split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    email: u.email,
    phone: u.phone,
    status: u.status,
    accountStatus: u.accountStatus ?? ACCOUNT_STATUS.ACTIVE,
    isDeleted: u.isDeleted ?? false,
    deletedAt: u.deletedAt ?? null,
    deleteReason: u.deleteReason ?? null,
    scheduledDeletionDate: u.scheduledDeletionDate ?? null,
    orders: ordersCount,
    joined: new Date(u.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }),
});

// ─── getUsers ─────────────────────────────────────────────────────────────────
// accountStatus filter: "all" | "ACTIVE" | "DELETED" | "PENDING_DELETION" | "SUSPENDED"
const getUsers = async ({ search, page = 1, limit = 20, accountStatus = "all" }) => {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Admin must bypass the global soft-delete middleware, so we include all docs
    const baseFilter = {
        role: "customer",
        isDeleted: { $in: [true, false] },   // bypass global pre-find filter
    };

    // Apply accountStatus filter
    if (accountStatus && accountStatus !== "all") {
        if (accountStatus === "DELETED") {
            baseFilter.isDeleted = true;
        } else {
            baseFilter.isDeleted = false;
            baseFilter.accountStatus = accountStatus;
        }
    }

    if (search?.trim()) {
        const regex = new RegExp(search.trim(), "i");
        baseFilter.$or = [
            { fullName: regex },
            { email: regex },
            { phone: regex },
        ];
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const adminBaseFilter = { role: "customer", isDeleted: { $in: [true, false] } };

    const [users, total, active, suspended, deleted, pendingDeletion, newThisWeek, newSuspendedThisWeek] =
        await Promise.all([
            User.find(baseFilter)
                .select("fullName email phone status accountStatus isDeleted deletedAt deleteReason scheduledDeletionDate createdAt")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            User.countDocuments(baseFilter),
            User.countDocuments({ ...adminBaseFilter, accountStatus: ACCOUNT_STATUS.ACTIVE, isDeleted: false }),
            User.countDocuments({ ...adminBaseFilter, accountStatus: ACCOUNT_STATUS.SUSPENDED, isDeleted: false }),
            User.countDocuments({ ...adminBaseFilter, isDeleted: true }),
            User.countDocuments({ ...adminBaseFilter, accountStatus: ACCOUNT_STATUS.PENDING_DELETION, isDeleted: false }),
            User.countDocuments({ ...adminBaseFilter, createdAt: { $gte: oneWeekAgo } }),
            User.countDocuments({ ...adminBaseFilter, accountStatus: ACCOUNT_STATUS.SUSPENDED, updatedAt: { $gte: oneWeekAgo } }),
        ]);

    const userIds = users.map((u) => u._id);
    const shipmentCounts = await Shipment.aggregate([
        { $match: { customer: { $in: userIds } } },
        { $group: { _id: "$customer", count: { $sum: 1 } } },
    ]);
    const countsMap = Object.fromEntries(
        shipmentCounts.map((s) => [s._id.toString(), s.count]),
    );

    const totalAll = active + suspended + deleted + pendingDeletion;
    const weekTrend =
        totalAll - newThisWeek > 0
            ? Math.round((newThisWeek / (totalAll - newThisWeek)) * 100)
            : 0;

    return {
        users: users.map((u) =>
            formatUser(u, countsMap[u._id.toString()] ?? 0),
        ),
        stats: {
            total: totalAll,
            active,
            suspended,
            deleted,
            pendingDeletion,
            weekTrend,
            newSuspendedThisWeek,
        },
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
        },
    };
};

// ─── getUserById (admin: bypasses soft-delete) ────────────────────────────────
const getUserById = async (id) => {
    const [user, ordersCount] = await Promise.all([
        User.findOne({ _id: id, role: "customer", isDeleted: { $in: [true, false] } })
            .select("fullName email phone status accountStatus isDeleted deletedAt deleteReason scheduledDeletionDate createdAt")
            .lean(),
        Shipment.countDocuments({ customer: id }),
    ]);

    if (!user) throw new ApiError(404, "User not found");

    return formatUser(user, ordersCount);
};

// ─── updateUserStatus (protect deleted accounts) ──────────────────────────────
const updateUserStatus = async (id, status) => {
    if (!VALID_USER_STATUSES.has(status)) {
        throw new ApiError(400, `Invalid status '${status}'. Must be one of: ${[...VALID_USER_STATUSES].join(", ")}`);
    }

    const user = await User.findOne({ _id: id, role: "customer", isDeleted: { $in: [true, false] } });
    if (!user) throw new ApiError(404, "User not found");

    if (user.isDeleted || user.accountStatus === ACCOUNT_STATUS.DELETED) {
        throw new ApiError(403, "Cannot modify a permanently deleted account.");
    }

    user.status = status;
    // Keep accountStatus in sync for non-lifecycle statuses
    if (status === "active" && user.accountStatus === ACCOUNT_STATUS.SUSPENDED) {
        user.accountStatus = ACCOUNT_STATUS.ACTIVE;
    } else if (status === "suspended") {
        user.accountStatus = ACCOUNT_STATUS.SUSPENDED;
    }

    await user.save();
    return { id: user._id, status: user.status };
};

export default { getUsers, getUserById, updateUserStatus };
