'use client'

import { useState } from 'react'

import { useAccount } from 'wagmi'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useApiMutation } from '@/hooks/use-api-mutation'
import { useAppRouter } from '@/hooks/use-app-router'
import { CourseMetadataEditor } from './course/course-metadata-editor'

type CreateCourseDialogProps = {
  groupId: Id<'groups'>
  children: React.ReactNode
}

export function CreateCourseDialog({ groupId, children }: CreateCourseDialogProps) {
  const router = useAppRouter()
  const { mutate: create, pending } = useApiMutation(api.courses.create)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const { address } = useAccount()

  const handleCreate = async () => {
    if (!address) {
      toast.error('Please connect your wallet to create a course')
      return
    }

    if (!title.trim()) {
      toast.error('Please provide a course title')
      return
    }

    try {
      const courseId = await create({
        title: title.trim(),
        description: description.trim(),
        thumbnailUrl,
        groupId,
        address
      })

      setTitle('')
      setDescription('')
      setThumbnailUrl(undefined)
      setOpen(false)
      toast.success('Course created successfully')
      router.push(`/${groupId}/classroom/${courseId}`)
    } catch (error) {
      console.error('Failed to create course', error)
      toast.error('Unable to create course. Please try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Create a Course</DialogTitle>
          <DialogDescription>
            Start building your course. Add modules and lessons after creation.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <CourseMetadataEditor
            mode='create'
            groupId={groupId}
            title={title}
            description={description}
            thumbnailUrl={thumbnailUrl}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onThumbnailChange={setThumbnailUrl}
          />
        </div>

        <div className='flex justify-end gap-3'>
          <DialogClose asChild>
            <Button variant='ghost' type='button' disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type='button'
            onClick={handleCreate}
            disabled={pending || !title.trim() || !address}
          >
            {pending ? 'Creating...' : 'Create Course'}
          </Button>
        </div>

        {!address && (
          <div className='rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive'>
            Please connect your wallet to create a course
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
