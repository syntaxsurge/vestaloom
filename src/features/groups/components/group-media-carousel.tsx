'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'

import { PlayCircle } from 'lucide-react'

import { normalizeYouTubeEmbedUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

type MediaKind = 'image' | 'video' | 'youtube'

type MediaItem = {
  url: string
  kind: MediaKind
  thumbnail?: string
  embedUrl?: string
}

type GroupMediaCarouselProps = {
  sources: string[]
  fallbackImage?: string | null
}

function parseYouTubeId(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v')
      if (id) return id
      const pathname = parsed.pathname.split('/')
      return pathname[pathname.length - 1]
    }
    if (parsed.hostname.includes('youtu.be')) {
      const pathname = parsed.pathname.split('/')
      return pathname[pathname.length - 1]
    }
  } catch {
    return null
  }
  return null
}

function detectMediaKind(url: string): MediaItem | null {
  const lower = url.toLowerCase()
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    const id = parseYouTubeId(url)
    if (!id) return null
    return {
      url,
      kind: 'youtube',
      thumbnail: `https://img.youtube.com/vi/${id}/0.jpg`,
      embedUrl: normalizeYouTubeEmbedUrl(url) ?? `https://www.youtube.com/embed/${id}?rel=0`
    }
  }

  const videoExtensions = ['.mp4', '.webm', '.mov', '.m4v', '.ogg']
  if (videoExtensions.some(ext => lower.endsWith(ext))) {
    return { url, kind: 'video' }
  }

  return { url, kind: 'image' }
}

export function GroupMediaCarousel({
  sources,
  fallbackImage
}: GroupMediaCarouselProps) {
  const mediaItems = useMemo(() => {
    const items: MediaItem[] = []
    const visited = new Set<string>()

    for (const source of sources ?? []) {
      const parsed = detectMediaKind(source)
      if (parsed && !visited.has(parsed.url)) {
        items.push(parsed)
        visited.add(parsed.url)
      }
    }

    if (fallbackImage && !visited.has(fallbackImage)) {
      items.push({ url: fallbackImage, kind: 'image' })
      visited.add(fallbackImage)
    }

    return items
  }, [fallbackImage, sources])

  const [activeIndex, setActiveIndex] = useState(0)
  const active = mediaItems[activeIndex]

  if (!active) {
    return (
      <div className='flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-border bg-muted/60 text-sm text-muted-foreground'>
        <PlayCircle className='mb-2 h-6 w-6 text-muted-foreground' />
        Media preview not available for this group yet.
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='overflow-hidden rounded-xl border border-border'>
        {active.kind === 'image' && (
          <div className='relative aspect-video w-full'>
            <Image
              src={active.url}
              alt='Group media'
              fill
              className='object-cover'
              sizes='(max-width: 1024px) 100vw, 720px'
            />
          </div>
        )}

        {active.kind === 'youtube' && active.embedUrl && (
          <iframe
            src={active.embedUrl}
            title='Group media'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
            allowFullScreen
            className='aspect-video h-full w-full'
          />
        )}

        {active.kind === 'video' && (
          <video
            src={active.url}
            controls
            className='aspect-video h-full w-full bg-black'
          />
        )}
      </div>

      {mediaItems.length > 1 && (
        <div className='flex gap-3 overflow-x-auto pb-1'>
          {mediaItems.map((item, index) => {
            const isActive = index === activeIndex
            const key = `${item.kind}-${item.url}-${index}`

            return (
              <button
                type='button'
                key={key}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border transition',
                  isActive ? 'ring-2 ring-ring' : 'opacity-80 hover:opacity-100'
                )}
              >
                {item.kind === 'image' && (
                  <Image
                    src={item.url}
                    alt='Media thumbnail'
                    fill
                    className='object-cover'
                    sizes='96px'
                  />
                )}
                {item.kind !== 'image' && (
                  <>
                    {item.thumbnail ? (
                      <Image
                        src={item.thumbnail}
                        alt='Media thumbnail'
                        fill
                        className='object-cover'
                        sizes='96px'
                      />
                    ) : (
                      <div className='flex h-full w-full items-center justify-center bg-muted text-muted-foreground'>
                        <PlayCircle className='h-6 w-6' />
                      </div>
                    )}
                    <div className='absolute inset-0 flex items-center justify-center bg-black/40 text-white'>
                      <PlayCircle className='h-6 w-6' />
                    </div>
                  </>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
