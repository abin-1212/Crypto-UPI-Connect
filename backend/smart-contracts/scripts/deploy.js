/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — Contract Deployment Script (Sepolia)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Usage:
 *    cd backend/smart-contracts
 *    npm install
 *    npx hardhat compile
 *    npx hardhat run scripts/deploy.js --network sepolia
 *
 *  Prerequisites:
 *    - ALCHEMY_SEPOLIA_URL in ../.env
 *    - SERVER_WALLET_PRIVATE_KEY in ../.env
 *    - Sepolia ETH in the deployer wallet (get from faucets)
 * ═══════════════════════════════════════════════════════════════
 */
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("═══════════════════════════════════════════════════");
  console.log("  ConvergeX Pay — Smart Contract Deployment");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Balance  : ${ethers.formatEther(balance)} ETH`);
  console.log(`  Network  : ${(await ethers.provider.getNetwork()).name}`);
  console.log("═══════════════════════════════════════════════════\n");

  // ── 1. Deploy MockCXToken ──────────────────────────────────
  console.log("Deploying MockCXToken (cxUSDC)...");
  const Token = await ethers.getContractFactory("MockCXToken");
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`✅ MockCXToken deployed: ${tokenAddr}\n`);

  // ── 2. Deploy CryptoBridgeEscrow ───────────────────────────
  console.log("Deploying CryptoBridgeEscrow...");
  const Escrow = await ethers.getContractFactory("CryptoBridgeEscrow");
  const escrow = await Escrow.deploy(tokenAddr);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log(`✅ CryptoBridgeEscrow deployed: ${escrowAddr}\n`);

  // ── 3. Fund escrow with liquidity ──────────────────────────
  //    (Needed for UPI → Crypto releases)
  console.log("Funding escrow with 500,000 cxUSDC...");
  const fundAmount = ethers.parseEther("500000");
  const tx = await token.transfer(escrowAddr, fundAmount);
  await tx.wait();
  console.log("✅ Escrow funded with 500,000 cxUSDC\n");

  // ── 4. Verify final state ──────────────────────────────────
  const escrowBal = await token.balanceOf(escrowAddr);
  const deployerBal = await token.balanceOf(deployer.address);

  console.log("═══════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE — Add to backend/.env:");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  MOCK_TOKEN_ADDRESS=${tokenAddr}`);
  console.log(`  ESCROW_CONTRACT_ADDRESS=${escrowAddr}`);
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Escrow Balance   : ${ethers.formatEther(escrowBal)} cxUSDC`);
  console.log(`  Deployer Balance : ${ethers.formatEther(deployerBal)} cxUSDC`);
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
