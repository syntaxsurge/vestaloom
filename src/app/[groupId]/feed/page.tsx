'use client'

import { useQuery } from 'convex/react'

import { LoadingIndicator } from '@/components/feedback/loading-indicator'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import { GroupPostComposer } from '@/features/groups/components/group-post-composer'
import { GroupPostThread } from '@/features/groups/components/group-post-thread'
import { JoinGroupButton } from '@/features/groups/components/join-group-button'
import { useGroupContext } from '@/features/groups/context/group-context'

type PostWithRelations = Doc<'posts'> & {
  likes: Doc<'likes'>[]
  comments: Doc<'comments'>[]
  author: Doc<'users'>
}

export default function GroupFeedPage() {
  const { group, access } = useGroupContext()

  if (!access.feed) {
    return (
      <div className='flex flex-col items-center justify-center space-y-6 rounded-xl border border-border bg-card px-6 py-16 text-center'>
        <div className='space-y-2'>
          <h2 className='text-2xl font-bold text-foreground'>
            Join this group to access the feed
          </h2>
          <p className='text-sm text-muted-foreground'>
            Discussions, announcements, and community threads unlock once you become a member.
          </p>
        </div>

        <JoinGroupButton />
      </div>
    )
  }

  const posts = useQuery(api.posts.list, {
    groupId: group._id
  }) as PostWithRelations[] | undefined

  if (posts === undefined) {
    return <LoadingIndicator fullScreen />
  }

  return (
    <div className='space-y-6'>
      <GroupPostComposer groupId={group._id} />

      <div className='space-y-4'>
        {posts.map(post => (
          <GroupPostThread key={post._id} post={post} />
        ))}
      </div>
    </div>
  )
}
