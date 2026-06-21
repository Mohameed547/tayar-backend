import mongoose from "mongoose";
import { ENV } from "./env.js";
import logger from "../shared/middleware/logger.js";

export const connectDB = async () => {
    await mongoose.connect(ENV.MONGO_URI);
    logger.info("MongoDB connected");
};
