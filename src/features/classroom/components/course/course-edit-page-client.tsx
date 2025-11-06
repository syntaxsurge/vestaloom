'use client'

import { useEffect, useState } from 'react'

import { useMutation, useQuery } from 'convex/react'
import {
  CaseSensitive,
  Component,
  Fullscreen,
  Plus,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'

import { LoadingIndicator } from '@/components/feedback/loading-indicator'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { LessonEditorView } from '@/features/classroom/components/course/lesson-editor-view'
import { ModuleNameEditor } from '@/features/classroom/components/course/module-name-editor'
import { CourseMetadataEditor } from '@/features/classroom/components/course/course-metadata-editor'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useAppRouter } from '@/hooks/use-app-router'
import { cn } from '@/lib/utils'

type CourseEditPageClientProps = {
  groupId: Id<'groups'>
  courseId: Id<'courses'>
}

export function CourseEditPageClient({
  groupId,
  courseId
}: CourseEditPageClientProps) {
  type CourseWithRelations = Doc<'courses'> & {
    modules: Array<Doc<'modules'> & { lessons: Doc<'lessons'>[] }>
  }

  const course = useQuery(api.courses.get, {
    id: courseId
  }) as CourseWithRelations | null | undefined

  const updateTitle = useMutation(api.courses.updateTitle)
  const updateDescription = useMutation(api.courses.updateDescription)

  const { currentUser, address } = useCurrentUser()
  const group = useQuery(api.groups.get, { id: groupId })
  const router = useAppRouter()
  const [selectedLesson, setSelectedLesson] = useState<Doc<'lessons'> | null>(
    null
  )
  const [courseTitle, setCourseTitle] = useState('')
  const [courseDescription, setCourseDescription] = useState('')
  const [courseThumbnailUrl, setCourseThumbnailUrl] = useState<string | undefined>(undefined)
  const addLesson = useMutation(api.lessons.add)
  const addModule = useMutation(api.modules.add)
  const removeLesson = useMutation(api.lessons.remove)
  const removeModule = useMutation(api.modules.remove)

  useEffect(() => {
    if (!course) {
      return
    }
    setCourseTitle(course.title ?? '')
    setCourseDescription(course.description ?? '')
    setCourseThumbnailUrl(course.thumbnailUrl)
  }, [course?._id, course?.title, course?.description, course?.thumbnailUrl])

  useEffect(() => {
    if (!course) return
    const lessonStillExists = selectedLesson
      ? course.modules.some(module =>
          module.lessons.some(lesson => lesson._id === selectedLesson._id)
        )
      : false

    if (selectedLesson && !lessonStillExists) {
      setSelectedLesson(null)
    }
  }, [course, selectedLesson])

  useEffect(() => {
    if (!course || selectedLesson) return
    const firstPopulatedModule = course.modules.find(
      module => module.lessons.length > 0
    )
    if (firstPopulatedModule) {
      setSelectedLesson(firstPopulatedModule.lessons[0])
    }
  }, [course?.modules, selectedLesson])

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

  const handleEditClick = () => {
    router.push(`/${groupId}/classroom/${course._id}`)
  }

  const handleTitleChange = async (newTitle: string) => {
    if (!address) return
    try {
      await updateTitle({ title: newTitle, id: course._id, address })
      setCourseTitle(newTitle)
    } catch (error) {
      console.error('Failed to update course title', error)
      toast.error('Unable to update the course title.')
    }
  }

  const handleDescriptionChange = async (newDescription: string) => {
    if (!address) return
    try {
      await updateDescription({
        id: course._id,
        description: newDescription,
        address
      })
      setCourseDescription(newDescription)
    } catch (error) {
      console.error('Failed to update course description', error)
      toast.error('Unable to update the course description.')
    }
  }

  const handleThumbnailChange = (newThumbnailUrl: string | undefined) => {
    setCourseThumbnailUrl(newThumbnailUrl)
  }

  const handleAddLesson = (moduleId: Id<'modules'>) => {
    if (!address) return
    addLesson({ moduleId, address })
  }

  const handleAddModule = (courseIdValue: Id<'courses'>) => {
    if (!address) return
    addModule({ courseId: courseIdValue, address })
  }

  const isOwner = currentUser?._id === group?.ownerId

  if (group === undefined || currentUser === undefined) {
    return <LoadingIndicator fullScreen />
  }

  if (!isOwner) {
    return (
      <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
        Unauthorized
      </div>
    )
  }

  return (
    <div className='flex h-full w-full flex-col gap-4 p-4'>
      <div className='mb-4'>
        <CourseMetadataEditor
          mode='edit'
          courseId={course._id}
          groupId={groupId}
          title={courseTitle}
          description={courseDescription}
          thumbnailUrl={courseThumbnailUrl}
          onTitleChange={handleTitleChange}
          onDescriptionChange={handleDescriptionChange}
          onThumbnailChange={handleThumbnailChange}
          address={address ?? undefined}
        />
      </div>

      <div className='flex h-full w-full flex-col gap-4 md:flex-row'>
        <div className='w-full md:w-1/4'>
          {isOwner && (
            <Button
              onClick={handleEditClick}
              variant='secondary'
              className='mb-10 flex items-center gap-3 text-sm'
            >
              <Fullscreen className='h-4 w-4' />
              <p>Preview</p>
            </Button>
          )}


        {course.modules.map(module => (
          <div key={module._id} className='mb-8'>
            <div className='mb-6 flex items-center gap-3 rounded-md px-3 py-2'>
              <Component className='h-5 w-5 shrink-0 text-muted-foreground' />
              <div className='flex flex-1 items-center justify-center'>
                <ModuleNameEditor
                  id={module._id}
                  name={module.title}
                  key={module._id}
                  ownerAddress={address}
                />
              </div>
              <Button
                variant='ghost'
                className='text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/40 dark:text-red-300 dark:hover:text-red-200'
                onClick={() => {
                  if (!address) return
                  removeModule({ moduleId: module._id, address })
                }}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </div>

            <ul>
              {module.lessons.map(lesson => {
                const isSelected = selectedLesson?._id === lesson._id
                return (
                  <li
                    key={lesson._id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md p-2 pl-4 transition duration-150 ease-in-out',
                      isSelected
                        ? 'bg-primary/10 ring-1 ring-primary/40'
                        : 'hover:bg-muted'
                    )}
                    onClick={() => setSelectedLesson(lesson)}
                  >
                    <CaseSensitive
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    <p
                      className={cn(
                        'flex-1 text-sm font-medium capitalize transition-colors',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {lesson.title}
                    </p>
                    <Button
                      variant='ghost'
                      className='text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/40 dark:text-red-300 dark:hover:text-red-200'
                      onClick={event => {
                        event.stopPropagation()
                        if (!address) return
                        removeLesson({ lessonId: lesson._id, address })
                        if (selectedLesson?._id === lesson._id) {
                          setSelectedLesson(null)
                        }
                      }}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </li>
                )
              })}
            </ul>

            <Button
              variant='ghost'
              onClick={() => handleAddLesson(module._id)}
              className='mt-4 flex w-full items-center gap-2'
            >
              <Plus className='h-4 w-4' />
              <p>Add lesson</p>
            </Button>
          </div>
        ))}
        <Button
          variant='outline'
          onClick={() => handleAddModule(course._id)}
          className='mt-4 flex w-full items-center gap-2'
        >
          <Plus className='h-4 w-4' />
          <p>Add module</p>
        </Button>
      </div>
      <div className='flex-grow space-y-4 md:w-3/4'>
        <div className='rounded-xl border border-border bg-card p-4 shadow-sm'>
          {selectedLesson ? (
            <LessonEditorView lesson={selectedLesson} />
          ) : (
            <div className='flex min-h-[240px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground'>
              <p>Select a lesson from the sidebar to edit its content.</p>
              <p>If this module is empty, add a lesson to begin crafting the curriculum.</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
