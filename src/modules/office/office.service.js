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

const formatCaptain = async (driver, user = null, officeId = null) => {
    const captainUser = user || driver.user;
    let relationshipStatus = "ACTIVE";
    if (officeId && driver._id) {
        const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
        const rel = await OfficeCaptain.findOne({ officeId, captainId: driver._id });
        if (rel) {
            relationshipStatus = rel.status;
        }
    }
    return {
        id: driver._id,
        userId: captainUser._id ?? captainUser,
        fullName: captainUser.fullName,
        email: captainUser.email,
        phone: captainUser.phone,
        vehicle: driver.vehicle,
        status: driver.status,
        relationshipStatus,
        isActive: driver.isActive,
        lastActiveAt: driver.lastActiveAt,
        officeId: driver.officeId,
        workingMode: driver.workingMode || "independent",
        activeOfficeId: driver.activeOfficeId || null,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
    };
};

const createCaptain = async (officeUserId, payload, { sendEmailOtp }) => {
    const office = await resolveOffice(officeUserId);
    const { fullName, email, phone, vehicleType, plateNumber } = payload;

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

    // Captain account: no password set yet. They must verify OTP → set password → upload docs.
    const user = new User({
        fullName,
        email: email.toLowerCase(),
        phone,
        password: null,
        role: "driver",
        status: "pending",
        isPhoneVerified: false,
        accountStatus: "PENDING_OTP",
    });
    await user.save();

    const driver = await Driver.create({
        user: user._id,
        vehicle: { type: vehicleType, plateNumber },
        officeId: office._id,
        status: CAPTAIN_STATUS.OFFLINE,
        isActive: false, // inactive until fully onboarded
    });

    const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
    const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");
    await OfficeCaptain.create({
        officeId: office._id,
        captainId: driver._id,
        status: OFFICE_CAPTAIN_STATUS.ACTIVE,
        joinedAt: new Date(),
        invitedBy: officeUserId,
    });

    // Send OTP to captain's email immediately
    await sendEmailOtp(user, "captain_activation");

    return {
        captain: await formatCaptain(driver, user),
        message: "Captain account created. Verification OTP sent to their email.",
    };
};

const ensureOwnedCaptain = async (officeUserId, captainId) => {
    const office = await resolveOffice(officeUserId);
    const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
    const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");

    let hasRelationship = false;
    const relation = await OfficeCaptain.findOne({
        officeId: office._id,
        captainId,
        status: { $in: [OFFICE_CAPTAIN_STATUS.ACTIVE, OFFICE_CAPTAIN_STATUS.SUSPENDED] },
    });

    if (relation) {
        hasRelationship = true;
    } else {
        // Fallback to legacy check for compatibility during migration
        const legacyDriver = await Driver.findOne({ _id: captainId, officeId: office._id });
        if (legacyDriver) {
            hasRelationship = true;
        }
    }

    const driver = await Driver.findById(captainId).populate(
        "user",
        "fullName email phone status",
    );

    if (!driver || !hasRelationship) {
        throw ApiError.notFound("Captain not found for this office");
    }

    return { office, driver };
};

const getCaptains = async (officeUserId, { status, relationshipStatus, search, page, limit }) => {
    const office = await resolveOffice(officeUserId);
    const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
    const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");

    // 1. Get relationship status filter
    const relStatusFilter = [];
    if (relationshipStatus === 'active') {
        relStatusFilter.push(OFFICE_CAPTAIN_STATUS.ACTIVE);
    } else if (relationshipStatus === 'suspended') {
        relStatusFilter.push(OFFICE_CAPTAIN_STATUS.SUSPENDED);
    } else {
        relStatusFilter.push(OFFICE_CAPTAIN_STATUS.ACTIVE, OFFICE_CAPTAIN_STATUS.SUSPENDED);
    }

    const relations = await OfficeCaptain.find({
        officeId: office._id,
        status: { $in: relStatusFilter }
    }).select("captainId status").lean();

    // 2. Fetch legacy drivers (only if relationshipStatus is not suspended)
    let legacyDriverIds = [];
    if (relationshipStatus !== 'suspended') {
        const legacyDrivers = await Driver.find({ officeId: office._id }).select("_id").lean();
        
        // Exclude legacy drivers with relationship other than ACTIVE
        const nonActiveRelations = await OfficeCaptain.find({
            officeId: office._id,
            status: { $ne: OFFICE_CAPTAIN_STATUS.ACTIVE }
        }).select("captainId").lean();
        
        const nonActiveSet = new Set(nonActiveRelations.filter(r => r.captainId).map(r => r.captainId.toString()));
        legacyDriverIds = legacyDrivers.map(d => d._id.toString()).filter(id => !nonActiveSet.has(id));
    }

    const captainIds = Array.from(
        new Set([
            ...relations.map((r) => r.captainId ? r.captainId.toString() : "").filter(Boolean),
            ...legacyDriverIds,
        ])
    );

    const filter = { _id: { $in: captainIds } };
    if (status) filter.status = status;

    let drivers = await Driver.find(filter).populate("user", "fullName email phone status").sort({ createdAt: -1 });

    // Apply client side search filter to support populated user object filtering
    if (search && search.trim()) {
        const query = search.trim().toLowerCase();
        drivers = drivers.filter(d => {
            const u = d.user || {};
            return (
                (u.fullName && u.fullName.toLowerCase().includes(query)) ||
                (u.email && u.email.toLowerCase().includes(query)) ||
                (u.phone && u.phone.includes(query))
            );
        });
    }

    const total = drivers.length;
    const { skip, take } = getPagination(page, limit);
    const paginatedDrivers = drivers.slice(skip, skip + take);

    const captains = await Promise.all(
        paginatedDrivers.map((d) => formatCaptain(d, null, office._id))
    );

    // Get total counts for office summary
    const [totalActive, totalSuspended] = await Promise.all([
        OfficeCaptain.countDocuments({ officeId: office._id, status: OFFICE_CAPTAIN_STATUS.ACTIVE }),
        OfficeCaptain.countDocuments({ officeId: office._id, status: OFFICE_CAPTAIN_STATUS.SUSPENDED }),
    ]);

    const legacyActiveCount = legacyDriverIds.length;

    return {
        captains,
        pagination: {
            total,
            page: page ? Number(page) : 1,
            limit: take,
            pages: Math.ceil(total / take),
        },
        summary: {
            totalCaptains: totalActive + totalSuspended + legacyActiveCount,
            activeCaptains: totalActive + legacyActiveCount,
            suspendedCaptains: totalSuspended,
        },
    };
};

const getCaptainById = async (officeUserId, captainId) => {
    const { office, driver } = await ensureOwnedCaptain(officeUserId, captainId);
    const ordersCount = await Shipment.countDocuments({ captain: driver.user._id });
    return { ...(await formatCaptain(driver, null, office._id)), ordersCount };
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

const deactivateCaptain = async (officeUserId, captainId, { hardDelete = false, removedReason = "Removed by office administrator" } = {}, reqMetadata) => {
    const { office, driver } = await ensureOwnedCaptain(officeUserId, captainId);

    const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
    const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");

    // 1. Validation check: Office CANNOT remove captain if active shipment, delivery in progress, or pending assignment exists.
    const activeShipments = await Shipment.find({
        captain: driver.user._id,
        assignedOffice: office._id,
        status: {
            $in: [
                SHIPMENT_STATUS.CAPTAIN_ASSIGNMENT,
                SHIPMENT_STATUS.PICKED_UP,
                SHIPMENT_STATUS.IN_TRANSIT,
                SHIPMENT_STATUS.OUT_FOR_DELIVERY
            ]
        }
    });

    if (activeShipments.length > 0) {
        const hasPending = activeShipments.some(s => s.status === SHIPMENT_STATUS.CAPTAIN_ASSIGNMENT);
        if (hasPending) {
            throw ApiError.badRequest("Cannot remove captain: Pending shipment assignment exists.");
        }
        throw ApiError.badRequest("Cannot remove captain: Active delivery is in progress.");
    }

    if (hardDelete) {
        // Clear relationship
        await OfficeCaptain.deleteOne({ officeId: office._id, captainId: driver._id });
        // Maintain legacy compatibility
        if (driver.officeId && driver.officeId.toString() === office._id.toString()) {
            driver.officeId = null;
            await driver.save();
        }

        const { logOfficeCaptainAction } = await import("../../shared/utils/auditLogger.js");
        await logOfficeCaptainAction({
            officeId: office._id,
            captainId: driver._id,
            action: "Captain Removed",
            reason: `Hard deleted. Reason: ${removedReason || "None given"}`,
            reqMetadata
        });

        // Send real-time notification to captain
        try {
            const notificationService = (await import("../notifications/notifications.service.js")).default;
            await notificationService.createNotification({
                userId: driver.user,
                type: "office_relation_update",
                title: "Affiliation Terminated",
                message: `Your affiliation with ${office.businessName} has been terminated.`
            });
        } catch (err) {
            console.error("Non-blocking notification error:", err);
        }

        return { deleted: true };
    }

    // Set relationship status to REMOVED
    await OfficeCaptain.findOneAndUpdate(
        { officeId: office._id, captainId: driver._id },
        {
            status: OFFICE_CAPTAIN_STATUS.REMOVED,
            leftAt: new Date(),
            removedAt: new Date(),
            removedBy: officeUserId,
            removedReason,
        },
        { upsert: true }
    );

    // Keep legacy field in sync by nulling it
    if (driver.officeId && driver.officeId.toString() === office._id.toString()) {
        driver.officeId = null;
        await driver.save();
    }

    const { logOfficeCaptainAction } = await import("../../shared/utils/auditLogger.js");
    await logOfficeCaptainAction({
        officeId: office._id,
        captainId: driver._id,
        action: "Captain Removed",
        reason: `Deactivated/Removed from office. Reason: ${removedReason || "None given"}`,
        reqMetadata
    });

    // Send real-time notification to captain
    try {
        const notificationService = (await import("../notifications/notifications.service.js")).default;
        await notificationService.createNotification({
            userId: driver.user,
            type: "office_relation_update",
            title: "Affiliation Terminated",
            message: `Your affiliation with ${office.businessName} has been terminated.`
        });

        const { getIO } = await import("../../config/socket.js");
        const io = getIO();
        io.to(`office:${office._id}`).emit("captain_removed", { captainId: driver._id });
        io.to(`user:${driver.user._id ?? driver.user}`).emit("captain_removed", { officeId: office._id });
    } catch (err) {
        console.error("Non-blocking notification error:", err);
    }

    return { deactivated: true, captain: await formatCaptain(driver, null, office._id) };
};

const suspendCaptain = async (officeUserId, captainId, reason, reqMetadata) => {
    const { office, driver } = await ensureOwnedCaptain(officeUserId, captainId);
    const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
    const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");

    await OfficeCaptain.findOneAndUpdate(
        { officeId: office._id, captainId: driver._id },
        { status: OFFICE_CAPTAIN_STATUS.SUSPENDED },
        { upsert: true }
    );

    const { logOfficeCaptainAction } = await import("../../shared/utils/auditLogger.js");
    await logOfficeCaptainAction({
        officeId: office._id,
        captainId: driver._id,
        action: "Captain Suspended",
        reason: reason || "Suspended by office administrator",
        reqMetadata
    });

    // Send real-time notification to captain
    try {
        const notificationService = (await import("../notifications/notifications.service.js")).default;
        await notificationService.createNotification({
            userId: driver.user,
            type: "office_relation_update",
            title: "Affiliation Suspended",
            message: `Your affiliation with ${office.businessName} has been suspended.`
        });

        const { getIO } = await import("../../config/socket.js");
        const io = getIO();
        io.to(`office:${office._id}`).emit("captain_status_changed", { captainId: driver._id, status: "suspended" });
        io.to(`user:${driver.user._id ?? driver.user}`).emit("captain_status_changed", { captainId: driver._id, status: "suspended" });
    } catch (err) {
        console.error("Non-blocking notification error:", err);
    }

    return formatCaptain(driver, null, office._id);
};

const unsuspendCaptain = async (officeUserId, captainId, reqMetadata) => {
    const { office, driver } = await ensureOwnedCaptain(officeUserId, captainId);
    const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
    const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");

    await OfficeCaptain.findOneAndUpdate(
        { officeId: office._id, captainId: driver._id },
        { status: OFFICE_CAPTAIN_STATUS.ACTIVE },
        { upsert: true }
    );

    const { logOfficeCaptainAction } = await import("../../shared/utils/auditLogger.js");
    await logOfficeCaptainAction({
        officeId: office._id,
        captainId: driver._id,
        action: "Captain Restored",
        reason: "Restored/Unsuspended by office administrator",
        reqMetadata
    });

    // Send real-time notification to captain
    try {
        const notificationService = (await import("../notifications/notifications.service.js")).default;
        await notificationService.createNotification({
            userId: driver.user,
            type: "office_relation_update",
            title: "Affiliation Restored",
            message: `Your affiliation with ${office.businessName} has been restored.`
        });

        const { getIO } = await import("../../config/socket.js");
        const io = getIO();
        io.to(`office:${office._id}`).emit("captain_status_changed", { captainId: driver._id, status: driver.status });
        io.to(`user:${driver.user._id ?? driver.user}`).emit("captain_status_changed", { captainId: driver._id, status: driver.status });
    } catch (err) {
        console.error("Non-blocking notification error:", err);
    }

    return formatCaptain(driver, null, office._id);
};


const updateCaptainStatus = async (officeUserId, captainId, status) => {
    const { office, driver } = await ensureOwnedCaptain(officeUserId, captainId);

    if (!driver.isActive) {
        throw ApiError.badRequest("Cannot change status of a deactivated captain");
    }

    driver.status = status;
    driver.lastActiveAt = new Date();
    await driver.save();

    try {
        const { getIO } = await import("../../config/socket.js");
        const io = getIO();
        io.to(`office:${office._id}`).emit("captain_status_changed", { captainId: driver._id, status });
        io.to(`user:${driver.user._id ?? driver.user}`).emit("captain_status_changed", { captainId: driver._id, status });
    } catch {}

    return formatCaptain(driver);
};

const getCaptainTracking = async (officeUserId, captainId) => {
    const { driver } = await ensureOwnedCaptain(officeUserId, captainId);

    const activeTracking = await Tracking.findOne({ captain: driver.user._id })
        .sort({ updatedAt: -1 })
        .populate("shipment", "trackingNumber pickupAddress deliveryAddress status pickupCoords deliveryCoords captainCurrentLocation");

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

const searchCaptain = async (officeUserId, query) => {
    const office = await resolveOffice(officeUserId);
    if (!query || query.trim() === "") {
        throw ApiError.badRequest("Search query is required");
    }

    const searchVal = query.trim();
    const user = await User.findOne({
        role: "driver",
        $or: [
            { email: { $regex: new RegExp(`^${searchVal}$`, "i") } },
            { phone: searchVal }
        ]
    }).select("fullName email phone status").lean();

    if (!user) {
        return { status: "not_found" };
    }

    const driver = await Driver.findOne({ user: user._id }).lean();
    if (!driver) {
        return { status: "not_found" };
    }

    const [reviews, totalDeliveries] = await Promise.all([
        Review.find({ reviewee: user._id, revieweeType: "Driver" }).select("rating").lean(),
        Shipment.countDocuments({ captain: user._id, status: SHIPMENT_STATUS.DELIVERED })
    ]);

    const avgRating = reviews.length
        ? Number((reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1))
        : 0;

    return {
        status: "found",
        captain: {
            id: driver._id,
            name: user.fullName,
            email: user.email,
            phone: user.phone,
            rating: avgRating,
            deliveries: totalDeliveries
        }
    };
};

const inviteCaptain = async (officeUserId, { email, phone, captainId }, reqMetadata) => {
    const office = await resolveOffice(officeUserId);
    const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
    const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");
    const { logOfficeCaptainAction } = await import("../../shared/utils/auditLogger.js");
    const crypto = await import("crypto");

    let targetDriver = null;
    let targetUser = null;
    let targetEmail = email ? email.trim().toLowerCase() : null;
    let targetPhone = phone ? phone.trim() : null;

    if (captainId) {
        targetDriver = await Driver.findById(captainId);
        if (!targetDriver) throw ApiError.notFound("Captain profile not found");
        targetUser = await User.findById(targetDriver.user).lean();
        if (targetUser) {
            targetEmail = targetUser.email;
            targetPhone = targetUser.phone;
        }
    } else {
        const query = [];
        if (targetEmail) query.push({ email: { $regex: new RegExp(`^${targetEmail}$`, "i") } });
        if (targetPhone) query.push({ phone: targetPhone });

        if (query.length > 0) {
            targetUser = await User.findOne({ role: "driver", $or: query }).lean();
            if (targetUser) {
                targetDriver = await Driver.findOne({ user: targetUser._id });
                targetEmail = targetUser.email;
                targetPhone = targetUser.phone;
            }
        }
    }

    if (targetDriver) {
        const activeOrSuspendedRelation = await OfficeCaptain.findOne({
            officeId: office._id,
            captainId: targetDriver._id,
            status: { $in: [OFFICE_CAPTAIN_STATUS.ACTIVE, OFFICE_CAPTAIN_STATUS.SUSPENDED] }
        });
        if (activeOrSuspendedRelation) {
            if (activeOrSuspendedRelation.status === OFFICE_CAPTAIN_STATUS.SUSPENDED) {
                throw ApiError.conflict("Captain is currently suspended in this office");
            }
            throw ApiError.conflict("Captain is already an active member of this office");
        }
    }

    let existingInvitation = null;
    if (targetDriver) {
        existingInvitation = await OfficeCaptain.findOne({
            officeId: office._id,
            captainId: targetDriver._id,
            status: OFFICE_CAPTAIN_STATUS.INVITED
        });
    } else {
        const matchQuery = [];
        if (targetEmail) matchQuery.push({ inviteeEmail: targetEmail });
        if (targetPhone) matchQuery.push({ inviteePhone: targetPhone });
        if (matchQuery.length > 0) {
            existingInvitation = await OfficeCaptain.findOne({
                officeId: office._id,
                status: OFFICE_CAPTAIN_STATUS.INVITED,
                $or: matchQuery
            });
        }
    }

    if (existingInvitation) {
        const token = crypto.randomBytes(32).toString("hex");
        existingInvitation.invitationToken = token;
        existingInvitation.invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await existingInvitation.save();
        console.log(`[Invitation Service] Resending/updating invitation token for ${targetEmail || targetPhone}`);

        await logOfficeCaptainAction({
            officeId: office._id,
            captainId: targetDriver ? targetDriver._id : null,
            action: "Invitation Sent",
            reason: `Resent/Updated invitation via email: ${targetEmail || "N/A"}, phone: ${targetPhone || "N/A"}`,
            reqMetadata
        });

        // Send real-time notification to captain
        if (targetUser) {
            try {
                const notificationService = (await import("../notifications/notifications.service.js")).default;
                await notificationService.createNotification({
                    userId: targetUser._id,
                    type: "office_invite",
                    title: "New Office Invitation",
                    message: `You have been invited to join ${office.businessName}.`
                });
            } catch (err) {
                console.error("Non-blocking notification error:", err);
            }
        }

        return existingInvitation;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitationData = {
        officeId: office._id,
        status: OFFICE_CAPTAIN_STATUS.INVITED,
        invitedBy: officeUserId,
        invitationToken: token,
        invitationExpires: expires,
        inviteeEmail: targetEmail,
        inviteePhone: targetPhone,
    };

    if (targetDriver) {
        invitationData.captainId = targetDriver._id;
    }

    const invitation = await OfficeCaptain.create(invitationData);
    console.log(`[Invitation Service] Simulating sending invitation to ${targetEmail || targetPhone} with token ${token}`);

    await logOfficeCaptainAction({
        officeId: office._id,
        captainId: targetDriver ? targetDriver._id : null,
        action: "Invitation Sent",
        reason: `Created invitation via email: ${targetEmail || "N/A"}, phone: ${targetPhone || "N/A"}`,
        reqMetadata
    });

    // Send real-time notification to captain
    if (targetUser) {
        try {
            const notificationService = (await import("../notifications/notifications.service.js")).default;
            await notificationService.createNotification({
                userId: targetUser._id,
                type: "office_invite",
                title: "New Office Invitation",
                message: `You have been invited to join ${office.businessName}.`
            });
        } catch (err) {
            console.error("Non-blocking notification error:", err);
        }
    }

    return invitation;
};

const cancelInvitation = async (officeUserId, invitationId, reqMetadata) => {
    const office = await resolveOffice(officeUserId);
    const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
    const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");
    const { logOfficeCaptainAction } = await import("../../shared/utils/auditLogger.js");
    const { getIO } = await import("../../config/socket.js");

    const invitation = await OfficeCaptain.findOne({
        _id: invitationId,
        officeId: office._id,
        status: OFFICE_CAPTAIN_STATUS.INVITED,
    });

    if (!invitation) {
        throw ApiError.notFound("Invitation not found or no longer pending");
    }

    invitation.status = OFFICE_CAPTAIN_STATUS.CANCELLED;
    await invitation.save();

    await logOfficeCaptainAction({
        officeId: office._id,
        captainId: invitation.captainId,
        action: "Invitation Cancelled",
        reason: "Cancelled by office administrator",
        reqMetadata
    });

    // Socket Events
    try {
        const io = getIO();
        io.to(`office:${office._id}`).emit("office_invitation_cancelled", { invitationId });
        
        let targetUserId = null;
        if (invitation.captainId) {
            const Driver = (await import("../../database/models/Driver.js")).default;
            const driver = await Driver.findById(invitation.captainId);
            if (driver) targetUserId = driver.user;
        } else {
            const User = (await import("../../database/models/User.model.js")).default;
            const query = [];
            if (invitation.inviteeEmail) query.push({ email: invitation.inviteeEmail });
            if (invitation.inviteePhone) query.push({ phone: invitation.inviteePhone });
            if (query.length > 0) {
                const user = await User.findOne({ role: "driver", $or: query });
                if (user) targetUserId = user._id;
            }
        }

        if (targetUserId) {
            io.to(`user:${targetUserId}`).emit("office_invitation_cancelled", { invitationId });
            
            // Database notification
            const notificationService = (await import("../notifications/notifications.service.js")).default;
            await notificationService.createNotification({
                userId: targetUserId,
                type: "office_invite_cancelled",
                title: "Invitation Cancelled",
                message: `The invitation to join ${office.businessName} has been cancelled.`
            });
        }
    } catch (err) {
        console.error("Non-blocking notification error on cancel invitation:", err);
    }

    return { cancelled: true };
};

const getOfficeInvitations = async (officeUserId, { status, page, limit }) => {
    const office = await resolveOffice(officeUserId);
    const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
    const { getPagination } = await import("../../shared/utils/pagination.js");

    const query = { officeId: office._id };
    if (status) {
        query.status = status.toUpperCase();
    }

    const { skip, take } = getPagination(page, limit);

    const [invitations, total] = await Promise.all([
        OfficeCaptain.find(query)
            .populate({
                path: "captainId",
                populate: { path: "user", select: "fullName email phone status" }
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(take),
        OfficeCaptain.countDocuments(query)
    ]);

    return {
        invitations: invitations.map(inv => ({
            id: inv._id,
            inviteeEmail: inv.inviteeEmail,
            inviteePhone: inv.inviteePhone,
            status: inv.status,
            createdAt: inv.createdAt,
            captain: inv.captainId ? {
                id: inv.captainId._id,
                fullName: inv.captainId.user?.fullName,
                email: inv.captainId.user?.email,
                phone: inv.captainId.user?.phone,
                status: inv.captainId.status
            } : null
        })),
        pagination: {
            total,
            page: page ? Number(page) : 1,
            limit: take,
            pages: Math.ceil(total / take)
        }
    };
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
    searchCaptain,
    inviteCaptain,
    suspendCaptain,
    unsuspendCaptain,
    cancelInvitation,
    getOfficeInvitations,
};
