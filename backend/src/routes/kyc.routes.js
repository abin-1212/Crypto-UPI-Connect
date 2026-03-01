import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import User from "../models/User.js";

const router = express.Router();

// PAN format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)
function isValidPAN(pan) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(pan);
}
// Aadhaar format: 12 digits
function isValidAadhaar(aadhaar) {
  return /^[0-9]{12}$/.test(aadhaar);
}

// Submit KYC
router.post("/submit", protect, async (req, res) => {
  const { panNumber, aadhaarNumber } = req.body;
  if (!panNumber && !aadhaarNumber) {
    return res.status(400).json({ message: "PAN or Aadhaar required" });
  }

  let status = "pending";
  let reason = "";

  if (panNumber && !isValidPAN(panNumber)) {
    status = "rejected";
    reason = "Invalid PAN format";
  }
  if (aadhaarNumber && !isValidAadhaar(aadhaarNumber)) {
    status = "rejected";
    reason = "Invalid Aadhaar format";
  }

  // Simulate verification delay
  await new Promise((resolve) => setTimeout(resolve, 1200));

  // If valid, mark as verified
  if (status === "pending") {
    status = "verified";
    reason = "KYC verified (simulated)";
  }

  // Update user
  const user = await User.findById(req.user._id);
  user.kycStatus = status;
  user.panNumber = panNumber || user.panNumber;
  user.aadhaarNumber = aadhaarNumber || user.aadhaarNumber;
  user.kycVerifiedAt = status === "verified" ? new Date() : undefined;
  user.kycAttempts = (user.kycAttempts || 0) + 1;
  user.kycHistory = user.kycHistory || [];
  user.kycHistory.push({
    submittedAt: new Date(),
    panNumber,
    aadhaarNumber,
    status,
    reason,
  });
  await user.save();

  res.json({ success: true, status, reason });
});

// Get KYC status
router.get("/status", protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({
    kycStatus: user.kycStatus,
    panNumber: user.panNumber,
    aadhaarNumber: user.aadhaarNumber,
    kycVerifiedAt: user.kycVerifiedAt,
    kycAttempts: user.kycAttempts,
    kycHistory: user.kycHistory,
  });
});

export default router;
