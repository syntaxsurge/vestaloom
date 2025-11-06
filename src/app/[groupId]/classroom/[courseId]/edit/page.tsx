import type { Id } from '@/convex/_generated/dataModel'
import { CourseEditPageClient } from '@/features/classroom/components/course/course-edit-page-client'

type CourseEditPageProps = {
  params: Promise<{
    groupId: string
    courseId: string
  }>
}

export default async function CourseEditPage({ params }: CourseEditPageProps) {
  const resolvedParams = await params
  const groupId = resolvedParams.groupId as Id<'groups'>
  const courseId = resolvedParams.courseId as Id<'courses'>

  return <CourseEditPageClient groupId={groupId} courseId={courseId} />
}
