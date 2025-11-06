import type { Doc } from '@/convex/_generated/dataModel'

type GroupDoc = Doc<'groups'>

/**
 * Attempts to resolve the ERC-1155 course id associated with a group by
 * checking the `subscriptionId` field first, then falling back to tagged metadata.
 */
export function resolveMembershipCourseId(group: GroupDoc): bigint | null {
  const subscriptionId = group.subscriptionId
  if (subscriptionId) {
    const trimmed = subscriptionId.trim()
    if (/^[0-9]+$/.test(trimmed)) {
      try {
        return BigInt(trimmed)
      } catch {
        // ignore parse errors on malformed values
      }
    }
  }

  const tags = group.tags ?? []
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase()
    const match = normalized.match(/^(?:course|pass|membership):([0-9]+)$/)
    if (match) {
      try {
        return BigInt(match[1])
      } catch {
        continue
      }
    }
  }

  return null
}

/**
 * Normalizes on-chain expiry values to millisecond timestamps suitable for Date usage.
 */
export function normalizePassExpiry(
  expiresAt: bigint | number | null | undefined
): number | undefined {
  if (!expiresAt) return undefined
  const numeric = Number(expiresAt)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined
  }
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
}

export function generateMembershipCourseId(): string {
  const timestamp = Date.now().toString()
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')
  return `${timestamp}${random}`
}
