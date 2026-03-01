import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    fromUpi: {
      type: String, // Can be UPI ID or Wallet Address
    },
    toUpi: {
      type: String, // Can be UPI ID or Wallet Address
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: [
        "UPI_TRANSFER",
        "REQUEST_ACCEPTED",
        "REQUEST_REJECTED",
        "CRYPTO_TRANSFER",
        "CRYPTO_TO_UPI",
        "UPI_TO_CRYPTO",
        "DEPOSIT"
      ],
      default: "UPI_TRANSFER",
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "COMPLETED",
    },
    note: {
      type: String,
      maxlength: 100,
    },
    paymentMethod: {
      type: String,
      enum: ["UPI", "CONVERGEX_WALLET", "METAMASK", "HYBRID", "STRIPE"],
      default: "UPI"
    },
    tokenType: String, // USDC, DAI, ETH, BTC
    walletFrom: String,
    walletTo: String,
    direction: { type: String, enum: ["INCOMING", "OUTGOING"] },
    category: String,

    // ── Hybrid conversion fields ──
    cryptoAmount: { type: Number },      // Amount in crypto units
    inrAmount: { type: Number },         // Amount in INR
    exchangeRate: { type: Number },      // Rate used for conversion
    exchangeRateSnapshot: { type: Number }, // Historical rate snapshot (bonus)

    description: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },

    transactionId: {
      type: String,
      unique: true,
      default: () => `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
    },
  },
  { timestamps: true }
);

// Indexes
transactionSchema.index({ fromUser: 1, createdAt: -1 });
transactionSchema.index({ toUser: 1, createdAt: -1 });
transactionSchema.index({ createdAt: -1 });

export default mongoose.model("Transaction", transactionSchema);
