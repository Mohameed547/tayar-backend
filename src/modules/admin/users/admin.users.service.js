import User from "../../../database/models/User.model.js";
import Shipment from "../../../database/models/Shipment.model.js";
import ApiError from "../../../shared/utils/ApiError.js";

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
    orders: ordersCount,
    joined: new Date(u.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }),
});

const getUsers = async ({ search, page = 1, limit = 20 }) => {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const baseFilter = { role: "customer" };

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

    const [users, total, active, suspended, newThisWeek, newSuspendedThisWeek] =
        await Promise.all([
            User.find(baseFilter)
                .select("fullName email phone status createdAt")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            User.countDocuments(baseFilter),
            User.countDocuments({ ...baseFilter, status: "active" }),
            User.countDocuments({ ...baseFilter, status: "suspended" }),
            User.countDocuments({
                ...baseFilter,
                createdAt: { $gte: oneWeekAgo },
            }),
            User.countDocuments({
                ...baseFilter,
                status: "suspended",
                updatedAt: { $gte: oneWeekAgo },
            }),
        ]);

    const userIds = users.map((u) => u._id);
    const shipmentCounts = await Shipment.aggregate([
        { $match: { customer: { $in: userIds } } },
        { $group: { _id: "$customer", count: { $sum: 1 } } },
    ]);
    const countsMap = Object.fromEntries(
        shipmentCounts.map((s) => [s._id.toString(), s.count]),
    );

    const weekTrend =
        total - newThisWeek > 0
            ? Math.round((newThisWeek / (total - newThisWeek)) * 100)
            : 0;

    return {
        users: users.map((u) =>
            formatUser(u, countsMap[u._id.toString()] ?? 0),
        ),
        stats: {
            total,
            active,
            suspended,
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

const getUserById = async (id) => {
    const [user, ordersCount] = await Promise.all([
        User.findOne({ _id: id, role: "customer" })
            .select("fullName email phone status createdAt")
            .lean(),
        Shipment.countDocuments({ customer: id }),
    ]);

    if (!user) throw new ApiError(404, "User not found");

    return formatUser(user, ordersCount);
};

const updateUserStatus = async (id, status) => {
    const user = await User.findOne({ _id: id, role: "customer" });
    if (!user) throw new ApiError(404, "User not found");

    user.status = status;
    await user.save();

    return { id: user._id, status: user.status };
};

export default { getUsers, getUserById, updateUserStatus };
