import Shipment from "../../database/models/Shipment.model.js";
import Driver, { CAPTAIN_STATUS } from "../../database/models/Driver.js";
import Office from "../../database/models/Office.js";
import ApiError from "../../shared/utils/ApiError.js";
import { SHIPMENT_STATUS } from "../../shared/constants/shipmentStatus.js";
import trackingService from "../tracking/tracking.service.js";
import OfficeCaptain from "../../database/models/OfficeCaptain.js";
import { OFFICE_CAPTAIN_STATUS } from "../../shared/constants/officeCaptainStatus.js";

// Helper to fetch all active captain IDs for an office (supporting legacy + new relation models)
const getActiveCaptainIdsForOffice = async (officeId) => {
    const inactiveRelations = await OfficeCaptain.find({
        officeId,
        status: { 
            $in: [
                OFFICE_CAPTAIN_STATUS.SUSPENDED,
                OFFICE_CAPTAIN_STATUS.REMOVED,
                OFFICE_CAPTAIN_STATUS.LEFT,
                OFFICE_CAPTAIN_STATUS.REJECTED
            ] 
        }
    }).select("captainId").lean();

    const inactiveIds = new Set(inactiveRelations.filter((r) => r.captainId).map((r) => r.captainId.toString()));

    const [relations, legacyDrivers] = await Promise.all([
        OfficeCaptain.find({ officeId, status: OFFICE_CAPTAIN_STATUS.ACTIVE }).select("captainId").lean(),
        Driver.find({ officeId }).select("_id").lean(),
    ]);

    const activeIds = relations.filter((r) => r.captainId).map((r) => r.captainId.toString());
    const legacyIds = legacyDrivers.map((d) => d._id.toString()).filter((id) => !inactiveIds.has(id));

    return Array.from(
        new Set([
            ...activeIds,
            ...legacyIds,
        ])
    );
};

const resolveOffice = async (userId) => {
    const office = await Office.findOne({ user: userId });
    if (!office) throw ApiError.notFound("Office profile not found");
    return office;
};

const formatShipment = (shipment) => ({
    id: shipment._id,
    trackingNumber: shipment.trackingNumber,
    pickupAddress: shipment.pickupAddress,
    deliveryAddress: shipment.deliveryAddress,
    status: shipment.status,
    captain: shipment.captain ?? null,
    createdAt: shipment.createdAt,
    price: shipment.price,
    officeDiscountPercentage: shipment.officeDiscountPercentage ?? 0,
    captainPrice: shipment.captainPrice ?? null,
    captainStatus: shipment.captainStatus ?? null,
});

// Shipments whose winning offer belongs to this office but haven't been
// handed off to one of the office's own captains yet.
const getPendingOffers = async (officeUserId) => {
    const office = await resolveOffice(officeUserId);
    const shipments = await Shipment.find({
        assignedOffice: office._id,
        captain: null,
    }).sort({ createdAt: -1 });
    return shipments.map(formatShipment);
};

// Shipments already handed off to one of the office's captains.
const getAssignedOffers = async (officeUserId) => {
    const office = await resolveOffice(officeUserId);
    const captainIds = await getActiveCaptainIdsForOffice(office._id);
    const captainDrivers = await Driver.find({ _id: { $in: captainIds } }).select("user");
    const captainUserIds = captainDrivers.map((d) => d.user);

    const shipments = await Shipment.find({
        assignedOffice: office._id,
        captain: { $in: captainUserIds },
    })
        .populate("captain", "fullName phone")
        .sort({ createdAt: -1 });

    return shipments.map((s) => ({
        ...formatShipment(s),
        captain: s.captain
            ? { id: s.captain._id, fullName: s.captain.fullName, phone: s.captain.phone }
            : null,
    }));
};

const ensureOfficeShipment = async (officeUserId, shipmentId) => {
    const office = await resolveOffice(officeUserId);
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) throw ApiError.notFound("Shipment not found");
    if (!shipment.assignedOffice || shipment.assignedOffice.toString() !== office._id.toString()) {
        throw ApiError.forbidden("This shipment is not assigned to your office");
    }
    return { office, shipment };
};

const ensureOfficeCaptain = async (office, captainId) => {
    const captainIds = await getActiveCaptainIdsForOffice(office._id);
    if (!captainIds.includes(captainId.toString())) {
        throw ApiError.notFound("Captain not found for this office");
    }
    const driver = await Driver.findById(captainId);
    if (!driver) throw ApiError.notFound("Captain not found");
    if (!driver.isActive) throw ApiError.badRequest("Captain is deactivated");
    if (driver.status === CAPTAIN_STATUS.BUSY) {
        throw ApiError.badRequest("Captain is currently busy with another shipment");
    }
    if (driver.workingMode !== "office" || !driver.activeOfficeId || driver.activeOfficeId.toString() !== office._id.toString()) {
        throw ApiError.badRequest("Captain is not currently working in Office mode for this office");
    }
    return driver;
};

const assignToCaptain = async (officeUserId, shipmentId, captainId, percentage = 0) => {
    const { office, shipment } = await ensureOfficeShipment(officeUserId, shipmentId);
    const driver = await ensureOfficeCaptain(office, captainId);

    if (shipment.captain) {
        throw ApiError.conflict("Shipment is already assigned. Use reassign instead.");
    }

    const EscrowModel = (await import("../../database/models/Escrow.model.js")).default;
    const escrow = await EscrowModel.findOne({ shipment: shipment._id });

    // Use escrow.amount as the true base price (guaranteed not null).
    // Fall back to shipment.price only if escrow doesn't exist yet.
    const baseAmount = escrow ? escrow.amount : (shipment.price || 0);
    const netAmount  = escrow ? escrow.netAmount : (baseAmount * 0.9);

    const officeShare = Math.round(baseAmount * (percentage / 100));
    const captainPrice = Math.max(0, netAmount - officeShare);

    shipment.captain = driver.user;
    shipment.officeDiscountPercentage = percentage;
    shipment.captainPrice = captainPrice;
    shipment.captainStatus = "pending";
    await shipment.save();

    try {
        const notificationsService = (await import("../notifications/notifications.service.js")).default;
        await notificationsService.createNotification({
            userId: driver.user,
            type: "captain_assigned",
            title: "New Shipment Assignment Offered",
            message: `You have been offered shipment #${shipment.trackingNumber} with a payout of EGP ${captainPrice}. Please accept or reject it.`,
            relatedShipmentId: shipment._id,
        });

        const { getIO } = await import("../../config/socket.js");
        const io = getIO();
        io.to(`user:${driver.user}`).emit("shipment_assigned", { shipmentId: shipment._id, trackingNumber: shipment.trackingNumber });
        io.to(`office:${office._id}`).emit("shipment_assigned", { shipmentId: shipment._id, trackingNumber: shipment.trackingNumber, captainId: driver._id });
    } catch (err) {
        console.error("Failed to emit assignment notifications:", err);
    }

    return formatShipment(shipment);
};

const reassignToCaptain = async (officeUserId, shipmentId, captainId, percentage = 0) => {
    const { office, shipment } = await ensureOfficeShipment(officeUserId, shipmentId);
    const newDriver = await ensureOfficeCaptain(office, captainId);

    if (shipment.captain && shipment.captain.toString() === newDriver.user.toString()) {
        throw ApiError.badRequest("Shipment is already assigned to this captain");
    }

    if (shipment.captain) {
        const captainIds = await getActiveCaptainIdsForOffice(office._id);
        const previousDriver = await Driver.findOne({ user: shipment.captain, _id: { $in: captainIds } });
        if (previousDriver) {
            previousDriver.status = CAPTAIN_STATUS.AVAILABLE;
            await previousDriver.save();
        }
    }

    const EscrowModel = (await import("../../database/models/Escrow.model.js")).default;
    const escrow = await EscrowModel.findOne({ shipment: shipment._id });

    // Use escrow.amount as the true base price (guaranteed not null).
    const baseAmount = escrow ? escrow.amount : (shipment.price || 0);
    const netAmount  = escrow ? escrow.netAmount : (baseAmount * 0.9);

    const officeShare = Math.round(baseAmount * (percentage / 100));
    const captainPrice = Math.max(0, netAmount - officeShare);

    shipment.captain = newDriver.user;
    shipment.officeDiscountPercentage = percentage;
    shipment.captainPrice = captainPrice;
    shipment.captainStatus = "pending";
    await shipment.save();

    try {
        const notificationsService = (await import("../notifications/notifications.service.js")).default;
        await notificationsService.createNotification({
            userId: newDriver.user,
            type: "captain_assigned",
            title: "New Shipment Assignment Offered",
            message: `You have been offered shipment #${shipment.trackingNumber} with a payout of EGP ${captainPrice}. Please accept or reject it.`,
            relatedShipmentId: shipment._id,
        });

        const { getIO } = await import("../../config/socket.js");
        const io = getIO();
        io.to(`user:${newDriver.user}`).emit("shipment_assigned", { shipmentId: shipment._id, trackingNumber: shipment.trackingNumber });
        io.to(`office:${office._id}`).emit("shipment_assigned", { shipmentId: shipment._id, trackingNumber: shipment.trackingNumber, captainId: newDriver._id });
    } catch (err) {
        console.error("Failed to emit reassignment notifications:", err);
    }

    return formatShipment(shipment);
};

const rejectOffer = async (officeUserId, shipmentId) => {
    const { shipment } = await ensureOfficeShipment(officeUserId, shipmentId);

    if (shipment.captain) {
        const previousDriver = await Driver.findOne({ user: shipment.captain });
        if (previousDriver) {
            previousDriver.status = CAPTAIN_STATUS.AVAILABLE;
            await previousDriver.save();
        }
    }

    shipment.status = SHIPMENT_STATUS.PENDING_OFFERS;
    shipment.assignedOffice = null;
    shipment.captain = null;
    shipment.captainStatus = null;
    shipment.officeDiscountPercentage = 0;
    shipment.captainPrice = null;
    shipment.selectedOfferId = null;
    await shipment.save();

    return { rejected: true, shipmentId: shipment._id };
};

const getDashboard = async (officeUserId) => {
    const office = await resolveOffice(officeUserId);
    const captainIds = await getActiveCaptainIdsForOffice(office._id);

    const [pendingCount, captainDrivers] = await Promise.all([
        Shipment.countDocuments({ assignedOffice: office._id, captain: null }),
        Driver.find({ _id: { $in: captainIds } }),
    ]);

    const captainUserIds = captainDrivers.map((d) => d.user);
    const assignedCount = await Shipment.countDocuments({
        assignedOffice: office._id,
        captain: { $in: captainUserIds },
    });

    return {
        totalCaptains: captainDrivers.length,
        activeCaptains: captainDrivers.filter((d) => d.isActive).length,
        onlineCaptains: captainDrivers.filter((d) => d.status === CAPTAIN_STATUS.ONLINE).length,
        pendingOffers: pendingCount,
        assignedOffers: assignedCount,
    };
};

export default {
    getPendingOffers,
    getAssignedOffers,
    assignToCaptain,
    reassignToCaptain,
    rejectOffer,
    getDashboard,
};
