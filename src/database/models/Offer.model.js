import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipment",
      required: true,
    },
    offererType: {
      type: String,
      enum: ["Driver", "Office"],
      required: true,
    },
    offerer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    estimatedDelivery: {
      type: String,
      required: true,
    },
    coverage: {
      type: String,
      enum: ["Insured", "None"],
      default: "None",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    isBestValue: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

offerSchema.index({ shipment: 1, offerer: 1 }, { unique: true });

const Offer = mongoose.model("Offer", offerSchema);

export default Offer;
