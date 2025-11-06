import { useEffect, useState } from 'react'

import { useConvex } from 'convex/react'

import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { extractStorageId, isStorageReference } from '@/lib/media'

export function useResolvedMediaUrl(source: string | null | undefined) {
  const convex = useConvex()
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!source) {
      setUrl(null)
      setLoading(false)
      return
    }

    if (!isStorageReference(source)) {
      setUrl(source)
      setLoading(false)
      return
    }

    const storageId = extractStorageId(source) as Id<'_storage'>
    setLoading(true)

    convex
      .query(api.media.getUrl, { storageId })
      .then(({ url: resolved }) => {
        if (!cancelled) {
          setUrl(resolved ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUrl(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [source, convex])

  return { url, loading }
}
