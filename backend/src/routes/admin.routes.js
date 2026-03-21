import express from 'express';
import adminMiddleware from '../middleware/admin.middleware.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Request from '../models/Request.js';
import Kyc from '../models/Kyc.js';
import {
  getAllKYCSubmissions,
  approveKYC,
  rejectKYC,
} from '../controllers/kyc.controller.js';
// Note: User model previously modified to include role, kycStatus etc.

const router = express.Router();

// Dashboard Overview
router.get('/dashboard', adminMiddleware, async (req, res) => {
    try {
        // Get total counts
        const totalUsers = await User.countDocuments();
        const totalTransactions = await Transaction.countDocuments();
        const totalRequests = await Request.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });

        // Get total volume
        const transactions = await Transaction.aggregate([
            {
                $group: {
                    _id: null,
                    totalVolume: { $sum: '$amount' }
                }
            }
        ]);

        const totalVolume = transactions[0]?.totalVolume || 0;

        // Get recent users (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentUsers = await User.countDocuments({
            createdAt: { $gte: sevenDaysAgo }
        });

        // Get transaction trends (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const dailyTransactions = await Transaction.aggregate([
            {
                $match: {
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                    volume: { $sum: '$amount' }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);

        // Get KYC status breakdown
        const kycStats = await User.aggregate([
            {
                $group: {
                    _id: '$kycStatus',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            overview: {
                totalUsers,
                activeUsers,
                recentUsers,
                totalTransactions,
                totalRequests,
                totalVolume: parseFloat(totalVolume.toFixed(2))
            },
            trends: {
                dailyTransactions,
                kycStats
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all users with pagination and filters
router.get('/users', adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', status, kycStatus } = req.query;
        const skip = (page - 1) * limit;

        let query = {};

        // Search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                // Need to join with BankAccount for UPI search if needed, skipping for simple implementation or using aggregation if critical
            ];
        }

        // Status filter
        if (status === 'active') {
            query.isActive = true;
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        // KYC filter
        if (kycStatus && kycStatus !== 'all') {
            query.kycStatus = kycStatus;
        }

        const users = await User.find(query)
            .select('-password')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        res.json({
            users,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user details
router.get('/users/:id', adminMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user transactions
        // Note: Transaction model filters by userId which in typical schema is the 'userId' field of the BankAccount or the Transaction model itself if updated
        // Assuming Transaction model has userId field or we query by fromUser/toUser logic.
        // Based on previous files, Transaction has `userId`? No, wait.
        // Let's check Transaction.js... It has `paymentMethod`, `walletFrom`, `walletTo`.
        // Wait, the new Transaction schema might not have `userId` directly if it's dual-wallet based? 
        // Checking `request.routes.js`: `Transaction.create({ userId: ... })`. Okay, so `userId` exists.

        const transactions = await Transaction.find({
            $or: [
                { fromUser: req.params.id },
                { toUser: req.params.id }
            ]
        })
            .populate('fromUser', 'name email')
            .populate('toUser', 'name email')
            .sort({ createdAt: -1 })
            .limit(20);

        // Get user requests
        const requests = await Request.find({
            $or: [
                { fromUserId: req.params.id },
                { toUserId: req.params.id }
            ]
        }).sort({ createdAt: -1 }).limit(10);

        res.json({
            user,
            transactions,
            requests
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user status
router.put('/users/:id/status', adminMiddleware, async (req, res) => {
    try {
        const { isActive } = req.body;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            user
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user KYC status
router.put('/users/:id/kyc', adminMiddleware, async (req, res) => {
    try {
        const { kycStatus } = req.body;

        if (!['pending', 'verified', 'rejected', 'not_submitted'].includes(kycStatus)) {
            return res.status(400).json({ error: 'Invalid KYC status' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { kycStatus },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            message: `KYC status updated to ${kycStatus}`,
            user
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all transactions with filters
router.get('/transactions', adminMiddleware, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            type,
            status,
            currency,
            startDate,
            endDate
        } = req.query;

        const skip = (page - 1) * limit;

        let query = {};

        // Type filter
        if (type && type !== 'all') {
            query.type = type;
        }

        // Status filter
        if (status && status !== 'all') {
            query.status = status;
        }

        // Currency filter
        if (currency && currency !== 'all') {
            query.currency = currency;
        }

        // Date range filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const transactions = await Transaction.find(query)
            .populate('fromUser', 'name email')
            .populate('toUser', 'name email')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Transaction.countDocuments(query);

        // Get transaction summary
        const summary = await Transaction.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    totalVolume: { $sum: '$amount' },
                    avgAmount: { $avg: '$amount' }
                }
            }
        ]);

        res.json({
            transactions,
            summary: summary[0] || { totalCount: 0, totalVolume: 0, avgAmount: 0 },
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/* ═══════════════════════════════════════════════════════════════
   KYC Management Routes (Admin)
═══════════════════════════════════════════════════════════════ */

/**
 * GET /api/admin/kyc
 * Admin: Get all KYC submissions (paginated)
 * Query params: page, limit, status (all|pending|approved|rejected|under_review)
 */
router.get('/kyc', adminMiddleware, getAllKYCSubmissions);

/**
 * PUT /api/admin/kyc/:userId/approve
 * Admin: Approve KYC submission
 * Sets KYC status to approved and User.kyc = true
 */
router.put('/kyc/:userId/approve', adminMiddleware, approveKYC);

/**
 * PUT /api/admin/kyc/:userId/reject
 * Admin: Reject KYC submission
 * Body: { adminRemarks: "reason" }
 */
router.put('/kyc/:userId/reject', adminMiddleware, rejectKYC);

export default router;
