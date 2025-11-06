'use client'

import Image from 'next/image'

import { BookOpen, ChevronRight } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { useAppRouter } from '@/hooks/use-app-router'
import { useResolvedMediaUrl } from '@/hooks/use-resolved-media-url'

type CourseCardProps = {
  groupId: Id<'groups'>
  course: Doc<'courses'> & { thumbnailUrl?: string }
}

export function CourseCard({ groupId, course }: CourseCardProps) {
  const router = useAppRouter()
  const { url: thumbnailUrl, loading } = useResolvedMediaUrl(
    course.thumbnailUrl
  )

  return (
    <article
      className='flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-md'
      onClick={() => router.push(`/${groupId}/classroom/${course._id}`)}
    >
      <div className='relative aspect-video bg-muted'>
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={course.title}
            fill
            className='object-cover'
            sizes='(max-width: 768px) 100vw, 360px'
          />
        ) : loading ? (
          <Skeleton className='h-full w-full rounded-none' />
        ) : (
          <div className='flex h-full w-full items-center justify-center'>
            <BookOpen className='h-12 w-12 text-muted-foreground' />
          </div>
        )}
      </div>

      <div className='flex flex-1 flex-col p-5'>
        <h3 className='text-lg font-bold text-foreground'>
          {course.title}
        </h3>
        <p className='mt-2 line-clamp-2 text-sm text-muted-foreground'>
          {course.description || 'No description provided'}
        </p>

        <div className='mt-auto pt-4'>
          <div className='h-2 w-full overflow-hidden rounded-full bg-secondary'>
            <div className='h-full w-0 bg-primary' />
          </div>
          <p className='mt-2 text-xs font-medium text-muted-foreground'>0%</p>
        </div>
      </div>
    </article>
  )
}
