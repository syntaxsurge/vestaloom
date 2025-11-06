'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'

import { useMutation } from 'convex/react'
import { ImageIcon, Link2, Pencil, UploadCloud, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { MediaDropzone } from '@/features/groups/components/media-dropzone'
import { useApiMutation } from '@/hooks/use-api-mutation'
import { useAppRouter } from '@/hooks/use-app-router'
import { useResolvedMediaUrl } from '@/hooks/use-resolved-media-url'
import { isStorageReference, toStorageSource } from '@/lib/media'

type CourseMetadataEditorProps = {
  mode: 'create' | 'edit'
  courseId?: Id<'courses'>
  groupId?: Id<'groups'>
  title: string
  description: string
  thumbnailUrl?: string
  onTitleChange: (title: string) => void
  onDescriptionChange: (description: string) => void
  onThumbnailChange?: (thumbnailUrl: string | undefined) => void
  address?: `0x${string}`
}

export function CourseMetadataEditor({
  mode,
  courseId,
  groupId,
  title,
  description,
  thumbnailUrl = '',
  onTitleChange,
  onDescriptionChange,
  onThumbnailChange,
  address
}: CourseMetadataEditorProps) {
  const router = useAppRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(title)
  const [editDescription, setEditDescription] = useState(description)
  const [thumbnailSource, setThumbnailSource] = useState<string>(thumbnailUrl)
  const [thumbnailLinkInput, setThumbnailLinkInput] = useState(
    thumbnailUrl && !isStorageReference(thumbnailUrl) ? thumbnailUrl : ''
  )
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false)
  const [thumbnailTab, setThumbnailTab] = useState<'upload' | 'link'>(
    thumbnailUrl && !isStorageReference(thumbnailUrl) ? 'link' : 'upload'
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const generateUploadUrl = useMutation(api.media.generateUploadUrl)
  const { mutate: updateThumbnail, pending: thumbnailPending } =
    useApiMutation(api.courses.updateThumbnail)
  const { mutate: deleteCourse, pending: deletePending } = useApiMutation(
    api.courses.remove
  )

  const { url: thumbnailPreviewUrl, loading: thumbnailPreviewLoading } =
    useResolvedMediaUrl(thumbnailSource || thumbnailUrl)

  const canRemoveThumbnail = useMemo(
    () => Boolean(thumbnailSource || thumbnailLinkInput.trim()),
    [thumbnailSource, thumbnailLinkInput]
  )

  const applyThumbnailSource = (next: string | null) => {
    const resolved = next ?? ''
    const isLinkSource = Boolean(resolved) && !isStorageReference(resolved)
    setThumbnailSource(resolved)
    setThumbnailLinkInput(isLinkSource ? resolved : '')
    setThumbnailTab(isLinkSource ? 'link' : 'upload')
  }

  const handleThumbnailFiles = async (files: File[]) => {
    const file = files[0]
    if (!file || thumbnailPending || isUploadingThumbnail) {
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }

    const previousSource = thumbnailSource
    try {
      setIsUploadingThumbnail(true)
      const { uploadUrl } = await generateUploadUrl({})
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const payload = (await response.json()) as { storageId?: string }
      if (!payload.storageId) {
        throw new Error('Missing storage id')
      }

      const source = toStorageSource(payload.storageId)

      if (mode === 'edit' && courseId && address && onThumbnailChange) {
        await updateThumbnail({
          id: courseId,
          thumbnailUrl: source,
          address
        })
      }

      applyThumbnailSource(source)
      if (onThumbnailChange) {
        onThumbnailChange(source)
      }
      toast.success('Course thumbnail updated.')
    } catch (error) {
      console.error('Uploading course thumbnail failed', error)
      applyThumbnailSource(previousSource)
      toast.error('Unable to upload that image. Try again with a different file.')
    } finally {
      setIsUploadingThumbnail(false)
    }
  }

  const handleThumbnailLinkCommit = async () => {
    const trimmed = thumbnailLinkInput.trim()
    const previousSource = thumbnailSource

    if (!trimmed) {
      if (!previousSource) return

      if (mode === 'edit' && courseId && address && onThumbnailChange) {
        try {
          await updateThumbnail({
            id: courseId,
            thumbnailUrl: undefined,
            address
          })
          applyThumbnailSource('')
          if (onThumbnailChange) {
            onThumbnailChange(undefined)
          }
          toast.success('Course thumbnail removed.')
        } catch (error) {
          console.error('Removing course thumbnail failed', error)
          applyThumbnailSource(previousSource)
          toast.error('Unable to remove the course thumbnail.')
        }
      } else {
        applyThumbnailSource('')
        if (onThumbnailChange) {
          onThumbnailChange(undefined)
        }
      }
      return
    }

    try {
      const candidate = new URL(trimmed)
      if (!['http:', 'https:'].includes(candidate.protocol)) {
        throw new Error('Unsupported protocol')
      }
    } catch {
      toast.error('Enter a valid image URL that starts with http:// or https://.')
      return
    }

    if (trimmed === previousSource) {
      return
    }

    if (mode === 'edit' && courseId && address && onThumbnailChange) {
      try {
        await updateThumbnail({
          id: courseId,
          thumbnailUrl: trimmed,
          address
        })
        applyThumbnailSource(trimmed)
        if (onThumbnailChange) {
          onThumbnailChange(trimmed)
        }
        toast.success('Course thumbnail updated.')
      } catch (error) {
        console.error('Saving thumbnail URL failed', error)
        applyThumbnailSource(previousSource)
        toast.error('Unable to update the course thumbnail.')
      }
    } else {
      applyThumbnailSource(trimmed)
      if (onThumbnailChange) {
        onThumbnailChange(trimmed)
      }
    }
  }

  const handleClearThumbnail = async () => {
    if (!thumbnailSource) {
      setThumbnailLinkInput('')
      applyThumbnailSource('')
      return
    }

    if (thumbnailPending || isUploadingThumbnail) {
      return
    }

    const previousSource = thumbnailSource

    if (mode === 'edit' && courseId && address && onThumbnailChange) {
      try {
        await updateThumbnail({
          id: courseId,
          thumbnailUrl: undefined,
          address
        })
        applyThumbnailSource('')
        setThumbnailLinkInput('')
        if (onThumbnailChange) {
          onThumbnailChange(undefined)
        }
        toast.success('Course thumbnail removed.')
      } catch (error) {
        console.error('Clearing thumbnail failed', error)
        applyThumbnailSource(previousSource)
        toast.error('Unable to remove the course thumbnail.')
      }
    } else {
      applyThumbnailSource('')
      setThumbnailLinkInput('')
      if (onThumbnailChange) {
        onThumbnailChange(undefined)
      }
    }
  }

  const handleSaveMetadata = () => {
    onTitleChange(editTitle)
    onDescriptionChange(editDescription)
    setDialogOpen(false)
    toast.success('Course metadata updated.')
  }

  const handleDeleteCourse = async () => {
    if (mode !== 'edit') return
    if (!courseId) {
      toast.error('Course identifier missing. Unable to delete.')
      return
    }
    if (!address) {
      toast.error('Connect your wallet to delete this course.')
      return
    }
    if (!groupId) {
      toast.error('Group identifier missing. Unable to delete course.')
      return
    }

    try {
      await deleteCourse({
        courseId,
        address
      })
      toast.success('Course deleted successfully.')
      setDeleteDialogOpen(false)
      setDialogOpen(false)
      router.push(`/${groupId}/classroom`)
      router.refresh()
    } catch (error) {
      console.error('Failed to delete course', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to delete course. Please try again.'
      )
    }
  }

  if (mode === 'create') {
    return (
      <div className='space-y-6'>
        <div className='space-y-2'>
          <label
            htmlFor='course-title'
            className='text-sm font-semibold text-foreground'
          >
            Course Title
          </label>
          <Input
            id='course-title'
            placeholder='e.g., Introduction to Web Development'
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            className='h-12'
          />
          <p className='text-xs text-muted-foreground'>
            Give your course a clear, descriptive title
          </p>
        </div>

        <div className='space-y-2'>
          <label
            htmlFor='course-description'
            className='text-sm font-semibold text-foreground'
          >
            Course Description
          </label>
          <Textarea
            id='course-description'
            placeholder='Describe what learners will gain from this course...'
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            className='min-h-[120px] resize-none'
          />
          <p className='text-xs text-muted-foreground'>
            Explain the key learning outcomes and benefits
          </p>
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-semibold text-foreground'>
            Course Thumbnail
          </label>
          <Tabs
            value={thumbnailTab}
            onValueChange={value => setThumbnailTab(value as 'upload' | 'link')}
            className='space-y-3'
          >
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='upload' className='flex items-center gap-2'>
                <UploadCloud className='h-4 w-4' />
                Upload
              </TabsTrigger>
              <TabsTrigger value='link' className='flex items-center gap-2'>
                <Link2 className='h-4 w-4' />
                Link
              </TabsTrigger>
            </TabsList>
            <TabsContent value='upload'>
              <MediaDropzone
                accept='image/*'
                onSelect={files => {
                  void handleThumbnailFiles(files)
                }}
                disabled={thumbnailPending || isUploadingThumbnail}
                uploading={isUploadingThumbnail}
                dropAreaClassName='min-h-[200px] p-4'
              >
                {thumbnailPreviewLoading ? (
                  <Skeleton className='h-[200px] w-full rounded-lg' />
                ) : thumbnailPreviewUrl ? (
                  <div className='relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted'>
                    <Image
                      src={thumbnailPreviewUrl}
                      alt='Course thumbnail preview'
                      fill
                      className='object-cover'
                      sizes='360px'
                    />
                  </div>
                ) : (
                  <div className='flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground'>
                    <ImageIcon className='h-6 w-6' />
                    <span>Drag & drop an image to represent your course.</span>
                    <span className='text-xs text-muted-foreground'>
                      PNG, JPG, or GIF up to 5MB.
                    </span>
                  </div>
                )}
              </MediaDropzone>
              {canRemoveThumbnail && (
                <div className='mt-2 flex justify-end'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => {
                      void handleClearThumbnail()
                    }}
                    disabled={thumbnailPending || isUploadingThumbnail}
                  >
                    <X className='mr-2 h-4 w-4' />
                    Remove
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value='link'>
              <div className='space-y-2'>
                <Input
                  placeholder='https://example.com/thumbnail.jpg'
                  value={thumbnailLinkInput}
                  onChange={event => setThumbnailLinkInput(event.target.value)}
                  onBlur={() => {
                    void handleThumbnailLinkCommit()
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void handleThumbnailLinkCommit()
                    }
                  }}
                  disabled={thumbnailPending || isUploadingThumbnail}
                />
                <p className='text-xs text-muted-foreground'>
                  Paste a direct image URL. JPG, PNG, or GIF files work best.
                </p>
              </div>
            </TabsContent>
          </Tabs>
          <p className='text-xs text-muted-foreground'>
            Learners see this image in the classroom grid and course overview.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm'>
        <div className='space-y-1'>
          <h2 className='text-lg font-semibold text-foreground'>{title}</h2>
          <p className='text-sm text-muted-foreground line-clamp-2'>
            {description || 'No description provided'}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant='outline'
              size='sm'
              className='ml-4'
              onClick={() => {
                setEditTitle(title)
                setEditDescription(description)
              }}
            >
              <Pencil className='mr-2 h-4 w-4' />
              Edit
            </Button>
          </DialogTrigger>
          <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
            <DialogHeader>
              <DialogTitle>Edit Course Metadata</DialogTitle>
              <DialogDescription>
                Update the course title, description, and thumbnail
              </DialogDescription>
            </DialogHeader>

            <div className='space-y-4'>
              <div className='space-y-2'>
                <label
                  htmlFor='edit-course-title'
                  className='text-sm font-semibold text-foreground'
                >
                  Course Title
                </label>
                <Input
                  id='edit-course-title'
                  placeholder='e.g., Introduction to Web Development'
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                />
              </div>

              <div className='space-y-2'>
                <label
                  htmlFor='edit-course-description'
                  className='text-sm font-semibold text-foreground'
                >
                  Course Description
                </label>
                <Textarea
                  id='edit-course-description'
                  placeholder='Describe what learners will gain from this course...'
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className='space-y-2'>
                <label className='text-sm font-semibold text-foreground'>
                  Course Thumbnail
                </label>
                <Tabs
                  value={thumbnailTab}
                  onValueChange={value => setThumbnailTab(value as 'upload' | 'link')}
                  className='space-y-3'
                >
                  <TabsList className='grid w-full grid-cols-2'>
                    <TabsTrigger value='upload' className='flex items-center gap-2'>
                      <UploadCloud className='h-4 w-4' />
                      Upload
                    </TabsTrigger>
                    <TabsTrigger value='link' className='flex items-center gap-2'>
                      <Link2 className='h-4 w-4' />
                      Link
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value='upload'>
                    <MediaDropzone
                      accept='image/*'
                      onSelect={files => {
                        void handleThumbnailFiles(files)
                      }}
                      disabled={thumbnailPending || isUploadingThumbnail}
                      uploading={isUploadingThumbnail}
                      dropAreaClassName='min-h-[200px] p-4'
                    >
                      {thumbnailPreviewLoading ? (
                        <Skeleton className='h-[200px] w-full rounded-lg' />
                      ) : thumbnailPreviewUrl ? (
                        <div className='relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted'>
                          <Image
                            src={thumbnailPreviewUrl}
                            alt='Course thumbnail preview'
                            fill
                            className='object-cover'
                            sizes='360px'
                          />
                        </div>
                      ) : (
                        <div className='flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground'>
                          <ImageIcon className='h-6 w-6' />
                          <span>Drag & drop an image to represent your course.</span>
                          <span className='text-xs text-muted-foreground'>
                            PNG, JPG, or GIF up to 5MB.
                          </span>
                        </div>
                      )}
                    </MediaDropzone>
                    {canRemoveThumbnail && (
                      <div className='mt-2 flex justify-end'>
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() => {
                            void handleClearThumbnail()
                          }}
                          disabled={thumbnailPending || isUploadingThumbnail}
                        >
                          <X className='mr-2 h-4 w-4' />
                          Remove
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value='link'>
                    <div className='space-y-2'>
                      <Input
                        placeholder='https://example.com/thumbnail.jpg'
                        value={thumbnailLinkInput}
                        onChange={event => setThumbnailLinkInput(event.target.value)}
                        onBlur={() => {
                          void handleThumbnailLinkCommit()
                        }}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void handleThumbnailLinkCommit()
                          }
                        }}
                        disabled={thumbnailPending || isUploadingThumbnail}
                      />
                      <p className='text-xs text-muted-foreground'>
                        Paste a direct image URL. JPG, PNG, or GIF files work best.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            <div className='mt-6 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between'>
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    type='button'
                    variant='destructive'
                    disabled={deletePending}
                  >
                    Delete course
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete this course?</DialogTitle>
                    <DialogDescription>
                      This action removes all modules, lessons, and related posts for this course. It cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className='gap-3 sm:justify-end'>
                    <DialogClose asChild>
                      <Button variant='ghost' type='button' disabled={deletePending}>
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      type='button'
                      variant='destructive'
                      onClick={() => {
                        void handleDeleteCourse()
                      }}
                      disabled={deletePending}
                    >
                      {deletePending ? 'Deleting…' : 'Delete course'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <div className='flex justify-end gap-3 sm:justify-end'>
                <DialogClose asChild>
                  <Button variant='ghost' type='button'>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type='button'
                  onClick={handleSaveMetadata}
                  disabled={!editTitle.trim()}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
