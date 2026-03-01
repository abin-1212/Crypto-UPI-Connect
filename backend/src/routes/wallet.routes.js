import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import BankAccount from "../models/BankAccount.js";
import { getExchangeRate, getAllRates, forceRefreshRates, getMarketData } from "../utils/conversion.js";

const router = express.Router();

/**
 * GET /wallet/rates — Live exchange rates + market data (powered by CoinGecko)
 */
router.get("/rates", async (req, res) => {
    try {
        const rates = await forceRefreshRates();
        const marketData = getMarketData();
        res.json({
            success: true,
            source: "CoinGecko",
            rates,
            marketData,
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch rates" });
    }
});

/**
 * Get user's ConvergeX Wallet info
 */
router.get("/convergex", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select(
            "convergeXWallet name email"
        );

        // Ensure wallet exists (migration safe)
        if (!user.convergeXWallet || !user.convergeXWallet.address) {
            // Auto-generate if missing
            user.convergeXWallet = {
                address: `cx_${Date.now()}${Math.random().toString(36).substr(2, 9)}`, // Fallback generation if Schema default didn't trigger
                balance: { usdc: 1000, dai: 500, eth: 1 }
            };
            await user.save();
        }

        res.json({
            success: true,
            wallet: user.convergeXWallet,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch ConvergeX Wallet"
        });
    }
});

/**
 * Transfer between ConvergeX Wallets
 */
router.post("/convergex/transfer", protect, async (req, res) => {
    try {
        const { toWalletAddress, amount, token } = req.body;

        // Validation
        if (!toWalletAddress || !amount || !token) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount must be positive"
            });
        }

        // Get sender
        const sender = await User.findById(req.user._id);
        if (!sender) {
            return res.status(404).json({
                success: false,
                message: "Sender not found"
            });
        }

        // Check if sending to self
        if (sender.convergeXWallet.address === toWalletAddress) {
            return res.status(400).json({
                success: false,
                message: "Cannot send to your own wallet"
            });
        }

        // Check sender balance
        const senderBalance = sender.convergeXWallet.balance[token.toLowerCase()] || 0;
        if (amount > senderBalance) {
            return res.status(400).json({
                success: false,
                message: `Insufficient ${token} balance`
            });
        }

        // Find recipient
        const recipient = await User.findOne({
            "convergeXWallet.address": toWalletAddress
        });

        if (!recipient) {
            return res.status(404).json({
                success: false,
                message: "Recipient ConvergeX Wallet not found"
            });
        }

        // Perform transfer
        // 1. Deduct from sender
        sender.convergeXWallet.balance[token.toLowerCase()] -= amount;

        // 2. Add to recipient
        recipient.convergeXWallet.balance[token.toLowerCase()] += amount;

        // 3. Record transaction for sender
        sender.walletTransactions.push({
            type: "TRANSFER",
            fromWallet: sender.convergeXWallet.address,
            toWallet: recipient.convergeXWallet.address,
            amount: -amount, // Negative for sender
            token: token.toUpperCase(),
            status: "COMPLETED"
        });

        // 4. Record transaction for recipient
        recipient.walletTransactions.push({
            type: "TRANSFER",
            fromWallet: sender.convergeXWallet.address,
            toWallet: recipient.convergeXWallet.address,
            amount: amount, // Positive for recipient
            token: token.toUpperCase(),
            status: "COMPLETED"
        });

        // 5. Save both users
        await sender.save();
        await recipient.save();

        // 6. Create main transaction records (for Transactions page)
        const senderTransaction = await Transaction.create({
            userId: sender._id,
            fromUser: sender._id,
            toUser: recipient._id,
            fromUpi: sender.convergeXWallet.address,
            toUpi: recipient.convergeXWallet.address,
            amount: amount,
            paymentMethod: "CONVERGEX_WALLET",
            tokenType: token.toUpperCase(),
            walletFrom: sender.convergeXWallet.address,
            walletTo: recipient.convergeXWallet.address,
            note: `ConvergeX Wallet transfer`,
            type: "CRYPTO_TRANSFER",
            status: "COMPLETED",
            transactionId: `CX_${Date.now()}_${sender._id.toString().substr(-6)}`,
            direction: "OUTGOING",
            category: "CRYPTO_SENT"
        });

        const recipientTransaction = await Transaction.create({
            userId: recipient._id,
            fromUser: sender._id,
            toUser: recipient._id,
            fromUpi: sender.convergeXWallet.address,
            toUpi: recipient.convergeXWallet.address,
            amount: amount,
            paymentMethod: "CONVERGEX_WALLET",
            tokenType: token.toUpperCase(),
            walletFrom: sender.convergeXWallet.address,
            walletTo: recipient.convergeXWallet.address,
            note: `ConvergeX Wallet transfer`,
            type: "CRYPTO_TRANSFER",
            status: "COMPLETED",
            transactionId: `CX_${Date.now()}_${recipient._id.toString().substr(-6)}`,
            direction: "INCOMING",
            category: "CRYPTO_RECEIVED"
        });

        res.json({
            success: true,
            message: "Transfer successful",
            transfer: {
                from: sender.convergeXWallet.address,
                to: recipient.convergeXWallet.address,
                amount,
                token,
                transactionId: senderTransaction.transactionId
            },
            senderBalance: sender.convergeXWallet.balance,
            recipientName: recipient.name
        });

    } catch (error) {
        console.error("Transfer error:", error);
        res.status(500).json({
            success: false,
            message: "Transfer failed",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Link MetaMask wallet (public address only) - NEW PHASE 1 ROUTE
 */
router.post("/connect", protect, async (req, res) => {
    try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ message: "Wallet address required" });
        }

        await User.findByIdAndUpdate(req.user._id, {
            walletAddress,
            walletType: "METAMASK",
            walletConnectedAt: new Date(),
        });

        res.json({
            success: true,
            walletAddress,
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to connect wallet" });
    }
});

/**
 * Connect MetaMask wallet (OLD - Deprecated but kept for safety)
 */
router.post("/metamask/connect", protect, async (req, res) => {
    try {
        const { walletAddress } = req.body;

        // Update user with MetaMask address
        await User.findByIdAndUpdate(req.user._id, {
            $set: {
                metamaskWallet: {
                    address: walletAddress,
                    connectedAt: new Date(),
                    isConnected: true
                }
            }
        });

        res.json({
            success: true,
            message: "MetaMask wallet connected"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to connect MetaMask"
        });
    }
});

/**
 * Find user by ConvergeX Wallet address OR MetaMask Address
 */
router.get("/find-by-address/:walletAddress", async (req, res) => {
    try {
        // Search in both ConvergeX wallet and new MetaMask walletAddress
        const user = await User.findOne({
            $or: [
                { "convergeXWallet.address": req.params.walletAddress },
                { "walletAddress": new RegExp(`^${req.params.walletAddress}$`, "i") }
            ]
        }).select("name email convergeXWallet walletAddress");

        if (!user) {
            return res.json({
                success: true,
                found: false,
                message: "Wallet not found"
            });
        }

        res.json({
            success: true,
            found: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                wallet: user.convergeXWallet,
                walletAddress: user.walletAddress
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to find wallet"
        });
    }
});

/**
 * Convert UPI (Bank) to Crypto (ConvergeX Wallet)
 */
router.post("/convert/upi-to-crypto", protect, async (req, res) => {
    try {
        const { amount, token } = req.body; // Amount in INR

        if (!amount || amount <= 0 || !token) {
            return res.status(400).json({ success: false, message: "Invalid amount or token" });
        }

        const user = await User.findById(req.user._id);
        const bankAccount = await BankAccount.findOne({ userId: req.user._id });

        if (!bankAccount) {
            return res.status(404).json({ success: false, message: "Bank account not found" });
        }

        if (bankAccount.balance < amount) {
            return res.status(400).json({ success: false, message: "Insufficient bank balance" });
        }

        // Live Exchange Rate from CoinGecko (via conversion utility)
        let rate;
        try {
            rate = getExchangeRate(token);
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        const cryptoAmount = amount / rate;

        // 1. Deduct INR
        bankAccount.balance -= amount;
        await bankAccount.save();

        // 2. Add Crypto
        user.convergeXWallet.balance[token.toLowerCase()] = (user.convergeXWallet.balance[token.toLowerCase()] || 0) + cryptoAmount;

        // 3. Record Crypto Transaction
        user.walletTransactions.push({
            type: "DEPOSIT",
            fromWallet: "UPI_BANK",
            toWallet: user.convergeXWallet.address,
            amount: cryptoAmount,
            token: token.toUpperCase(),
            status: "COMPLETED"
        });
        await user.save();

        // 4. Record Main Transaction (for dashboard consistency)
        await Transaction.create({
            userId: user._id,
            fromUser: user._id,
            toUser: user._id, // Self
            fromUpi: bankAccount.upiId,
            toUpi: user.convergeXWallet.address,
            amount: amount,
            paymentMethod: "UPI",
            tokenType: token.toUpperCase(),
            note: `Converted ₹${amount} to ${cryptoAmount.toFixed(4)} ${token}`,
            type: "CRYPTO_TRANSFER",
            status: "COMPLETED",
            category: "CONVERSION",
            direction: "OUTGOING" // Money left bank
        });

        res.json({
            success: true,
            message: `Successfully converted ₹${amount} to ${cryptoAmount.toFixed(4)} ${token}`,
            newBankBalance: bankAccount.balance,
            newCryptoBalance: user.convergeXWallet.balance
        });

    } catch (error) {
        console.error("Conversion error:", error);
        res.status(500).json({ success: false, message: "Conversion failed" });
    }
});

/**
 * Convert Crypto (ConvergeX Wallet) to UPI (Bank)
 */
router.post("/convert/crypto-to-upi", protect, async (req, res) => {
    try {
        const { amount, token } = req.body; // Amount in Crypto

        if (!amount || amount <= 0 || !token) {
            return res.status(400).json({ success: false, message: "Invalid amount or token" });
        }

        const user = await User.findById(req.user._id);
        const bankAccount = await BankAccount.findOne({ userId: req.user._id });

        if (!bankAccount) {
            return res.status(404).json({ success: false, message: "Bank account not found" });
        }

        const cryptoBalance = user.convergeXWallet.balance[token.toLowerCase()] || 0;
        if (cryptoBalance < amount) {
            return res.status(400).json({ success: false, message: `Insufficient ${token} balance` });
        }

        // Live Exchange Rate from CoinGecko (via conversion utility)
        let rate;
        try {
            rate = getExchangeRate(token);
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        const inrAmount = amount * rate;

        // 1. Deduct Crypto
        user.convergeXWallet.balance[token.toLowerCase()] -= amount;

        // 2. Record Crypto Transaction
        user.walletTransactions.push({
            type: "WITHDRAWAL",
            fromWallet: user.convergeXWallet.address,
            toWallet: "UPI_BANK",
            amount: -amount,
            token: token.toUpperCase(),
            status: "COMPLETED"
        });
        await user.save();

        // 3. Add INR
        bankAccount.balance += inrAmount;
        await bankAccount.save();

        // 4. Record Main Transaction
        await Transaction.create({
            userId: user._id,
            fromUser: user._id,
            toUser: user._id,
            fromUpi: user.convergeXWallet.address,
            toUpi: bankAccount.upiId,
            amount: inrAmount,
            paymentMethod: "CONVERGEX_WALLET",
            tokenType: token.toUpperCase(),
            note: `Converted ${amount} ${token} to ₹${inrAmount.toFixed(2)}`,
            type: "CRYPTO_TRANSFER",
            status: "COMPLETED",
            category: "CONVERSION",
            direction: "INCOMING" // Money entered bank
        });

        res.json({
            success: true,
            message: `Successfully converted ${amount} ${token} to ₹${inrAmount.toFixed(2)}`,
            newBankBalance: bankAccount.balance,
            newCryptoBalance: user.convergeXWallet.balance
        });

    } catch (error) {
        console.error("Conversion error:", error);
        res.status(500).json({ success: false, message: "Conversion failed" });
    }
});

export default router;
