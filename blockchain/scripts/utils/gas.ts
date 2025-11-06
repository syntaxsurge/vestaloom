import hre from "hardhat";

/**
 * Returns transaction overrides that set maxPriorityFeePerGas and maxFeePerGas
 * to twice the current network suggestions (plus one wei) for highest inclusion
 * probability.
 *
 * Truffle contracts cannot accept JavaScript BigInt values in tx params,
 * therefore we serialise the 1559 fee fields as 0x-prefixed hexadecimal strings.
 *
 * @param from Optional sender address to embed in the overrides object.
 */
export async function highFeeOverrides(from?: string): Promise<Record<string, unknown>> {
  const feeData = await hre.ethers.provider.getFeeData();

  const basePriority = feeData.maxPriorityFeePerGas ?? feeData.gasPrice ?? 0n;
  const baseMaxFee = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;

  /** Convert bigint → 0x-prefixed hex string */
  const toHex = (v: bigint): `0x${string}` => `0x${v.toString(16)}` as `0x${string}`;

  const overrides: Record<string, unknown> = {
    maxPriorityFeePerGas: toHex(basePriority * 2n + 1n),
    maxFeePerGas: toHex(baseMaxFee * 2n + 1n),
  };

  if (from) overrides.from = from;
  return overrides;
}
