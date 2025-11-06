'use client'

import { format } from 'date-fns'
import { Calendar } from 'lucide-react'

import type { Doc } from '@/convex/_generated/dataModel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { shortenAddress } from '@/lib/utils'

import { useGroupContext } from '../context/group-context'

type GroupMemberCardProps = {
  member: Doc<'users'>
}

export function GroupMemberCard({ member }: GroupMemberCardProps) {
  const { group } = useGroupContext()
  const joinedAt = format(member._creationTime, 'MMM dd, yyyy')
  const isOwner = group.ownerId === member._id
  const walletAddress = member.walletAddress as `0x${string}`
  const displayLabel = member.displayName ?? shortenAddress(walletAddress)

  return (
    <article className='flex items-start gap-4 rounded-xl border border-border bg-card p-5'>
      <Avatar className='h-14 w-14'>
        <AvatarImage src={member.avatarUrl ?? undefined} alt={displayLabel} />
        <AvatarFallback>{displayLabel.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className='flex-1 space-y-2'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <p className='text-base font-bold text-foreground'>{displayLabel}</p>
            <p className='text-sm text-muted-foreground'>{walletAddress}</p>
            {isOwner && (
              <span className='mt-1 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground'>
                Owner
              </span>
            )}
          </div>
        </div>

        {member.about && (
          <p className='text-sm leading-relaxed text-foreground'>
            {member.about}
          </p>
        )}

        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <Calendar className='h-3.5 w-3.5' />
          <span>Joined {joinedAt}</span>
        </div>
      </div>
    </article>
  )
}
