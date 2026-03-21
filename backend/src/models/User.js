import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — User Model (Blockchain Upgrade)
 * ═══════════════════════════════════════════════════════════════
 *
 *  REMOVED: convergeXWallet.balance (crypto balances from DB)
 *  REMOVED: walletTransactions embedded array
 *  ADDED:   walletVerified, walletNonce (signature-based auth)
 *
 *  Crypto balances are now derived from on-chain state:
 *    ERC20.balanceOf(walletAddress) via blockchain.service.js
 *
 *  convergeXWallet.address kept as internal platform identifier.
 * ═══════════════════════════════════════════════════════════════
 */

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    // ─── Admin & Role Management ────────────────────────────
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: { type: Date },
    totalTransactions: { type: Number, default: 0 },
    totalVolume: { type: Number, default: 0 },

    // ─── KYC ────────────────────────────────────────────────
    kyc: {
      type: Boolean,
      default: false,
    },
    kycStatus: {
      type: String,
      enum: ["pending", "verified", "rejected", "not_submitted"],
      default: "not_submitted",
    },
    panNumber: { type: String },
    aadhaarNumber: { type: String },
    kycVerifiedAt: { type: Date },
    kycAttempts: { type: Number, default: 0 },
    kycHistory: [
      {
        submittedAt: Date,
        panNumber: String,
        aadhaarNumber: String,
        status: String,
        reason: String,
      },
    ],

    // ─── ConvergeX Internal Identifier ──────────────────────
    //     Kept for UPI request routing & user lookup.
    //     NO balance fields — crypto is on-chain only.
    convergeXWallet: {
      address: {
        type: String,
        default: function () {
          return `cx_${uuidv4().replace(/-/g, "").substring(0, 20)}`;
        },
        unique: true,
      },
      createdAt: { type: Date, default: Date.now },
    },

    // ─── Blockchain Wallet (MetaMask / Sepolia) ─────────────
    walletAddress: {
      type: String,
      unique: true,
      sparse: true, // Allows users without wallets
    },
    walletVerified: {
      type: Boolean,
      default: false,
    },
    walletNonce: {
      type: String,
      default: () => crypto.randomBytes(16).toString("hex"),
    },
    walletType: {
      type: String,
      enum: ["METAMASK"],
    },
    walletConnectedAt: { type: Date },
  },
  { timestamps: true }
);

/**
 * Hash password before saving
 */
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

/**
 * Compare password
 */
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

/**
 * Rotate wallet nonce (call after successful verification)
 */
userSchema.methods.rotateNonce = function () {
  this.walletNonce = crypto.randomBytes(16).toString("hex");
};

const User = mongoose.model("User", userSchema);
export default User;
