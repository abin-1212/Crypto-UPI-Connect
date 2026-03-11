/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — Joi Validation Schemas
 * ═══════════════════════════════════════════════════════════════
 *
 *  All request body schemas for input validation.
 *  Never trust amount, txHash, or wallet address from the frontend.
 * ═══════════════════════════════════════════════════════════════
 */

import Joi from "joi";

// ─── Ethereum address pattern ─────────────────────────────────
const ethAddress = Joi.string()
  .pattern(/^0x[a-fA-F0-9]{40}$/)
  .message("Invalid Ethereum address");

// ─── Transaction hash pattern ─────────────────────────────────
const txHash = Joi.string()
  .pattern(/^0x[a-fA-F0-9]{64}$/)
  .message("Invalid transaction hash");

// ═══════════════════════════════════════════════════════════════
//  WALLET SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const walletVerifySchema = Joi.object({
  walletAddress: ethAddress.required(),
  signature: Joi.string().required().min(100).max(200),
});

export const walletConnectSchema = Joi.object({
  walletAddress: ethAddress.required(),
});

// ═══════════════════════════════════════════════════════════════
//  CRYPTO → UPI (Lock) SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const cryptoToUpiSchema = Joi.object({
  txHash: txHash.required(),
  offchainId: Joi.string().required().min(10).max(100),
  cryptoAmount: Joi.number().positive().required().max(1000000),
  token: Joi.string()
    .valid("USDC", "cxUSDC")
    .default("cxUSDC")
    .insensitive(),
  receiverUpiId: Joi.string().required().pattern(/@/).message("Invalid UPI ID"),
});

// ═══════════════════════════════════════════════════════════════
//  UPI → CRYPTO (Release) SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const upiToCryptoSchema = Joi.object({
  receiverAddress: ethAddress.required(),
  inrAmount: Joi.number().positive().required().max(10000000),
  token: Joi.string()
    .valid("USDC", "cxUSDC")
    .default("cxUSDC")
    .insensitive(),
});

// ═══════════════════════════════════════════════════════════════
//  DIRECT CRYPTO TRANSFER SCHEMA
// ═══════════════════════════════════════════════════════════════

export const cryptoTransferSchema = Joi.object({
  txHash: txHash.required(),
  toAddress: ethAddress.required(),
  amount: Joi.number().positive().required(),
  token: Joi.string()
    .valid("USDC", "cxUSDC")
    .default("cxUSDC")
    .insensitive(),
});

// ═══════════════════════════════════════════════════════════════
//  STRIPE SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const stripeCheckoutSchema = Joi.object({
  amount: Joi.number().integer().positive().min(1).max(500000).required(),
});

export const stripeVerifySchema = Joi.object({
  sessionId: Joi.string().required().min(10),
});

// ═══════════════════════════════════════════════════════════════
//  AUTH SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(6).max(100).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

export default {
  walletVerifySchema,
  walletConnectSchema,
  cryptoToUpiSchema,
  upiToCryptoSchema,
  cryptoTransferSchema,
  stripeCheckoutSchema,
  stripeVerifySchema,
  registerSchema,
  loginSchema,
};
