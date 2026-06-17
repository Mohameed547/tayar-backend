import mongoose from "mongoose";

const shipmentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "delivered", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true },
);

const Shipment = mongoose.model("Shipment", shipmentSchema);

export default Shipment;
