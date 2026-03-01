import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import Request from '../models/Request.js';
import User from '../models/User.js';
import BankAccount from '../models/BankAccount.js';
import Transaction from '../models/Transaction.js';

const router = express.Router();

/**
 * Create a payment request
 * POST /api/requests/create
 */
router.post('/create', protect, async (req, res) => {
  try {
    const { amount, currency, description, toUPI, toCryptoAddress, paymentMethod } = req.body;

    // Find recipient if UPI provided
    let recipient = null;
    let recipientId = null;

    if (toUPI) {
      // Look up User via BankAccount (UPI)
      const bankAccount = await BankAccount.findOne({ upiId: toUPI });
      if (bankAccount) {
        recipientId = bankAccount.userId;
      }
    } else if (toCryptoAddress) {
      // Look up User via ConvergeX Address
      // Note: convergeXWallet.address is in User model
      recipient = await User.findOne({ 'convergeXWallet.address': toCryptoAddress });
      if (recipient) {
        recipientId = recipient._id;
      }
    }

    const request = new Request({
      fromUserId: req.user._id, // Auth middleware attaches user object, use _id
      toUserId: recipientId,
      toUPI,
      toCryptoAddress,
      amount,
      currency,
      description,
      paymentMethod
    });

    await request.save();

    res.status(201).json({
      success: true,
      requestId: request.requestId,
      message: 'Payment request created successfully'
    });
  } catch (error) {
    console.error("Create Request Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get my pending (outgoing) requests
 * GET /api/requests/my-requests
 */
router.get('/my-requests', protect, async (req, res) => {
  try {
    const requests = await Request.find({
      fromUserId: req.user._id,
      status: 'PENDING'
    }).sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get incoming requests (sent TO me)
 * GET /api/requests/incoming
 */
router.get('/incoming', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const bankAccount = await BankAccount.findOne({ userId: req.user._id });

    const upiId = bankAccount ? bankAccount.upiId : null;
    const cryptoAddress = user.convergeXWallet?.address;

    // Find requests targeted to my UserID, my UPI, or my Crypto Address
    const requests = await Request.find({
      $or: [
        { toUserId: req.user._id },
        { toUPI: upiId },
        { toCryptoAddress: cryptoAddress }
      ],
      status: 'PENDING'
    }).populate('fromUserId', 'name email')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Pay a request
 * POST /api/requests/:requestId/pay
 */
router.post('/:requestId/pay', protect, async (req, res) => {
  try {
    const request = await Request.findOne({ requestId: req.params.requestId });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    // Find the sender (current user paying the request)
    const senderUser = await User.findById(req.user._id);
    const senderBank = await BankAccount.findOne({ userId: req.user._id });

    // Handle payment based on method
    if (request.paymentMethod === 'UPI') {
      // Deduct from bank balance
      if (!senderBank) {
        return res.status(404).json({ error: 'Bank account not found' });
      }
      if (senderBank.balance < request.amount) {
        return res.status(400).json({ error: 'Insufficient bank balance' });
      }
      senderBank.balance -= request.amount;
      await senderBank.save();

      // Credit recipient
      // Need recipient's BankAccount
      // Logic: request.fromUserId is the requester (recipient of funds)
      const recipientBank = await BankAccount.findOne({ userId: request.fromUserId });
      if (recipientBank) {
        recipientBank.balance += request.amount;
        await recipientBank.save();
      }

    } else if (request.paymentMethod === 'CONVERGEX_WALLET') {
      // Deduct from crypto balance
      const currencyKey = request.currency.toLowerCase(); // usdc, dai, eth
      if (!senderUser.convergeXWallet.balance || senderUser.convergeXWallet.balance[currencyKey] === undefined) {
        return res.status(400).json({ error: `Invalid currency ${request.currency}` });
      }

      if (senderUser.convergeXWallet.balance[currencyKey] < request.amount) {
        return res.status(400).json({ error: `Insufficient ${request.currency} balance` });
      }
      senderUser.convergeXWallet.balance[currencyKey] -= request.amount;
      await senderUser.save();

      // Credit recipient
      const recipientUser = await User.findById(request.fromUserId);
      if (recipientUser) {
        recipientUser.convergeXWallet.balance[currencyKey] += request.amount;
        await recipientUser.save();
      }
    }

    // Update request status
    request.status = 'PAID';
    request.paidAt = new Date();
    await request.save();

    // Create transaction record
    // Note: Transaction model might require specific fields.
    // User provided generic code: new Transaction({...})
    // Our Transaction.js has: paymentMethod, tokenType, walletFrom, walletTo, direction, category, amount.

    const transaction = new Transaction({
      userId: req.user._id,
      type: 'PAYMENT',
      amount: request.amount,
      // Mapping fields to our schema
      tokenType: request.paymentMethod === 'CONVERGEX_WALLET' ? request.currency : undefined,
      paymentMethod: request.paymentMethod,
      category: 'REQUEST_PAYMENT', // Custom category
      description: `Paid request: ${request.description}`,
      status: 'COMPLETED',
      // Allow for internal transfer tracking if needed
      walletFrom: request.paymentMethod === 'CONVERGEX_WALLET' ? senderUser.convergeXWallet.address : senderBank?.upiId,
      walletTo: request.paymentMethod === 'CONVERGEX_WALLET' ? (await User.findById(request.fromUserId))?.convergeXWallet?.address : 'RECIPIENT_UPI', // Simplified
      direction: 'OUTGOING'
    });
    await transaction.save();

    res.json({
      success: true,
      message: 'Payment completed successfully'
    });
  } catch (error) {
    console.error("Pay Request Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
