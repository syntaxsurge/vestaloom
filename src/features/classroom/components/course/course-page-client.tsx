'use client'

import { useQuery } from 'convex/react'

import { LoadingIndicator } from '@/components/feedback/loading-indicator'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'

import { Curriculum } from './curriculum'

type CoursePageClientProps = {
  groupId: Id<'groups'>
  courseId: Id<'courses'>
}

export function CoursePageClient({
  groupId,
  courseId
}: CoursePageClientProps) {
  type CourseWithRelations = Doc<'courses'> & {
    modules: Array<Doc<'modules'> & { lessons: Doc<'lessons'>[] }>
  }

  const course = useQuery(api.courses.get, {
    id: courseId
  }) as CourseWithRelations | null | undefined

  if (course === undefined) {
    return <LoadingIndicator fullScreen />
  }

  if (course === null) {
    return (
      <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
        Course not found.
      </div>
    )
  }

  return <Curriculum course={course} groupId={groupId} />
}
