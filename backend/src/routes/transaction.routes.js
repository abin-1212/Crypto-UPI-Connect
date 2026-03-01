import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import Transaction from "../models/Transaction.js";

const router = express.Router();

/**
 * GET /transactions - Get user's transactions with pagination and filtering
 */
router.get("/", protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (page - 1) * limit;

    // Base filter - transactions involving the user
    const filter = {
      $or: [
        { fromUser: req.user._id },
        { toUser: req.user._id }
      ]
    };

    // Apply type filter if provided
    if (type) {
      if (type === 'sent') {
        filter.fromUser = req.user._id;
        delete filter.$or;
      } else if (type === 'received') {
        filter.toUser = req.user._id;
        delete filter.$or;
      }
    }

    const transactions = await Transaction.find(filter)
      .populate('fromUser', 'name upiId email')
      .populate('toUser', 'name upiId email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /transactions/:id - Get specific transaction by ID
 */
router.get("/:id", protect, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('fromUser', 'name email upiId')
      .populate('toUser', 'name email upiId');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check if user is involved in transaction
    const isFromUser = transaction.fromUser._id.toString() === req.user._id.toString();
    const isToUser = transaction.toUser._id.toString() === req.user._id.toString();

    if (!isFromUser && !isToUser) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this transaction'
      });
    }

    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;

