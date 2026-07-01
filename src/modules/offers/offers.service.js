import Offer from "../../database/models/Offer.model.js";
import Shipment from "../../database/models/Shipment.model.js";
import Driver from "../../database/models/Driver.js";
import Office from "../../database/models/Office.js";
import ApiError from "../../shared/utils/ApiError.js";
import { SHIPMENT_STATUS } from "../../shared/constants/shipmentStatus.js";
import trackingService from "../tracking/tracking.service.js";
import Escrow from "../../database/models/Escrow.model.js";
import { getCommissionRate } from "../../shared/utils/platformConfig.js";

const getShipmentOffers = async (userId, shipmentId) => {
  const query = shipmentId.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: shipmentId }
    : { trackingNumber: shipmentId.toUpperCase() };

  const shipment = await Shipment.findOne(query);
  if (!shipment) throw new ApiError(404, "Shipment not found");

  if (shipment.customer.toString() !== userId.toString())
    throw new ApiError(403, "You are not allowed to view these offers");

  const offers = await Offer.find({ shipment: shipment._id })
    .sort({ price: 1 });

  // Manually populate offerer details to resolve Driver/Office schemas
  const populatedOffers = await Promise.all(
    offers.map(async (offer) => {
      const offerObj = offer.toObject();
      let providerName = "Provider";
      let providerAvatar = null;
      let rating = 4.8;
      let reviewCount = 120;

      if (offer.offererType === "Driver") {
        const driver = await Driver.findById(offer.offerer).populate("user", "fullName profileImage");
        if (driver && driver.user) {
          providerName = driver.user.fullName;
          providerAvatar = driver.user.profileImage;
          rating = driver.rating || 4.8;
        }
      } else if (offer.offererType === "Office") {
        const office = await Office.findById(offer.offerer).populate("user", "fullName profileImage");
        if (office) {
          providerName = office.businessName || (office.user && office.user.fullName) || "Logistics Office";
          providerAvatar = office.user ? office.user.profileImage : null;
        }
      }

      offerObj.offerer = {
        _id: offer.offerer,
        fullName: providerName,
        profileImage: providerAvatar,
        rating,
        reviewCount,
      };

      return offerObj;
    })
  );

  const bestValue = populatedOffers.find((o) => o.coverage === "Insured") || populatedOffers[0];

  const result = populatedOffers.map((offer) => ({
    ...offer,
    isBestValue: bestValue && offer._id.toString() === bestValue._id.toString(),
  }));

  return result;
};

const resolveOfferer = async (userId, role) => {
  if (role === "driver") {
    const driver = await Driver.findOne({ user: userId });
    if (!driver) throw new ApiError(404, "Driver profile not found");
    return { offererType: "Driver", offererId: driver._id, status: driver.status };
  }

  if (role === "office") {
    const office = await Office.findOne({ user: userId });
    if (!office) throw new ApiError(404, "Office profile not found");
    return { offererType: "Office", offererId: office._id, status: office.status };
  }

  throw new ApiError(403, "Only drivers and offices can create offers");
};

const createOffer = async (userId, role, offerData) => {
  const { shipmentId, price, estimatedDelivery, coverage, description } =
    offerData;
  const { offererType, offererId, status } = await resolveOfferer(userId, role);

  if (status === "offline") {
    throw new ApiError(403, "You cannot make offers while offline. Please go online first.");
  }

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

  try {
    let providerName = "A provider";
    if (offererType === "Driver") {
      const driver = await Driver.findById(offererId).populate("user", "fullName");
      if (driver && driver.user) providerName = driver.user.fullName;
    } else if (offererType === "Office") {
      const office = await Office.findById(offererId);
      if (office) providerName = office.businessName || "Logistics Office";
    }

    const notificationsService = (await import("../notifications/notifications.service.js")).default;
    await notificationsService.createNotification({
      userId: shipment.customer,
      type: "offer_received",
      title: "New Offer Received",
      message: `${providerName} sent a new offer of EGP ${price} for shipment #${shipment.trackingNumber}.`,
      relatedShipmentId: shipment._id,
    });
  } catch (err) {
    console.error("Failed to notify customer of offer:", err);
  }

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

  // Lock customer funds
  const walletService = (await import("../wallet/wallet.service.js")).default;
  await walletService.lockFunds(shipment.customer, offer.price, shipment._id);

  offer.status = "accepted";
  await offer.save();

  await Offer.updateMany(
    { shipment: shipment._id, _id: { $ne: offerId } },
    { status: "rejected" },
  );

  if (offer.offererType === "Office") {
    // The office still needs to assign one of its own captains.
    await Shipment.findByIdAndUpdate(shipment._id, {
      status: SHIPMENT_STATUS.CAPTAIN_ASSIGNMENT,
      captain: null,
      assignedOffice: offer.offerer,
      selectedOfferId: offer._id,
      etaDescription: offer.estimatedDelivery,
      price: offer.price,
    });
  } else {
    // Independent captain offer: assign the captain's User id directly.
    const driver = await Driver.findById(offer.offerer);
    await Shipment.findByIdAndUpdate(shipment._id, {
      status: SHIPMENT_STATUS.CAPTAIN_ASSIGNMENT,
      captain: driver ? driver.user : offer.offerer,
      captainStatus: "pending",
      assignedOffice: null,
      selectedOfferId: offer._id,
      etaDescription: offer.estimatedDelivery,
      price: offer.price,
    });
    await trackingService.initTracking(
      shipment._id,
      driver ? driver.user : offer.offerer,
    );
  }

  const commissionRate = await getCommissionRate();
  const commissionAmount = Math.round(offer.price * (commissionRate / 100));
  const netAmount = offer.price - commissionAmount;

  let providerUser = null;
  if (offer.offererType === "Office") {
    const officeDoc = await Office.findById(offer.offerer).select("user");
    providerUser = officeDoc ? officeDoc.user : null;
  } else {
    const driverDoc = await Driver.findById(offer.offerer).select("user");
    providerUser = driverDoc ? driverDoc.user : null;
  }

  await Escrow.create({
    shipment: shipment._id,
    customer: shipment.customer,
    driver: providerUser,
    amount: offer.price,
    commissionRate,
    commissionAmount,
    netAmount,
  });

  try {
    if (providerUser) {
      const notificationsService = (await import("../notifications/notifications.service.js")).default;
      await notificationsService.createNotification({
        userId: providerUser,
        type: "offer_accepted",
        title: "Offer Accepted!",
        message: `Your offer of EGP ${offer.price} for shipment #${shipment.trackingNumber} has been accepted.`,
        relatedShipmentId: shipment._id,
      });
    }
  } catch (err) {
    console.error("Failed to notify provider of accepted offer:", err);
  }

  return offer;
};

const getMyOffers = async (userId, role) => {
  const { offererId } = await resolveOfferer(userId, role);

  const offers = await Offer.find({ offerer: offererId })
    .populate("shipment", "trackingNumber pickupAddress deliveryAddress status")
    .sort({ createdAt: -1 });

  return offers;
};

export { getShipmentOffers, createOffer, acceptOffer, getMyOffers };
