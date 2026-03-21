import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { protect } from "../middleware/auth.middleware.js";
import {
  submitKYC,
  getKYCStatus,
} from "../controllers/kyc.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ─── Multer Configuration ──────────────────────────────────
// Storage engine: save to uploads/kyc/{userId}/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/kyc", req.user._id.toString());
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // e.g., docFront-1000.jpg
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${timestamp}${ext}`);
  },
});

// File filter: only jpg, jpeg, png, pdf
const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "application/pdf"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, and PDF files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Middleware to handle multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File size exceeds 5MB limit" });
    }
  }
  if (err?.message) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// ─── User Routes ────────────────────────────────────

/**
 * POST /kyc/submit
 * Submit KYC with documents
 * Expects: multipart/form-data with:
 *   - fullName, dateOfBirth, address, documentType, documentNumber (text fields)
 *   - docFront, docBack, selfie (file uploads)
 */
router.post(
  "/submit",
  protect,
  upload.fields([
    { name: "docFront", maxCount: 1 },
    { name: "docBack", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]),
  handleMulterError,
  submitKYC
);

/**
 * GET /kyc/status
 * Get current user's KYC status
 */
router.get("/status", protect, getKYCStatus);

export default router;
