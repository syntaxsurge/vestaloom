import hre from "hardhat";

import { updateEnvLog } from "./utils/logEnv";
import { shouldVerifyNetwork } from "./utils/verify";

async function main() {
  const { ethers, network } = hre;

  console.log(`\n🚀 Deploying RevenueSplitRouter to '${network.name}'…`);

  const factory = await ethers.getContractFactory("RevenueSplitRouter");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`✅ RevenueSplitRouter deployed at ${address}`);

  updateEnvLog("REVENUE_SPLIT_ROUTER_ADDRESS", address);
  updateEnvLog("NEXT_PUBLIC_REVENUE_SPLIT_ROUTER_ADDRESS", address);

  if (shouldVerifyNetwork(network.name)) {
    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments: []
      });
      console.log("🔍 Verification submitted to the Somnia explorer");
    } catch (err) {
      console.warn(
        "⚠️ Verification failed:",
        err instanceof Error ? err.message : err
      );
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
