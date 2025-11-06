export function formatDurationShort(seconds: bigint | number): string {
  const value = typeof seconds === 'bigint' ? Number(seconds) : seconds
  if (!Number.isFinite(value) || value <= 0) return '—'

  const days = Math.floor(value / 86_400)
  if (days >= 1) {
    return `${days}d`
  }

  const hours = Math.floor(value / 3_600)
  if (hours >= 1) {
    return `${hours}h`
  }

  const minutes = Math.floor(value / 60)
  if (minutes >= 1) {
    return `${minutes}m`
  }

  return `${value}s`
}

export function formatTimestampRelative(timestamp: bigint | number): string {
  const rawValue = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp
  if (!Number.isFinite(rawValue) || rawValue === 0) return '∅'

  const value =
    rawValue > 1_000_000_000_000 ? Math.floor(rawValue / 1000) : rawValue
  if (!Number.isFinite(value) || value === 0) return '∅'

  const now = Math.floor(Date.now() / 1000)
  const delta = value - now
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (Math.abs(delta) >= 86_400) {
    return formatter.format(Math.round(delta / 86_400), 'day')
  }
  if (Math.abs(delta) >= 3_600) {
    return formatter.format(Math.round(delta / 3_600), 'hour')
  }
  if (Math.abs(delta) >= 60) {
    return formatter.format(Math.round(delta / 60), 'minute')
  }
  return formatter.format(delta, 'second')
}
