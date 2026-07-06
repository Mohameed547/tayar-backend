import jwt from "jsonwebtoken";
import { ENV } from "../../config/env.js";
import ApiError from "../utils/ApiError.js";
import User from "../../database/models/User.model.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Access denied. No token provided.");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, ENV.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) throw ApiError.unauthorized("Invalid token. User not found.");

    if (user.status === "suspended" || user.status === "banned") {
      throw ApiError.forbidden("Your account is suspended or banned.");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      next(ApiError.unauthorized("Token has expired"));
    } else {
      next(ApiError.unauthorized(error.message || "Invalid Token"));
    }
  }
};
