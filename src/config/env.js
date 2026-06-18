import "dotenv/config";

export const ENV = {
    PORT: process.env.PORT || 4000,
    MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/deliverhub",
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV || "development",
};
