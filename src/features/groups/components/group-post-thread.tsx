'use client'

import type { Doc } from '@/convex/_generated/dataModel'

import { GroupCommentList } from './group-comment-list'
import { GroupPostCard } from './group-post-card'

type GroupPostThreadProps = {
  post: Doc<'posts'> & {
    likes: Doc<'likes'>[]
    comments: Doc<'comments'>[]
    author: Doc<'users'>
  }
}

export function GroupPostThread({ post }: GroupPostThreadProps) {
  return (
    <div className='space-y-6'>
      <GroupPostCard post={post} />
      <GroupCommentList post={post} />
    </div>
  )
}
