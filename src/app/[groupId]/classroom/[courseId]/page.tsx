import type { Id } from '@/convex/_generated/dataModel'
import { CoursePageClient } from '@/features/classroom/components/course/course-page-client'

type CoursePageProps = {
  params: Promise<{
    groupId: string
    courseId: string
  }>
}

export default async function CoursePage({ params }: CoursePageProps) {
  const resolvedParams = await params
  const groupId = resolvedParams.groupId as Id<'groups'>
  const courseId = resolvedParams.courseId as Id<'courses'>

  return <CoursePageClient groupId={groupId} courseId={courseId} />
}
