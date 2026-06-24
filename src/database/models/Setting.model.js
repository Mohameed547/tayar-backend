import mongoose from "mongoose";
const settingSchema = new mongoose.Schema(
    {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        // ── Platform (fees & commission) ────────────────────────────────────
        commissionRate: {
            type: Number,
            min: 0,
            max: 100,
            default: 7,
        },
        subscriptionFee: {
            type: Number,
            min: 0,
            default: 49,
        },
        featuredListingFee: {
            type: Number,
            min: 0,
            default: 19,
        },

        // ── Notifications ────────────────────────────────────────────────────
        newDisputeAlerts: {
            type: Boolean,
            default: true,
        },
        newOfficeRegistrations: {
            type: Boolean,
            default: false,
        },
        dailyRevenueReport: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

settingSchema.statics.getForAdmin = async function (adminId) {
    let settings = await this.findOne({ adminId });
    if (!settings) {
        settings = await this.create({ adminId });
    }
    return settings;
};

const Setting = mongoose.model("Setting", settingSchema);

export default Setting;
