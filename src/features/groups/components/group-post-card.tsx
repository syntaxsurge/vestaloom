'use client'

import { useState } from 'react'

import { formatDistanceToNow } from 'date-fns'
import { PencilLine, ThumbsUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from '@/components/ui/avatar'
import { useApiMutation } from '@/hooks/use-api-mutation'
import { useCurrentUser } from '@/hooks/use-current-user'
import { cn } from '@/lib/utils'

import { GroupPostContent } from './group-post-content'
import { useGroupContext } from '@/features/groups/context/group-context'
import { Badge } from '@/components/ui/badge'

type GroupPostCardProps = {
  post: Doc<'posts'> & {
    likes: Doc<'likes'>[]
    comments: Doc<'comments'>[]
    author: Doc<'users'>
  }
  className?: string
}

export function GroupPostCard({ post, className }: GroupPostCardProps) {
  const { currentUser, address } = useCurrentUser()
  const { group, owner, administrators } = useGroupContext()

  const { mutate: likePost, pending: isLiking } = useApiMutation(api.likes.add)
  const { mutate: removePost, pending: isRemoving } = useApiMutation(
    api.posts.remove
  )
  const { mutate: updatePost, pending: isUpdating } = useApiMutation(
    api.posts.updateContent
  )

  const isOwner = currentUser?._id === post.author._id
  const isAuthorGroupOwner = post.author._id === owner?._id
  const isAuthorAdmin = administrators.some(
    admin => admin.user._id === post.author._id
  )

  const authorAddress = post.author.walletAddress as `0x${string}`
  const authorLabel =
    post.author.displayName?.trim() ||
    `${authorAddress.slice(0, 6)}...${authorAddress.slice(-4)}`
  const createdAtLabel = formatDistanceToNow(post._creationTime, {
    addSuffix: true
  })

  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(post.title)
  const [content, setContent] = useState(post.content ?? '')

  const canUpdate =
    Boolean(title.trim()) && Boolean(content.trim()) && !isUpdating && Boolean(address)

  const openEditDialog = () => {
    setTitle(post.title)
    setContent(post.content ?? '')
    setIsEditing(true)
  }

  const handleUpdate = async () => {
    if (!address || !canUpdate) return

    try {
      await updatePost({
        id: post._id,
        title: title.trim(),
        content: content.trim(),
        address
      })
      setIsEditing(false)
      toast.success('Post updated')
    } catch (error) {
      toast.error('Unable to update post, please retry.')
    }
  }

  return (
    <article
      className={cn(
        'relative rounded-xl border border-border bg-card p-6',
        className
      )}
    >
      <div className='space-y-4'>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <Avatar className='h-10 w-10'>
              {post.author.avatarUrl ? (
                <AvatarImage src={post.author.avatarUrl} alt={authorLabel} />
              ) : null}
              <AvatarFallback className='text-sm font-semibold'>
                {authorLabel.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className='flex flex-col'>
              <div className='flex items-center gap-2'>
                <p className='text-sm font-semibold text-foreground'>{authorLabel}</p>
                {isAuthorGroupOwner && (
                  <Badge variant='default' className='h-5 px-2 text-xs'>
                    Owner
                  </Badge>
                )}
                {!isAuthorGroupOwner && isAuthorAdmin && (
                  <Badge variant='outline' className='h-5 px-2 text-xs'>
                    Admin
                  </Badge>
                )}
              </div>
              <span className='text-xs text-muted-foreground'>{createdAtLabel}</span>
            </div>
          </div>

          {isOwner && (
            <div className='flex items-center gap-1'>
              <button
                type='button'
                onClick={openEditDialog}
                className='rounded-md p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground'
                aria-label='Edit post'
              >
                <PencilLine className='h-4 w-4' />
              </button>
              <button
                type='button'
                onClick={() => {
                  if (!address || isRemoving) return
                  removePost({ id: post._id, address })
                }}
                className='rounded-md p-2 text-muted-foreground transition hover:bg-secondary hover:text-destructive'
                aria-label='Delete post'
              >
                <Trash2 className='h-4 w-4' />
              </button>
            </div>
          )}
        </div>

        <div className='space-y-2'>
          <h2 className='text-lg font-bold text-foreground'>{post.title}</h2>
          <GroupPostContent content={post.content} />
        </div>

        <div className='flex items-center gap-6 border-t border-border pt-3 text-sm text-muted-foreground'>
          <button
            type='button'
            className='flex items-center gap-2 transition hover:text-foreground'
            onClick={() => {
              if (!address || isLiking) return
              likePost({ postId: post._id, address })
            }}
            disabled={!address || isLiking}
          >
            <ThumbsUp className='h-4 w-4' />
            <span className='font-medium'>{post.likes.length}</span>
          </button>

          <span className='font-medium'>{post.comments.length} comments</span>
        </div>
      </div>

      <Dialog
        open={isEditing}
        onOpenChange={open => {
          setIsEditing(open)
          if (!open) {
            setTitle(post.title)
            setContent(post.content ?? '')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
            <DialogDescription>
              Update your title or message before saving changes.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <Input
              placeholder='Post title'
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
            <Textarea
              placeholder='Post content'
              value={content}
              onChange={event => setContent(event.target.value)}
              rows={5}
            />
          </div>

          <div className='flex justify-end gap-3'>
            <DialogClose asChild>
              <Button variant='ghost' type='button' disabled={isUpdating}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type='button'
              onClick={handleUpdate}
              disabled={!canUpdate}
            >
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  )
}
