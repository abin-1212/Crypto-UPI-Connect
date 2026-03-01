/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — Wallet Routes (Blockchain Upgrade)
 * ═══════════════════════════════════════════════════════════════
 *
 *  REMOVED: Fake crypto balances, DB-only transfers
 *  ADDED:   Signature-based wallet auth, on-chain balance queries,
 *           gas estimation, token faucet
 *
 *  Crypto balance = ERC20.balanceOf(walletAddress) on Sepolia
 * ═══════════════════════════════════════════════════════════════
 */

import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { requireVerifiedWallet } from "../middleware/walletVerify.middleware.js";
import { validate } from "../middleware/validate.js";
import { walletVerifySchema } from "../validations/schemas.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import BankAccount from "../models/BankAccount.js";
import blockchainService from "../services/blockchain.service.js";
import BlockchainService from "../services/blockchain.service.js";
import {
  getExchangeRate,
  getAllRates,
  forceRefreshRates,
  getMarketData,
} from "../utils/conversion.js";
import { SEPOLIA_CHAIN_ID, BLOCK_EXPLORER } from "../config/contracts.js";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
//  EXCHANGE RATES (unchanged — CoinGecko)
// ═══════════════════════════════════════════════════════════════

router.get("/rates", async (req, res) => {
  try {
    const rates = await forceRefreshRates();
    const marketData = getMarketData();
    res.json({
      success: true,
      source: "CoinGecko",
      rates,
      marketData,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch rates" });
  }
});

// ═══════════════════════════════════════════════════════════════
//  PHASE 1: WALLET NONCE (for signature auth)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /wallet/nonce
 * Returns a nonce for the authenticated user to sign with MetaMask.
 */
router.get("/nonce", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("walletNonce walletAddress walletVerified");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const message = BlockchainService.generateSignMessage(user.walletNonce);

    res.json({
      success: true,
      nonce: user.walletNonce,
      message,
      walletAddress: user.walletAddress || null,
      walletVerified: user.walletVerified || false,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to get nonce" });
  }
});

// ═══════════════════════════════════════════════════════════════
//  PHASE 1: WALLET VERIFICATION (Signature-based)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /wallet/verify
 * Verify wallet ownership via signed message.
 */
router.post(
  "/verify",
  protect,
  validate(walletVerifySchema),
  async (req, res) => {
    try {
      const { walletAddress, signature } = req.body;

      const user = await User.findById(req.user._id).select(
        "walletNonce walletAddress walletVerified"
      );
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const expectedMessage = BlockchainService.generateSignMessage(
        user.walletNonce
      );

      const isValid = blockchainService.verifySignatureMatches(
        expectedMessage,
        signature,
        walletAddress
      );

      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: "Signature verification failed. Address does not match.",
        });
      }

      // Check if another user already has this wallet
      const existingUser = await User.findOne({
        walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") },
        _id: { $ne: req.user._id },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "This wallet is already linked to another account.",
        });
      }

      user.walletAddress = walletAddress;
      user.walletVerified = true;
      user.walletType = "METAMASK";
      user.walletConnectedAt = new Date();
      user.rotateNonce();
      await user.save();

      res.json({
        success: true,
        message: "Wallet verified and linked successfully",
        walletAddress,
        walletVerified: true,
      });
    } catch (error) {
      console.error("Wallet verify error:", error);
      res.status(500).json({
        success: false,
        message: "Wallet verification failed",
      });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
//  WALLET INFO (On-chain balance)
// ═══════════════════════════════════════════════════════════════

router.get("/info", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "name email convergeXWallet walletAddress walletVerified walletConnectedAt"
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let onChainBalance = "0";
    let ethBalance = "0";

    if (user.walletAddress && user.walletVerified) {
      try {
        onChainBalance = await blockchainService.getTokenBalance(user.walletAddress);
        ethBalance = await blockchainService.getEthBalance(user.walletAddress);
      } catch (err) {
        console.warn("On-chain balance fetch failed:", err.message);
      }
    }

    res.json({
      success: true,
      wallet: {
        convergeXAddress: user.convergeXWallet?.address,
        walletAddress: user.walletAddress || null,
        walletVerified: user.walletVerified || false,
        connectedAt: user.walletConnectedAt,
      },
      balances: { cxUSDC: onChainBalance, eth: ethBalance },
      chain: {
        chainId: SEPOLIA_CHAIN_ID,
        name: "Sepolia",
        explorer: BLOCK_EXPLORER,
        tokenAddress: process.env.MOCK_TOKEN_ADDRESS || null,
        escrowAddress: process.env.ESCROW_CONTRACT_ADDRESS || null,
      },
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Wallet info error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch wallet info" });
  }
});

/** GET /wallet/convergex  (backward compat) */
router.get("/convergex", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "convergeXWallet name email walletAddress walletVerified"
    );

    let onChainBalance = "0";
    if (user.walletAddress && user.walletVerified) {
      try {
        onChainBalance = await blockchainService.getTokenBalance(user.walletAddress);
      } catch {}
    }

    res.json({
      success: true,
      wallet: {
        address: user.convergeXWallet?.address,
        walletAddress: user.walletAddress,
        walletVerified: user.walletVerified,
        balance: {
          cxUSDC: parseFloat(onChainBalance) || 0,
          usdc: parseFloat(onChainBalance) || 0,
          dai: 0, eth: 0,
        },
      },
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch wallet" });
  }
});

// ═══════════════════════════════════════════════════════════════
//  ON-CHAIN BALANCE QUERY
// ═══════════════════════════════════════════════════════════════

router.get("/balance/:address", async (req, res) => {
  try {
    const { address } = req.params;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ success: false, message: "Invalid address" });
    }

    const cxUSDC = await blockchainService.getTokenBalance(address);
    const eth = await blockchainService.getEthBalance(address);

    res.json({ success: true, address, balances: { cxUSDC, eth }, chain: "sepolia" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Balance query failed" });
  }
});

// ═══════════════════════════════════════════════════════════════
//  GAS ESTIMATION
// ═══════════════════════════════════════════════════════════════

router.get("/gas-estimate", protect, async (req, res) => {
  try {
    const { amount = "100", offchainId = "test" } = req.query;
    const estimate = await blockchainService.estimateLockGas(amount, offchainId);
    res.json({ success: true, ...estimate });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gas estimation failed" });
  }
});

// ═══════════════════════════════════════════════════════════════
//  ESCROW INFO
// ═══════════════════════════════════════════════════════════════

router.get("/escrow", async (req, res) => {
  try {
    const escrowBalance = await blockchainService.getEscrowBalance();
    res.json({
      success: true,
      escrow: {
        address: process.env.ESCROW_CONTRACT_ADDRESS,
        tokenBalance: escrowBalance,
        tokenAddress: process.env.MOCK_TOKEN_ADDRESS,
        chain: "sepolia",
        explorer: `${BLOCK_EXPLORER}/address/${process.env.ESCROW_CONTRACT_ADDRESS}`,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Escrow info fetch failed" });
  }
});

// ═══════════════════════════════════════════════════════════════
//  USER LOOKUP
// ═══════════════════════════════════════════════════════════════

router.get("/find-by-address/:walletAddress", async (req, res) => {
  try {
    const user = await User.findOne({
      $or: [
        { "convergeXWallet.address": req.params.walletAddress },
        { walletAddress: new RegExp(`^${req.params.walletAddress}$`, "i") },
      ],
    }).select("name email convergeXWallet walletAddress walletVerified");

    if (!user) {
      return res.json({ success: true, found: false, message: "Wallet not found" });
    }

    res.json({
      success: true,
      found: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        convergeXAddress: user.convergeXWallet?.address,
        walletAddress: user.walletAddress,
        walletVerified: user.walletVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "User lookup failed" });
  }
});

// ═══════════════════════════════════════════════════════════════
//  BLOCKCHAIN TX STATUS
// ═══════════════════════════════════════════════════════════════

router.get("/tx-status/:txHash", async (req, res) => {
  try {
    const { txHash } = req.params;
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return res.status(400).json({ success: false, message: "Invalid tx hash" });
    }

    const receipt = await blockchainService.getTransactionReceipt(txHash);

    if (!receipt) {
      return res.json({
        success: true,
        status: "PENDING",
        message: "Transaction not yet mined",
      });
    }

    const currentBlock = await blockchainService.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;

    res.json({
      success: true,
      status: receipt.status === 1 ? "SUCCESS" : "REVERTED",
      txHash,
      blockNumber: receipt.blockNumber,
      confirmations,
      gasUsed: receipt.gasUsed.toString(),
      etherscanUrl: `${BLOCK_EXPLORER}/tx/${txHash}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "TX status query failed" });
  }
});

// ═══════════════════════════════════════════════════════════════
//  CHAIN CONFIG (for frontend)
// ═══════════════════════════════════════════════════════════════

router.get("/chain-config", (req, res) => {
  res.json({
    success: true,
    chainId: SEPOLIA_CHAIN_ID,
    chainName: "Sepolia",
    rpcUrl: "https://rpc.sepolia.org",
    explorer: BLOCK_EXPLORER,
    contracts: {
      token: process.env.MOCK_TOKEN_ADDRESS || null,
      escrow: process.env.ESCROW_CONTRACT_ADDRESS || null,
    },
  });
});

// ═══════════════════════════════════════════════════════════════
//  LEGACY WALLET CONNECT (backward compat — unverified)
// ═══════════════════════════════════════════════════════════════

router.post("/connect", protect, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ message: "Wallet address required" });
    }

    await User.findByIdAndUpdate(req.user._id, {
      walletAddress,
      walletType: "METAMASK",
      walletConnectedAt: new Date(),
    });

    res.json({
      success: true,
      walletAddress,
      walletVerified: false,
      message: "Wallet connected. Sign verification message to complete setup.",
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to connect wallet" });
  }
});

export default router;
