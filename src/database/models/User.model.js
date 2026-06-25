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

export default mongoose.model("User", userSchema);
