import express from "express";
import Stripe from "stripe";
import { protect } from "../middleware/auth.middleware.js";
import BankAccount from "../models/BankAccount.js";
import Transaction from "../models/Transaction.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/* =============================================
   POST /stripe/create-checkout-session
   Creates a Stripe Checkout Session (hosted).
   Stripe handles the entire payment page.
============================================= */
router.post("/create-checkout-session", protect, async (req, res) => {
  try {
    const { amount } = req.body; // amount in INR (e.g. 500)

    if (!amount || amount < 1) {
      return res.status(400).json({ message: "Minimum amount is ₹1" });
    }

    if (amount > 500000) {
      return res.status(400).json({ message: "Maximum amount is ₹5,00,000" });
    }

    const convergexTxId = uuidv4();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: "Add Money to ConvergeX Wallet",
              description: `Adding ₹${Number(amount).toLocaleString("en-IN")} to your ConvergeX balance`,
            },
            unit_amount: Math.round(amount * 100), // paise
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: req.user._id.toString(),
        convergexTxId,
      },
      success_url: `${FRONTEND_URL}/add-money?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/add-money?cancelled=true`,
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("❌ Stripe create-checkout-session error:", error.message);
    res.status(500).json({ message: error.message || "Failed to create checkout session" });
  }
});

/* =============================================
   POST /stripe/verify-session
   Verifies a completed Checkout Session and
   credits the user's bank balance.
============================================= */
router.post("/verify-session", protect, async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "Session ID required" });
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        message: `Payment not completed. Status: ${session.payment_status}`,
      });
    }

    // Verify the session belongs to this user
    if (session.metadata.userId !== req.user._id.toString()) {
      return res.status(403).json({ message: "Session does not belong to this user" });
    }

    // Check if this session was already processed (idempotency)
    const existingTx = await Transaction.findOne({
      "metadata.stripeSessionId": sessionId,
    });
    if (existingTx) {
      const bankAccount = await BankAccount.findOne({ userId: req.user._id });
      return res.json({
        success: true,
        message: "Payment already processed",
        alreadyProcessed: true,
        newBalance: bankAccount?.balance || 0,
        transaction: existingTx,
      });
    }

    // Credit the user's bank balance
    const amountInRupees = session.amount_total / 100;

    const bankAccount = await BankAccount.findOne({ userId: req.user._id });
    if (!bankAccount) {
      return res.status(404).json({ message: "Bank account not found" });
    }

    bankAccount.balance += amountInRupees;
    await bankAccount.save();

    // Create transaction record
    const transaction = new Transaction({
      transactionId: session.metadata.convergexTxId || uuidv4(),
      fromUser: req.user._id,
      toUser: req.user._id,
      amount: amountInRupees,
      type: "DEPOSIT",
      status: "COMPLETED",
      paymentMethod: "STRIPE",
      description: `Added ₹${amountInRupees.toLocaleString("en-IN")} via Stripe`,
      metadata: {
        stripeSessionId: sessionId,
        stripePaymentIntent: session.payment_intent,
        gateway: "stripe",
      },
      auditTrail: [
        { action: "STRIPE_CHECKOUT_CREATED", details: `Session: ${sessionId}` },
        { action: "PAYMENT_VERIFIED", details: `Amount: ₹${amountInRupees}, Intent: ${session.payment_intent}` },
        { action: "BALANCE_CREDITED", details: `New balance: ₹${bankAccount.balance}` },
      ],
    });
    await transaction.save();

    console.log(`✅ Stripe deposit: ₹${amountInRupees} credited to user ${req.user._id}`);

    res.json({
      success: true,
      message: `₹${amountInRupees.toLocaleString("en-IN")} added to your account`,
      newBalance: bankAccount.balance,
      transaction,
    });
  } catch (error) {
    console.error("❌ Stripe verify-session error:", error);
    res.status(500).json({ message: error.message || "Failed to verify payment" });
  }
});

/* =============================================
   POST /stripe/create-send-checkout-session
   Creates a Stripe Checkout Session to send
   money to another user via their UPI ID.
============================================= */
router.post("/create-send-checkout-session", protect, async (req, res) => {
  try {
    const { amount, toUpiId } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ message: "Minimum amount is ₹1" });
    }
    if (amount > 500000) {
      return res.status(400).json({ message: "Maximum amount is ₹5,00,000" });
    }
    if (!toUpiId || typeof toUpiId !== "string") {
      return res.status(400).json({ message: "Recipient UPI ID is required" });
    }

    // Verify recipient exists
    const recipientAccount = await BankAccount.findOne({ upiId: toUpiId });
    if (!recipientAccount) {
      return res.status(404).json({ message: "Recipient UPI ID not found" });
    }

    // Prevent sending to self
    const senderAccount = await BankAccount.findOne({ userId: req.user._id });
    if (senderAccount && senderAccount.upiId === toUpiId) {
      return res.status(400).json({ message: "Cannot send money to yourself. Use Add Money instead." });
    }

    // Get recipient user info for display
    const User = (await import("../models/User.js")).default;
    const recipientUser = await User.findById(recipientAccount.userId).select("name email");

    const convergexTxId = uuidv4();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `Send Money to ${recipientUser?.name || toUpiId}`,
              description: `Sending ₹${Number(amount).toLocaleString("en-IN")} to ${toUpiId}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: req.user._id.toString(),
        recipientUpiId: toUpiId,
        recipientUserId: recipientAccount.userId.toString(),
        convergexTxId,
        type: "SEND_MONEY",
      },
      success_url: `${FRONTEND_URL}/send?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/send?cancelled=true`,
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      recipientName: recipientUser?.name || null,
    });
  } catch (error) {
    console.error("❌ Stripe create-send-checkout-session error:", error.message);
    res.status(500).json({ message: error.message || "Failed to create checkout session" });
  }
});

/* =============================================
   POST /stripe/verify-send-session
   Verifies a completed Send-Money Checkout
   Session and credits the recipient's balance.
============================================= */
router.post("/verify-send-session", protect, async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "Session ID required" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        message: `Payment not completed. Status: ${session.payment_status}`,
      });
    }

    // Verify session belongs to this user
    if (session.metadata.userId !== req.user._id.toString()) {
      return res.status(403).json({ message: "Session does not belong to this user" });
    }

    // Verify this is a send-money session
    if (session.metadata.type !== "SEND_MONEY") {
      return res.status(400).json({ message: "Invalid session type" });
    }

    // Idempotency check
    const existingTx = await Transaction.findOne({
      "metadata.stripeSessionId": sessionId,
    });
    if (existingTx) {
      const senderBankAccount = await BankAccount.findOne({ userId: req.user._id });
      return res.json({
        success: true,
        message: "Payment already processed",
        alreadyProcessed: true,
        newBalance: senderBankAccount?.balance || 0,
        transaction: existingTx,
      });
    }

    const amountInRupees = session.amount_total / 100;
    const recipientUpiId = session.metadata.recipientUpiId;
    const recipientUserId = session.metadata.recipientUserId;

    // ── Deduct from sender's bank account ──
    const senderAccount = await BankAccount.findOne({ userId: req.user._id });
    if (!senderAccount) {
      return res.status(404).json({ message: "Sender bank account not found" });
    }
    if (senderAccount.balance < amountInRupees) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }
    senderAccount.balance -= amountInRupees;
    await senderAccount.save();

    // ── Credit recipient's bank account ──
    const recipientAccount = await BankAccount.findOne({ upiId: recipientUpiId });
    if (!recipientAccount) {
      // Rollback sender deduction if recipient not found
      senderAccount.balance += amountInRupees;
      await senderAccount.save();
      return res.status(404).json({ message: "Recipient account not found" });
    }

    recipientAccount.balance += amountInRupees;
    await recipientAccount.save();

    // Get recipient name
    const User = (await import("../models/User.js")).default;
    const recipientUser = await User.findById(recipientUserId).select("name");

    // Create transaction record
    const transaction = new Transaction({
      transactionId: session.metadata.convergexTxId || uuidv4(),
      fromUser: req.user._id,
      toUser: recipientUserId,
      fromUpi: senderAccount.upiId || "",
      toUpi: recipientUpiId,
      amount: amountInRupees,
      type: "UPI_TRANSFER",
      status: "COMPLETED",
      paymentMethod: "STRIPE",
      description: `Sent ₹${amountInRupees.toLocaleString("en-IN")} to ${recipientUser?.name || recipientUpiId} via Stripe`,
      metadata: {
        stripeSessionId: sessionId,
        stripePaymentIntent: session.payment_intent,
        gateway: "stripe",
        type: "SEND_MONEY",
      },
      auditTrail: [
        { action: "STRIPE_SEND_CHECKOUT_CREATED", details: `Session: ${sessionId}` },
        { action: "PAYMENT_VERIFIED", details: `Amount: ₹${amountInRupees}, To: ${recipientUpiId}` },
        { action: "SENDER_DEBITED", details: `₹${amountInRupees} debited from ${senderAccount.upiId}. New balance: ₹${senderAccount.balance}` },
        { action: "RECIPIENT_CREDITED", details: `₹${amountInRupees} credited to ${recipientUpiId}. New balance: ₹${recipientAccount.balance}` },
      ],
    });
    await transaction.save();

    console.log(`✅ Stripe send: ₹${amountInRupees} | ${senderAccount.upiId} (₹${senderAccount.balance}) → ${recipientUpiId} (₹${recipientAccount.balance})`);

    res.json({
      success: true,
      message: `₹${amountInRupees.toLocaleString("en-IN")} sent to ${recipientUser?.name || recipientUpiId}`,
      newBalance: senderAccount.balance,
      transaction,
      recipientName: recipientUser?.name || null,
      recipientUpiId,
    });
  } catch (error) {
    console.error("❌ Stripe verify-send-session error:", error);
    res.status(500).json({ message: error.message || "Failed to verify send payment" });
  }
});

/* =============================================
   GET /stripe/config
   Returns the publishable key for the frontend
============================================= */
router.get("/config", (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

export default router;
