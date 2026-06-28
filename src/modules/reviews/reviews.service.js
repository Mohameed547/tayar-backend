import Review from "../../database/models/Review.model.js";
import Shipment from "../../database/models/Shipment.model.js";
import ApiError from "../../shared/utils/ApiError.js";

const createReview = async (userId, reviewData) => {
  const { shipmentId, revieweeType, revieweeId, rating, comment } = reviewData;

  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new ApiError(404, "Shipment not found");
  if (shipment.status !== "delivered")
    throw new ApiError(400, "Cannot review before shipment is delivered");

  if (shipment.customer.toString() !== userId.toString())
    throw new ApiError(403, "You are not allowed to review this shipment");

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
    .populate("shipment", "trackingNumber status")
    .populate("reviewee", "fullName profileImage")
    .sort({ createdAt: -1 });

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  const deliveredShipments = await Shipment.find({
    customer: userId,
    status: "delivered",
  })
    .populate("captain", "fullName profileImage")
    .populate({
      path: "assignedOffice",
      populate: { path: "user", select: "fullName profileImage" }
    })
    .select("_id trackingNumber captain assignedOffice updatedAt");

  const reviewedShipmentIds = reviews.map((r) => r.shipment ? r.shipment._id.toString() : "");

  const pendingReviewsList = deliveredShipments
    .filter((s) => !reviewedShipmentIds.includes(s._id.toString()))
    .map((s) => {
      let revieweeId = null;
      let revieweeType = "Driver";
      let revieweeName = "";

      if (s.assignedOffice) {
        revieweeId = s.assignedOffice.user?._id || s.assignedOffice.user;
        revieweeType = "Office";
        revieweeName = s.assignedOffice.businessName || (s.assignedOffice.user?.fullName || "Office");
      } else if (s.captain) {
        revieweeId = s.captain._id;
        revieweeType = "Driver";
        revieweeName = s.captain.fullName || "Driver";
      }

      return {
        _id: s._id,
        trackingNumber: s.trackingNumber,
        revieweeId,
        revieweeType,
        revieweeName,
        updatedAt: s.updatedAt,
      };
    })
    .filter((s) => s.revieweeId); // Only allow reviewing if there is a driver or office assigned

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews: reviews.length,
    pendingReviews: pendingReviewsList.length,
    pendingReviewsList,
    reviews,
  };
};

const getReceivedRatings = async (userId) => {
  const reviews = await Review.find({ reviewee: userId })
    .populate("reviewer", "fullName profileImage")
    .populate("shipment", "trackingNumber")
    .sort({ createdAt: -1 });

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    ratingsCount: reviews.length,
    reviews,
  };
};

export { createReview, getMyReviews, getReceivedRatings };
