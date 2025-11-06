import { parseUnits } from 'viem'

import { SUBSCRIPTION_PRICE_USDC } from '@/lib/config'

export { SUBSCRIPTION_PRICE_USDC } from '@/lib/config'

const USDC_DECIMALS = 6

export const SUBSCRIPTION_PRICE_LABEL = `${SUBSCRIPTION_PRICE_USDC} USDC/month`

export const SUBSCRIPTION_PRICE_AMOUNT = parseUnits(
  SUBSCRIPTION_PRICE_USDC,
  USDC_DECIMALS
)

export const SUBSCRIPTION_PRICE_NUMBER = Number(SUBSCRIPTION_PRICE_USDC)
