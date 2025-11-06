'use client'

import { useQuery } from 'convex/react'

import { LoadingIndicator } from '@/components/feedback/loading-indicator'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import { GroupMemberCard } from '@/features/groups/components/group-member-card'
import { JoinGroupButton } from '@/features/groups/components/join-group-button'
import { MemberInviteForm } from '@/features/groups/components/member-invite-form'
import { useGroupContext } from '@/features/groups/context/group-context'

type GroupMembersPageProps = {
  params: Promise<{
    groupId: string
  }>
}

export default function GroupMembersPage(_: GroupMembersPageProps) {
  const { group, isOwner, currentUser, access } = useGroupContext()
  const members = useQuery(api.groups.getMembers, {
    id: group._id,
    viewerId: currentUser?._id ?? undefined
  }) as Array<Doc<'users'>> | undefined

  if (!access.members) {
    return (
      <div className='flex flex-col items-center justify-center space-y-6 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center'>
        <div className='space-y-2 max-w-xl'>
          <h2 className='text-xl font-semibold text-foreground'>
            Become a member to view the roster
          </h2>
          <p className='text-sm text-muted-foreground'>
            Member directories, admin tools, and invitations are available once you join.
          </p>
        </div>

        <JoinGroupButton />
      </div>
    )
  }

  if (members === undefined) {
    return <LoadingIndicator fullScreen />
  }

  return (
    <div className='space-y-6'>
      {isOwner && <MemberInviteForm groupId={group._id} />}

      <div className='space-y-4'>
        {members.map(member => (
          <GroupMemberCard key={member._id} member={member} />
        ))}
      </div>
    </div>
  )
}
