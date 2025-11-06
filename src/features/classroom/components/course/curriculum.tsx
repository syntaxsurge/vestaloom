'use client'

import { useState } from 'react'

import { BookCheck, Component, Pen, Type } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { useGroupContext } from '@/features/groups/context/group-context'
import { useAppRouter } from '@/hooks/use-app-router'

import { LessonView } from './lesson-view'

type CurriculumProps = {
  course: Doc<'courses'> & {
    modules: Array<Doc<'modules'> & { lessons: Doc<'lessons'>[] }>
  }
  groupId: Id<'groups'>
}

export function Curriculum({ course, groupId }: CurriculumProps) {
  type ModuleWithLessons = Doc<'modules'> & { lessons: Doc<'lessons'>[] }
  type LessonDoc = Doc<'lessons'>

  const { isOwner } = useGroupContext()
  const router = useAppRouter()
  const [activeLesson, setActiveLesson] = useState<Doc<'lessons'> | null>(
    course.modules[0]?.lessons[0] ?? null
  )

  return (
    <div className='grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]'>
      <aside className='space-y-4 rounded-2xl border border-border bg-card p-4'>
        <div className='flex items-center gap-3'>
          <BookCheck className='h-5 w-5 text-primary' />
          <div>
            <h1 className='text-lg font-semibold text-foreground'>
              {course.title}
            </h1>
            <p className='text-xs text-muted-foreground'>
              {course.modules.length} modules
            </p>
          </div>
        </div>

        {isOwner && (
          <Button
            type='button'
            variant='secondary'
            className='w-full'
            onClick={() =>
              router.push(`/${groupId}/classroom/${course._id}/edit`)
            }
          >
            <Pen className='mr-2 h-4 w-4' /> Edit course
          </Button>
        )}

        <div className='space-y-4'>
          {course.modules.map((module: ModuleWithLessons) => (
            <section key={module._id} className='space-y-2'>
              <div className='flex items-center gap-2 text-sm font-semibold'>
                <Component className='h-4 w-4 text-muted-foreground' />
                <span>{module.title}</span>
              </div>

              <ul className='space-y-1'>
                {module.lessons.map((lesson: LessonDoc) => {
                  const isActive = activeLesson?._id === lesson._id
                  return (
                    <li key={lesson._id}>
                      <button
                        type='button'
                        onClick={() => setActiveLesson(lesson)}
                        className={[
                          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted'
                        ].join(' ')}
                      >
                        <Type className='h-4 w-4' />
                        <span className='truncate'>{lesson.title}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </aside>

      <div className='min-h-[320px] rounded-2xl border border-border bg-card p-6'>
        {activeLesson ? (
          <LessonView lesson={activeLesson} />
        ) : (
          <p className='text-sm text-muted-foreground'>
            Select a lesson to get started.
          </p>
        )}
      </div>
    </div>
  )
}
