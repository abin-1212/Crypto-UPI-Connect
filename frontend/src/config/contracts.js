/**
 * ConvergeX — Frontend Contract Configuration (Sepolia)
 *
 * Human-readable ABIs for ethers.js v5.
 * Contract addresses loaded from Vite env vars.
 */

export const SEPOLIA_CHAIN_ID = 11155111;
export const CHAIN_NAME = "Sepolia";
export const BLOCK_EXPLORER = "https://sepolia.etherscan.io";

// Vite exposes env vars via import.meta.env.VITE_*
export const TOKEN_ADDRESS =
  import.meta.env.VITE_MOCK_TOKEN_ADDRESS || "";
export const ESCROW_ADDRESS =
  import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS || "";

/* ───────── ERC-20 ABI (cxUSDC) ───────── */
export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function faucet() external",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

/* ───────── Escrow ABI (CryptoBridgeEscrow) ───────── */
export const ESCROW_ABI = [
  "function lockForUPI(uint256 amount, string calldata offchainId) external",
  "function release(address user, uint256 amount) external",
  "function token() view returns (address)",
  "function lockedBalances(address) view returns (uint256)",
  "function totalLocked() view returns (uint256)",
  "function owner() view returns (address)",
  "function getLockedBalance(address user) view returns (uint256)",
  "function getEscrowBalance() view returns (uint256)",
  "event CryptoLocked(address indexed user, uint256 amount, string offchainId, uint256 timestamp)",
  "event CryptoReleased(address indexed user, uint256 amount, uint256 timestamp)",
];

/* ───────── Sepolia network params for MetaMask ───────── */
export const SEPOLIA_NETWORK_PARAMS = {
  chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
  chainName: "Sepolia Testnet",
  nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://rpc.sepolia.org"],
  blockExplorerUrls: [BLOCK_EXPLORER],
};

/* ───────── Helper: Generate unique offchain ID ───────── */
export const generateOffchainId = () => {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `cx_${ts}_${rand}`;
};
