import logger from "./logger.js";

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.isOperational
    ? err.message
    : "Something went wrong on our end";

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid identifier format";
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = err.message;
  }

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "Field";
    message = `${field} already exists`;
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  const status = err.status || (statusCode >= 500 ? "error" : "fail");
  if (!err.isOperational) {
    logger.error(`Unhandled error: ${err.message}\n${err.stack}`);
  }

  res.status(statusCode).json({
    status,
    success: false,
    message,
    errorCode: err.errorCode || err.code,
    code: err.code || err.errorCode,
    phone: err.phone,
    email: err.email,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default errorHandler;
