import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["customer", "driver", "office", "admin"],
      default: "customer",
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "banned"],
      default: "pending",
    },
    isPhoneVerified: { type: Boolean, default: false },
    otpHash: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    otpPurpose: { type: String, select: false },
    refreshTokens: { type: [String], select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastLoginAt: { type: Date },

    // --- Added for profile module ---
    profileImage: { type: String, default: null },
    pushTokens: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Return safe user object (without sensitive data)
userSchema.methods.toSafeJSON = function () {
  const userObj = this.toObject();
  delete userObj.password;
  delete userObj.refreshTokens;
  delete userObj.otpHash;
  delete userObj.otpExpires;
  delete userObj.otpPurpose;
  delete userObj.passwordResetTokenHash;
  delete userObj.passwordResetExpires;
  return userObj;
};

// Cascade Delete Helper
async function cascadeDeleteUser(userId) {
  try {
    const mongoose = (await import("mongoose")).default;
    
    // Import all models dynamically to register their schemas
    await import("./Driver.js");
    await import("./Office.js");
    await import("./Wallet.model.js");
    await import("./Shipment.model.js");
    await import("./Offer.model.js");
    await import("./Tracking.model.js");
    await import("./Escrow.model.js");
    await import("./Notification.model.js");
    await import("./Support.model.js");
    await import("./Review.model.js");

    console.log(`[CASCADE DELETE] Starting cleanup for user: ${userId}`);

    const Driver = mongoose.model("Driver");
    const Office = mongoose.model("Office");
    const Wallet = mongoose.model("Wallet");
    const Transaction = mongoose.model("Transaction");
    const Shipment = mongoose.model("Shipment");
    const Offer = mongoose.model("Offer");
    const Tracking = mongoose.model("Tracking");
    const Escrow = mongoose.model("Escrow");
    const Notification = mongoose.model("Notification");
    const Support = mongoose.model("Support");
    const Review = mongoose.model("Review");

    const driver = await Driver.findOne({ user: userId });
    const office = await Office.findOne({ user: userId });

    const driverId = driver ? driver._id : null;
    const officeId = office ? office._id : null;

    // 2. Delete Wallet and Transactions
    const wallets = await Wallet.find({ userId });
    const walletIds = wallets.map(w => w._id);
    if (walletIds.length > 0) {
      await Transaction.deleteMany({ walletId: { $in: walletIds } });
      await Wallet.deleteMany({ userId });
      console.log(`[CASCADE DELETE] Deleted ${walletIds.length} wallets and their transactions`);
    }

    // 3. Find and Delete Shipments (where user is customer or captain)
    const shipmentQuery = {
      $or: [
        { customer: userId },
        { captain: userId }
      ]
    };
    if (officeId) {
      shipmentQuery.$or.push({ assignedOffice: officeId });
    }
    const shipments = await Shipment.find(shipmentQuery);
    const shipmentIds = shipments.map(s => s._id);

    if (shipmentIds.length > 0) {
      await Tracking.deleteMany({ shipmentId: { $in: shipmentIds } });
      await Escrow.deleteMany({ shipmentId: { $in: shipmentIds } });
      await Offer.deleteMany({ shipment: { $in: shipmentIds } });
      await Shipment.deleteMany({ _id: { $in: shipmentIds } });
      console.log(`[CASCADE DELETE] Deleted ${shipmentIds.length} shipments and their tracking/escrow/offers`);
    }

    // 4. Delete Offers made by Driver or Office
    const offerQuery = { $or: [] };
    if (driverId) {
      offerQuery.$or.push({ offerer: driverId, offererType: "Driver" });
    }
    if (officeId) {
      offerQuery.$or.push({ offerer: officeId, offererType: "Office" });
    }
    if (offerQuery.$or.length > 0) {
      const deletedOffersResult = await Offer.deleteMany(offerQuery);
      console.log(`[CASCADE DELETE] Deleted ${deletedOffersResult.deletedCount} offers made by driver/office`);
    }

    // 5. Delete Driver and Office profiles
    if (driverId) {
      await Driver.deleteOne({ _id: driverId });
      console.log(`[CASCADE DELETE] Deleted Driver profile`);
    }
    if (officeId) {
      await Office.deleteOne({ _id: officeId });
      console.log(`[CASCADE DELETE] Deleted Office profile`);
    }

    // 6. Delete Notifications
    await Notification.deleteMany({ userId });

    // 7. Delete Support tickets
    await Support.deleteMany({ customer: userId });

    // 8. Delete Reviews
    await Review.deleteMany({ $or: [{ reviewer: userId }, { reviewee: userId }] });

    console.log(`[CASCADE DELETE] Cleanup complete for user: ${userId}`);
  } catch (err) {
    console.error(`[CASCADE DELETE ERROR] Failed to cascade delete user ${userId}:`, err);
  }
}

// Hooks
userSchema.pre("deleteOne", { document: true, query: false }, async function (next) {
  await cascadeDeleteUser(this._id);
  next();
});

userSchema.pre("deleteOne", { document: false, query: true }, async function (next) {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    await cascadeDeleteUser(doc._id);
  }
  next();
});

userSchema.pre("findOneAndDelete", async function (next) {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    await cascadeDeleteUser(doc._id);
  }
  next();
});

userSchema.pre("deleteMany", async function (next) {
  const docs = await this.model.find(this.getQuery());
  for (const doc of docs) {
    await cascadeDeleteUser(doc._id);
  }
  next();
});

export default mongoose.model("User", userSchema);
