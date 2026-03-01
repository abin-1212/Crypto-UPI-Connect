/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — Contract Configuration (ABIs + Addresses)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Human-readable ABIs for ethers.js v5.
 *  Contract addresses loaded from environment variables.
 * ═══════════════════════════════════════════════════════════════
 */

// ─── Chain Config ─────────────────────────────────────────────
export const SEPOLIA_CHAIN_ID = 11155111;
export const CHAIN_NAME = "Sepolia";
export const BLOCK_EXPLORER = "https://sepolia.etherscan.io";

// ─── Contract Addresses (from .env) ──────────────────────────
export const getContractAddresses = () => ({
  token: process.env.MOCK_TOKEN_ADDRESS,
  escrow: process.env.ESCROW_CONTRACT_ADDRESS,
});

// ─── CryptoBridgeEscrow ABI ──────────────────────────────────
export const ESCROW_ABI = [
  // State-changing
  "function lockForUPI(uint256 amount, string calldata offchainId) external",
  "function release(address user, uint256 amount) external",
  "function emergencyWithdraw() external",

  // View
  "function token() external view returns (address)",
  "function lockedBalances(address) external view returns (uint256)",
  "function totalLocked() external view returns (uint256)",
  "function totalReleased() external view returns (uint256)",
  "function owner() external view returns (address)",
  "function getLockedBalance(address user) external view returns (uint256)",
  "function getEscrowBalance() external view returns (uint256)",
  "function isOffchainIdUsed(string calldata offchainId) external view returns (bool)",

  // Events
  "event CryptoLocked(address indexed user, uint256 amount, string offchainId, uint256 timestamp)",
  "event CryptoReleased(address indexed user, uint256 amount, uint256 timestamp)",
  "event EmergencyWithdrawal(address indexed owner, uint256 amount, uint256 timestamp)",
];

// ─── ERC-20 Token ABI (MockCXToken + standard) ───────────────
export const ERC20_ABI = [
  // Standard ERC-20
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",

  // MockCXToken extras
  "function faucet() external",
  "function lastFaucetTime(address) external view returns (uint256)",
  "function FAUCET_AMOUNT() external view returns (uint256)",

  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

export default {
  SEPOLIA_CHAIN_ID,
  CHAIN_NAME,
  BLOCK_EXPLORER,
  ESCROW_ABI,
  ERC20_ABI,
  getContractAddresses,
};
