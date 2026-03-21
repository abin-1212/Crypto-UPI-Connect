import "./src/config/env.js"; // Must be first — loads .env before any other module
import express from "express";
import cors from "cors";
import connectDB from "./src/config/db.js";
import authRoutes from "./src/routes/auth.routes.js";
import bankRoutes from "./src/routes/bank.routes.js";
import paymentRoutes from "./src/routes/payment.routes.js";
import transactionRoutes from "./src/routes/transaction.routes.js";
import requestRoutes from "./src/routes/request.routes.js";
import notificationRoutes from "./src/routes/notification.routes.js";
import walletRoutes from "./src/routes/wallet.routes.js";
import hybridPaymentRoutes from "./src/routes/hybridPaymentRoutes.js";
import stripeRoutes from "./src/routes/stripe.routes.js";
import kycRoutes from "./src/routes/kyc.routes.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import { protect } from "./src/middleware/auth.middleware.js";
import adminRoutes from "./src/routes/admin.routes.js";
import blockchainService from "./src/services/blockchain.service.js";
import blockchainListener from "./src/services/blockchainListener.js";




const app = express();
const PORT = process.env.PORT || 5000;

/* =====================
   Global Middleware
===================== */
app.use(cors());
app.use(express.json());

/* =====================
   Health Check
===================== */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "ConvergeX Pay",
    environment: process.env.NODE_ENV || "development",
  });
});
app.post("/pay/test", (req, res) => {
  res.json({ message: "DIRECT PAY ROUTE HIT" });
});

/* =====================
   Secure File Serving for KYC
===================== */
// KYC documents are served as static files - browser img tags can load them
// The directory structure (uploads/kyc/{userId}) provides privacy through obscurity
// For production, consider implementing a signed URL or custom endpoint with JWT verification
app.use("/uploads/kyc", express.static("uploads/kyc"));

/* =====================
   Routes
===================== */
app.use("/auth", authRoutes);
app.use("/bank", bankRoutes);
app.use("/pay", paymentRoutes);
app.use("/pay", hybridPaymentRoutes);   // Hybrid: /pay/crypto-to-upi & /pay/upi-to-crypto
app.use("/transactions", transactionRoutes);
app.use("/api/request", requestRoutes);
app.use("/api/admin", adminRoutes);
app.use("/notification", notificationRoutes);
app.use("/wallet", walletRoutes);
app.use("/stripe", stripeRoutes);
app.use("/kyc", kycRoutes);

/* =====================
   Error Handler (Must be last)
===================== */
app.use(errorHandler);


/* =====================
   Global Safety Net — prevent server crashes from unhandled errors
===================== */
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception (server kept alive):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection (server kept alive):', reason);
});

/* =====================
   Start Server
===================== */
const startServer = async () => {
  try {
    await connectDB();

    // ── Initialize Blockchain Service ──
    try {
      await blockchainService.init();
      console.log("⛓️  Blockchain service initialized (Sepolia)");
    } catch (err) {
      console.warn("⚠️  Blockchain service init failed (will retry on first use):", err.message);
    }

    // ── Start Blockchain Event Listener ──
    try {
      blockchainListener.start();
    } catch (err) {
      console.warn("⚠️  Blockchain listener failed to start:", err.message);
    }

    app.listen(PORT, () => {
      console.log(`🚀 ConvergeX Pay running on port ${PORT}`);
      console.log(`⛓️  Chain: Sepolia (chainId 11155111)`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
