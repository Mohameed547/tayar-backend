import mongoose from "mongoose";
import { SHIPMENT_STATUS } from "../../shared/constants/shipmentStatus.js";

const shipmentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    trackingNumber: {
      type: String,
      unique: true,
    },

    pickupAddress: {
      type: String,
      required: true,
    },

    deliveryAddress: {
      type: String,
      required: true,
    },

    pickupCoords: {
      type: [Number],
      required: true,
    },

    deliveryCoords: {
      type: [Number],
      required: true,
    },

    weight: {
      type: Number,
      required: true,
    },

    packageType: {
      type: String,
      enum: ["small_box", "medium_box", "large_box", "pallet"],
      required: true,
    },

    deliverySpeed: {
      type: String,
      enum: ["standard", "express", "scheduled"],
      required: true,
    },

    scheduledDate: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(SHIPMENT_STATUS),
      default: SHIPMENT_STATUS.PENDING_OFFERS,
    },

    distanceKm: {
      type: Number,
      default: null,
    },

    estimatedPriceMin: {
      type: Number,
      default: null,
    },

    estimatedPriceMax: {
      type: Number,
      default: null,
    },

    price: {
      type: Number,
      default: null,
    },

    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Set when an Office's offer is accepted; the office must then assign
    // one of its own captains via the /office/offers endpoints.
    assignedOffice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Office",
      default: null,
    },

    selectedOfferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },

    etaDescription: {
      type: String,
      default: null,
    },

    pickedUpTime: {
      type: String,
      default: null,
    },

    deliveryProgressPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    officeDiscountPercentage: {
      type: Number,
      default: 0,
    },

    captainPrice: {
      type: Number,
      default: null,
    },

    captainStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: null,
    },

    proofOfDelivery: {
      otpCode: {
        type: String,
        default: null,
      },
      recipientName: {
        type: String,
        default: null,
      },
      signatureImage: {
        type: String,
        default: null,
      },
      packageImage: {
        type: String,
        default: null,
      },
      verifiedAt: {
        type: Date,
        default: null,
      },
    },

    deliveryVerification: {
      otpHash: {
        type: String,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      attempts: {
        type: Number,
        default: 0,
      },
      verified: {
        type: Boolean,
        default: false,
      },
      verifiedAt: {
        type: Date,
        default: null,
      },
      photoUrl: {
        type: String,
        default: null,
      },
      photoUploadedAt: {
        type: Date,
        default: null,
      },
    },

    captainCurrentLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },

    deliveryDistance: {
      type: Number,
      default: null,
    },

    deliveryLogs: [
      {
        status: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        note: {
          type: String,
          default: null,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

shipmentSchema.pre("save", async function (next) {
  if (!this.trackingNumber) {
    const count = await mongoose.model("Shipment").countDocuments();
    this.trackingNumber = `SC-${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

const Shipment = mongoose.model("Shipment", shipmentSchema);

export default Shipment;
