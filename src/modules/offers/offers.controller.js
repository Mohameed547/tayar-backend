import * as offersService from "./offers.service.js";

const getShipmentOffers = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { shipmentId } = req.params;
    const offers = await offersService.getShipmentOffers(userId, shipmentId);

    res.status(200).json({
      success: true,
      total: offers.length,
      data: offers,
    });
  } catch (error) {
    next(error);
  }
};

const createOffer = async (req, res, next) => {
  try {
    const offererId = req.user.id;
    const roleToOffererType = {
      driver: "driver",
      office: "office",
    };
    const offererType = roleToOffererType[req.user.role] ?? "office";
    const offer = await offersService.createOffer(
      req.user._id,
      req.user.role,
      req.body,
    );

    res.status(201).json({
      success: true,
      message: "Offer created successfully",
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};

const acceptOffer = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { offerId } = req.params;
    const offer = await offersService.acceptOffer(userId, offerId);

    res.status(200).json({
      success: true,
      message: "Offer accepted successfully",
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};

export { getShipmentOffers, createOffer, acceptOffer };
