import Offer from "../../database/models/Offer.model.js";
import Shipment from "../../database/models/Shipment.model.js";
import Driver from "../../database/models/Driver.js";
import Office from "../../database/models/Office.js";
import ApiError from "../../shared/utils/ApiError.js";
import { SHIPMENT_STATUS } from "../../shared/constants/shipmentStatus.js";
import trackingService from "../tracking/tracking.service.js";

const getShipmentOffers = async (userId, shipmentId) => {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new ApiError(404, "Shipment not found");

  if (shipment.customer.toString() !== userId.toString())
    throw new ApiError(403, "You are not allowed to view these offers");

  const offers = await Offer.find({ shipment: shipmentId })
    .populate("offerer", "fullName profileImage")
    .sort({ price: 1 });

  const bestValue = offers.find((o) => o.coverage === "Insured") || offers[0];

  const result = offers.map((offer) => ({
    ...offer.toObject(),
    isBestValue: bestValue && offer._id.equals(bestValue._id),
  }));

  return result;
};

const resolveOfferer = async (userId, role) => {
  if (role === "driver") {
    const driver = await Driver.findOne({ user: userId });
    if (!driver) throw new ApiError(404, "Driver profile not found");
    return { offererType: "Driver", offererId: driver._id };
  }

  if (role === "office") {
    const office = await Office.findOne({ user: userId });
    if (!office) throw new ApiError(404, "Office profile not found");
    return { offererType: "Office", offererId: office._id };
  }

  throw new ApiError(403, "Only drivers and offices can create offers");
};

const createOffer = async (userId, role, offerData) => {
  const { shipmentId, price, estimatedDelivery, coverage, description } =
    offerData;
  const { offererType, offererId } = await resolveOfferer(userId, role);

  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new ApiError(404, "Shipment not found");
  if (shipment.status !== SHIPMENT_STATUS.PENDING_OFFERS)
    throw new ApiError(400, "Shipment is no longer accepting offers");

  const existing = await Offer.findOne({
    shipment: shipmentId,
    offerer: offererId,
  });
  if (existing)
    throw new ApiError(409, "You already made an offer on this shipment");

  const offer = await Offer.create({
    shipment: shipmentId,
    offererType,
    offerer: offererId,
    price,
    estimatedDelivery,
    coverage,
    description,
  });

  return offer;
};

const acceptOffer = async (userId, offerId) => {
  const offer = await Offer.findById(offerId).populate("shipment");
  if (!offer) throw new ApiError(404, "Offer not found");

  const shipment = offer.shipment;
  if (shipment.customer.toString() !== userId.toString())
    throw new ApiError(403, "You are not allowed to accept this offer");

  if (shipment.status !== SHIPMENT_STATUS.PENDING_OFFERS)
    throw new ApiError(400, "Shipment is no longer accepting offers");

  offer.status = "accepted";
  await offer.save();

  await Offer.updateMany(
    { shipment: shipment._id, _id: { $ne: offerId } },
    { status: "rejected" },
  );

  await Shipment.findByIdAndUpdate(shipment._id, {
    status: SHIPMENT_STATUS.CAPTAIN_ASSIGNMENT,
    captain: offer.offerer,
    selectedOfferId: offer._id,
  });

  await trackingService.initTracking(shipment._id, offer.offerer);

  return offer;
};

export { getShipmentOffers, createOffer, acceptOffer };
