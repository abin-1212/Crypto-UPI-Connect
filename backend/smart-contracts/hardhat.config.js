require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_URL || "",
      accounts:
        process.env.SERVER_WALLET_PRIVATE_KEY
          ? [process.env.SERVER_WALLET_PRIVATE_KEY]
          : [],
      chainId: 11155111,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};
