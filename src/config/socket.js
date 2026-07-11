import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { ENV } from "./env.js";
import User from "../database/models/User.model.js";

let io;
const onlineUsers = new Map();

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:5000",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:5173",
        ENV.CLIENT_ORIGIN
      ].filter(Boolean),
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

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Notify all active sockets about the connection change
    io.emit("user:statusChanged", { userId, status: "online" });

    // Handle initial online status checks
    socket.on("checkUserStatus", (targetUserId, callback) => {
      const isOnline = onlineUsers.has(targetUserId) && onlineUsers.get(targetUserId).size > 0;
      if (typeof callback === "function") {
        callback({ userId: targetUserId, status: isOnline ? "online" : "offline" });
      }
    });

    socket.on("disconnect", () => {
      const uId = socket.user._id.toString();
      if (onlineUsers.has(uId)) {
        const sockets = onlineUsers.get(uId);
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(uId);
          io.emit("user:statusChanged", { userId: uId, status: "offline" });
        }
      }
    });

    // 1. Join user room
    socket.join(`user:${socket.user._id}`);

    // 2. Join role room
    socket.join(`role:${socket.user.role}`);

    // 3. Join office room if applicable
    try {
      if (socket.user.role === "office") {
        const OfficeModel = (await import("../database/models/Office.js")).default;
        const office = await OfficeModel.findOne({ user: socket.user._id });
        if (office) {
          socket.join(`office:${office._id}`);
          console.log(`Socket ${socket.id} (Office) joined office room office:${office._id}`);
        }
      } else if (socket.user.role === "driver") {
        const DriverModel = (await import("../database/models/Driver.js")).default;
        const driver = await DriverModel.findOne({ user: socket.user._id });
        if (driver && driver.officeId) {
          socket.join(`office:${driver.officeId}`);
          console.log(`Socket ${socket.id} (Driver) joined office room office:${driver.officeId}`);
        }
      }
    } catch (err) {
      console.error("Error joining office room on connection:", err.message);
    }

    socket.on("joinShipment", (shipmentId) => {
      socket.join(`shipment:${shipmentId}`);
      console.log(`Socket ${socket.id} joined shipment room shipment:${shipmentId}`);
    });

    socket.on("leaveShipment", (shipmentId) => {
      socket.leave(`shipment:${shipmentId}`);
      console.log(`Socket ${socket.id} left shipment room shipment:${shipmentId}`);
    });

    socket.on("joinOffice", (officeId) => {
      socket.join(`office:${officeId}`);
      console.log(`Socket ${socket.id} joined office room office:${officeId}`);
    });

    socket.on("leaveOffice", (officeId) => {
      socket.leave(`office:${officeId}`);
      console.log(`Socket ${socket.id} left office room office:${officeId}`);
    });

    socket.on("joinRole", (role) => {
      socket.join(`role:${role}`);
      console.log(`Socket ${socket.id} joined role room role:${role}`);
    });

    socket.on("leaveRole", (role) => {
      socket.leave(`role:${role}`);
      console.log(`Socket ${socket.id} left role room role:${role}`);
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
