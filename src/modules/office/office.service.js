import crypto from "crypto";
import User from "../../database/models/User.model.js";
import Driver, { CAPTAIN_STATUS } from "../../database/models/Driver.js";
import Office from "../../database/models/Office.js";
import Shipment from "../../database/models/Shipment.model.js";
import Tracking from "../../database/models/Tracking.model.js";
import Review from "../../database/models/Review.model.js";
import { Wallet, Transaction } from "../../database/models/Wallet.model.js";
import { SHIPMENT_STATUS } from "../../shared/constants/shipmentStatus.js";
import ApiError from "../../shared/utils/ApiError.js";
import { getPagination } from "../../shared/utils/pagination.js";

// Resolve the Office document owned by the currently authenticated office user.
const resolveOffice = async (userId) => {
    const office = await Office.findOne({ user: userId });
    if (!office) throw ApiError.notFound("Office profile not found");
    return office;
};

const generateTempPassword = () => crypto.randomBytes(6).toString("hex");

const formatCaptain = async (driver, user = null) => {
    const captainUser = user || driver.user;
    return {
        id: driver._id,
        userId: captainUser._id ?? captainUser,
        fullName: captainUser.fullName,
        email: captainUser.email,
        phone: captainUser.phone,
        vehicle: driver.vehicle,
        status: driver.status,
        isActive: driver.isActive,
        lastActiveAt: driver.lastActiveAt,
        officeId: driver.officeId,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
    };
};

const createCaptain = async (officeUserId, payload) => {
    const office = await resolveOffice(officeUserId);
    const { fullName, email, phone, password, vehicleType, plateNumber } = payload;

    const existing = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { phone }],
    });
    if (existing) {
        throw ApiError.conflict(
            existing.email === email.toLowerCase()
                ? "Email is already registered"
                : "Phone number is already registered",
        );
    }

    const generatedPassword = password || generateTempPassword();

    const user = new User({
        fullName,
        email: email.toLowerCase(),
        phone,
        password: generatedPassword,
        role: "driver",
        status: "active",
        isPhoneVerified: true,
    });
    await user.save();

    const driver = await Driver.create({
        user: user._id,
        vehicle: { type: vehicleType, plateNumber },
        officeId: office._id,
        status: CAPTAIN_STATUS.OFFLINE,
        isActive: true,
    });

    return {
        captain: await formatCaptain(driver, user),
        ...(password ? {} : { temporaryPassword: generatedPassword }),
    };
};

const ensureOwnedCaptain = async (officeUserId, captainId) => {
    const office = await resolveOffice(officeUserId);
    const driver = await Driver.findOne({ _id: captainId, officeId: office._id }).populate(
        "user",
        "fullName email phone status",
    );
    if (!driver) throw ApiError.notFound("Captain not found for this office");
    return { office, driver };
};

const getCaptains = async (officeUserId, { status, page, limit }) => {
    const office = await resolveOffice(officeUserId);
    const filter = { officeId: office._id };
    if (status) filter.status = status;

    const { skip, take } = getPagination(page, limit);

    const [drivers, total, totalAll, activeCount] = await Promise.all([
        Driver.find(filter)
            .populate("user", "fullName email phone status")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(take),
        Driver.countDocuments(filter),
        Driver.countDocuments({ officeId: office._id }),
        Driver.countDocuments({ officeId: office._id, isActive: true }),
    ]);

    const captains = await Promise.all(drivers.map((d) => formatCaptain(d)));

    return {
        captains,
        pagination: { total, page: page ? Number(page) : 1, limit: take },
        summary: {
            totalCaptains: totalAll,
            activeCaptains: activeCount,
        },
    };
};

const getCaptainById = async (officeUserId, captainId) => {
    const { driver } = await ensureOwnedCaptain(officeUserId, captainId);
    const ordersCount = await Shipment.countDocuments({ captain: driver.user._id });
    return { ...(await formatCaptain(driver)), ordersCount };
};

const updateCaptain = async (officeUserId, captainId, updates) => {
    const { driver } = await ensureOwnedCaptain(officeUserId, captainId);
    const { fullName, phone, vehicleType, plateNumber } = updates;

    if (fullName !== undefined) driver.user.fullName = fullName;
    if (phone !== undefined) driver.user.phone = phone;
    if (fullName !== undefined || phone !== undefined) await driver.user.save();

    if (vehicleType !== undefined) driver.vehicle = { ...driver.vehicle, type: vehicleType };
    if (plateNumber !== undefined) driver.vehicle = { ...driver.vehicle, plateNumber };
    await driver.save();

    return formatCaptain(driver);
};

const deactivateCaptain = async (officeUserId, captainId, { hardDelete = false } = {}) => {
    const { driver } = await ensureOwnedCaptain(officeUserId, captainId);

    if (hardDelete) {
        await Driver.deleteOne({ _id: driver._id });
        return { deleted: true };
    }

    driver.isActive = false;
    driver.status = CAPTAIN_STATUS.OFFLINE;
    await driver.save();

    await User.findByIdAndUpdate(driver.user._id, { status: "suspended" });

    return { deactivated: true, captain: await formatCaptain(driver) };
};

const updateCaptainStatus = async (officeUserId, captainId, status) => {
    const { driver } = await ensureOwnedCaptain(officeUserId, captainId);

    if (!driver.isActive) {
        throw ApiError.badRequest("Cannot change status of a deactivated captain");
    }

    driver.status = status;
    driver.lastActiveAt = new Date();
    await driver.save();

    return formatCaptain(driver);
};

const getCaptainTracking = async (officeUserId, captainId) => {
    const { driver } = await ensureOwnedCaptain(officeUserId, captainId);

    const activeTracking = await Tracking.findOne({ captain: driver.user._id })
        .sort({ updatedAt: -1 })
        .populate("shipment", "trackingNumber pickupAddress deliveryAddress status");

    return {
        captainId: driver._id,
        status: driver.status,
        lastActiveAt: driver.lastActiveAt,
        lastKnownLocation: driver.lastLocation ?? null,
        activeShipmentTracking: activeTracking || null,
    };
};

const getCaptainPerformance = async (officeUserId, captainId) => {
    const { driver } = await ensureOwnedCaptain(officeUserId, captainId);
    const userId = driver.user._id;

    const [completed, active, cancelled] = await Promise.all([
        Shipment.countDocuments({ captain: userId, status: SHIPMENT_STATUS.DELIVERED }),
        Shipment.countDocuments({
            captain: userId,
            status: { $in: [SHIPMENT_STATUS.CAPTAIN_ASSIGNMENT, SHIPMENT_STATUS.PICKED_UP, SHIPMENT_STATUS.IN_TRANSIT, SHIPMENT_STATUS.OUT_FOR_DELIVERY] },
        }),
        Shipment.countDocuments({ captain: userId, status: SHIPMENT_STATUS.CANCELLED }),
    ]);

    const ratingAgg = await Review.aggregate([
        { $match: { reviewee: userId } },
        { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    // Calculate real earnings from completed wallet transactions
    let totalEarnings = 0;
    const wallet = await Wallet.findOne({ userId });
    if (wallet) {
        const txAgg = await Transaction.aggregate([
            {
                $match: {
                    walletId: wallet._id,
                    type: "Credit",
                    purpose: "Earning",
                    status: "Completed"
                }
            },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        totalEarnings = txAgg[0]?.total ?? 0;
    }

    // Fallback to delivered shipments price if no transactions exist yet
    if (totalEarnings === 0 && completed > 0) {
        const shipmentPriceAgg = await Shipment.aggregate([
            { $match: { captain: userId, status: SHIPMENT_STATUS.DELIVERED } },
            { $group: { _id: null, total: { $sum: { $ifNull: ["$price", "$estimatedPriceMax"] } } } }
        ]);
        totalEarnings = shipmentPriceAgg[0]?.total ?? 0;
    }

    return {
        completedDeliveries: completed,
        activeDeliveries: active,
        cancelledDeliveries: cancelled,
        totalEarnings,
        averageRating: ratingAgg[0]?.average ? Number(ratingAgg[0].average.toFixed(2)) : null,
        ratingsCount: ratingAgg[0]?.count ?? 0,
    };
};

const getCaptainRatings = async (officeUserId, captainId, { page, limit } = {}) => {
    const { driver } = await ensureOwnedCaptain(officeUserId, captainId);
    const { skip, take } = getPagination(page, limit);

    const [reviews, total, agg] = await Promise.all([
        Review.find({ reviewee: driver.user._id })
            .populate("reviewer", "fullName")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(take),
        Review.countDocuments({ reviewee: driver.user._id }),
        Review.aggregate([
            { $match: { reviewee: driver.user._id } },
            { $group: { _id: null, average: { $avg: "$rating" } } },
        ]),
    ]);

    return {
        reviews,
        total,
        averageRating: agg[0]?.average ? Number(agg[0].average.toFixed(2)) : null,
    };
};

const getCaptainOrders = async (officeUserId, captainId, { status, page, limit } = {}) => {
    const { driver } = await ensureOwnedCaptain(officeUserId, captainId);
    const { skip, take } = getPagination(page, limit);

    const filter = { captain: driver.user._id };
    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
        Shipment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take),
        Shipment.countDocuments(filter),
    ]);

    return { orders, total, page: page ? Number(page) : 1, limit: take };
};

const getCaptainDeliveries = async (officeUserId, captainId, { page, limit } = {}) => {
    return getCaptainOrders(officeUserId, captainId, {
        status: SHIPMENT_STATUS.DELIVERED,
        page,
        limit,
    });
};

const updateOfficeAvailability = async (userId, status) => {
    const office = await resolveOffice(userId);
    office.status = status;
    await office.save();
    return office;
};

export default {
    createCaptain,
    getCaptains,
    getCaptainById,
    updateCaptain,
    deactivateCaptain,
    updateCaptainStatus,
    getCaptainTracking,
    getCaptainPerformance,
    getCaptainRatings,
    getCaptainOrders,
    getCaptainDeliveries,
    updateOfficeAvailability,
};
