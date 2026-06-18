import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env.js';
import ApiError from '../utils/ApiError.js';
import User from '../../database/models/User.js';

export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw ApiError.unauthorized('Access denied. No token provided.');
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, ENV.JWT_SECRET);

        const user = await User.findById(decoded.id);
        if (!user) throw ApiError.unauthorized('Invalid token. User not found.');

        if (user.status === 'suspended' || user.status === 'banned') {
            throw ApiError.forbidden('Your account is suspended or banned.');
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            next(ApiError.unauthorized('Token has expired'));
        } else {
            next(ApiError.unauthorized(error.message || 'Invalid Token'));
        }
    }
};
import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import { ENV } from "../../config/env.js";
import User from "../../database/models/User.model.js";

export const authenticate = async (req, res, next) => {
    try {
        const header = req.headers.authorization;

        if (!header || !header.startsWith("Bearer ")) {
            throw new ApiError(401, "No token provided");
        }

        const token = header.split(" ")[1];

        let decoded;
        try {
            decoded = jwt.verify(token, ENV.JWT_SECRET);
        } catch {
            throw new ApiError(401, "Invalid or expired token");
        }

        // decoded is expected to carry { id } at minimum (set at login time)
        const user = await User.findById(decoded.id).select("-passwordHash");
        if (!user) {
            throw new ApiError(401, "User no longer exists");
        }

        req.user = user;
        return next();
    } catch (err) {
        return next(err);
    }
};
