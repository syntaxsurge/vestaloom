'use client'

import { useState } from 'react'

import { toast } from 'sonner'
import { useAccount } from 'wagmi'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useApiMutation } from '@/hooks/use-api-mutation'

type MemberInviteFormProps = {
  groupId: Id<'groups'>
}

export function MemberInviteForm({ groupId }: MemberInviteFormProps) {
  const [value, setValue] = useState('')
  const { address } = useAccount()
  const { mutate, pending } = useApiMutation(api.users.addToGroup)

  const handleInvite = async () => {
    if (!address) {
      toast.error('Connect your wallet to invite members.')
      return
    }

    if (!value.trim()) {
      toast.error('Enter a wallet address.')
      return
    }

    try {
      await mutate({
        groupId,
        ownerAddress: address,
        memberAddress: value.trim()
      })
      toast.success('Invitation sent!')
      setValue('')
    } catch (error) {
      console.error(error)
      toast.error('Unable to add member. Please try again.')
    }
  }

  return (
    <div className='rounded-2xl border border-border bg-card p-5'>
      <p className='text-sm text-muted-foreground'>
        Invite a member by wallet address.
      </p>

      <div className='mt-3 flex flex-col gap-3 sm:flex-row'>
        <Input
          placeholder='vitalik.base'
          value={value}
          onChange={event => setValue(event.target.value)}
          disabled={pending}
        />
        <Button
          type='button'
          variant='secondary'
          onClick={handleInvite}
          disabled={pending}
        >
          Add member
        </Button>
      </div>
    </div>
  )
}
