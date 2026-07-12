import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    officeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Office",
      default: null,
    },
    captainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },
    action: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    browser: {
      type: String,
      default: null,
    },
    device: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ officeId: 1 });
auditLogSchema.index({ captainId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ timestamp: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
