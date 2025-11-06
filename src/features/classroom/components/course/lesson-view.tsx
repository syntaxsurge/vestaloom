import { CaseSensitive, Text } from 'lucide-react'

import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Doc } from '@/convex/_generated/dataModel'
import { normalizeYouTubeEmbedUrl } from '@/lib/media'

interface LessonViewProps {
  lesson: Doc<'lessons'>
}

export const LessonView = ({ lesson }: LessonViewProps) => {
  const embedUrl = normalizeYouTubeEmbedUrl(lesson.youtubeUrl)

  return (
    <div className='space-y-4 rounded-lg border border-border bg-card p-4'>
      <div className='mb-6 flex items-center space-x-3'>
        <CaseSensitive className='text-muted-foreground' />
        <h1 className='text-xl font-semibold capitalize text-foreground'>
          {lesson.title}
        </h1>
      </div>

      <AspectRatio ratio={16 / 9}>
        {embedUrl ? (
          <iframe
            width='100%'
            height='100%'
            src={embedUrl}
            title='YouTube video player'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            allowFullScreen
            referrerPolicy='strict-origin-when-cross-origin'
            loading='lazy'
          ></iframe>
        ) : (
          <div className='flex h-full w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground'>
            Video preview unavailable.
          </div>
        )}
      </AspectRatio>
      <div className='mb-6 mt-3 flex items-center space-x-3'>
        <Text className='mt-3 text-muted-foreground' />
        <p className='text-md mt-3 font-normal text-foreground'>
          {lesson.description}
        </p>
      </div>
    </div>
  )
}
