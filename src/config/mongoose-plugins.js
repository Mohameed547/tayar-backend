import mongoose from "mongoose";

// Setup global mongoose plugin to emit real-time updates to sockets
mongoose.plugin((schema) => {
  const emitSocketUpdate = async (modelName, action, doc) => {
    try {
      const { getIO } = await import("./socket.js");
      const io = getIO();
      if (!io) return;

      // Broadcast a generic dashboard update to all admins
      io.to("role:admin").emit("admin:dashboardUpdate", { model: modelName, action });
      
      // Specifically trigger resource-specific admin/office updates
      if (["User", "Driver", "Office"].includes(modelName)) {
        io.to("role:admin").emit("admin:userUpdate");
      }
      if (modelName === "Shipment") {
        io.to("role:admin").emit("admin:shipmentUpdate");
        
        // Notify all offices of shipment/order/requests updates
        io.emit("office:shipmentUpdate"); 

        if (doc && doc._id) {
          io.to(`shipment:${doc._id.toString()}`).emit("shipment:updated", doc);
        }
      }
      if (modelName === "Driver") {
        io.emit("office:captainUpdate");
      }
      if (modelName === "Verification") {
        io.to("role:admin").emit("admin:verificationUpdate");
        io.emit("office:verificationUpdate");
      }
      if (modelName === "Support") {
        io.to("role:admin").emit("admin:supportUpdate");
      }
      if (modelName === "Wallet") {
        io.to("role:admin").emit("admin:shipmentUpdate"); // updates revenue/stats
        io.emit("office:shipmentUpdate"); // updates office revenue
      }
    } catch (err) {
      // Safe catch for cases where Socket.IO isn't initialized yet
    }
  };

  schema.post("save", function (doc) {
    if (doc && doc.constructor && doc.constructor.modelName) {
      emitSocketUpdate(doc.constructor.modelName, "save", doc);
    }
  });

  const handleUpdate = function () {
    if (this.model && this.model.modelName) {
      emitSocketUpdate(this.model.modelName, "update");
    }
  };

  schema.post("updateOne", handleUpdate);
  schema.post("updateMany", handleUpdate);
  schema.post("findOneAndUpdate", handleUpdate);
  schema.post("deleteOne", handleUpdate);
  schema.post("deleteMany", handleUpdate);
  schema.post("findOneAndDelete", handleUpdate);
});
