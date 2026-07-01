import mongoose from "mongoose";

export const TICKET_STATUS = {
    SENT: "sent",
    RESOLVED: "resolved",
};

export const TICKET_CATEGORY = {
    DELAY: "delay",
    BILLING: "billing",
    DAMAGE: "damage",
    APP_ISSUE: "app_issue",
    PAYMENT: "payment",
    ACCIDENT: "accident",
    CUSTOMER_ISSUE: "customer_issue",
    DRIVER_ISSUE: "driver_issue",
    SYSTEM_ISSUE: "system_issue",
    OTHER: "other",
};

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 9021 },
});

const Counter = mongoose.model("Counter", counterSchema);

const getNextSequence = async (name) => {
    const counter = await Counter.findByIdAndUpdate(
        name,
        [
            {
                $set: {
                    seq: { $add: [{ $ifNull: ["$seq", 9021] }, 1] },
                },
            },
        ],
        { new: true, upsert: true },
    );
    return counter.seq;
};

const supportTicketSchema = new mongoose.Schema(
    {
        ticketNumber: {
            type: String,
            unique: true,
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        subject: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            enum: Object.values(TICKET_CATEGORY),
            required: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: Object.values(TICKET_STATUS),
            default: TICKET_STATUS.SENT,
        },
        relatedShipment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Shipment",
            default: null,
        },
        resolvedAt: {
            type: Date,
            default: null,
        },
        messages: [
            {
                sender: {
                    type: String,
                    enum: ["user", "admin"],
                    required: true,
                },
                senderName: {
                    type: String,
                    required: true,
                },
                text: {
                    type: String,
                    required: true,
                },
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
    },
    { timestamps: true },
);

supportTicketSchema.pre("save", async function (next) {
    if (this.isNew) {
        const seq = await getNextSequence("supportTicket");
        this.ticketNumber = `tkt-${seq}`;
        
        // Populate messages with initial ticket message
        if (this.message && (!this.messages || this.messages.length === 0)) {
            this.messages.push({
                sender: "user",
                senderName: "Customer",
                text: this.message,
                createdAt: new Date(),
            });
        }
    }
    next();
});

const Support = mongoose.model("Support", supportTicketSchema);
export default Support;
