import hre from "hardhat";

import { adminAddress, badgeURI } from "./config";
import { updateEnvLog } from "./utils/logEnv";
import { shouldVerifyNetwork } from "./utils/verify";

async function main() {
  const { ethers, network } = hre;

  console.log(`\n🚀 Deploying Badge1155 to '${network.name}'…`);
  console.log(`   · admin: ${adminAddress}`);
  console.log(`   · uri:   ${badgeURI}`);

  const factory = await ethers.getContractFactory("Badge1155");
  const contract = await factory.deploy(badgeURI, adminAddress);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`✅ Badge1155 deployed at ${address}`);

  updateEnvLog("NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS", address);

  if (shouldVerifyNetwork(network.name)) {
    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments: [badgeURI, adminAddress],
      });
      console.log("🔍 Verification submitted to the Somnia explorer");
    } catch (err) {
      console.warn("⚠️ Verification failed:", err instanceof Error ? err.message : err);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
