import Shipment from "../../database/models/Shipment.model.js";
import Driver, { CAPTAIN_STATUS } from "../../database/models/Driver.js";
import Office from "../../database/models/Office.js";
import ApiError from "../../shared/utils/ApiError.js";
import { SHIPMENT_STATUS } from "../../shared/constants/shipmentStatus.js";
import trackingService from "../tracking/tracking.service.js";

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
    const captainDrivers = await Driver.find({ officeId: office._id }).select("user");
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
    const driver = await Driver.findOne({ _id: captainId, officeId: office._id });
    if (!driver) throw ApiError.notFound("Captain not found for this office");
    if (!driver.isActive) throw ApiError.badRequest("Captain is deactivated");
    return driver;
};

const assignToCaptain = async (officeUserId, shipmentId, captainId) => {
    const { office, shipment } = await ensureOfficeShipment(officeUserId, shipmentId);
    const driver = await ensureOfficeCaptain(office, captainId);

    if (shipment.captain) {
        throw ApiError.conflict("Shipment is already assigned. Use reassign instead.");
    }

    shipment.captain = driver.user;
    await shipment.save();

    driver.status = CAPTAIN_STATUS.BUSY;
    driver.lastActiveAt = new Date();
    await driver.save();

    await trackingService.initTracking(shipment._id, driver.user).catch(() => null);

    return formatShipment(shipment);
};

const reassignToCaptain = async (officeUserId, shipmentId, captainId) => {
    const { office, shipment } = await ensureOfficeShipment(officeUserId, shipmentId);
    const newDriver = await ensureOfficeCaptain(office, captainId);

    if (shipment.captain && shipment.captain.toString() === newDriver.user.toString()) {
        throw ApiError.badRequest("Shipment is already assigned to this captain");
    }

    if (shipment.captain) {
        const previousDriver = await Driver.findOne({ user: shipment.captain, officeId: office._id });
        if (previousDriver) {
            previousDriver.status = CAPTAIN_STATUS.AVAILABLE;
            await previousDriver.save();
        }
    }

    shipment.captain = newDriver.user;
    await shipment.save();

    newDriver.status = CAPTAIN_STATUS.BUSY;
    newDriver.lastActiveAt = new Date();
    await newDriver.save();

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
    shipment.selectedOfferId = null;
    await shipment.save();

    return { rejected: true, shipmentId: shipment._id };
};

const getDashboard = async (officeUserId) => {
    const office = await resolveOffice(officeUserId);

    const [pendingCount, captainDrivers] = await Promise.all([
        Shipment.countDocuments({ assignedOffice: office._id, captain: null }),
        Driver.find({ officeId: office._id }),
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
