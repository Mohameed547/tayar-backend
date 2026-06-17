import mongoose from "mongoose";

export const TICKET_STATUS = {
    OPEN: "open",
    RESOLVED: "resolved",
};

export const TICKET_CATEGORY = {
    DELAY: "delay",
    BILLING: "billing",
    DAMAGE: "damage",
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
            default: TICKET_STATUS.OPEN,
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
    },
    { timestamps: true },
);

supportTicketSchema.pre("save", async function (next) {
    if (this.isNew) {
        const seq = await getNextSequence("supportTicket");
        this.ticketNumber = `tkt-${seq}`;
    }
    next();
});

const Support = mongoose.model("Support", supportTicketSchema);
export default Support;
