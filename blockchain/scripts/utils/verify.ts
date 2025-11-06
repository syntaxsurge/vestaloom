// Helper utilities for Hardhat verification checks.

import hre from "hardhat";

/**
 * Determines whether the current deployment network should attempt contract
 * verification on the block-explorer. We only verify when:
 *   • The network is not "hardhat" or "localhost"; and
 *   • An API key is configured for the target explorer.
 */
export function shouldVerifyNetwork(networkName: string): boolean {
  if (["hardhat", "localhost"].includes(networkName)) return false;

  const apiKey = (hre.config as any).etherscan?.apiKey;
  if (!apiKey) return false;

  if (typeof apiKey === "string") {
    return apiKey.trim().length > 0;
  }

  if (typeof apiKey === "object") {
    const key = (apiKey as Record<string, string | undefined>)[networkName];
    return Boolean(key && key.trim().length > 0);
  }

  return false;
}
