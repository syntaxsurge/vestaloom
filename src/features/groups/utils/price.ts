const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
})

type BillingCadence = 'free' | 'monthly' | undefined

export function formatGroupPriceLabel(
  price: number | undefined,
  cadence: BillingCadence,
  options?: { includeCadence?: boolean }
) {
  const includeCadence = options?.includeCadence ?? true
  if (!price || price <= 0 || cadence === 'free') {
    return includeCadence ? 'Free' : 'Join for free'
  }
  const amount = USD_FORMATTER.format(price)
  if (!includeCadence) {
    return amount
  }
  const cadenceLabel =
    cadence === 'monthly' || !cadence ? 'month' : cadence
  return `${amount}/${cadenceLabel}`
}
