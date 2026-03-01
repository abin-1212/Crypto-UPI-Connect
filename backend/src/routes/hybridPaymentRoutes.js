/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — Hybrid Payment Routes (Crypto ↔ UPI)
 * ═══════════════════════════════════════════════════════════════
 *
 *  POST /pay/crypto-to-upi   — Sender pays crypto, receiver gets INR
 *  POST /pay/upi-to-crypto   — Sender pays INR, receiver gets crypto
 *
 *  Uses the same non-session pattern as existing payment routes
 *  for maximum compatibility with all MongoDB deployments.
 *
 *  Crypto balances : User.convergeXWallet.balance[token]
 *  Fiat balances   : BankAccount.balance
 * ═══════════════════════════════════════════════════════════════
 */

import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import User from "../models/User.js";
import BankAccount from "../models/BankAccount.js";
import Transaction from "../models/Transaction.js";
import { getExchangeRate, cryptoToInr, inrToCrypto } from "../utils/conversion.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════
   ROUTE 1 — CRYPTO → UPI
   Sender's crypto balance is debited.
   Receiver's bank (UPI) balance is credited with INR equivalent.
═══════════════════════════════════════════════════════════ */
router.post("/crypto-to-upi", protect, async (req, res) => {
  try {
    console.log("🔄 CRYPTO→UPI request:", req.body);
    console.log("👤 From user:", req.user._id);

    // ── 1. Parse & validate inputs ────────────────────────
    const { receiverUpiId, token, cryptoAmount } = req.body;
    const senderId = req.user._id;

    if (!receiverUpiId || !token || cryptoAmount === undefined) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: receiverUpiId, token, cryptoAmount",
      });
    }

    const parsedAmount = Number(cryptoAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "cryptoAmount must be a positive number",
      });
    }

    // Validate token is supported
    let exchangeRate;
    try {
      exchangeRate = getExchangeRate(token);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    // ── 2. Fetch sender (User) ────────────────────────
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    // ── 3. Fetch receiver's bank account by UPI ───────
    const receiverBank = await BankAccount.findOne({ upiId: receiverUpiId });
    if (!receiverBank) {
      return res.status(404).json({ success: false, message: "Receiver UPI ID not found" });
    }

    // Prevent self-transfer
    if (sender._id.toString() === receiverBank.userId.toString()) {
      return res.status(400).json({ success: false, message: "Cannot transfer to yourself" });
    }

    // ── 4. Check sender's crypto balance ──────────────
    const tokenKey = token.toLowerCase();
    const senderCryptoBalance = sender.convergeXWallet?.balance?.[tokenKey] ?? 0;

    if (senderCryptoBalance < parsedAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${token.toUpperCase()} balance. Available: ${senderCryptoBalance}`,
      });
    }

    // ── 5. Convert crypto → INR ─────────────────────
    const convertedInr = cryptoToInr(token, parsedAmount);

    // ── 6. Deduct crypto from sender ────────────────
    sender.convergeXWallet.balance[tokenKey] -= parsedAmount;
    sender.totalTransactions = (sender.totalTransactions || 0) + 1;
    sender.totalVolume = (sender.totalVolume || 0) + convertedInr;

    // Record wallet-level transaction on sender
    sender.walletTransactions.push({
      type: "WITHDRAWAL",
      fromWallet: sender.convergeXWallet.address,
      toWallet: `UPI:${receiverUpiId}`,
      amount: -parsedAmount,
      token: token.toUpperCase(),
      status: "COMPLETED",
    });
    await sender.save();

    // ── 7. Credit INR to receiver bank ──────────────
    receiverBank.balance += convertedInr;
    await receiverBank.save();

    // ── 8. Create Transaction records ───────────────
    await Transaction.create({
      fromUser: sender._id,
      toUser: receiverBank.userId,
      fromUpi: sender.convergeXWallet.address,
      toUpi: receiverUpiId,
      amount: convertedInr,
      type: "CRYPTO_TO_UPI",
      status: "COMPLETED",
      paymentMethod: "HYBRID",
      tokenType: token.toUpperCase(),
      walletFrom: sender.convergeXWallet.address,
      walletTo: receiverUpiId,
      direction: "OUTGOING",
      category: "HYBRID_TRANSFER",
      cryptoAmount: parsedAmount,
      inrAmount: convertedInr,
      exchangeRate,
      exchangeRateSnapshot: exchangeRate,
      note: `Sent ${parsedAmount} ${token.toUpperCase()} → ₹${convertedInr}`,
    });

    await Transaction.create({
      fromUser: sender._id,
      toUser: receiverBank.userId,
      fromUpi: sender.convergeXWallet.address,
      toUpi: receiverUpiId,
      amount: convertedInr,
      type: "CRYPTO_TO_UPI",
      status: "COMPLETED",
      paymentMethod: "HYBRID",
      tokenType: token.toUpperCase(),
      walletFrom: sender.convergeXWallet.address,
      walletTo: receiverUpiId,
      direction: "INCOMING",
      category: "HYBRID_TRANSFER",
      cryptoAmount: parsedAmount,
      inrAmount: convertedInr,
      exchangeRate,
      exchangeRateSnapshot: exchangeRate,
      note: `Received ₹${convertedInr} from ${parsedAmount} ${token.toUpperCase()}`,
    });

    console.log(`✅ CRYPTO→UPI | ${parsedAmount} ${token} → ₹${convertedInr} | ${sender.name} → UPI:${receiverUpiId}`);

    return res.json({
      success: true,
      message: `Successfully sent ${parsedAmount} ${token.toUpperCase()} (₹${convertedInr}) to ${receiverUpiId}`,
      data: {
        cryptoAmount: parsedAmount,
        inrAmount: convertedInr,
        exchangeRate,
        token: token.toUpperCase(),
        receiverUpiId,
        senderCryptoBalance: sender.convergeXWallet.balance,
      },
    });
  } catch (error) {
    console.error("❌ CRYPTO→UPI error:", error);
    return res.status(500).json({
      success: false,
      message: "Crypto-to-UPI transfer failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/* ═══════════════════════════════════════════════════════════
   ROUTE 2 — UPI → CRYPTO
   Sender's bank (UPI) balance is debited in INR.
   Receiver's crypto wallet is credited with crypto equivalent.
═══════════════════════════════════════════════════════════ */
router.post("/upi-to-crypto", protect, async (req, res) => {
  try {
    console.log("🔄 UPI→CRYPTO request:", req.body);
    console.log("👤 From user:", req.user._id);

    // ── 1. Parse & validate inputs ────────────────────────
    const { receiverUserId, token, inrAmount } = req.body;
    const senderUserId = req.user._id;

    if (!receiverUserId || !token || inrAmount === undefined) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: receiverUserId, token, inrAmount",
      });
    }

    const parsedInr = Number(inrAmount);
    if (isNaN(parsedInr) || parsedInr <= 0) {
      return res.status(400).json({
        success: false,
        message: "inrAmount must be a positive number",
      });
    }

    // Validate token
    let exchangeRate;
    try {
      exchangeRate = getExchangeRate(token);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    // ── 2. Fetch sender bank account ────────────────
    const senderBank = await BankAccount.findOne({ userId: senderUserId });
    if (!senderBank) {
      return res.status(404).json({ success: false, message: "Sender bank account not found" });
    }

    // ── 3. Fetch receiver user ──────────────────────
    const receiver = await User.findById(receiverUserId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: "Receiver user not found" });
    }

    // Prevent self-transfer
    if (senderUserId.toString() === receiverUserId.toString()) {
      return res.status(400).json({ success: false, message: "Cannot transfer to yourself" });
    }

    // ── 4. Check sender's INR balance ───────────────
    if (senderBank.balance < parsedInr) {
      return res.status(400).json({
        success: false,
        message: `Insufficient bank balance. Available: ₹${senderBank.balance}`,
      });
    }

    // ── 5. Convert INR → Crypto ─────────────────────
    const convertedCrypto = inrToCrypto(token, parsedInr);

    // ── 6. Deduct INR from sender ───────────────────
    senderBank.balance -= parsedInr;
    await senderBank.save();

    // ── 7. Credit crypto to receiver ────────────────
    const tokenKey = token.toLowerCase();
    receiver.convergeXWallet.balance[tokenKey] =
      (receiver.convergeXWallet.balance[tokenKey] || 0) + convertedCrypto;

    // Record wallet-level transaction on receiver
    receiver.walletTransactions.push({
      type: "DEPOSIT",
      fromWallet: `UPI:${senderBank.upiId}`,
      toWallet: receiver.convergeXWallet.address,
      amount: convertedCrypto,
      token: token.toUpperCase(),
      status: "COMPLETED",
    });
    await receiver.save();

    // ── 8. Create Transaction records ───────────────
    const txOut = await Transaction.create({
      fromUser: senderUserId,
      toUser: receiver._id,
      fromUpi: senderBank.upiId,
      toUpi: receiver.convergeXWallet.address,
      amount: parsedInr,
      type: "UPI_TO_CRYPTO",
      status: "COMPLETED",
      paymentMethod: "HYBRID",
      tokenType: token.toUpperCase(),
      walletFrom: senderBank.upiId,
      walletTo: receiver.convergeXWallet.address,
      direction: "OUTGOING",
      category: "HYBRID_TRANSFER",
      cryptoAmount: convertedCrypto,
      inrAmount: parsedInr,
      exchangeRate,
      exchangeRateSnapshot: exchangeRate,
      note: `Sent ₹${parsedInr} → ${convertedCrypto} ${token.toUpperCase()}`,
    });

    await Transaction.create({
      fromUser: senderUserId,
      toUser: receiver._id,
      fromUpi: senderBank.upiId,
      toUpi: receiver.convergeXWallet.address,
      amount: parsedInr,
      type: "UPI_TO_CRYPTO",
      status: "COMPLETED",
      paymentMethod: "HYBRID",
      tokenType: token.toUpperCase(),
      walletFrom: senderBank.upiId,
      walletTo: receiver.convergeXWallet.address,
      direction: "INCOMING",
      category: "HYBRID_TRANSFER",
      cryptoAmount: convertedCrypto,
      inrAmount: parsedInr,
      exchangeRate,
      exchangeRateSnapshot: exchangeRate,
      note: `Received ${convertedCrypto} ${token.toUpperCase()} from ₹${parsedInr}`,
    });

    console.log(`✅ UPI→CRYPTO | ₹${parsedInr} → ${convertedCrypto} ${token} | UPI:${senderBank.upiId} → ${receiver.name}`);

    return res.json({
      success: true,
      message: `Successfully sent ₹${parsedInr} (${convertedCrypto} ${token.toUpperCase()}) to ${receiver.name}`,
      data: {
        inrAmount: parsedInr,
        cryptoAmount: convertedCrypto,
        exchangeRate,
        token: token.toUpperCase(),
        receiverName: receiver.name,
        receiverWallet: receiver.convergeXWallet.address,
        transactionId: txOut.transactionId,
        senderBankBalance: senderBank.balance,
      },
    });
  } catch (error) {
    console.error("❌ UPI→CRYPTO error:", error);
    return res.status(500).json({
      success: false,
      message: "UPI-to-Crypto transfer failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default router;
