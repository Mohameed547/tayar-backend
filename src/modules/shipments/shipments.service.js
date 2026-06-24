import Shipment from "../../database/models/Shipment.model.js";
import Offer from "../../database/models/Offer.model.js";
import Driver from "../../database/models/Driver.js";
import Office from "../../database/models/Office.js";
import ApiError from "../../shared/utils/ApiError.js";
import { getPagination } from "../../shared/utils/pagination.js";
import { SHIPMENT_STATUS } from "../../shared/constants/shipmentStatus.js";
import User from "../../database/models/User.model.js";

const geocodeAddress = async (address) => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;

  const res = await fetch(url, {
    headers: { "User-Agent": "DeliverHub/1.0" },
  });

  const data = await res.json();

  if (!data || data.length === 0) {
    throw new ApiError(400, `Cannot geocode address: ${address}`);
  }

  return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
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
    estimatedPriceMin,
    estimatedPriceMax,
  });

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
    Shipment.find(query).sort({ createdAt: -1 }).skip(skip).limit(take),
    Shipment.countDocuments(query),
  ]);

  return { shipments, total, page: Number(page) || 1, limit: take };
};

const getShipmentById = async (id, customerId) => {
  const shipment = await Shipment.findOne({ _id: id, customer: customerId })
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
      .populate({
        path: "captain",
        model: "Driver",
        populate: { path: "user", select: "fullName phone" },
      }),
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

    const alreadyOffered = await Offer.find({ offerer: offererId }).select("shipment");
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

const getMyAssignedShipments = async (userId, role, { status, page, limit } = {}) => {
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
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(take),
        Shipment.countDocuments(query),
    ]);

    return { shipments, total, page: Number(page) || 1, limit: take };
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
};
