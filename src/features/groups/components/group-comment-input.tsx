'use client'

import { useState } from 'react'

import { useAccount } from 'wagmi'
import { Send } from 'lucide-react'

import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useApiMutation } from '@/hooks/use-api-mutation'
import { useCurrentUser } from '@/hooks/use-current-user'

type GroupCommentInputProps = {
  postId: Id<'posts'>
}

export function GroupCommentInput({ postId }: GroupCommentInputProps) {
  const { address } = useAccount()
  const { currentUser } = useCurrentUser()
  const [value, setValue] = useState('')
  const { mutate, pending } = useApiMutation(api.comments.add)

  const canSubmit = Boolean(value.trim()) && Boolean(address) && !pending

  const userAddress = currentUser?.walletAddress as `0x${string}` | undefined
  const userLabel = userAddress
    ? currentUser?.displayName?.trim() ||
      `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
    : 'User'

  const submitComment = async () => {
    if (!canSubmit) return
    await mutate({ postId, content: value.trim(), address })
    setValue('')
  }

  return (
    <div className='flex items-start gap-3'>
      <Avatar className='h-9 w-9 shrink-0'>
        {currentUser?.avatarUrl ? (
          <AvatarImage src={currentUser.avatarUrl} alt={userLabel} />
        ) : null}
        <AvatarFallback className='text-xs font-semibold bg-primary/10 text-primary'>
          {userLabel.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className='flex flex-1 items-center gap-2'>
        <Input
          placeholder='Write a comment...'
          value={value}
          disabled={pending}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submitComment()
            }
          }}
          className='flex-1'
        />
        <Button
          type='button'
          size='icon'
          disabled={!canSubmit}
          onClick={submitComment}
          className='shrink-0'
        >
          <Send className='h-4 w-4' />
        </Button>
      </div>
    </div>
  )
}
