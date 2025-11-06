import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with:", await deployer.getAddress());

  const questFactory = await ethers.getContractFactory("VestaQuest");
  const quest = await questFactory.deploy();
  await quest.waitForDeployment();

  const badgeFactory = await ethers.getContractFactory("VestaBadge");
  const badge = await badgeFactory.deploy(await deployer.getAddress());
  await badge.waitForDeployment();

  console.log(`VestaQuest deployed to: ${await quest.getAddress()}`);
  console.log(`VestaBadge deployed to: ${await badge.getAddress()}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
