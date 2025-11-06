import hre from "hardhat";

import {
  adminAddress,
  existingMembershipAddress,
  existingRegistrarAddress,
  marketplaceFeeBps,
  marketplaceMaxListingDuration,
  marketplaceTreasuryAddress,
  usdcAddress
} from "./config";
import { updateEnvLog } from "./utils/logEnv";
import { shouldVerifyNetwork } from "./utils/verify";

async function main() {
  const { ethers, network } = hre;

  if (!existingMembershipAddress) {
    throw new Error("MEMBERSHIP_CONTRACT_ADDRESS env var is required before deploying the marketplace");
  }

  console.log(`\n🚀 Deploying MembershipMarketplace to '${network.name}'…`);
  console.log(`   · admin:      ${adminAddress}`);
  console.log(`   · membership: ${existingMembershipAddress}`);
  console.log(`   · treasury:   ${marketplaceTreasuryAddress}`);
  console.log(`   · fee bps:    ${marketplaceFeeBps}`);
  console.log(`   · max list:   ${marketplaceMaxListingDuration} seconds`);

  const factory = await ethers.getContractFactory("MembershipMarketplace");
  const contract = await factory.deploy(
    usdcAddress,
    existingMembershipAddress,
    adminAddress,
    marketplaceTreasuryAddress,
    marketplaceFeeBps,
    marketplaceMaxListingDuration
  );
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`✅ MembershipMarketplace deployed at ${address}`);

  updateEnvLog("NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS", address);

  const membership = await ethers.getContractAt("MembershipPass1155", existingMembershipAddress);
  const marketplaceRole = await membership.MARKETPLACE_ROLE();
  const tx = await membership.grantRole(marketplaceRole, address);
  await tx.wait();
  console.log("🔑 MARKETPLACE_ROLE granted on MembershipPass1155");

  if (existingRegistrarAddress) {
    const registrar = await ethers.getContractAt("Registrar", existingRegistrarAddress);
    const setTx = await registrar.setMarketplace(address);
    await setTx.wait();
    console.log("🔧 Registrar marketplace set");
  }

  if (shouldVerifyNetwork(network.name)) {
    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments: [
          usdcAddress,
          existingMembershipAddress,
          adminAddress,
          marketplaceTreasuryAddress,
          marketplaceFeeBps,
          marketplaceMaxListingDuration
        ]
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
