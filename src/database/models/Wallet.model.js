import mongoose from "mongoose";

export const TRANSACTION_TYPE = {
  TOPUP: "topup",
  PAYMENT: "payment",
  CASHBACK: "cashback",
};

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(TRANSACTION_TYPE),
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    reference: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    walletId: {
      type: String,
      unique: true,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    cashbackEarned: {
      type: Number,
      default: 0,
    },

    transactions: [transactionSchema],
  },
  { timestamps: true },
);

walletSchema.pre("save", async function (next) {
  if (!this.walletId) {
    const count = await mongoose.model("Wallet").countDocuments();
    this.walletId = `SC-W-${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

const Wallet = mongoose.model("Wallet", walletSchema);

export default Wallet;
