/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — Wallet Verification Middleware
 * ═══════════════════════════════════════════════════════════════
 *
 *  Ensures the user has a cryptographically verified wallet
 *  before allowing any crypto operations.
 *
 *  Without signature verification: no crypto operations allowed.
 * ═══════════════════════════════════════════════════════════════
 */

import User from "../models/User.js";

/**
 * Middleware: Require a verified (signature-proved) wallet.
 * Use after `protect` middleware.
 */
export const requireVerifiedWallet = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      "walletAddress walletVerified"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.walletAddress) {
      return res.status(403).json({
        success: false,
        message: "No wallet connected. Connect a MetaMask wallet first.",
        code: "NO_WALLET",
      });
    }

    if (!user.walletVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Wallet not verified. Sign a verification message to prove ownership.",
        code: "WALLET_NOT_VERIFIED",
      });
    }

    // Attach wallet address to request for downstream use
    req.walletAddress = user.walletAddress;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Wallet verification check failed",
    });
  }
};

export default requireVerifiedWallet;
