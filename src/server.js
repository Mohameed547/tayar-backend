import http from "http";
import app from "./app.js";
import { connectDB } from "./config/database.js";
import { initSocket } from "./config/socket.js";
import { ENV } from "./config/env.js";
import logger from "./shared/middleware/logger.js";

const start = async () => {
  try {
    await connectDB();
    logger.info("Connected to MongoDB successfully.");

    const httpServer = http.createServer(app);
    initSocket(httpServer);
    logger.info("Socket.IO initialized");

    httpServer.listen(ENV.PORT, () => {
      logger.info(`Server running on port ${ENV.PORT}`);
    });
  } catch (err) {
    logger.error(`Server failed to start: ${err.message}`);
    process.exit(1);
  }
};

start().catch((err) => {
    logger.error(`Server startup failed: ${err.message}`);
    process.exit(1);
});
