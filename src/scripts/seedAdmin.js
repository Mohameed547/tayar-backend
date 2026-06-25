import mongoose from "mongoose";
import { ENV } from "../config/env.js";
import User from "../database/models/User.model.js";

const run = async () => {
  await mongoose.connect(ENV.MONGO_URI);

  const email = process.env.SEED_ADMIN_EMAIL || "admin@deliverhub.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const fullName = process.env.SEED_ADMIN_NAME || "DeliverHub Admin";
  const phone = process.env.SEED_ADMIN_PHONE || "01000000000";

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`this email is already exist ${email}`);
    process.exit(0);
  }

  await User.create({
    fullName,
    email,
    phone,
    password,
    role: "admin",
    status: "active",
    isPhoneVerified: true,
  });

  console.log(`✅ create account admin successfully: ${email} / ${password}`);
  process.exit(0);
};

run().catch((err) => {
  console.error("❌  create account admin failed:", err.message);
  process.exit(1);
});
