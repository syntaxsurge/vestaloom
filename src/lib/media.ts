export const STORAGE_PREFIX = 'storage:'

export function isStorageReference(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(STORAGE_PREFIX)
}

export function toStorageSource(storageId: string) {
  return `${STORAGE_PREFIX}${storageId}`
}

export function extractStorageId(source: string) {
  return isStorageReference(source) ? source.slice(STORAGE_PREFIX.length) : source
}

function parseYouTubeTime(value: string) {
  if (!value) return null
  if (/^\d+$/.test(value)) {
    return Number(value)
  }

  const pattern = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i
  const match = value.match(pattern)
  if (!match) return null
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  const total = hours * 3600 + minutes * 60 + seconds
  return total > 0 ? total : null
}

export function normalizeYouTubeEmbedUrl(input: string | null | undefined) {
  if (!input) return null
  let candidate = input.trim()
  if (!candidate) return null

  if (candidate.toLowerCase().includes('<iframe')) {
    const match = candidate.match(/src\s*=\s*['"]([^'"]+)['"]/i)
    if (match) {
      candidate = match[1]
    }
  }

  try {
    const url = new URL(candidate)
    const hostname = url.hostname.toLowerCase()
    const isYouTube =
      hostname.includes('youtube.com') || hostname.includes('youtu.be')
    if (!isYouTube) {
      return candidate
    }

    let videoId: string | null = null

    if (hostname.includes('youtu.be')) {
      const segments = url.pathname.split('/').filter(Boolean)
      videoId = segments[0] ?? null
    } else if (url.pathname.startsWith('/embed/')) {
      const segments = url.pathname.split('/').filter(Boolean)
      videoId = segments[1] ?? null
    } else if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v')
    } else if (url.pathname.startsWith('/shorts/')) {
      const segments = url.pathname.split('/').filter(Boolean)
      videoId = segments[1] ?? null
    }

    if (!videoId) {
      return candidate
    }

    const params = new URLSearchParams()
    const startParam = url.searchParams.get('t') ?? url.searchParams.get('start')
    const startSeconds = startParam ? parseYouTubeTime(startParam) : null
    if (startSeconds) {
      params.set('start', startSeconds.toString())
    }

    params.set('rel', '0')
    params.set('modestbranding', '1')

    const query = params.toString()
    return `https://www.youtube.com/embed/${videoId}${query ? `?${query}` : ''}`
  } catch {
    return candidate
  }
}
