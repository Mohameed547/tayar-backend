import Offer from "../../database/models/Offer.model.js";
import Shipment from "../../database/models/Shipment.model.js";
import ApiError from "../../shared/utils/ApiError.js";

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

const createOffer = async (offererId, offererType, offerData) => {
  const { shipmentId, price, estimatedDelivery, coverage, description } =
    offerData;

  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new ApiError(404, "Shipment not found");
  if (shipment.status !== "pending")
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

  if (shipment.status !== "pending")
    throw new ApiError(400, "Shipment is no longer accepting offers");

  offer.status = "accepted";
  await offer.save();

  await Offer.updateMany(
    { shipment: shipment._id, _id: { $ne: offerId } },
    { status: "rejected" },
  );

  await Shipment.findByIdAndUpdate(shipment._id, { status: "in_progress" });

  return offer;
};

export { getShipmentOffers, createOffer, acceptOffer };
