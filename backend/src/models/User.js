import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from 'uuid';

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
      unique: true, // index built automatically
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    // 🛡️ ADMIN & ROLE MANAGEMENT
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    isActive: {
      type: Boolean, // Replacing the nested isActive inside convergeXWallet if it was meant for the user globally, or keeping both. 
      // The user request specified isActive at root. I'll add it here.
      default: true
    },
    lastLogin: {
      type: Date
    },
    totalTransactions: {
      type: Number,
      default: 0
    },
    totalVolume: {
      type: Number,
      default: 0
    },
    kycStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'not_submitted'],
      default: 'not_submitted'
    },
      // Simulated KYC fields
      panNumber: { type: String },
      aadhaarNumber: { type: String },
      kycVerifiedAt: { type: Date },
      kycAttempts: { type: Number, default: 0 },
      kycHistory: [{
        submittedAt: Date,
        panNumber: String,
        aadhaarNumber: String,
        status: String,
        reason: String,
      }],

    // 🔥 CONVERGEX WALLET (Built-in for every user)
    convergeXWallet: {
      address: {
        type: String,
        default: function () {
          // Generate unique ConvergeX wallet address for each user
          return `cx_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
        },
        unique: true
      },
      balance: {
        usdc: { type: Number, default: 1000 },
        dai: { type: Number, default: 500 },
        eth: { type: Number, default: 1 }
      },
      createdAt: { type: Date, default: Date.now },
      isActive: { type: Boolean, default: true }
    },

    // 🔥 METAMASK WALLET (Optional - External)
    metamaskWallet: {
      address: { type: String, default: "" },
      connectedAt: { type: Date },
      isConnected: { type: Boolean, default: false }
    },

    // 🔥 PHASE 1: DIRECT WALLET FIELDS
    walletAddress: {
      type: String,
      unique: true,
      sparse: true, // allows users without wallets
    },
    walletType: {
      type: String,
      enum: ["METAMASK"],
    },
    walletConnectedAt: {
      type: Date,
    },

    // All wallet transactions
    walletTransactions: [{
      type: { type: String, enum: ["DEPOSIT", "WITHDRAWAL", "TRANSFER"] },
      fromWallet: String,
      toWallet: String,
      amount: Number,
      token: String,
      timestamp: { type: Date, default: Date.now },
      status: { type: String, enum: ["PENDING", "COMPLETED", "FAILED"], default: "COMPLETED" }
    }]
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

const User = mongoose.model("User", userSchema);
export default User;
