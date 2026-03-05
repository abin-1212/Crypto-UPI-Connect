import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import BankAccount from "../models/BankAccount.js";
import User from "../models/User.js";

const router = express.Router();

router.get("/balance", protect, async (req, res) => {
  try {
    let account = await BankAccount.findOne({ userId: req.user._id });

    // Auto-create BankAccount if missing (legacy users)
    if (!account) {
      const user = await User.findById(req.user._id);
      const emailPrefix = (user.email || 'user').split('@')[0];
      account = await BankAccount.create({
        userId: req.user._id,
        upiId: `${emailPrefix}@cxpay`,
        accountNumber: `CX${Date.now()}${Math.floor(Math.random() * 1000)}`,
        balance: 10000,
      });
    }

    res.json({
      upiId: account.upiId,
      balance: account.balance,
    });
  } catch (error) {
    console.error('Bank balance error:', error.message);
    res.status(500).json({ message: 'Failed to fetch balance' });
  }
});

/**
 * Look up a user by their UPI ID (for hybrid transfers)
 */
router.get("/find-by-upi/:upiId", protect, async (req, res) => {
  try {
    const bankAccount = await BankAccount.findOne({ upiId: req.params.upiId });

    if (!bankAccount) {
      return res.json({ success: true, found: false, message: "UPI ID not found" });
    }

    const user = await User.findById(bankAccount.userId).select("name email convergeXWallet");

    res.json({
      success: true,
      found: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        upiId: bankAccount.upiId,
        walletAddress: user.convergeXWallet?.address || null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to find UPI user" });
  }
});

/**
 * Look up a user by their User ID (for UPI-to-crypto bridge)
 */
router.get("/find-user/:userId", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("name email convergeXWallet");

    if (!user) {
      return res.json({ success: true, found: false, message: "User not found" });
    }

    res.json({
      success: true,
      found: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        walletAddress: user.convergeXWallet?.address || null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to find user" });
  }
});

export default router;
