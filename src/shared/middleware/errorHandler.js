import logger from './logger.js';

export const errorHandler = (err, req, res, next) => {
    // Mongoose validation errors
    if (err.name === "ValidationError") {
        return res.status(400).json({
            status: "fail",
            message: err.message,
        });
    }

    // Mongoose bad ObjectId
    if (err.name === "CastError") {
        return res.status(400).json({
            status: "fail",
            message: "Invalid identifier format",
        });
    }

    const statusCode = err.statusCode || 500;
    const status = err.status || (statusCode >= 500 ? "error" : "fail");

    if (!err.isOperational) {
        console.error("Unhandled error:", err);
    }

    return res.status(statusCode).json({
        status,
        message: err.isOperational ? err.message : "Something went wrong on our end",
    });
};

export default errorHandler;