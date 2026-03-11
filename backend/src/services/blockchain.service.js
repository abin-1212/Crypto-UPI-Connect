/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — Blockchain Service (Sepolia)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Core service for all on-chain interactions:
 *   - Verify lock transactions
 *   - Release tokens from escrow
 *   - Query on-chain balances
 *   - Estimate gas
 *   - Verify wallet signatures
 *
 *  Uses ethers.js v5 with Alchemy/Infura provider.
 * ═══════════════════════════════════════════════════════════════
 */

import { ethers } from "ethers";
import {
  ESCROW_ABI,
  ERC20_ABI,
  SEPOLIA_CHAIN_ID,
  BLOCK_EXPLORER,
} from "../config/contracts.js";

class BlockchainService {
  constructor() {
    this.provider = null;
    this.serverWallet = null;
    this.escrowContract = null;
    this.tokenContract = null;
    this.minConfirmations = 2;
    this.initialized = false;
  }

  /**
   * Initialize the blockchain service.
   * Call once after environment is loaded.
   */
  init() {
    if (this.initialized) return;

    const rpcUrl = process.env.ALCHEMY_SEPOLIA_URL;
    if (!rpcUrl) {
      console.warn("⚠️  ALCHEMY_SEPOLIA_URL not set — blockchain features disabled");
      return;
    }

    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    if (process.env.SERVER_WALLET_PRIVATE_KEY) {
      this.serverWallet = new ethers.Wallet(
        process.env.SERVER_WALLET_PRIVATE_KEY,
        this.provider
      );
      console.log(`⛓️  Server wallet: ${this.serverWallet.address}`);
    } else {
      console.warn("⚠️  SERVER_WALLET_PRIVATE_KEY not set — release operations disabled");
    }

    if (process.env.ESCROW_CONTRACT_ADDRESS) {
      this.escrowContract = new ethers.Contract(
        process.env.ESCROW_CONTRACT_ADDRESS,
        ESCROW_ABI,
        this.serverWallet || this.provider
      );
    }

    if (process.env.MOCK_TOKEN_ADDRESS) {
      this.tokenContract = new ethers.Contract(
        process.env.MOCK_TOKEN_ADDRESS,
        ERC20_ABI,
        this.serverWallet || this.provider
      );
    }

    this.minConfirmations = parseInt(process.env.MIN_CONFIRMATIONS || "1");
    this.initialized = true;
    console.log("⛓️  Blockchain service initialized (Sepolia)");
  }

  /** Ensure service is initialized before use. */
  _requireInit() {
    if (!this.initialized) {
      throw new Error("Blockchain service not initialized. Call init() first.");
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  TRANSACTION VERIFICATION
  // ═══════════════════════════════════════════════════════════

  /**
   * Verify a lockForUPI transaction on-chain.
   *
   * @param {string} txHash          — Transaction hash
   * @param {string} expectedSender  — Expected sender address
   * @param {string} expectedAmount  — Expected amount (human-readable, e.g. "100")
   * @param {string} expectedOffchainId — Expected offchain ID
   * @returns {Object} Verification result with block data
   */
  async verifyLockTransaction(txHash, expectedSender, expectedAmount, expectedOffchainId) {
    this._requireInit();

    // 1. Fetch receipt (with retries — RPC nodes may have slight indexing delay)
    let receipt = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      receipt = await this.provider.getTransactionReceipt(txHash);
      if (receipt) break;
      console.log(`⏳ Receipt not found yet, retry ${attempt + 1}/5...`);
      await new Promise(r => setTimeout(r, 3000));
    }
    if (!receipt) {
      throw new Error("Transaction not found on-chain after retries. It may still be pending.");
    }

    // 2. Check on-chain success
    if (receipt.status !== 1) {
      throw new Error("Transaction reverted on-chain");
    }

    // 3. Verify target is escrow contract
    if (
      receipt.to.toLowerCase() !==
      process.env.ESCROW_CONTRACT_ADDRESS.toLowerCase()
    ) {
      throw new Error("Transaction was not sent to the escrow contract");
    }

    // 4. Parse CryptoLocked event from logs
    const iface = new ethers.utils.Interface(ESCROW_ABI);
    let lockEvent = null;

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed.name === "CryptoLocked") {
          lockEvent = parsed;
          break;
        }
      } catch {
        // Not our event, skip
      }
    }

    if (!lockEvent) {
      throw new Error("CryptoLocked event not found in transaction logs");
    }

    // 5. Verify sender
    if (lockEvent.args.user.toLowerCase() !== expectedSender.toLowerCase()) {
      throw new Error(
        `Sender mismatch: expected ${expectedSender}, got ${lockEvent.args.user}`
      );
    }

    // 6. Verify amount
    const expectedWei = ethers.utils.parseEther(expectedAmount.toString());
    if (!lockEvent.args.amount.eq(expectedWei)) {
      throw new Error(
        `Amount mismatch: expected ${expectedAmount}, got ${ethers.utils.formatEther(lockEvent.args.amount)}`
      );
    }

    // 7. Verify offchainId
    if (lockEvent.args.offchainId !== expectedOffchainId) {
      throw new Error(
        `OffchainId mismatch: expected ${expectedOffchainId}, got ${lockEvent.args.offchainId}`
      );
    }

    // 8. Wait for minimum confirmations
    let confirmations = 0;
    const currentBlock = await this.provider.getBlockNumber();
    confirmations = currentBlock - receipt.blockNumber;

    if (confirmations < this.minConfirmations) {
      await this._waitForConfirmations(txHash, this.minConfirmations);
      const newBlock = await this.provider.getBlockNumber();
      confirmations = newBlock - receipt.blockNumber;
    }

    return {
      verified: true,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      confirmations,
      onChainAmount: ethers.utils.formatEther(lockEvent.args.amount),
      sender: lockEvent.args.user,
      offchainId: lockEvent.args.offchainId,
      timestamp: lockEvent.args.timestamp.toNumber(),
      etherscanUrl: `${BLOCK_EXPLORER}/tx/${receipt.transactionHash}`,
    };
  }

  /**
   * Wait for a transaction to reach N confirmations.
   */
  async _waitForConfirmations(txHash, targetConfirmations, timeoutMs = 300_000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Confirmation timeout after ${timeoutMs}ms`)),
        timeoutMs
      );

      const check = async () => {
        try {
          const receipt = await this.provider.getTransactionReceipt(txHash);
          if (receipt) {
            const currentBlock = await this.provider.getBlockNumber();
            const confs = currentBlock - receipt.blockNumber;
            if (confs >= targetConfirmations) {
              clearTimeout(timeout);
              resolve(receipt);
              return;
            }
          }
          setTimeout(check, 5000); // Poll every 5 seconds
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      };

      check();
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  TOKEN RELEASE (UPI → Crypto)
  // ═══════════════════════════════════════════════════════════

  /**
   * Release tokens from escrow to a user.
   *
   * @param {string} userAddress — Recipient wallet address
   * @param {string} amount      — Human-readable amount (e.g. "100")
   * @returns {Object} Transaction result
   */
  async releaseTokens(userAddress, amount) {
    this._requireInit();

    if (!this.serverWallet) {
      throw new Error("Server wallet not configured for release operations");
    }

    const amountWei = ethers.utils.parseEther(amount.toString());

    // Check escrow has enough balance
    const escrowBal = await this.tokenContract.balanceOf(
      process.env.ESCROW_CONTRACT_ADDRESS
    );
    if (escrowBal.lt(amountWei)) {
      throw new Error(
        `Insufficient escrow balance: ${ethers.utils.formatEther(escrowBal)} < ${amount}`
      );
    }

    const tx = await this.escrowContract.release(userAddress, amountWei);
    const receipt = await tx.wait(this.minConfirmations);

    return {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      confirmations: this.minConfirmations,
      etherscanUrl: `${BLOCK_EXPLORER}/tx/${receipt.transactionHash}`,
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  ON-CHAIN QUERIES
  // ═══════════════════════════════════════════════════════════

  /**
   * Get on-chain cxUSDC balance for a wallet.
   */
  async getTokenBalance(walletAddress) {
    this._requireInit();
    const balance = await this.tokenContract.balanceOf(walletAddress);
    return ethers.utils.formatEther(balance);
  }

  /**
   * Get ETH balance (needed for gas).
   */
  async getEthBalance(walletAddress) {
    this._requireInit();
    const balance = await this.provider.getBalance(walletAddress);
    return ethers.utils.formatEther(balance);
  }

  /**
   * Get escrow contract balance.
   */
  async getEscrowBalance() {
    this._requireInit();
    const balance = await this.tokenContract.balanceOf(
      process.env.ESCROW_CONTRACT_ADDRESS
    );
    return ethers.utils.formatEther(balance);
  }

  /**
   * Get locked balance for a specific user.
   */
  async getLockedBalance(walletAddress) {
    this._requireInit();
    const locked = await this.escrowContract.getLockedBalance(walletAddress);
    return ethers.utils.formatEther(locked);
  }

  /**
   * Check if an offchainId has been used.
   */
  async isOffchainIdUsed(offchainId) {
    this._requireInit();
    return this.escrowContract.isOffchainIdUsed(offchainId);
  }

  /**
   * Get transaction receipt by hash.
   */
  async getTransactionReceipt(txHash) {
    this._requireInit();
    return this.provider.getTransactionReceipt(txHash);
  }

  /**
   * Get current block number.
   */
  async getBlockNumber() {
    this._requireInit();
    return this.provider.getBlockNumber();
  }

  // ═══════════════════════════════════════════════════════════
  //  GAS ESTIMATION
  // ═══════════════════════════════════════════════════════════

  /**
   * Estimate gas for a lockForUPI call.
   */
  async estimateLockGas(amount, offchainId) {
    this._requireInit();
    try {
      const amountWei = ethers.utils.parseEther(amount.toString());
      const gasPrice = await this.provider.getGasPrice();

      // Use a static estimate since we can't simulate from another user's context
      const estimatedGas = ethers.BigNumber.from("120000"); // Typical ERC20 approve + lock

      return {
        gasLimit: estimatedGas.toString(),
        gasPriceGwei: ethers.utils.formatUnits(gasPrice, "gwei"),
        estimatedCostWei: estimatedGas.mul(gasPrice).toString(),
        estimatedCostEth: ethers.utils.formatEther(estimatedGas.mul(gasPrice)),
      };
    } catch (error) {
      return {
        gasLimit: "120000",
        gasPriceGwei: "0",
        estimatedCostWei: "0",
        estimatedCostEth: "0",
        error: error.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  WALLET SIGNATURE VERIFICATION
  // ═══════════════════════════════════════════════════════════

  /**
   * Verify a signed message and return the recovered address.
   */
  verifySignature(message, signature) {
    return ethers.utils.verifyMessage(message, signature);
  }

  /**
   * Verify a signed message matches an expected address.
   */
  verifySignatureMatches(message, signature, expectedAddress) {
    const recovered = this.verifySignature(message, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  }

  /**
   * Generate the signing message for wallet verification.
   */
  static generateSignMessage(nonce) {
    return `ConvergeX Pay — Verify wallet ownership\n\nNonce: ${nonce}\n\nThis signature does not trigger a blockchain transaction or cost any gas.`;
  }

  // ═══════════════════════════════════════════════════════════
  //  PROVIDER ACCESS (for listener & advanced use)
  // ═══════════════════════════════════════════════════════════

  getProvider() {
    this._requireInit();
    return this.provider;
  }

  getEscrowContract() {
    this._requireInit();
    return this.escrowContract;
  }
}

// Singleton
const blockchainService = new BlockchainService();
export default blockchainService;
