import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import BankAccount from "../models/BankAccount.js";
import Transaction from "../models/Transaction.js";

const router = express.Router();
router.post("/test", (req, res) => {
  res.json({ message: "PAY ROUTE HIT" });
});

router.post("/upi", protect, async (req, res) => {
  try {
    console.log("💸 Payment request received:", req.body);
    console.log("👤 From user:", req.user._id);

    const { toUpiId, amount } = req.body;

    if (!toUpiId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid transfer data"
      });
    }

    const senderAccount = await BankAccount.findOne({ userId: req.user._id });
    if (!senderAccount) {
      console.error("❌ Sender account not found for user:", req.user._id);
      return res.status(404).json({
        success: false,
        message: "Your bank account not found"
      });
    }

    const receiverAccount = await BankAccount.findOne({ upiId: toUpiId });
    if (!receiverAccount) {
      console.error("❌ Receiver account not found for UPI:", toUpiId);
      return res.status(404).json({
        success: false,
        message: "Recipient UPI ID not found"
      });
    }

    if (senderAccount.upiId === toUpiId) {
      return res.status(400).json({
        success: false,
        message: "Cannot send money to yourself"
      });
    }

    if (senderAccount.balance < amount) {
      console.warn("⚠️ Insufficient balance:", senderAccount.balance, "< Needed:", amount);
      return res.status(400).json({
        success: false,
        message: "Insufficient balance"
      });
    }

    // Perform transfer
    senderAccount.balance -= amount;
    receiverAccount.balance += amount;

    await senderAccount.save();
    await receiverAccount.save();

    // Create transaction record
    await Transaction.create({
      fromUser: req.user._id,
      toUser: receiverAccount.userId,
      fromUpi: senderAccount.upiId,
      toUpi: receiverAccount.upiId,
      amount,
      status: "COMPLETED"
    });

    console.log("✅ Transfer completed successfully");

    res.json({
      success: true,
      message: "Payment successful",
      balance: senderAccount.balance
    });

  } catch (error) {
    console.error("💥 Payment processing error:", error);
    res.status(500).json({
      success: false,
      message: "Payment processing failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// In your payment.routes.js - Update the /history endpoint
router.get("/history", protect, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      $or: [
        { fromUser: req.user._id },
        { toUser: req.user._id }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("fromUser", "name email")
      .populate("toUser", "name email");

    // Format for frontend
    const formatted = transactions.map(tx => ({
      id: tx._id,
      date: tx.createdAt,
      amount: tx.amount,
      type: tx.type,
      fromUserId: tx.fromUser?._id,
      fromUserName: tx.fromUser?.name,
      fromUpi: tx.fromUpi,
      toUserId: tx.toUser?._id,
      toUserName: tx.toUser?.name,
      toUpi: tx.toUpi,
      isSent: tx.fromUser?._id.toString() === req.user._id.toString(),
      status: "COMPLETED" // Or use actual status from your model
    }));

    res.json(formatted);
  } catch (error) {
    console.error("History error:", error);
    res.status(500).json({
      message: "Failed to fetch history",
      error: error.message
    });
  }
});

/**
 * @route   POST /pay/crypto
 * @desc    Process crypto payment and record in database
 * @access  Private
 */
router.post("/crypto", protect, async (req, res) => {
  try {
    console.log("💎 Processing crypto payment:", req.body);

    const {
      toWalletAddress,
      amount,
      tokenType = "USDC",
      recipientUserId,
      note = ""
    } = req.body;

    // Validate required fields
    if (!toWalletAddress || !amount || amount <= 0 || !tokenType) {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid payment details"
      });
    }

    // Get sender's info (using dynamic import to avoid circular dep if needed, or stick to imports at top)
    const User = (await import('../models/User.js')).default;
    const sender = await User.findById(req.user._id);
    const senderAccount = await BankAccount.findOne({ userId: req.user._id });

    if (!sender || !senderAccount) {
      return res.status(404).json({
        success: false,
        message: "Sender account not found"
      });
    }

    // Get recipient's info if provided
    let recipient = null;
    let recipientAccount = null;

    if (recipientUserId) {
      recipient = await User.findById(recipientUserId);
      // Recipient might not have a bank account if they just joined for crypto, handle gracefully?
      // But for now assume they do as per system design
      recipientAccount = await BankAccount.findOne({ userId: recipientUserId });

      if (!recipient) {
        return res.status(404).json({ success: false, message: "Recipient user not found" });
      }
    }

    // Verify recipient's wallet matches IF it's a system user transfer
    if (recipient && recipient.wallet && recipient.wallet.address &&
      recipient.wallet.address.toLowerCase() !== toWalletAddress.toLowerCase()) {
      // Warn but allow? Or block?
      // Safety: If user explicitly selected a system user, ensure wallet matches
      console.warn(`⚠️ Wallet mismatch for user ${recipient.name}. Expected ${recipient.wallet.address}, got ${toWalletAddress}`);
    }

    const txId = `CRYPTO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 💰 Perform Atomic Balance Updates (Internal Ledger)
    const tokenField = `cryptoBalance.${tokenType.toLowerCase()}`;

    // 1. Deduct from Sender
    await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { [tokenField]: -amount } }
    );

    // 2. Add to Receiver (if internal system user)
    if (recipient) {
      await User.findByIdAndUpdate(
        recipient._id,
        { $inc: { [tokenField]: amount } }
      );
    }

    // Create transaction record for SENDER (outgoing)
    const senderTransaction = await Transaction.create({
      userId: req.user._id,
      relatedUserId: recipient ? recipient._id : null,
      fromUser: req.user._id,
      toUser: recipient ? recipient._id : null,
      fromUpi: senderAccount.upiId,
      toUpi: recipientAccount ? recipientAccount.upiId : "EXTERNAL_WALLET",
      fromUserName: sender.name,
      toUserName: recipient ? recipient.name : "External Wallet",
      amount: amount,
      isSent: true,
      paymentMethod: "CRYPTO",
      tokenType: tokenType,
      walletFrom: sender.wallet && sender.wallet.address ? sender.wallet.address : (sender.walletAddress || ""),
      walletTo: toWalletAddress,
      note: note || (recipient ? "" : "External Transfer"),
      type: "CRYPTO_TRANSFER",
      status: "COMPLETED",
      id: `${txId}_SENT`,
      date: new Date()
    });

    // Create transaction record for RECEIVER (incoming) ONLY if system user
    let receiverTransaction = null;
    if (recipient) {
      // If recipient doesn't have bank account, use placeholder UPI
      const recipientUpi = recipientAccount ? recipientAccount.upiId : "NO_UPI";

      receiverTransaction = await Transaction.create({
        userId: recipient._id,
        relatedUserId: req.user._id,
        fromUser: req.user._id,
        toUser: recipient._id,
        fromUpi: senderAccount.upiId,
        toUpi: recipientUpi,
        fromUserName: sender.name,
        toUserName: recipient.name,
        amount: amount,
        isSent: false,
        paymentMethod: "CRYPTO",
        tokenType: tokenType,
        walletFrom: sender.wallet && sender.wallet.address ? sender.wallet.address : (sender.walletAddress || ""),
        walletTo: toWalletAddress,
        note: note,
        type: "CRYPTO_TRANSFER",
        status: "COMPLETED",
        id: `${txId}_RECEIVED`,
        date: new Date()
      });
    }

    console.log("✅ Crypto transaction recorded");

    res.json({
      success: true,
      message: "Crypto payment processed successfully",
      transactions: {
        sender: senderTransaction,
        receiver: receiverTransaction
      }
    });

  } catch (error) {
    console.error("❌ Crypto payment processing error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process crypto payment",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
