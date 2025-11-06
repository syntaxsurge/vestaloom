'use client'

import { extractStorageId, isStorageReference } from '@/lib/media'

export function normalizeMediaInput(value: string | undefined | null) {
  return value?.trim() ?? ''
}

export function isValidMediaReference(value: string | undefined | null) {
  const trimmed = value?.trim()
  if (!trimmed) return true

  if (isStorageReference(trimmed)) {
    return extractStorageId(trimmed).length > 0
  }

  try {
    new URL(trimmed)
    return true
  } catch {
    return false
  }
}

export function generateGalleryId(seed?: string) {
  if (seed) return seed
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `gallery-${Math.random().toString(36).slice(2, 10)}`
}
