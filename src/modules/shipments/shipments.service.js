import Shipment from "../../database/models/Shipment.model.js";
import Offer from "../../database/models/Offer.model.js";
import Driver from "../../database/models/Driver.js";
import Office from "../../database/models/Office.js";
import ApiError from "../../shared/utils/ApiError.js";
import { getPagination } from "../../shared/utils/pagination.js";
import { SHIPMENT_STATUS } from "../../shared/constants/shipmentStatus.js";
import User from "../../database/models/User.model.js";
import walletService from "../wallet/wallet.service.js";

const geocodeAddress = async (address) => {
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;

        const res = await fetch(url, {
            headers: { "User-Agent": "DeliverHub/1.0" },
        });

        const data = await res.json();

        if (!data || data.length === 0) {
            console.warn(
                `Geocoding failed for: ${address}, using Cairo fallback coords.`,
            );
            return [31.2357, 30.0444];
        }

        return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
    } catch (err) {
        console.error(
            "Geocoding fetch error, using Cairo fallback coords:",
            err,
        );
        return [31.2357, 30.0444];
    }
};

const calcDistanceKm = ([lng1, lat1], [lng2, lat2]) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calcEstimatedPrice = (distanceKm, weight, deliverySpeed) => {
    const base = 10;
    const perKm = 2;
    const perKg = 1.5;
    const speedMultiplier = { standard: 1, express: 1.5, scheduled: 1.2 };

    const price =
        (base + distanceKm * perKm + weight * perKg) *
        (speedMultiplier[deliverySpeed] ?? 1);

    return {
        estimatedPriceMin: Math.round(price * 0.9),
        estimatedPriceMax: Math.round(price * 1.1),
    };
};

const createShipment = async (customerId, body) => {
    const {
        pickupAddress,
        deliveryAddress,
        weight,
        packageType,
        deliverySpeed,
        scheduledDate,
        notes,
        price,
    } = body;

    const [pickupCoords, deliveryCoords] = await Promise.all([
        geocodeAddress(pickupAddress),
        geocodeAddress(deliveryAddress),
    ]);

    const distanceKm = calcDistanceKm(pickupCoords, deliveryCoords);
    const { estimatedPriceMin, estimatedPriceMax } = calcEstimatedPrice(
        distanceKm,
        weight,
        deliverySpeed,
    );

    const cost = price || estimatedPriceMin || 0;
    const wallet = await walletService.getWalletBalance(customerId, "customer");
    if (wallet.balance < cost) {
        throw new ApiError(
            400,
            "Insufficient wallet balance to cover the shipment cost. Please top up your wallet.",
        );
    }

    const shipment = await Shipment.create({
        customer: customerId,
        pickupAddress,
        deliveryAddress,
        pickupCoords,
        deliveryCoords,
        weight,
        packageType,
        deliverySpeed,
        scheduledDate: scheduledDate ?? null,
        notes: notes ?? null,
        distanceKm: Math.round(distanceKm * 10) / 10,
        estimatedPriceMin: price ? Math.round(price * 0.9) : estimatedPriceMin,
        estimatedPriceMax: price ? Math.round(price * 1.1) : estimatedPriceMax,
    });

    try {
        const notificationsService = (
            await import("../notifications/notifications.service.js")
        ).default;
        const [drivers, offices] = await Promise.all([
            Driver.find({ status: { $ne: "offline" } }).select("user"),
            Office.find({ status: { $ne: "offline" } }).select("user"),
        ]);

        const providers = [
            ...drivers.map((d) => d.user),
            ...offices.map((o) => o.user),
        ].filter(Boolean);

        for (const userId of providers) {
            await notificationsService.createNotification({
                userId,
                type: "new_shipment",
                title: "New Shipment Request Available",
                message: `A new package is waiting for offers from ${pickupAddress} to ${deliveryAddress}.`,
                relatedShipmentId: shipment._id,
            });
        }
    } catch (err) {
        console.error("Failed to emit shipment notifications:", err);
    }

    return shipment;
};

const getShipmentsByCustomer = async (
    customerId,
    statusFilter,
    { page, limit },
) => {
    const { skip, take } = getPagination(page, limit);

    const query = { customer: customerId };
    if (statusFilter) query.status = { $in: statusFilter };

    const [shipments, total] = await Promise.all([
        Shipment.find(query)
            .populate("captain", "fullName phone profileImage")
            .populate("selectedOfferId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(take),
        Shipment.countDocuments(query),
    ]);

    return { shipments, total, page: Number(page) || 1, limit: take };
};

const getShipmentById = async (id, customerId) => {
    const query = id.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: id }
        : { trackingNumber: id.toUpperCase() };

    if (customerId) query.customer = customerId;

    const shipment = await Shipment.findOne(query)
        .populate("captain", "fullName phone profileImage")
        .populate("selectedOfferId");

    return shipment;
};

const cancelShipment = async (id, customerId) => {
    const shipment = await Shipment.findOne({ _id: id, customer: customerId });

    if (!shipment) throw new ApiError(404, "Shipment not found");

    const cancellable = [
        SHIPMENT_STATUS.PENDING_OFFERS,
        SHIPMENT_STATUS.CAPTAIN_ASSIGNMENT,
    ];

    if (!cancellable.includes(shipment.status)) {
        throw new ApiError(400, "Cannot cancel shipment at this stage");
    }

    shipment.status = "cancelled";
    await shipment.save();

    await walletService.refundFunds(id).catch((err) => {
        console.error(
            "Failed to refund escrow funds on customer cancellation:",
            err,
        );
    });

    return shipment;
};

const getAllShipments = async (statusFilter, { page, limit, search }) => {
    const { skip, take } = getPagination(page, limit);

    const query = {};
    if (statusFilter) query.status = { $in: statusFilter };
    if (search) {
        const matchingCustomers = await User.find({
            role: "customer",
            $or: [
                { fullName: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ],
        }).distinct("_id");
        query.customer = { $in: matchingCustomers };
    }

    const [shipments, total] = await Promise.all([
        Shipment.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(take)
            .populate("customer", "fullName phone")
            .populate("captain", "fullName phone"),
        Shipment.countDocuments(query),
    ]);

    return { shipments, total, page: Number(page) || 1, limit: take };
};

const updateShipmentStatus = async (id, status) => {
    const shipment = await Shipment.findById(id);
    if (!shipment) throw new ApiError(404, "Shipment not found");
    shipment.status = status;
    await shipment.save();
    return shipment;
};

const getAvailableShipments = async (userId, role, { page, limit } = {}) => {
    const { skip, take } = getPagination(page, limit);

    let offererId = userId;
    if (role === "driver") {
        const driver = await Driver.findOne({ user: userId });
        if (driver) offererId = driver._id;
    } else if (role === "office") {
        const office = await Office.findOne({ user: userId });
        if (office) offererId = office._id;
    }

    const alreadyOffered = await Offer.find({ offerer: offererId }).select(
        "shipment",
    );
    const excludeIds = alreadyOffered.map((o) => o.shipment);

    const query = {
        status: SHIPMENT_STATUS.PENDING_OFFERS,
        _id: { $nin: excludeIds },
    };

    const [shipments, total] = await Promise.all([
        Shipment.find(query).sort({ createdAt: -1 }).skip(skip).limit(take),
        Shipment.countDocuments(query),
    ]);

    return { shipments, total, page: Number(page) || 1, limit: take };
};

const getMyAssignedShipments = async (
    userId,
    role,
    { status, page, limit } = {},
) => {
    const { skip, take } = getPagination(page, limit);

    let query;
    if (role === "office") {
        const office = await Office.findOne({ user: userId });
        query = office ? { assignedOffice: office._id } : { _id: null };
    } else {
        query = { captain: userId };
    }

    if (status) query.status = { $in: status.split(",") };

    const [shipments, total] = await Promise.all([
        Shipment.find(query)
            .populate("captain", "fullName phone")
            .populate("customer", "fullName phone")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(take),
        Shipment.countDocuments(query),
    ]);

    return { shipments, total, page: Number(page) || 1, limit: take };
};

const acceptAssignment = async (shipmentId, captainUserId) => {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) throw ApiError.notFound("Shipment not found");

    if (
        !shipment.captain ||
        shipment.captain.toString() !== captainUserId.toString()
    ) {
        throw ApiError.forbidden("This shipment is not assigned to you");
    }

    if (shipment.captainStatus !== "pending") {
        throw ApiError.badRequest(
            `Shipment assignment is already ${shipment.captainStatus}`,
        );
    }

    shipment.captainStatus = "accepted";
    shipment.status = SHIPMENT_STATUS.CAPTAIN_ASSIGNMENT;
    await shipment.save();

    const driver = await Driver.findOne({ user: captainUserId });
    if (driver) {
        driver.status = "busy";
        driver.lastActiveAt = new Date();
        await driver.save();
    }

    try {
        const trackingService = (
            await import("../tracking/tracking.service.js")
        ).default;
        await trackingService
            .initTracking(shipment._id, captainUserId)
            .catch(() => null);
    } catch (err) {
        console.error("Failed to init tracking on acceptAssignment:", err);
    }

    try {
        const notificationsService = (
            await import("../notifications/notifications.service.js")
        ).default;
        await notificationsService.createNotification({
            userId: shipment.customer,
            type: "captain_assigned",
            title: "Captain Assigned",
            message: `A captain has accepted your shipment #${shipment.trackingNumber}.`,
            relatedShipmentId: shipment._id,
        });

        if (shipment.assignedOffice) {
            const office = await Office.findById(shipment.assignedOffice);
            if (office) {
                await notificationsService.createNotification({
                    userId: office.user,
                    type: "captain_accepted",
                    title: "Shipment Assignment Accepted",
                    message: `Captain accepted the assignment for shipment #${shipment.trackingNumber}.`,
                    relatedShipmentId: shipment._id,
                });
            }
        }
    } catch (err) {
        console.error("Failed to send notification on accept:", err);
    }

    return shipment;
};

const rejectAssignment = async (shipmentId, captainUserId) => {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) throw ApiError.notFound("Shipment not found");

    if (
        !shipment.captain ||
        shipment.captain.toString() !== captainUserId.toString()
    ) {
        throw ApiError.forbidden("This shipment is not assigned to you");
    }

    if (shipment.captainStatus !== "pending") {
        throw ApiError.badRequest(
            `Shipment assignment is already ${shipment.captainStatus}`,
        );
    }

    shipment.captainStatus = "rejected";
    shipment.captain = null;
    shipment.officeDiscountPercentage = 0;
    shipment.captainPrice = null;
    await shipment.save();

    const driver = await Driver.findOne({ user: captainUserId });
    if (driver) {
        driver.status = "available";
        await driver.save();
    }

    try {
        const notificationsService = (
            await import("../notifications/notifications.service.js")
        ).default;
        if (shipment.assignedOffice) {
            const OfficeModel = (
                await import("../../database/models/Office.js")
            ).default;
            const office = await OfficeModel.findById(shipment.assignedOffice);
            if (office) {
                await notificationsService.createNotification({
                    userId: office.user,
                    type: "captain_rejected",
                    title: "Shipment Assignment Rejected",
                    message: `Captain rejected the assignment for shipment #${shipment.trackingNumber}.`,
                    relatedShipmentId: shipment._id,
                });
            }
        }
    } catch (err) {
        console.error("Failed to send notification on reject:", err);
    }

    return shipment;
};

export default {
    createShipment,
    getShipmentsByCustomer,
    getShipmentById,
    cancelShipment,
    getAllShipments,
    updateShipmentStatus,
    getAvailableShipments,
    getMyAssignedShipments,
    acceptAssignment,
    rejectAssignment,
};