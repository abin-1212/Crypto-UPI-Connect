import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import MoneyRequest from "../models/MoneyRequest.js";

const router = express.Router();

/**
 * GET /notification/count - Get unread notification count
 */
router.get("/count", protect, async (req, res) => {
    try {
        const count = await MoneyRequest.countDocuments({
            toUser: req.user._id,
            status: "PENDING"
        });

        res.json({
            success: true,
            count
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /notification/read - Mark request notifications as read (optional for future)
 */
router.post("/read", protect, async (req, res) => {
    try {
        // This could be used to mark specific requests as "seen"
        // For now, returning success
        res.json({
            success: true,
            message: "Marked as read"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

export default router;
