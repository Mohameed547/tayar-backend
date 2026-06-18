import * as reviewsService from "./reviews.service.js";

const createReview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const review = await reviewsService.createReview(userId, req.body);

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

const getMyReviews = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = await reviewsService.getMyReviews(userId);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export { createReview, getMyReviews };
