// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — Mock ERC-20 Test Token (Sepolia)
 * ═══════════════════════════════════════════════════════════════
 *
 *  A test token for ConvergeX Pay development on Sepolia.
 *  Includes a faucet() function so any user can mint 1,000 tokens
 *  once per hour for testing.
 *
 *  Symbol  : cxUSDC
 *  Decimals: 18
 *  Initial : 10,000,000 minted to deployer
 * ═══════════════════════════════════════════════════════════════
 */
contract MockCXToken is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 1000 * 10 ** 18;
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address => uint256) public lastFaucetTime;

    constructor() ERC20("ConvergeX Test USDC", "cxUSDC") {
        _mint(msg.sender, 10_000_000 * 10 ** 18);
    }

    /**
     * @notice Anyone can call faucet() to receive 1,000 cxUSDC for testing.
     *         Rate-limited to once per hour per address.
     */
    function faucet() external {
        require(
            block.timestamp - lastFaucetTime[msg.sender] >= FAUCET_COOLDOWN,
            "Faucet: wait 1 hour between claims"
        );

        lastFaucetTime[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
