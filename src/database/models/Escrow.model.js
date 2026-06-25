import mongoose from "mongoose";

const escrowSchema = new mongoose.Schema(
  {
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipment",
      required: true,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    amount: {
      type: Number,
      required: true,
    },
    commissionRate: {
      type: Number,
      required: true,
    },
    commissionAmount: {
      type: Number,
      required: true,
    },
    netAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["held", "released", "refunded", "disputed"],
      default: "held",
    },
    releasedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("Escrow", escrowSchema);
