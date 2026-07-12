import mongoose from "mongoose";
import { OFFICE_CAPTAIN_STATUS } from "../../shared/constants/officeCaptainStatus.js";

const officeCaptainSchema = new mongoose.Schema(
  {
    officeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Office",
      required: true,
    },
    captainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: false,
      default: null,
    },
    inviteeEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    inviteePhone: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(OFFICE_CAPTAIN_STATUS),
      default: OFFICE_CAPTAIN_STATUS.PENDING,
      required: true,
    },
    joinedAt: {
      type: Date,
      default: null,
    },
    leftAt: {
      type: Date,
      default: null,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    joinedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    role: {
      type: String,
      default: null,
    },
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    removedReason: {
      type: String,
      default: null,
    },
    removedAt: {
      type: Date,
      default: null,
    },
    invitationToken: {
      type: String,
      default: null,
    },
    invitationExpires: {
      type: Date,
      default: null,
    },
    isDefaultOffice: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for query performance and data integrity
officeCaptainSchema.index({ officeId: 1, captainId: 1 });
officeCaptainSchema.index({ captainId: 1, status: 1 });
officeCaptainSchema.index({ officeId: 1, status: 1 });
officeCaptainSchema.index({ invitationToken: 1 });
officeCaptainSchema.index({ officeId: 1, inviteeEmail: 1 });
officeCaptainSchema.index({ officeId: 1, inviteePhone: 1 });

const OfficeCaptain = mongoose.model("OfficeCaptain", officeCaptainSchema);

// Programmatically drop legacy unique index if it exists to support historical records and new marketplace relationships
OfficeCaptain.collection.dropIndex("officeId_1_captainId_1").catch(() => {});

export default OfficeCaptain;
