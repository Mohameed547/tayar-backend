import Review from "../../database/models/Review.model.js";
import Shipment from "../../database/models/Shipment.model.js";
import ApiError from "../../shared/utils/ApiError.js";

const createReview = async (userId, reviewData) => {
  const { shipmentId, revieweeType, revieweeId, rating, comment } = reviewData;

  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new ApiError(404, "Shipment not found");
  if (shipment.status !== "delivered")
    throw new ApiError(400, "Cannot review before shipment is delivered");

  // sure the customer is the owner for this shipment or not
  if (shipment.customer.toString() !== userId.toString())
    throw new ApiError(403, "You are not allowed to review this shipment");

  // sure review not exist on same shipment before
  const existing = await Review.findOne({
    shipment: shipmentId,
    reviewer: userId,
  });
  if (existing) throw new ApiError(409, "You already reviewed this shipment");

  const review = await Review.create({
    shipment: shipmentId,
    reviewer: userId,
    revieweeType,
    reviewee: revieweeId,
    rating,
    comment,
  });

  return review;
};

const getMyReviews = async (userId) => {
  const reviews = await Review.find({ reviewer: userId })
    .populate("shipment", "shipmentId status")
    .populate("reviewee", "fullName profileImage")
    .sort({ createdAt: -1 });

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  //shipment complete but not review yet
  const deliveredShipments = await Shipment.find({
    customer: userId,
    status: "delivered",
  }).select("_id");

  const reviewedShipmentIds = reviews.map((r) => r.shipment._id.toString());

  const pendingReviews = deliveredShipments.filter(
    (s) => !reviewedShipmentIds.includes(s._id.toString()),
  ).length;

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews: reviews.length,
    pendingReviews,
    reviews,
  };
};

export { createReview, getMyReviews };
