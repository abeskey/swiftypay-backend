const hre = require("hardhat");

async function main() {
  const SwiftyToken = await hre.ethers.getContractFactory("SwiftyToken"); // Replace with your contract name
  const swiftyToken = await SwiftyToken.deploy(); // Deploy contract

  await swiftyToken.deployed();
  console.log(`SwiftyToken deployed to: ${swiftyToken.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
