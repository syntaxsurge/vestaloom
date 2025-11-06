'use client'

import { formatDistanceToNow } from 'date-fns'
import { Trash2 } from 'lucide-react'

import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useApiMutation } from '@/hooks/use-api-mutation'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useGroupContext } from '@/features/groups/context/group-context'
import { cn } from '@/lib/utils'

type GroupCommentCardProps = {
  comment: Doc<'comments'> & { author: Doc<'users'> }
}

export function GroupCommentCard({ comment }: GroupCommentCardProps) {
  const { currentUser, address } = useCurrentUser()
  const { owner, administrators } = useGroupContext()
  const { mutate: removeComment, pending: isRemoving } = useApiMutation(
    api.comments.remove
  )

  const isAuthor = currentUser?._id === comment.authorId
  const isAuthorGroupOwner = comment.author._id === owner?._id
  const isAuthorAdmin = administrators.some(
    admin => admin.user._id === comment.author._id
  )
  const timestamp = formatDistanceToNow(comment._creationTime, {
    addSuffix: true
  })
  const authorAddress = comment.author.walletAddress as `0x${string}`

  const authorLabel =
    comment.author.displayName?.trim() ||
    `${authorAddress.slice(0, 6)}...${authorAddress.slice(-4)}`

  const handleRemove = () => {
    if (!address || isRemoving) return
    removeComment({ id: comment._id, address })
  }

  return (
    <div className='group relative flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50'>
      <Avatar className='h-9 w-9 shrink-0'>
        {comment.author.avatarUrl ? (
          <AvatarImage src={comment.author.avatarUrl} alt={authorLabel} />
        ) : null}
        <AvatarFallback className='text-xs font-semibold bg-primary/10 text-primary'>
          {authorLabel.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className='flex-1 space-y-1 min-w-0'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-sm font-semibold text-foreground'>
            {authorLabel}
          </span>

          {isAuthorGroupOwner && (
            <Badge variant='default' className='h-5 px-2 text-[10px] font-semibold'>
              Owner
            </Badge>
          )}

          {!isAuthorGroupOwner && isAuthorAdmin && (
            <Badge variant='outline' className='h-5 px-2 text-[10px] font-semibold'>
              Admin
            </Badge>
          )}

          <span className='text-xs text-muted-foreground'>
            {timestamp}
          </span>
        </div>

        <p className='text-sm leading-relaxed text-foreground break-words'>
          {comment.content}
        </p>
      </div>

      {isAuthor && (
        <button
          type='button'
          onClick={handleRemove}
          disabled={isRemoving}
          className={cn(
            'shrink-0 rounded-md p-1.5 text-muted-foreground transition-all',
            'opacity-0 group-hover:opacity-100',
            'hover:bg-destructive/10 hover:text-destructive',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label='Delete comment'
        >
          <Trash2 className='h-3.5 w-3.5' />
        </button>
      )}
    </div>
  )
}
