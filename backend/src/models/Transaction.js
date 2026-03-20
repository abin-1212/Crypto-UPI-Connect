import mongoose from "mongoose";

/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — Transaction Model (Blockchain Upgrade)
 * ═══════════════════════════════════════════════════════════════
 *
 *  ADDED: txHash, blockNumber, confirmations, gasUsed,
 *         onChainAmount, offchainId, releaseTxHash,
 *         settlementStatus, auditTrail[]
 *
 *  Status flow for crypto:
 *    PENDING → CONFIRMED → SETTLED → (or FAILED)
 *
 *  No instant "COMPLETED" writes for crypto transactions.
 * ═══════════════════════════════════════════════════════════════
 */

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
    fromUpi: { type: String },
    toUpi: { type: String },
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
        "DEPOSIT",
      ],
      default: "UPI_TRANSFER",
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "SETTLED", "COMPLETED", "FAILED"],
      default: "PENDING",
    },
    note: {
      type: String,
      maxlength: 200,
    },
    paymentMethod: {
      type: String,
      enum: ["UPI", "CONVERGEX_WALLET", "METAMASK", "HYBRID", "STRIPE", "BLOCKCHAIN"],
      default: "UPI",
    },

    // ─── Blockchain Fields ──────────────────────────────────
    txHash: {
      type: String,
      unique: true,
      sparse: true, // Allow null for UPI-only transactions
    },
    blockNumber: { type: Number },
    confirmations: { type: Number, default: 0 },
    gasUsed: { type: String },
    onChainAmount: { type: String }, // Amount as recorded on-chain (wei-formatted string)
    offchainId: {
      type: String,
      unique: true,
      sparse: true,
    },
    releaseTxHash: {
      type: String,
      unique: true,
      sparse: true,
    },
    etherscanUrl: { type: String },

    // ─── Token & Conversion Fields ──────────────────────────
    tokenType: { type: String }, // cxUSDC, ETH, etc.
    walletFrom: { type: String },
    walletTo: { type: String },
    direction: { type: String, enum: ["INCOMING", "OUTGOING"] },
    category: { type: String },

    // ─── Hybrid conversion fields ───────────────────────────
    cryptoAmount: { type: Number },
    inrAmount: { type: Number },
    exchangeRate: { type: Number },
    exchangeRateSnapshot: { type: Number },

    // ─── Settlement ─────────────────────────────────────────
    settlementStatus: {
      type: String,
      enum: ["UNSETTLED", "SETTLING", "SETTLED", "FAILED"],
      default: "UNSETTLED",
    },

    // ─── Audit Trail ────────────────────────────────────────
    auditTrail: [
      {
        action: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        details: { type: String },
        txHash: { type: String },
      },
    ],

    // ─── Stripe / Metadata ──────────────────────────────────
    description: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },

    transactionId: {
      type: String,
      unique: true,
      default: () =>
        `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────
transactionSchema.index({ fromUser: 1, createdAt: -1 });
transactionSchema.index({ toUser: 1, createdAt: -1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ offchainId: 1 });

export default mongoose.model("Transaction", transactionSchema);
