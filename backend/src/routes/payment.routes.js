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
    const userId = req.user._id.toString();
    const formatted = transactions.map(tx => {
      const isFromMe = tx.fromUser?._id?.toString() === userId;
      const isToMe = tx.toUser?._id?.toString() === userId;
      const isDeposit = tx.type === 'DEPOSIT';

      // Determine isSent:  deposits are NOT "sent" — they are incoming to self
      const isSent = isDeposit ? false : isFromMe;

      return {
        id: tx._id,
        _id: tx._id,
        date: tx.createdAt,
        createdAt: tx.createdAt,
        amount: tx.amount,
        type: tx.type || 'UPI_TRANSFER',
        fromUserId: tx.fromUser?._id,
        fromUserName: tx.fromUser?.name,
        fromUpi: tx.fromUpi,
        toUserId: tx.toUser?._id,
        toUserName: tx.toUser?.name,
        toUpi: tx.toUpi,
        isSent,
        status: tx.status || 'COMPLETED',
        paymentMethod: tx.paymentMethod || 'UPI',
        tokenType: tx.tokenType,
        txHash: tx.txHash,
        etherscanUrl: tx.etherscanUrl,
        direction: tx.direction,
        category: tx.category,
        description: tx.description,
        note: tx.note,
        cryptoAmount: tx.cryptoAmount,
        inrAmount: tx.inrAmount,
        exchangeRate: tx.exchangeRate,
      };
    });

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
 * @desc    Record on-chain crypto transfer (ERC-20 transfer verified via txHash)
 * @access  Private
 */
router.post("/crypto", protect, async (req, res) => {
  try {
    const {
      toWalletAddress,
      amount,
      tokenType = "cxUSDC",
      recipientUserId,
      txHash,
      note = ""
    } = req.body;

    // Validate required fields
    if (!toWalletAddress || !amount || amount <= 0 || !txHash) {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid payment details (toWalletAddress, amount, txHash required)"
      });
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return res.status(400).json({ success: false, message: "Invalid transaction hash" });
    }

    // Replay protection
    const existingTx = await Transaction.findOne({ txHash });
    if (existingTx) {
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_TX",
        message: "This transaction has already been recorded"
      });
    }

    const User = (await import('../models/User.js')).default;
    const sender = await User.findById(req.user._id);
    const senderAccount = await BankAccount.findOne({ userId: req.user._id });

    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    // Look up recipient by ID or wallet address
    let recipient = null;
    if (recipientUserId) {
      recipient = await User.findById(recipientUserId);
    }
    if (!recipient && toWalletAddress) {
      recipient = await User.findOne({
        walletAddress: { $regex: new RegExp(`^${toWalletAddress}$`, 'i') },
        _id: { $ne: req.user._id }
      });
    }

    // Verify on-chain receipt
    const { default: blockchainService } = await import('../services/blockchain.service.js');
    const receipt = await blockchainService.getTransactionReceipt(txHash);

    const onChainStatus = receipt
      ? (receipt.status === 1 ? "CONFIRMED" : "FAILED")
      : "PENDING";

    const currentBlock = receipt ? await blockchainService.getBlockNumber() : 0;
    const confirmations = receipt ? currentBlock - receipt.blockNumber : 0;
    const { BLOCK_EXPLORER } = await import('../config/contracts.js');

    // Create sender transaction record
    const senderTransaction = await Transaction.create({
      fromUser: req.user._id,
      toUser: recipient ? recipient._id : null,
      fromUpi: senderAccount?.upiId || sender.walletAddress,
      toUpi: toWalletAddress,
      amount,
      paymentMethod: "BLOCKCHAIN",
      tokenType,
      walletFrom: sender.walletAddress || "",
      walletTo: toWalletAddress,
      txHash,
      blockNumber: receipt?.blockNumber,
      confirmations,
      gasUsed: receipt?.gasUsed?.toString(),
      etherscanUrl: `${BLOCK_EXPLORER}/tx/${txHash}`,
      note: note || "Crypto transfer",
      type: "CRYPTO_TRANSFER",
      status: onChainStatus,
      direction: "OUTGOING",
      category: "CRYPTO_SENT",
      auditTrail: [{
        action: "TX_RECORDED",
        details: `On-chain status: ${onChainStatus}, ${confirmations} confirmations`,
        txHash,
      }],
    });

    // Create receiver transaction if internal user
    if (recipient) {
      await Transaction.create({
        fromUser: req.user._id,
        toUser: recipient._id,
        fromUpi: sender.walletAddress || "",
        toUpi: toWalletAddress,
        amount,
        paymentMethod: "BLOCKCHAIN",
        tokenType,
        walletFrom: sender.walletAddress || "",
        walletTo: toWalletAddress,
        txHash,
        blockNumber: receipt?.blockNumber,
        confirmations,
        etherscanUrl: `${BLOCK_EXPLORER}/tx/${txHash}`,
        note,
        type: "CRYPTO_TRANSFER",
        status: onChainStatus,
        direction: "INCOMING",
        category: "CRYPTO_RECEIVED",
      });
    }

    res.json({
      success: true,
      message: "Crypto payment recorded",
      transaction: {
        id: senderTransaction._id,
        txHash,
        status: onChainStatus,
        confirmations,
        etherscanUrl: `${BLOCK_EXPLORER}/tx/${txHash}`,
      },
    });
  } catch (error) {
    console.error("Crypto payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process crypto payment",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
