/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — Blockchain Event Listener (Background Worker)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Listens for CryptoLocked / CryptoReleased events on-chain.
 *  Reconciles pending transactions in the database.
 *  Detects orphaned / failed / expired transactions.
 *
 *  This makes the system event-driven, not frontend-trusted.
 * ═══════════════════════════════════════════════════════════════
 */

import { ethers } from "ethers";
import { ESCROW_ABI, BLOCK_EXPLORER } from "../config/contracts.js";
import Transaction from "../models/Transaction.js";

class BlockchainListener {
  constructor() {
    this.provider = null;
    this.escrowContract = null;
    this.isRunning = false;
    this.reconciliationInterval = null;
  }

  /**
   * Start the event listener.
   */
  start() {
    if (this.isRunning) return;

    const rpcUrl = process.env.ALCHEMY_SEPOLIA_URL;
    if (!rpcUrl || !process.env.ESCROW_CONTRACT_ADDRESS) {
      console.warn("⚠️  Blockchain listener not started — missing config");
      return;
    }

    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    this.escrowContract = new ethers.Contract(
      process.env.ESCROW_CONTRACT_ADDRESS,
      ESCROW_ABI,
      this.provider
    );

    this.isRunning = true;
    this._listenForLockEvents();
    this._listenForReleaseEvents();
    this._startReconciliation();

    console.log("⛓️  Blockchain event listener started");
    console.log(`⛓️  Watching escrow: ${process.env.ESCROW_CONTRACT_ADDRESS}`);
  }

  /**
   * Listen for CryptoLocked events in real-time.
   */
  _listenForLockEvents() {
    this.escrowContract.on(
      "CryptoLocked",
      async (user, amount, offchainId, timestamp, event) => {
        const amountFormatted = ethers.utils.formatEther(amount);
        console.log(
          `⛓️  CryptoLocked | ${user} | ${amountFormatted} cxUSDC | offchainId: ${offchainId}`
        );

        try {
          // Find matching pending transaction
          const tx = await Transaction.findOne({
            offchainId,
            status: "PENDING",
          });

          if (tx) {
            tx.txHash = event.transactionHash;
            tx.blockNumber = event.blockNumber;
            tx.onChainAmount = amountFormatted;
            tx.status = "CONFIRMED";
            tx.auditTrail.push({
              action: "EVENT_LOCK_DETECTED",
              timestamp: new Date(),
              details: `CryptoLocked event at block ${event.blockNumber}`,
              txHash: event.transactionHash,
            });
            await tx.save();
            console.log(
              `⛓️  TX ${tx._id} updated to CONFIRMED via event listener`
            );
          }
        } catch (error) {
          console.error("⛓️  Lock event handler error:", error.message);
        }
      }
    );
  }

  /**
   * Listen for CryptoReleased events.
   */
  _listenForReleaseEvents() {
    this.escrowContract.on(
      "CryptoReleased",
      async (user, amount, timestamp, event) => {
        const amountFormatted = ethers.utils.formatEther(amount);
        console.log(
          `⛓️  CryptoReleased | ${user} | ${amountFormatted} cxUSDC`
        );

        try {
          // Find matching transaction with this release txHash
          const tx = await Transaction.findOne({
            releaseTxHash: event.transactionHash,
            status: { $in: ["PENDING", "CONFIRMED"] },
          });

          if (tx) {
            tx.status = "SETTLED";
            tx.auditTrail.push({
              action: "EVENT_RELEASE_DETECTED",
              timestamp: new Date(),
              details: `CryptoReleased event at block ${event.blockNumber}`,
              txHash: event.transactionHash,
            });
            await tx.save();
          }
        } catch (error) {
          console.error("⛓️  Release event handler error:", error.message);
        }
      }
    );
  }

  /**
   * Periodic reconciliation for missed events and stale transactions.
   * Runs every 60 seconds.
   */
  _startReconciliation() {
    this.reconciliationInterval = setInterval(async () => {
      try {
        await this._reconcilePending();
        await this._expireStale();
      } catch (error) {
        console.error("⛓️  Reconciliation error:", error.message);
      }
    }, 60_000);
  }

  /**
   * Check pending transactions that have a txHash but haven't been confirmed.
   */
  async _reconcilePending() {
    const pendingTxs = await Transaction.find({
      status: "PENDING",
      txHash: { $exists: true, $ne: null },
      createdAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) }, // Older than 2 min
    }).limit(20);

    for (const tx of pendingTxs) {
      try {
        const receipt = await this.provider.getTransactionReceipt(tx.txHash);

        if (receipt) {
          const currentBlock = await this.provider.getBlockNumber();
          tx.confirmations = currentBlock - receipt.blockNumber;
          tx.blockNumber = receipt.blockNumber;
          tx.gasUsed = receipt.gasUsed.toString();

          if (receipt.status === 1) {
            const minConf = parseInt(process.env.MIN_CONFIRMATIONS || "2");
            if (tx.confirmations >= minConf) {
              tx.status = "CONFIRMED";
              tx.auditTrail.push({
                action: "RECONCILIATION_CONFIRMED",
                timestamp: new Date(),
                details: `${tx.confirmations} confirmations reached`,
              });
            }
          } else {
            tx.status = "FAILED";
            tx.auditTrail.push({
              action: "TX_REVERTED",
              timestamp: new Date(),
              details: "Transaction reverted on-chain",
            });
          }
          await tx.save();
        }
      } catch (err) {
        console.error(
          `⛓️  Reconciliation error for tx ${tx._id}:`,
          err.message
        );
      }
    }
  }

  /**
   * Expire pending transactions that are too old (no receipt after 30 min).
   */
  async _expireStale() {
    const staleTxs = await Transaction.find({
      status: "PENDING",
      createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) },
    }).limit(10);

    for (const tx of staleTxs) {
      tx.status = "FAILED";
      tx.auditTrail.push({
        action: "TX_EXPIRED",
        timestamp: new Date(),
        details: "No confirmation received within 30 minutes",
      });
      await tx.save();
      console.log(`⛓️  TX ${tx._id} expired (30 min timeout)`);
    }
  }

  /**
   * Stop the listener and clean up.
   */
  stop() {
    if (this.escrowContract) {
      this.escrowContract.removeAllListeners();
    }
    if (this.reconciliationInterval) {
      clearInterval(this.reconciliationInterval);
    }
    this.isRunning = false;
    console.log("⛓️  Blockchain listener stopped");
  }
}

// Singleton
const blockchainListener = new BlockchainListener();
export default blockchainListener;
