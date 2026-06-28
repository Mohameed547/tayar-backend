import Shipment from "../../../database/models/Shipment.model.js";
import User from "../../../database/models/User.model.js";
import Escrow from "../../../database/models/Escrow.model.js";
import Setting from "../../../database/models/Setting.model.js";
import Support from "../../../database/models/Support.model.js";
import { SHIPMENT_STATUS } from "../../../shared/constants/shipmentStatus.js";

// ── Helpers ──────────────────────────────────────────────────────────────

const startOfThisWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
};

const startOfLastWeek = () => {
    const d = startOfThisWeek();
    d.setDate(d.getDate() - 7);
    return d;
};

const startOfThisMonth = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
};

const startOfLastMonth = () => {
    const d = startOfThisMonth();
    d.setMonth(d.getMonth() - 1);
    return d;
};

const percentTrend = (current, previous) => {
    if (!previous) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
};

const timeAgo = (date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
};

// ── Stat cards ───────────────────────────────────────────────────────────

const getStatsCards = async () => {
    const thisWeek = startOfThisWeek();
    const lastWeek = startOfLastWeek();
    const thisMonth = startOfThisMonth();
    const lastMonth = startOfLastMonth();

    const [
        totalOrders,
        ordersThisWeek,
        ordersLastWeek,
        registeredUsers,
        usersThisWeek,
        usersLastWeek,
        openDisputes,
        urgentDisputes,
        commissionThisMonthAgg,
        commissionLastMonthAgg,
    ] = await Promise.all([
        Shipment.countDocuments(),
        Shipment.countDocuments({ createdAt: { $gte: thisWeek } }),
        Shipment.countDocuments({
            createdAt: { $gte: lastWeek, $lt: thisWeek },
        }),
        User.countDocuments({
            role: { $in: ["customer", "driver", "office"] },
        }),
        User.countDocuments({
            role: { $in: ["customer", "driver", "office"] },
            createdAt: { $gte: thisWeek },
        }),
        User.countDocuments({
            role: { $in: ["customer", "driver", "office"] },
            createdAt: { $gte: lastWeek, $lt: thisWeek },
        }),
        Support.countDocuments({ status: "sent" }),
        Support.countDocuments({
            status: "sent",
            createdAt: { $lte: new Date(Date.now() - 24 * 36e5) },
        }),
        Escrow.aggregate([
            { $match: { createdAt: { $gte: thisMonth } } },
            { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
        ]),
        Escrow.aggregate([
            { $match: { createdAt: { $gte: lastMonth, $lt: thisMonth } } },
            { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
        ]),
    ]);

    const monthlyRevenue = commissionThisMonthAgg[0]?.total ?? 0;
    const lastMonthRevenue = commissionLastMonthAgg[0]?.total ?? 0;
    const disputeRate = totalOrders
        ? Number(((openDisputes / totalOrders) * 100).toFixed(1))
        : 0;

    return {
        totalOrders,
        totalOrdersTrend: percentTrend(ordersThisWeek, ordersLastWeek),
        registeredUsers,
        registeredUsersTrend: percentTrend(usersThisWeek, usersLastWeek),
        openDisputes,
        urgentDisputes,
        disputeRate,
        monthlyRevenue,
        revenueTrend: percentTrend(monthlyRevenue, lastMonthRevenue),
    };
};

// ── Recent shipments ─────────────────────────────────────────────────────

const STATUS_MAP_TO_FRONTEND = {
    [SHIPMENT_STATUS.PENDING_OFFERS]: "pending_offer",
    [SHIPMENT_STATUS.CAPTAIN_ASSIGNMENT]: "pending_offer",
    [SHIPMENT_STATUS.PICKED_UP]: "in_transit",
    [SHIPMENT_STATUS.IN_TRANSIT]: "in_transit",
    [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: "in_transit",
    [SHIPMENT_STATUS.DELIVERED]: "delivered",
    [SHIPMENT_STATUS.CANCELLED]: "pending_offer",
};

const getRecentOrders = async () => {
    const shipments = await Shipment.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("trackingNumber customer status createdAt")
        .populate("customer", "fullName")
        .lean();

    if (shipments.length === 0) return [];

    const shipmentIds = shipments.map((s) => s._id);
    const disputedEscrows = await Escrow.find({
        shipment: { $in: shipmentIds },
        status: "disputed",
    })
        .select("shipment")
        .lean();

    const disputedShipmentIds = new Set(
        disputedEscrows.map((e) => e.shipment.toString()),
    );

    return shipments.map((s) => ({
        id: s.trackingNumber,
        customer: s.customer?.fullName ?? "Unknown",
        timeAgo: timeAgo(s.createdAt),
        status: disputedShipmentIds.has(s._id.toString())
            ? "dispute"
            : (STATUS_MAP_TO_FRONTEND[s.status] ?? "pending_offer"),
    }));
};

// ── Revenue breakdown ────────────────────────────────────────────────────

const getRevenueSources = async () => {
    const [commissionAgg, activeOfficeCount, settingsDoc] = await Promise.all([
        Escrow.aggregate([
            { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
        ]),
        User.countDocuments({ role: "office", status: "active" }),
        Setting.findOne().lean(),
    ]);

    const commission = commissionAgg[0]?.total ?? 0;
    const subscriptionFee = settingsDoc?.subscriptionFee ?? 49;
    const subscriptions = activeOfficeCount * subscriptionFee;
    const featured = 0;
    const total = commission + subscriptions + featured || 1;

    const sources = [
        { label: "Commission", amount: commission, color: "#3b82f6" },
        { label: "Subscriptions", amount: subscriptions, color: "#8b5cf6" },
        { label: "Featured", amount: featured, color: "#f59e0b" },
    ];

    return sources.map((s) => ({
        label: s.label,
        percentage: Number(((s.amount / total) * 100).toFixed(0)),
        color: s.color,
    }));
};

// ── Escrow breakdown ─────────────────────────────────────────────────────

const ESCROW_LABEL_MAP = {
    held: "Held",
    released: "Released",
    disputed: "Disputed",
    refunded: "Refunded",
};

const ESCROW_COLOR_MAP = {
    held: "#f59e0b",
    released: "#22c55e",
    disputed: "#ef4444",
    refunded: "#6366f1",
};

const getEscrowStatuses = async () => {
    const agg = await Escrow.aggregate([
        { $group: { _id: "$status", total: { $sum: "$amount" } } },
    ]);

    const byStatus = Object.fromEntries(agg.map((a) => [a._id, a.total]));
    const grandTotal = agg.reduce((sum, a) => sum + a.total, 0) || 1;

    return Object.entries(ESCROW_LABEL_MAP).map(([key, label]) => ({
        label,
        amount: byStatus[key] ?? 0,
        percentage: Number(
            (((byStatus[key] ?? 0) / grandTotal) * 100).toFixed(0),
        ),
        color: ESCROW_COLOR_MAP[key],
    }));
};

// ── Recent users ─────────────────────────────────────────────────────────

const getRecentUsers = async () => {
    const users = await User.find({ role: { $in: ["customer", "driver"] } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("fullName email role status createdAt")
        .lean();

    if (users.length === 0) return [];

    const userIds = users.map((u) => u._id);
    const orderCounts = await Shipment.aggregate([
        { $match: { customer: { $in: userIds } } },
        { $group: { _id: "$customer", count: { $sum: 1 } } },
    ]);

    const ordersByUser = Object.fromEntries(
        orderCounts.map((o) => [o._id.toString(), o.count]),
    );

    return users.map((u) => ({
        email: u.email,
        initials: u.fullName
            ?.split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
        name: u.fullName,
        role: u.role,
        orders: ordersByUser[u._id.toString()] ?? 0,
        joined: new Date(u.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        }),
        status: u.status === "active" ? "active" : "suspended",
    }));
};

// ── Public entry point ───────────────────────────────────────────────────

const getDashboardData = async () => {
    const [stats, recentOrders, revenueSources, escrowStatuses, recentUsers] =
        await Promise.all([
            getStatsCards(),
            getRecentOrders(),
            getRevenueSources(),
            getEscrowStatuses(),
            getRecentUsers(),
        ]);

    return { stats, recentOrders, revenueSources, escrowStatuses, recentUsers };
};

export default { getDashboardData };
