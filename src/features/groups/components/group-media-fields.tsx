'use client'

import { ImageIcon, Link2, Trash2, UploadCloud, X } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FieldError, Path, PathValue, UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import { useConvex } from 'convex/react'

import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { isStorageReference, toStorageSource } from '@/lib/media'

import { MediaDropzone } from './media-dropzone'
import {
  generateGalleryId,
  isValidMediaReference,
  normalizeMediaInput
} from '../utils/media'

type GalleryItem = {
  id: string
  url: string
  source: string
  storageId?: string
}

type InitialMediaItem = {
  source: string
  url?: string | null
  storageId?: string | null
}

type InitialMediaSnapshot = {
  thumbnailSource?: string | null
  thumbnailUrl?: string | null
  gallery?: InitialMediaItem[]
}

export type GroupMediaFormShape = {
  thumbnailUrl?: string | null
  galleryUrls: string[]
}

type GroupMediaFieldsProps<FormValues extends GroupMediaFormShape> = {
  form: UseFormReturn<FormValues>
  requestUploadUrl: () => Promise<{ uploadUrl: string }>
  thumbnailField?: Path<FormValues>
  galleryField?: Path<FormValues>
  maxGalleryItems?: number
  initialMedia?: InitialMediaSnapshot
}

const DEFAULT_MAX_GALLERY_ITEMS = 10

export function GroupMediaFields<FormValues extends GroupMediaFormShape>(
  {
    form,
    requestUploadUrl,
    thumbnailField,
    galleryField,
    maxGalleryItems = DEFAULT_MAX_GALLERY_ITEMS,
    initialMedia
  }: GroupMediaFieldsProps<FormValues>
) {
  const convex = useConvex()
  const thumbnailPath = (thumbnailField ?? ('thumbnailUrl' as Path<FormValues>))
  const galleryPath = (galleryField ?? ('galleryUrls' as Path<FormValues>))
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false)
  const [isUploadingGallery, setIsUploadingGallery] = useState(false)
  const [galleryLinkInput, setGalleryLinkInput] = useState('')
  const thumbnailObjectUrlRef = useRef<string | null>(null)
  const galleryObjectUrlsRef = useRef<string[]>([])

  const initialThumbnailSource = normalizeMediaInput(
    initialMedia?.thumbnailSource ?? (form.getValues(thumbnailPath) as string | undefined | null)
  )

  const initialThumbnailPreview = useMemo(() => {
    const provided = normalizeMediaInput(initialMedia?.thumbnailUrl)
    if (provided) return provided
    if (initialThumbnailSource) return initialThumbnailSource
    return null
  }, [initialMedia?.thumbnailUrl, initialThumbnailSource])

  const initialGalleryItems = useMemo<GalleryItem[]>(() => {
    if (initialMedia?.gallery && initialMedia.gallery.length) {
      const hydrated: GalleryItem[] = []
      initialMedia.gallery.forEach(item => {
        const source = normalizeMediaInput(item.source)
        if (!source) return
        hydrated.push({
          id: generateGalleryId(item.storageId ?? source),
          url: normalizeMediaInput(item.url) || source,
          source,
          storageId: item.storageId ?? undefined
        })
      })
      return hydrated
    }

    const existing = form.getValues(galleryPath) as string[] | undefined
    const hydrated: GalleryItem[] = []
    ;(existing ?? []).forEach(value => {
      const source = normalizeMediaInput(value)
      if (!source) return
      hydrated.push({
        id: generateGalleryId(source),
        url: source,
        source
      })
    })
    return hydrated
  }, [form, galleryPath, initialMedia?.gallery])

  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(initialThumbnailPreview)
  const [thumbnailTab, setThumbnailTab] = useState<'upload' | 'link'>(
    initialThumbnailSource
      ? isStorageReference(initialThumbnailSource)
        ? 'upload'
        : 'link'
      : 'upload'
  )
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(initialGalleryItems)
  const [galleryTab, setGalleryTab] = useState<'upload' | 'links'>(
    initialGalleryItems.length === 0
      ? 'upload'
      : initialGalleryItems.some(item => isStorageReference(item.source))
        ? 'upload'
        : 'links'
  )
  const galleryItemsRef = useRef<GalleryItem[]>(initialGalleryItems)

  useEffect(() => {
    galleryItemsRef.current = galleryItems
  }, [galleryItems])

  useEffect(() => {
    if (!initialMedia) return

    if (thumbnailObjectUrlRef.current) {
      URL.revokeObjectURL(thumbnailObjectUrlRef.current)
      thumbnailObjectUrlRef.current = null
    }

    galleryObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    galleryObjectUrlsRef.current = []

    const nextThumbnailSource = normalizeMediaInput(
      initialMedia.thumbnailSource ?? (form.getValues(thumbnailPath) as string | undefined | null)
    )
    const nextThumbnailPreview = normalizeMediaInput(initialMedia.thumbnailUrl) || (nextThumbnailSource || null)

    form.setValue(
      thumbnailPath,
      nextThumbnailSource as PathValue<FormValues, Path<FormValues>>,
      { shouldDirty: false }
    )
    setThumbnailPreview(nextThumbnailPreview)
    setThumbnailTab(
      nextThumbnailSource
        ? isStorageReference(nextThumbnailSource)
          ? 'upload'
          : 'link'
        : 'upload'
    )

    const nextGalleryItems: GalleryItem[] = []
    ;(initialMedia.gallery ?? []).forEach(item => {
      const source = normalizeMediaInput(item.source)
      if (!source) return
      nextGalleryItems.push({
        id: generateGalleryId(item.storageId ?? source),
        url: normalizeMediaInput(item.url) || source,
        source,
        storageId: item.storageId ?? undefined
      })
    })

    if (nextGalleryItems.length) {
      setGalleryItems(nextGalleryItems)
      galleryItemsRef.current = nextGalleryItems
      form.setValue(
        galleryPath,
        nextGalleryItems.map(item => item.source) as PathValue<FormValues, Path<FormValues>>,
        { shouldDirty: false }
      )
      setGalleryTab(
        nextGalleryItems.some(item => isStorageReference(item.source)) ? 'upload' : 'links'
      )
    } else {
      setGalleryItems([])
      galleryItemsRef.current = []
      form.setValue(
        galleryPath,
        [] as PathValue<FormValues, Path<FormValues>>,
        { shouldDirty: false }
      )
      setGalleryTab('upload')
    }
  }, [form, galleryPath, initialMedia, thumbnailPath])

  useEffect(() => () => {
    if (thumbnailObjectUrlRef.current) {
      URL.revokeObjectURL(thumbnailObjectUrlRef.current)
    }
    galleryObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
  }, [])

  const remainingGallerySlots = maxGalleryItems - galleryItems.length

  const galleryFieldErrors = form.formState.errors[
    galleryPath as keyof typeof form.formState.errors
  ] as unknown

  const galleryErrorMessage = useMemo(() => {
    if (Array.isArray(galleryFieldErrors)) {
      const firstWithMessage = galleryFieldErrors.find(
        (error): error is FieldError => Boolean((error as FieldError)?.message)
      )
      return firstWithMessage?.message
    }

    if (typeof galleryFieldErrors === 'object' && galleryFieldErrors !== null) {
      const fieldError = galleryFieldErrors as FieldError
      if (typeof fieldError.message === 'string') {
        return fieldError.message
      }
    }

    return undefined
  }, [galleryFieldErrors])

  const handleThumbnailFiles = useCallback(
    async (files: File[]) => {
      const file = files[0]
      if (!file) return

      if (!file.type.startsWith('image/')) {
        toast.error('Please choose an image file.')
        return
      }

      try {
        setIsUploadingThumbnail(true)
        const { uploadUrl } = await requestUploadUrl()
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

        const storageId = payload.storageId
        const { url } = await convex.query(api.media.getUrl, {
          storageId: storageId as Id<'_storage'>
        })

        if (thumbnailObjectUrlRef.current) {
          URL.revokeObjectURL(thumbnailObjectUrlRef.current)
          thumbnailObjectUrlRef.current = null
        }

        let resolvedUrl = url ?? null
        if (!resolvedUrl) {
          resolvedUrl = URL.createObjectURL(file)
          thumbnailObjectUrlRef.current = resolvedUrl
        }

        const source = toStorageSource(storageId)
        form.setValue(
          thumbnailPath,
          source as PathValue<FormValues, Path<FormValues>>,
          { shouldDirty: true, shouldValidate: true }
        )
        setThumbnailPreview(resolvedUrl)
        setThumbnailTab('upload')
        toast.success('Thumbnail ready to use.')
      } catch (error) {
        console.error('Thumbnail upload failed', error)
        toast.error('Unable to upload thumbnail. Please try a different image.')
      } finally {
        setIsUploadingThumbnail(false)
      }
    },
    [convex, form, requestUploadUrl, thumbnailPath]
  )

  const handleClearThumbnail = useCallback(() => {
    if (thumbnailObjectUrlRef.current) {
      URL.revokeObjectURL(thumbnailObjectUrlRef.current)
      thumbnailObjectUrlRef.current = null
    }
    setThumbnailPreview(null)
    form.setValue(
      thumbnailPath,
      '' as PathValue<FormValues, Path<FormValues>>,
      { shouldDirty: true, shouldValidate: true }
    )
    setThumbnailTab('link')
  }, [form, thumbnailPath])

  const handleAddGalleryLink = useCallback(() => {
    const trimmed = normalizeMediaInput(galleryLinkInput)
    if (!trimmed) {
      toast.error('Enter a URL before adding it to the gallery.')
      return
    }

    if (!isValidMediaReference(trimmed)) {
      toast.error('Enter a valid image URL.')
      return
    }

    const existingItems = galleryItemsRef.current

    if (existingItems.length >= maxGalleryItems) {
      toast.error(`You can add up to ${maxGalleryItems} gallery assets.`)
      return
    }

    if (existingItems.some(item => item.source === trimmed)) {
      toast.error('This asset is already in your gallery.')
      return
    }

    const nextItems = [
      ...existingItems,
      {
        id: generateGalleryId(trimmed),
        url: trimmed,
        source: trimmed
      }
    ]
    setGalleryItems(nextItems)
    galleryItemsRef.current = nextItems
    form.setValue(
      galleryPath,
      nextItems.map(item => item.source) as PathValue<FormValues, Path<FormValues>>,
      { shouldDirty: true, shouldValidate: true }
    )
    setGalleryLinkInput('')
    setGalleryTab('links')
  }, [form, galleryLinkInput, galleryPath, maxGalleryItems])

  const handleRemoveGalleryItem = useCallback(
    (id: string) => {
      const currentItems = galleryItemsRef.current
      const target = currentItems.find(item => item.id === id)
      if (target) {
        const index = galleryObjectUrlsRef.current.indexOf(target.url)
        if (index >= 0) {
          URL.revokeObjectURL(galleryObjectUrlsRef.current[index])
          galleryObjectUrlsRef.current.splice(index, 1)
        }
      }

      const nextItems = currentItems.filter(item => item.id !== id)
      if (nextItems.length === currentItems.length) {
        return
      }

      setGalleryItems(nextItems)
      galleryItemsRef.current = nextItems
      form.setValue(
        galleryPath,
        nextItems.map(item => item.source) as PathValue<FormValues, Path<FormValues>>,
        { shouldDirty: true, shouldValidate: true }
      )
    },
    [form, galleryPath]
  )

  const handleGalleryFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return
      const currentItems = galleryItemsRef.current
      const remainingSlots = maxGalleryItems - currentItems.length
      if (remainingSlots <= 0) {
        toast.error(`You can add up to ${maxGalleryItems} gallery assets.`)
        return
      }

      const toUpload = files.slice(0, remainingSlots)
      const uploaded: GalleryItem[] = []

      try {
        setIsUploadingGallery(true)
        for (const file of toUpload) {
          if (!file.type.startsWith('image/')) {
            toast.error(`${file.name} is not an image file.`)
            continue
          }

          const { uploadUrl } = await requestUploadUrl()
          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': file.type },
            body: file
          })

          if (!response.ok) {
            toast.error(`Failed to upload ${file.name}.`)
            continue
          }

          const payload = (await response.json()) as { storageId?: string }
          if (!payload.storageId) {
            toast.error(`Upload failed for ${file.name}.`)
            continue
          }

          const storageId = payload.storageId
          const { url } = await convex.query(api.media.getUrl, {
            storageId: storageId as Id<'_storage'>
          })

          let resolvedUrl = url ?? null
          if (!resolvedUrl) {
            resolvedUrl = URL.createObjectURL(file)
            galleryObjectUrlsRef.current.push(resolvedUrl)
          }

          uploaded.push({
            id: generateGalleryId(storageId),
            url: resolvedUrl,
            source: toStorageSource(storageId),
            storageId
          })
        }
      } catch (error) {
        console.error('Gallery upload failed', error)
        toast.error('Unable to upload gallery assets right now.')
      } finally {
        setIsUploadingGallery(false)
      }

      if (!uploaded.length) {
        return
      }

      const nextItems = [...currentItems, ...uploaded]
      setGalleryItems(nextItems)
      galleryItemsRef.current = nextItems
      form.setValue(
        galleryPath,
        nextItems.map(item => item.source) as PathValue<FormValues, Path<FormValues>>,
        { shouldDirty: true, shouldValidate: true }
      )
      setGalleryTab('upload')
      toast.success('Gallery assets added.')
    },
    [convex, form, galleryPath, maxGalleryItems, requestUploadUrl]
  )

  return (
    <div className='space-y-6'>
      <FormField
        control={form.control}
        name={thumbnailPath}
        render={({ field }) => {
          const resolvedValue = typeof field.value === 'string' ? field.value : ''
          return (
            <FormItem>
              <FormLabel>Thumbnail image</FormLabel>
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
                  uploading={isUploadingThumbnail}
                  disabled={isUploadingThumbnail}
                  dropAreaClassName='h-40 w-full overflow-hidden p-0 sm:h-48'
                  onSelect={handleThumbnailFiles}
                >
                  {thumbnailPreview ? (
                    <div className='relative h-full w-full'>
                      <Image
                        src={thumbnailPreview}
                        alt='Group thumbnail preview'
                        fill
                        className='object-cover'
                        sizes='360px'
                      />
                    </div>
                  ) : (
                    <div className='flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground'>
                      <ImageIcon className='h-6 w-6' />
                      <span>Drag & drop an image to represent your group.</span>
                      <span className='text-xs text-muted-foreground'>
                        PNG, JPG, and GIF files are supported.
                      </span>
                    </div>
                  )}
                </MediaDropzone>
                {thumbnailPreview && (
                  <div className='mt-2 flex justify-end'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={handleClearThumbnail}
                      disabled={isUploadingThumbnail}
                    >
                      <X className='mr-2 h-4 w-4' />
                      Remove
                    </Button>
                  </div>
                )}
              </TabsContent>
              <TabsContent value='link'>
                <FormControl>
                  <Input
                    ref={field.ref}
                    name={field.name}
                    placeholder='https://example.com/thumbnail.jpg'
                    value={isStorageReference(resolvedValue) ? '' : resolvedValue}
                    onBlur={field.onBlur}
                    onChange={event => {
                      const nextValue = event.target.value
                      field.onChange(nextValue)
                      const normalized = normalizeMediaInput(nextValue)
                      setThumbnailPreview(normalized || null)
                    }}
                  />
                </FormControl>
                <p className='mt-2 text-xs text-muted-foreground'>
                  Paste a direct image URL. JPG, PNG, or GIF files work best.
                </p>
              </TabsContent>
            </Tabs>
            <FormMessage />
          </FormItem>
          )
        }}
      />

      <FormField
        control={form.control}
        name={galleryPath}
        render={() => (
          <FormItem>
            <FormLabel className='flex items-center justify-between text-sm font-medium'>
              Gallery assets
              <span className='text-xs font-normal text-muted-foreground'>
                {galleryItems.length}/{maxGalleryItems}
              </span>
            </FormLabel>
            <Tabs
              value={galleryTab}
              onValueChange={value => setGalleryTab(value as 'upload' | 'links')}
              className='space-y-3'
            >
              <TabsList className='grid w-full grid-cols-2'>
                <TabsTrigger value='upload' className='flex items-center gap-2'>
                  <UploadCloud className='h-4 w-4' />
                  Upload
                </TabsTrigger>
                <TabsTrigger value='links' className='flex items-center gap-2'>
                  <Link2 className='h-4 w-4' />
                  Links
                </TabsTrigger>
              </TabsList>
              <TabsContent value='upload'>
                <MediaDropzone
                  accept='image/*'
                  multiple
                  uploading={isUploadingGallery}
                  disabled={isUploadingGallery || remainingGallerySlots <= 0}
                  onSelect={handleGalleryFiles}
                >
                  <div className='flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground'>
                    <UploadCloud className='h-6 w-6' />
                    <span>
                      {remainingGallerySlots > 0
                        ? `Drag & drop up to ${remainingGallerySlots} more image${remainingGallerySlots === 1 ? '' : 's'}, or click to browse.`
                        : 'Gallery is full. Remove an asset to add another.'}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      PNG, JPG, and GIF files are supported.
                    </span>
                  </div>
                </MediaDropzone>
              </TabsContent>
              <TabsContent value='links'>
                <div className='space-y-3'>
                  <div className='flex flex-col gap-2 sm:flex-row'>
                    <Input
                      placeholder='https://example.com/gallery-image.png'
                      value={galleryLinkInput}
                      onChange={event => setGalleryLinkInput(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          handleAddGalleryLink()
                        }
                      }}
                    />
                    <Button
                      type='button'
                      onClick={handleAddGalleryLink}
                      disabled={!galleryLinkInput.trim()}
                    >
                      Add link
                    </Button>
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Paste direct image URLs to feature additional media.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {galleryItems.length > 0 ? (
              <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                {galleryItems.map(item => (
                  <div
                    key={item.id}
                    className='group relative overflow-hidden rounded-lg border border-border'
                  >
                    <div className='relative aspect-[4/3] w-full bg-muted'>
                      <Image
                        src={item.url}
                        alt='Gallery asset preview'
                        fill
                        className='object-cover'
                        sizes='250px'
                      />
                    </div>
                    <div className='absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/60 via-black/40 to-transparent p-2 opacity-0 transition group-hover:opacity-100'>
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        onClick={() => handleRemoveGalleryItem(item.id)}
                      >
                        <Trash2 className='mr-1.5 h-3.5 w-3.5' />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='mt-4 rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground'>
                No gallery assets yet. Upload files or paste links to showcase more visuals.
              </div>
            )}

            {galleryErrorMessage && (
              <p className='mt-2 text-sm text-destructive'>{galleryErrorMessage}</p>
            )}

            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
