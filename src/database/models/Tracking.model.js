import { Schema, model } from "mongoose";

export const TRACKING_STATUS = {
    ASSIGNED: "assigned",
    PICKED_UP: "picked_up",
    IN_TRANSIT: "in_transit",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
};

const milestoneSchema = new Schema(
    {
        status: { type: String, enum: Object.values(TRACKING_STATUS), required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
    },
    { _id: false }
);

const trackingSchema = new Schema(
    {
        shipment: { type: Schema.Types.ObjectId, ref: "Shipment", required: true, unique: true },
        captain: { type: Schema.Types.ObjectId, ref: "User" },
        status: {
            type: String,
            enum: Object.values(TRACKING_STATUS),
            default: TRACKING_STATUS.ASSIGNED,
        },
        currentLocation: {
            coords: { type: [Number] },
            updatedAt: { type: Date },
        },
        milestones: { type: [milestoneSchema], default: [] },
        estimatedArrival: { type: Date },
        progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    },
    { timestamps: true }
);

trackingSchema.index({ captain: 1, status: 1 });

export default model("Tracking", trackingSchema);
