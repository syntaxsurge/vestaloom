'use client'

import { useEffect, useRef } from 'react'

import { useQuery } from 'convex/react'
import { MessageCircle } from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'

import { GroupCommentCard } from './group-comment-card'
import { GroupCommentInput } from './group-comment-input'

type GroupCommentListProps = {
  post: Doc<'posts'> & {
    likes: Doc<'likes'>[]
    comments: Doc<'comments'>[]
    author: Doc<'users'>
  }
}

export function GroupCommentList({ post }: GroupCommentListProps) {
  const comments = (useQuery(api.comments.list, { postId: post._id }) ||
    []) as Array<Doc<'comments'> & { author: Doc<'users'> }>
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  return (
    <div className='space-y-4'>
      <div className='rounded-xl border border-border bg-card/50'>
        <div className='border-b border-border px-4 py-3'>
          <div className='flex items-center gap-2'>
            <MessageCircle className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm font-semibold text-foreground'>
              {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
            </span>
          </div>
        </div>

        <div className='p-3'>
          <GroupCommentInput postId={post._id} />
        </div>

        {comments.length > 0 && (
          <ScrollArea className='max-h-[400px] px-1'>
            <div className='space-y-1 pb-2'>
              {comments.map(comment => (
                <GroupCommentCard key={comment._id} comment={comment} />
              ))}
              <div ref={endRef} />
            </div>
          </ScrollArea>
        )}

        {comments.length === 0 && (
          <div className='flex flex-col items-center justify-center py-8 text-center'>
            <MessageCircle className='h-8 w-8 text-muted-foreground/50 mb-2' />
            <p className='text-sm text-muted-foreground'>
              No comments yet. Be the first to comment!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
