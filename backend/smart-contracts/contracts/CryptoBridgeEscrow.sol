// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — CryptoBridgeEscrow
 * ═══════════════════════════════════════════════════════════════
 *
 *  Escrow contract for Crypto ↔ UPI hybrid settlements.
 *
 *  lockForUPI()  — User locks ERC-20 tokens; backend settles INR off-chain.
 *  release()     — Owner releases tokens to user (for UPI → Crypto flow).
 *  emergencyWithdraw() — Owner can drain in emergencies.
 *
 *  Security:
 *   - ReentrancyGuard on all state-changing functions
 *   - offchainId uniqueness prevents double-lock
 *   - SafeERC20 for token interactions
 *   - Ownable for admin functions
 *
 *  Deployed on Ethereum Sepolia Testnet.
 * ═══════════════════════════════════════════════════════════════
 */
contract CryptoBridgeEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────
    IERC20 public immutable token;

    mapping(address => uint256) public lockedBalances;
    mapping(bytes32 => bool) public usedOffchainIds;

    uint256 public totalLocked;
    uint256 public totalReleased;

    // ─── Events ───────────────────────────────────────────────
    event CryptoLocked(
        address indexed user,
        uint256 amount,
        string offchainId,
        uint256 timestamp
    );

    event CryptoReleased(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );

    event EmergencyWithdrawal(
        address indexed owner,
        uint256 amount,
        uint256 timestamp
    );

    // ─── Constructor ──────────────────────────────────────────
    constructor(address _token) {
        require(_token != address(0), "Invalid token address");
        token = IERC20(_token);
    }

    // ─── User: Lock tokens for UPI settlement ─────────────────
    /**
     * @notice Lock ERC-20 tokens in escrow for off-chain UPI settlement.
     * @param amount   Token amount (in wei / smallest unit).
     * @param offchainId  Unique identifier linking to the off-chain transaction.
     */
    function lockForUPI(uint256 amount, string calldata offchainId) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(bytes(offchainId).length > 0, "offchainId required");

        bytes32 idHash = keccak256(abi.encodePacked(offchainId));
        require(!usedOffchainIds[idHash], "Offchain ID already used");

        // Mark as used BEFORE external call (CEI pattern)
        usedOffchainIds[idHash] = true;
        lockedBalances[msg.sender] += amount;
        totalLocked += amount;

        // Transfer tokens from user to this contract
        // Requires prior approval: token.approve(escrowAddress, amount)
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit CryptoLocked(msg.sender, amount, offchainId, block.timestamp);
    }

    // ─── Owner: Release tokens to user (UPI → Crypto) ─────────
    /**
     * @notice Release tokens from escrow to a user.
     * @param user    Recipient address.
     * @param amount  Token amount to release.
     */
    function release(address user, uint256 amount) external onlyOwner nonReentrant {
        require(user != address(0), "Invalid address");
        require(amount > 0, "Amount must be > 0");
        require(
            token.balanceOf(address(this)) >= amount,
            "Insufficient escrow balance"
        );

        totalReleased += amount;

        token.safeTransfer(user, amount);

        emit CryptoReleased(user, amount, block.timestamp);
    }

    // ─── Owner: Emergency drain ───────────────────────────────
    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");

        token.safeTransfer(owner(), balance);

        emit EmergencyWithdrawal(msg.sender, balance, block.timestamp);
    }

    // ─── View helpers ─────────────────────────────────────────
    function getLockedBalance(address user) external view returns (uint256) {
        return lockedBalances[user];
    }

    function getEscrowBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function isOffchainIdUsed(string calldata offchainId) external view returns (bool) {
        return usedOffchainIds[keccak256(abi.encodePacked(offchainId))];
    }
}
