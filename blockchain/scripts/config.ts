/**
 * Vestaloom deployment configuration.
 */

import { getAddress, Wallet } from "ethers";

/* -------------------------------------------------------------------------- */
/*                               H E L P E R S                                */
/* -------------------------------------------------------------------------- */

/** EIP-55-checksum an address and trim stray whitespace. */
function normalise(addr: string): string {
  return getAddress(addr.trim());
}

function parseUintEnv(name: string, fallback?: number): bigint {
  const raw = env[name];
  if (!raw || raw.trim() === "") {
    if (fallback === undefined) {
      throw new Error(`${name} env var is required`);
    }
    return BigInt(fallback);
  }

  try {
    const value = BigInt(raw.trim());
    if (value < 0n) {
      throw new Error(`${name} must be positive`);
    }
    return value;
  } catch (err) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function parseNumberEnv(name: string, fallback?: number): number {
  const raw = env[name];
  if (!raw || raw.trim() === "") {
    if (fallback === undefined) {
      throw new Error(`${name} env var is required`);
    }
    return fallback;
  }

  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/*                              E N V   L O A D                               */
/* -------------------------------------------------------------------------- */

const env = process.env as Record<string, string | undefined>;

/* -------------------------------------------------------------------------- */
/*                             C O R E  R O L E S                             */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the administrator address in the following order:
 *   1. Explicit ADMIN_ADDRESS env var
 *   2. Address derived from PRIVATE_KEY (checksummed)
 */
const privateKey = env.PRIVATE_KEY ?? "";
export const adminAddress = env.ADMIN_ADDRESS
  ? normalise(env.ADMIN_ADDRESS)
  : privateKey.length === 66 || privateKey.length === 64
    ? new Wallet(privateKey).address
    : "";

/* Fail fast if we still have no valid admin address */
if (!adminAddress) {
  throw new Error(
    "ADMIN_ADDRESS env var is missing and PRIVATE_KEY is not set – please supply at least one so deployment scripts can assign ADMIN_ROLE"
  );
}

export const usdcAddress = env.USDC_ADDRESS ? normalise(env.USDC_ADDRESS) : "";
if (!usdcAddress) {
  throw new Error("USDC_ADDRESS env var is required for deployment");
}

export const membershipURI = env.MEMBERSHIP_METADATA_URI;
export const badgeURI = env.BADGE_METADATA_URI;
export const existingMembershipAddress = env.MEMBERSHIP_CONTRACT_ADDRESS
  ? normalise(env.MEMBERSHIP_CONTRACT_ADDRESS)
  : "";

export const existingRegistrarAddress = env.REGISTRAR_ADDRESS
  ? normalise(env.REGISTRAR_ADDRESS)
  : env.NEXT_PUBLIC_REGISTRAR_CONTRACT_ADDRESS
    ? normalise(env.NEXT_PUBLIC_REGISTRAR_CONTRACT_ADDRESS)
    : "";

export const membershipDurationSeconds = parseUintEnv("MEMBERSHIP_DURATION_SECONDS", 60 * 60 * 24 * 30); // 30 days
export const membershipTransferCooldownSeconds = parseUintEnv(
  "MEMBERSHIP_TRANSFER_COOLDOWN_SECONDS",
  60 * 60 * 24
); // 1 day

const treasuryEnv = env.MARKETPLACE_TREASURY_ADDRESS ?? env.PLATFORM_TREASURY_ADDRESS;
export const marketplaceTreasuryAddress = treasuryEnv ? normalise(treasuryEnv) : "";
if (!marketplaceTreasuryAddress) {
  throw new Error("MARKETPLACE_TREASURY_ADDRESS or PLATFORM_TREASURY_ADDRESS must be provided");
}

export const marketplaceFeeBps = parseNumberEnv("MARKETPLACE_FEE_BPS", 250); // 2.5%
export const marketplaceMaxListingDuration = parseUintEnv(
  "MARKETPLACE_MAX_LISTING_DURATION_SECONDS",
  60 * 60 * 24 * 7
); // 7 days
