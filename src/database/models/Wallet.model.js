import mongoose from "mongoose";

const { Schema } = mongoose;

export const USER_TYPE = {
  CUSTOMER: "Customer",
  DRIVER: "Driver",
  OFFICE: "Office",
};

export const WALLET_STATUS = {
  ACTIVE: "Active",
  LOCKED: "Locked",
};

export const TRANSACTION_TYPE = {
  DEBIT: "Debit",
  CREDIT: "Credit",
};

export const TRANSACTION_PURPOSE = {
  TOPUP: "Topup",
  PAYMENT: "Payment",
  DELIVERY_FEE: "DeliveryFee",
  WITHDRAWAL: "Withdrawal",
  DEPOSIT: "Deposit",
  REFUND: "Refund",
  COMMISSION: "Commission",
  EARNING: "Earning",
  TRANSFER: "Transfer",
};

export const GATEWAY = {
  INSTAPAY: "Instapay",
  APPLE_PAY: "ApplePay",
  VODAFONE_CASH: "VodafoneCash",
  ORANGE_CASH: "OrangeCash",
  ETISALAT_CASH: "EtisalatCash",
  INTERNAL: "Internal",
};

export const TRANSACTION_STATUS = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const walletSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    userType: {
      type: String,
      enum: Object.values(USER_TYPE),
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockedBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "EGP",
    },
    status: {
      type: String,
      enum: Object.values(WALLET_STATUS),
      default: WALLET_STATUS.ACTIVE,
    },
  },
  { timestamps: true },
);

walletSchema.post("save", async function (doc) {
  try {
    const { getIO } = await import("../../config/socket.js");
    const io = getIO();
    if (io) {
      io.to(`user:${doc.userId}`).emit("walletUpdate", {
        balance: doc.balance,
        lockedBalance: doc.lockedBalance,
      });
    }
  } catch (err) {
    console.error("Failed to emit walletUpdate on post-save:", err.message);
  }
});

walletSchema.index({ userType: 1 });

const transactionSchema = new Schema(
  {
    walletId: {
      type: Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TRANSACTION_TYPE),
      required: true,
    },
    purpose: {
      type: String,
      enum: Object.values(TRANSACTION_PURPOSE),
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    gateway: {
      type: String,
      enum: Object.values(GATEWAY),
      default: GATEWAY.INTERNAL,
    },
    status: {
      type: String,
      enum: Object.values(TRANSACTION_STATUS),
      default: TRANSACTION_STATUS.COMPLETED,
    },
    referenceId: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
);

transactionSchema.index({ walletId: 1, createdAt: -1 });
transactionSchema.index({ referenceId: 1 }, { sparse: true });

export const Wallet = mongoose.model("Wallet", walletSchema);
export const Transaction = mongoose.model("Transaction", transactionSchema);

export default Wallet;