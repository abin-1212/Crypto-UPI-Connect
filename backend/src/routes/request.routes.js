import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import Request from '../models/Request.js';
import User from '../models/User.js';
import BankAccount from '../models/BankAccount.js';
import Transaction from '../models/Transaction.js';

const router = express.Router();

/**
 * Create a payment request
 * POST /api/request
 */
router.post('/', protect, async (req, res) => {
  try {
    const { toUpiId, toUserId, amount, currency = 'INR', description = '', paymentMethod = 'UPI', toCryptoAddress, category = 'OTHER', dueDate } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    // Validate description
    if (!description || description.trim().length === 0) {
      return res.status(400).json({ message: 'Please provide a description for the request' });
    }

    if (!toUpiId && !toUserId && !toCryptoAddress) {
      return res.status(400).json({ message: 'Please provide recipient UPI ID, User ID, or Crypto Address' });
    }

    // Find recipient if UPI provided
    let recipientId = null;
    let recipientUpi = toUpiId;

    if (toUpiId) {
      const bankAccount = await BankAccount.findOne({ upiId: toUpiId });
      if (bankAccount) {
        recipientId = bankAccount.userId;
      }
    } else if (toUserId) {
      recipientId = toUserId;
      // Also get their UPI for reference
      const bankAccount = await BankAccount.findOne({ userId: toUserId });
      if (bankAccount) {
        recipientUpi = bankAccount.upiId;
      }
    } else if (toCryptoAddress) {
      const user = await User.findOne({ 'convergeXWallet.address': toCryptoAddress });
      if (user) {
        recipientId = user._id;
      }
    }

    const newRequest = new Request({
      fromUserId: req.user._id,
      toUserId: recipientId,
      toUPI: recipientUpi,
      toCryptoAddress,
      amount,
      currency,
      description: description.trim(),
      paymentMethod,
      category,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: 'PENDING'
    });

    await newRequest.save();

    res.status(201).json({
      success: true,
      message: 'Payment request created successfully',
      requestId: newRequest.requestId,
      request: newRequest
    });
  } catch (error) {
    console.error("Create Request Error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Get my outgoing requests
 * GET /api/request/outgoing
 */
router.get('/outgoing', protect, async (req, res) => {
  try {
    let requests = await Request.find({
      fromUserId: req.user._id
    }).populate('toUserId', 'name email')
      .sort({ createdAt: -1 });

    // Transform response to use toUser for outgoing requests
    requests = requests.map(req => ({
      ...req.toObject(),
      toUser: req.toUserId
    }));

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error("Get Outgoing Requests Error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Get my incoming requests (sent TO me)
 * GET /api/request/incoming
 */
router.get('/incoming', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const bankAccount = await BankAccount.findOne({ userId: req.user._id });

    const upiId = bankAccount ? bankAccount.upiId : null;
    const cryptoAddress = user.convergeXWallet?.address;

    // Find requests targeted to my UserID, my UPI, or my Crypto Address
    let requests = await Request.find({
      $or: [
        { toUserId: req.user._id },
        { toUPI: upiId },
        { toCryptoAddress: cryptoAddress }
      ]
    }).populate('fromUserId', 'name email')
      .sort({ createdAt: -1 });

    // Transform response to use fromUser for incoming requests
    requests = requests.map(req => ({
      ...req.toObject(),
      fromUser: req.fromUserId
    }));

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error("Get Incoming Requests Error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Accept and pay a request
 * POST /api/request/:requestId/accept
 */
router.post('/:requestId/accept', protect, async (req, res) => {
  try {
    // Support both MongoDB _id and custom requestId
    const query = {
      $or: [
        { _id: req.params.requestId },
        { requestId: req.params.requestId }
      ]
    };
    const request = await Request.findOne(query).populate('fromUserId', 'name email');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if requester is trying to accept their own request
    if (request.fromUserId._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot accept your own request' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Check if request has expired
    if (new Date() > request.expiresAt) {
      request.status = 'EXPIRED';
      await request.save();
      return res.status(400).json({ message: 'Request has expired' });
    }

    // Find the payer (current user)
    const payerBank = await BankAccount.findOne({ userId: req.user._id });
    if (!payerBank) {
      return res.status(404).json({ message: 'Bank account not found' });
    }

    // Check balance
    if (payerBank.balance < request.amount) {
      return res.status(400).json({ message: 'Insufficient balance to accept this request' });
    }

    // Find the requester's bank account
    const requesterBank = await BankAccount.findOne({ userId: request.fromUserId._id });

    // Process payment
    payerBank.balance -= request.amount;
    await payerBank.save();

    if (requesterBank) {
      requesterBank.balance += request.amount;
      await requesterBank.save();
    }

    // Update request status
    request.status = 'PAID';
    request.paidAt = new Date();
    await request.save();

    // Create transaction for payer (outgoing)
    const payerTx = new Transaction({
      fromUser: req.user._id,
      toUser: request.fromUserId._id,
      fromUpi: payerBank.upiId,
      toUpi: requesterBank?.upiId || request.toUPI || '',
      amount: request.amount,
      type: 'REQUEST_ACCEPTED',
      status: 'COMPLETED',
      paymentMethod: 'UPI',
      description: `Paid request: ${request.description || 'Payment request'}`,
      category: 'REQUEST_PAYMENT',
      direction: 'OUTGOING',
      note: request.description || '',
    });
    await payerTx.save();

    // Create transaction for requester (incoming)
    const requesterTx = new Transaction({
      fromUser: req.user._id,
      toUser: request.fromUserId._id,
      fromUpi: payerBank.upiId,
      toUpi: requesterBank?.upiId || request.toUPI || '',
      amount: request.amount,
      type: 'REQUEST_ACCEPTED',
      status: 'COMPLETED',
      paymentMethod: 'UPI',
      description: `Received payment for: ${request.description || 'Payment request'}`,
      category: 'REQUEST_PAYMENT',
      direction: 'INCOMING',
      note: request.description || '',
    });
    await requesterTx.save();

    res.json({
      success: true,
      message: 'Payment completed successfully',
      newBalance: payerBank.balance,
      request
    });
  } catch (error) {
    console.error("Accept Request Error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Reject a request
 * POST /api/request/:requestId/reject
 */
router.post('/:requestId/reject', protect, async (req, res) => {
  try {
    // Support both MongoDB _id and custom requestId
    const query = {
      $or: [
        { _id: req.params.requestId },
        { requestId: req.params.requestId }
      ]
    };
    const request = await Request.findOne(query).populate('fromUserId', 'name email');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request cannot be rejected - already processed' });
    }

    // Update request status to DECLINED
    request.status = 'DECLINED';
    await request.save();

    res.json({
      success: true,
      message: 'Request declined',
      request
    });
  } catch (error) {
    console.error("Reject Request Error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Get request by ID
 * GET /api/request/:requestId
 */
router.get('/:requestId', protect, async (req, res) => {
  try {
    // Support both MongoDB _id and custom requestId
    const query = {
      $or: [
        { _id: req.params.requestId },
        { requestId: req.params.requestId }
      ]
    };
    const request = await Request.findOne(query)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json({
      success: true,
      request
    });
  } catch (error) {
    console.error("Get Request Error:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
