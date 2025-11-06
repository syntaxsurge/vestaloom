/**
 * Somnia-specific configuration shared across the app.
 */

const DEFAULT_CHAIN_ID = 50312

export const SOMNIA_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_SOMNIA_CHAIN_ID ?? DEFAULT_CHAIN_ID
) as 50312

export const SOMNIA_RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? process.env.NEXT_PUBLIC_SOMNIA_RPC_URL ?? 'https://dream-rpc.somnia.network'

export const SOMNIA_EXPLORER_URL =
  process.env.NEXT_PUBLIC_SOMNIA_EXPLORER_URL ?? 'https://shannon-explorer.somnia.network'

export const USDC_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS ?? ''

export const PLATFORM_TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS ?? ''

export const MEMBERSHIP_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_MEMBERSHIP_CONTRACT_ADDRESS ?? ''

export const BADGE_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS ?? ''

export const REGISTRAR_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_REGISTRAR_CONTRACT_ADDRESS ?? ''

export const MARKETPLACE_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS ?? ''

export const REVENUE_SPLIT_ROUTER_ADDRESS =
  process.env.NEXT_PUBLIC_REVENUE_SPLIT_ROUTER_ADDRESS ?? ''

export const SUBSCRIPTION_PRICE_USDC =
  process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE_USDC ?? '99'

const DEFAULT_MEMBERSHIP_DURATION_SECONDS = 60 * 60 * 24 * 30
const DEFAULT_MEMBERSHIP_TRANSFER_COOLDOWN_SECONDS = 60 * 60 * 24

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

export const MEMBERSHIP_DURATION_SECONDS = parsePositiveInt(
  process.env.NEXT_PUBLIC_MEMBERSHIP_DURATION_SECONDS,
  DEFAULT_MEMBERSHIP_DURATION_SECONDS
)

export const MEMBERSHIP_TRANSFER_COOLDOWN_SECONDS = parsePositiveInt(
  process.env.NEXT_PUBLIC_MEMBERSHIP_TRANSFER_COOLDOWN_SECONDS,
  DEFAULT_MEMBERSHIP_TRANSFER_COOLDOWN_SECONDS
)
