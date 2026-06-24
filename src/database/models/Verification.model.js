import mongoose from "mongoose";

export const VERIFICATION_STATUS = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
};

const documentSchema = new mongoose.Schema(
    {
        documentType: {
            type: String,
            enum: ["national_id", "driving_license", "vehicle_license", "commercial_register"],
            required: true,
        },
        documentUrl: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
    },
    { _id: false },
);

const verificationSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        status: {
            type: String,
            enum: Object.values(VERIFICATION_STATUS),
            default: VERIFICATION_STATUS.PENDING,
        },
        documents: { type: [documentSchema], default: [] },
        reviewNote: { type: String, default: null },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reviewedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

export default mongoose.model("Verification", verificationSchema);
