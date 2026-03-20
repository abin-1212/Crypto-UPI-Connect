/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — Hybrid Payment Routes (Blockchain Upgrade)
 * ═══════════════════════════════════════════════════════════════
 *
 *  POST /pay/crypto-to-upi — Verify on-chain escrow lock → credit INR
 *  POST /pay/upi-to-crypto — Deduct INR → release tokens on-chain
 *
 *  Crypto balance lives ON-CHAIN (Sepolia ERC-20).
 *  Fiat balance lives in MongoDB (BankAccount).
 * ═══════════════════════════════════════════════════════════════
 */

import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { requireVerifiedWallet } from "../middleware/walletVerify.middleware.js";
import { validate } from "../middleware/validate.js";
import { cryptoToUpiSchema, upiToCryptoSchema } from "../validations/schemas.js";
import User from "../models/User.js";
import BankAccount from "../models/BankAccount.js";
import Transaction from "../models/Transaction.js";
import blockchainService from "../services/blockchain.service.js";
import { getExchangeRate, cryptoToInr, inrToCrypto } from "../utils/conversion.js";
import { BLOCK_EXPLORER } from "../config/contracts.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════
   ROUTE 1 — CRYPTO → UPI  (On-chain lock → INR credit)
   
   Flow:
   1. Frontend: approve + lockForUPI on escrow contract
   2. Frontend: POST txHash + offchainId here
   3. Backend:  verify receipt, parse CryptoLocked event
   4. Backend:  convert to INR, credit receiver bank
   5. Backend:  store full audit trail
═══════════════════════════════════════════════════════════ */
router.post(
  "/crypto-to-upi",
  protect,
  requireVerifiedWallet,
  validate(cryptoToUpiSchema),
  async (req, res) => {
    try {
      const { txHash, offchainId, cryptoAmount, token, receiverUpiId } = req.body;
      const senderId = req.user._id;

      // ── 1. Replay protection — check txHash uniqueness ──
      const existingTx = await Transaction.findOne({ txHash });
      if (existingTx) {
        return res.status(409).json({
          success: false,
          code: "DUPLICATE_TX",
          message: "This transaction has already been processed",
        });
      }

      const existingOffchain = await Transaction.findOne({ offchainId });
      if (existingOffchain) {
        return res.status(409).json({
          success: false,
          code: "DUPLICATE_OFFCHAIN_ID",
          message: "This offchain ID has already been used",
        });
      }

      // ── 2. Fetch sender & receiver ──
      const sender = await User.findById(senderId);
      if (!sender) return res.status(404).json({ success: false, message: "Sender not found" });

      const receiverBank = await BankAccount.findOne({ upiId: receiverUpiId });
      if (!receiverBank) {
        return res.status(404).json({ success: false, message: "Receiver UPI ID not found" });
      }

      if (senderId.toString() === receiverBank.userId.toString()) {
        return res.status(400).json({ success: false, message: "Cannot transfer to yourself" });
      }

      // ── 3. Create PENDING transaction ──
      const parsedAmount = parseFloat(cryptoAmount);
      let exchangeRate;
      try { exchangeRate = getExchangeRate(token); } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      const convertedInr = cryptoToInr(token, parsedAmount);

      const transaction = await Transaction.create({
        fromUser: senderId,
        toUser: receiverBank.userId,
        fromUpi: sender.walletAddress,
        toUpi: receiverUpiId,
        amount: convertedInr,
        type: "CRYPTO_TO_UPI",
        status: "PENDING",
        paymentMethod: "BLOCKCHAIN",
        tokenType: token.toUpperCase(),
        walletFrom: sender.walletAddress,
        walletTo: receiverUpiId,
        txHash,
        offchainId,
        cryptoAmount: parsedAmount,
        inrAmount: convertedInr,
        exchangeRate,
        exchangeRateSnapshot: exchangeRate,
        direction: "OUTGOING",
        category: "HYBRID_TRANSFER",
        note: `Lock ${parsedAmount} ${token} → ₹${convertedInr.toFixed(2)}`,
        auditTrail: [{ action: "TX_SUBMITTED", details: `txHash: ${txHash}` }],
      });

      // ── 4. Verify on-chain transaction ──
      let verification;
      try {
        verification = await blockchainService.verifyLockTransaction(
          txHash, sender.walletAddress, parsedAmount, offchainId
        );
      } catch (verifyErr) {
        transaction.status = "FAILED";
        transaction.auditTrail.push({
          action: "VERIFICATION_FAILED",
          details: verifyErr.message,
        });
        await transaction.save();
        return res.status(400).json({
          success: false,
          code: "ON_CHAIN_VERIFICATION_FAILED",
          message: verifyErr.message,
        });
      }

      // ── 5. Update transaction with on-chain data ──
      transaction.status = "CONFIRMED";
      transaction.blockNumber = verification.blockNumber;
      transaction.confirmations = verification.confirmations;
      transaction.gasUsed = verification.gasUsed;
      transaction.onChainAmount = verification.onChainAmount;
      transaction.etherscanUrl = `${BLOCK_EXPLORER}/tx/${txHash}`;
      transaction.auditTrail.push({
        action: "ON_CHAIN_VERIFIED",
        details: `Block ${verification.blockNumber}, ${verification.confirmations} confirmations`,
        txHash,
      });

      // ── 6. Credit INR to receiver bank ──
      receiverBank.balance += convertedInr;
      await receiverBank.save();

      transaction.status = "SETTLED";
      transaction.settlementStatus = "SETTLED";
      transaction.auditTrail.push({
        action: "INR_CREDITED",
        details: `₹${convertedInr.toFixed(2)} credited to ${receiverUpiId}`,
      });
      await transaction.save();

      // ── 7. Create incoming record for receiver ──
      await Transaction.create({
        fromUser: senderId,
        toUser: receiverBank.userId,
        fromUpi: sender.walletAddress,
        toUpi: receiverUpiId,
        amount: convertedInr,
        type: "CRYPTO_TO_UPI",
        status: "SETTLED",
        paymentMethod: "BLOCKCHAIN",
        tokenType: token.toUpperCase(),
        walletFrom: sender.walletAddress,
        walletTo: receiverUpiId,
        blockNumber: verification.blockNumber,
        confirmations: verification.confirmations,
        etherscanUrl: `${BLOCK_EXPLORER}/tx/${txHash}`,
        cryptoAmount: parsedAmount,
        inrAmount: convertedInr,
        exchangeRate,
        direction: "INCOMING",
        category: "HYBRID_TRANSFER",
        note: `Received ₹${convertedInr.toFixed(2)} from ${parsedAmount} ${token}`,
      });

      console.log(`⛓️ CRYPTO→UPI SETTLED | ${parsedAmount} ${token} → ₹${convertedInr} | TX: ${txHash.slice(0, 10)}...`);

      return res.json({
        success: true,
        message: `${parsedAmount} ${token} locked on-chain → ₹${convertedInr.toFixed(2)} credited`,
        data: {
          transactionId: transaction._id,
          txHash,
          blockNumber: verification.blockNumber,
          confirmations: verification.confirmations,
          cryptoAmount: parsedAmount,
          inrAmount: convertedInr,
          exchangeRate,
          etherscanUrl: `${BLOCK_EXPLORER}/tx/${txHash}`,
          status: "SETTLED",
        },
      });
    } catch (error) {
      console.error("CRYPTO→UPI error:", error);
      return res.status(500).json({
        success: false,
        message: "Crypto-to-UPI transfer failed",
        error: error.message,
      });
    }
  }
);

/* ═══════════════════════════════════════════════════════════
   ROUTE 2 — UPI → CRYPTO  (INR debit → on-chain release)
   
   Flow:
   1. Verify sender has sufficient bank balance
   2. Deduct INR from sender bank
   3. Call escrow.release() on-chain
   4. Wait for confirmation
   5. Store full audit trail
═══════════════════════════════════════════════════════════ */
router.post(
  "/upi-to-crypto",
  protect,
  validate(upiToCryptoSchema),
  async (req, res) => {
    try {
      const { receiverAddress, token, inrAmount } = req.body;
      const senderUserId = req.user._id;

      const parsedInr = parseFloat(inrAmount);

      let exchangeRate;
      try { exchangeRate = getExchangeRate(token); } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      const convertedCrypto = inrToCrypto(token, parsedInr);

      // ── 1. Fetch sender bank ──
      const senderBank = await BankAccount.findOne({ userId: senderUserId });
      if (!senderBank) {
        return res.status(404).json({ success: false, message: "Sender bank account not found" });
      }
      if (senderBank.balance < parsedInr) {
        return res.status(400).json({
          success: false,
          message: `Insufficient bank balance. Available: ₹${senderBank.balance}`,
        });
      }

      // ── 2. Find receiver by wallet address ──
      const receiver = await User.findOne({
        walletAddress: new RegExp(`^${receiverAddress}$`, "i"),
        walletVerified: true,
      });
      if (!receiver) {
        return res.status(404).json({
          success: false,
          message: "Receiver wallet not found or not verified",
        });
      }

      if (senderUserId.toString() === receiver._id.toString()) {
        return res.status(400).json({ success: false, message: "Cannot transfer to yourself" });
      }

      // ── 3. Deduct INR ──
      senderBank.balance -= parsedInr;
      await senderBank.save();

      // ── 4. Create PENDING transaction ──
      const transaction = await Transaction.create({
        fromUser: senderUserId,
        toUser: receiver._id,
        fromUpi: senderBank.upiId,
        toUpi: receiver.walletAddress,
        amount: parsedInr,
        type: "UPI_TO_CRYPTO",
        status: "PENDING",
        paymentMethod: "BLOCKCHAIN",
        tokenType: token.toUpperCase(),
        walletFrom: senderBank.upiId,
        walletTo: receiver.walletAddress,
        cryptoAmount: convertedCrypto,
        inrAmount: parsedInr,
        exchangeRate,
        exchangeRateSnapshot: exchangeRate,
        direction: "OUTGOING",
        category: "HYBRID_TRANSFER",
        note: `₹${parsedInr} → ${convertedCrypto.toFixed(6)} ${token}`,
        auditTrail: [{ action: "INR_DEBITED", details: `₹${parsedInr} debited from bank` }],
      });

      // ── 5. Release tokens on-chain ──
      let releaseResult;
      try {
        releaseResult = await blockchainService.releaseTokens(
          receiver.walletAddress, convertedCrypto
        );
      } catch (releaseErr) {
        // Refund INR on failure
        senderBank.balance += parsedInr;
        await senderBank.save();

        transaction.status = "FAILED";
        transaction.auditTrail.push({
          action: "RELEASE_FAILED",
          details: releaseErr.message,
        });
        transaction.auditTrail.push({
          action: "INR_REFUNDED",
          details: `₹${parsedInr} refunded to bank`,
        });
        await transaction.save();

        return res.status(500).json({
          success: false,
          code: "ON_CHAIN_RELEASE_FAILED",
          message: "Failed to release tokens on-chain. INR has been refunded.",
        });
      }

      // ── 6. Update transaction ──
      transaction.status = "SETTLED";
      transaction.settlementStatus = "SETTLED";
      transaction.releaseTxHash = releaseResult.txHash;
      transaction.txHash = releaseResult.txHash;
      transaction.blockNumber = releaseResult.blockNumber;
      transaction.confirmations = releaseResult.confirmations;
      transaction.gasUsed = releaseResult.gasUsed;
      transaction.etherscanUrl = `${BLOCK_EXPLORER}/tx/${releaseResult.txHash}`;
      transaction.auditTrail.push({
        action: "TOKENS_RELEASED",
        details: `${convertedCrypto.toFixed(6)} cxUSDC released to ${receiver.walletAddress}`,
        txHash: releaseResult.txHash,
      });
      await transaction.save();

      // ── 7. Create incoming record ──
      await Transaction.create({
        fromUser: senderUserId,
        toUser: receiver._id,
        fromUpi: senderBank.upiId,
        toUpi: receiver.walletAddress,
        amount: parsedInr,
        type: "UPI_TO_CRYPTO",
        status: "SETTLED",
        paymentMethod: "BLOCKCHAIN",
        tokenType: token.toUpperCase(),
        blockNumber: releaseResult.blockNumber,
        etherscanUrl: `${BLOCK_EXPLORER}/tx/${releaseResult.txHash}`,
        cryptoAmount: convertedCrypto,
        inrAmount: parsedInr,
        exchangeRate,
        direction: "INCOMING",
        category: "HYBRID_TRANSFER",
        note: `Received ${convertedCrypto.toFixed(6)} ${token} from ₹${parsedInr}`,
      });

      console.log(`⛓️ UPI→CRYPTO SETTLED | ₹${parsedInr} → ${convertedCrypto.toFixed(6)} ${token} | Release TX: ${releaseResult.txHash.slice(0, 10)}...`);

      return res.json({
        success: true,
        message: `₹${parsedInr} converted → ${convertedCrypto.toFixed(6)} ${token} released on-chain`,
        data: {
          transactionId: transaction._id,
          txHash: releaseResult.txHash,
          blockNumber: releaseResult.blockNumber,
          confirmations: releaseResult.confirmations,
          inrAmount: parsedInr,
          cryptoAmount: convertedCrypto,
          exchangeRate,
          etherscanUrl: `${BLOCK_EXPLORER}/tx/${releaseResult.txHash}`,
          receiverWallet: receiver.walletAddress,
          senderBankBalance: senderBank.balance,
          status: "SETTLED",
        },
      });
    } catch (error) {
      console.error("UPI→CRYPTO error:", error);
      return res.status(500).json({
        success: false,
        message: "UPI-to-Crypto transfer failed",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

export default router;
