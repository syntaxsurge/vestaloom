import { formatUnits } from 'viem'

const USDC_DECIMALS = 6

export function formatUSDC(amount: bigint, options?: { minimumFractionDigits?: number }) {
  const value = Number(formatUnits(amount, USDC_DECIMALS))
  return value.toLocaleString('en-US', {
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: 2
  })
}

export function usdc(amount: number | string) {
  return `${amount} USDC`
}
