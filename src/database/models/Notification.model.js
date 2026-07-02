import { Schema, model } from "mongoose";

export const NOTIFICATION_TYPE = {
    PICKED_UP: "picked_up",
    IN_TRANSIT: "in_transit",
    OFFER_ACCEPTED: "offer_accepted",
    OFFERS_RECEIVED: "offers_received",
    OFFER_RECEIVED: "offer_received",
    NEW_SHIPMENT: "new_shipment",
    CAPTAIN_ASSIGNED: "captain_assigned",
    CAPTAIN_ACCEPTED: "captain_accepted",
    CAPTAIN_REJECTED: "captain_rejected",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
    DISPUTE_OPENED: "dispute_opened",
    WALLET_CREDITED: "wallet_credited",
};

const notificationSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        type: { type: String, enum: Object.values(NOTIFICATION_TYPE), required: true },
        title: { type: String, required: true },
        message: { type: String, required: true },
        relatedShipment: { type: Schema.Types.ObjectId, ref: "Shipment" },
        isRead: { type: Boolean, default: false },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export default model("Notification", notificationSchema);
