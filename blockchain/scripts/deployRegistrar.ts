import hre from "hardhat";

import { adminAddress, existingMembershipAddress, usdcAddress } from "./config";
import { updateEnvLog } from "./utils/logEnv";
import { shouldVerifyNetwork } from "./utils/verify";

async function main() {
  const { ethers, network } = hre;

  if (!existingMembershipAddress) {
    throw new Error("MEMBERSHIP_CONTRACT_ADDRESS env var is required to deploy the Registrar");
  }

  console.log(`\n🚀 Deploying Registrar to '${network.name}'…`);
  console.log(`   · admin:      ${adminAddress}`);
  console.log(`   · membership: ${existingMembershipAddress}`);
  console.log(`   · usdc:       ${usdcAddress}`);

  const factory = await ethers.getContractFactory("Registrar");
  const contract = await factory.deploy(usdcAddress, existingMembershipAddress, adminAddress);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`✅ Registrar deployed at ${address}`);

  updateEnvLog("NEXT_PUBLIC_REGISTRAR_CONTRACT_ADDRESS", address);

  const membership = await ethers.getContractAt("MembershipPass1155", existingMembershipAddress);
  const registrarRole = await membership.REGISTRAR_ROLE();
  const tx = await membership.grantRole(registrarRole, address);
  await tx.wait();
  console.log("🔑 REGISTRAR_ROLE granted on MembershipPass1155");

  if (shouldVerifyNetwork(network.name)) {
    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments: [usdcAddress, existingMembershipAddress, adminAddress],
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
