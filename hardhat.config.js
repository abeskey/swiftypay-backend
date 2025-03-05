require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // Load environment variables

module.exports = {
  solidity: "0.8.19",
  networks: {
    polygon: {
      url: "https://polygon-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY, // Use Infura or Alchemy RPC
      accounts: [`0x${process.env.PRIVATE_KEY}`],  // Load private key from .env
    },
  },
};
