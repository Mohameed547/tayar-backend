import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { ENV } from "./env.js";
import User from "../database/models/User.model.js";

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:3001", ENV.CLIENT_ORIGIN].filter(Boolean),
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Authentication token missing"));
      }

      const decoded = jwt.verify(token, ENV.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (!user) {
        return next(new Error("User no longer exists"));
      }

      socket.user = user;
      return next();
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user._id}`);

    socket.on("joinShipment", (shipmentId) => {
      socket.join(`shipment:${shipmentId}`);
    });

    socket.on("leaveShipment", (shipmentId) => {
      socket.leave(`shipment:${shipmentId}`);
    });

    // Captain emits live GPS coordinates while en route; broadcast to
    // everyone watching this shipment (office dashboard, customer tracking).
    socket.on("captain:updateLocation", async ({ shipmentId, lng, lat }) => {
      try {
        if (socket.user.role !== "driver") return;

        const trackingService = (await import("../modules/tracking/tracking.service.js")).default;
        const tracking = await trackingService.recordLocationPing(shipmentId, socket.user._id, {
          lng,
          lat,
        });

        io.to(`shipment:${shipmentId}`).emit("locationUpdate", {
          shipmentId,
          coords: tracking.currentLocation?.coords,
          progressPercent: tracking.progressPercent,
          updatedAt: tracking.currentLocation?.updatedAt,
        });
      } catch (err) {
        socket.emit("trackingError", { message: err.message ?? "Unable to update location" });
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error(
      "Socket.IO has not been initialized. Call initSocket() first.",
    );
  }
  return io;
};
