'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

import { Check, Copy, CreditCard, Globe, Lock, Trash2, Users } from 'lucide-react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { api } from '@/convex/_generated/api'
import { useAppRouter } from '@/hooks/use-app-router'

import { useGroupContext } from '../context/group-context'
import { JoinGroupButton } from './join-group-button'
import { formatGroupPriceLabel } from '../utils/price'

type GroupSidebarProps = {
  onEdit?: () => void
}

function formatMemberLabel(count: number) {
  return count === 1 ? 'member' : 'members'
}

function formatCreatorName({
  displayName,
  handle,
  walletAddress
}: {
  displayName?: string | null
  handle?: string | null
  walletAddress?: string | null
}) {
  if (displayName) return displayName
  if (handle) return handle
  if (!walletAddress) return 'Unknown creator'
  return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
}

export function GroupSidebar({ onEdit }: GroupSidebarProps) {
  const router = useAppRouter()
  const removeGroup = useMutation(api.groups.remove)
  const { group, owner, isOwner, memberCount } = useGroupContext()
  const totalMembers =
    typeof memberCount === 'number'
      ? memberCount
      : group.memberNumber ?? 0
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  const groupUrl = origin ? `${origin}/${group._id}` : `/${group._id}`

  const handleEditClick = () => {
    if (onEdit) {
      onEdit()
      return
    }

    router.push(`/${group._id}/edit`)
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(groupUrl)
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy link')
    }
  }

  const privacy =
    group.visibility === 'public'
      ? { icon: Globe, label: 'Public group' }
      : { icon: Lock, label: 'Private group' }

  const priceLabel = formatGroupPriceLabel(
    group.price,
    group.billingCadence,
    { includeCadence: true }
  )

  const handleDeleteGroup = async () => {
    if (isDeleting) {
      return
    }

    if (!owner?.walletAddress) {
      toast.error('Group owner wallet not available. Unable to delete.')
      return
    }

    try {
      setIsDeleting(true)
      await removeGroup({
        groupId: group._id,
        ownerAddress: owner.walletAddress
      })

      toast.success('Group deleted successfully.')
      setDeleteDialogOpen(false)
      router.push('/groups')
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to delete group. Please try again.'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <aside className='w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm'>
      {group.thumbnailUrl ? (
        <div className='relative aspect-video w-full overflow-hidden rounded-lg'>
          <Image
            src={group.thumbnailUrl}
            alt={`${group.name} thumbnail`}
            fill
            sizes='(max-width: 768px) 100vw, 320px'
            className='object-cover'
          />
        </div>
      ) : (
        <div className='flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-muted-foreground'>
          <span className='text-xs font-medium uppercase tracking-wide'>
            No thumbnail
          </span>
        </div>
      )}

      <div className='space-y-3'>
        <h2 className='text-2xl font-bold text-foreground'>{group.name}</h2>

        {/* Modern URL display with copy button */}
        <div className='group relative flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 transition-colors hover:bg-muted/50'>
          <div className='flex-1 overflow-hidden'>
            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
              Group Link
            </p>
            <p className='truncate text-sm font-mono text-foreground'>
              {groupUrl}
            </p>
          </div>
          <button
            onClick={handleCopyUrl}
            className='flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-all hover:bg-primary/20 hover:scale-105 active:scale-95'
            title='Copy link'
          >
            {copied ? (
              <Check className='h-4 w-4' />
            ) : (
              <Copy className='h-4 w-4' />
            )}
          </button>
        </div>
      </div>

      <p className='text-sm leading-relaxed text-foreground'>
        {group.shortDescription ?? 'No summary provided yet.'}
      </p>

      <div className='grid grid-cols-3 gap-4 border-t border-border pt-4 text-center'>
        <div>
          <div className='text-xl font-bold text-foreground'>{totalMembers}</div>
          <div className='text-xs text-muted-foreground'>Members</div>
        </div>
        <div>
          <div className='text-xl font-bold text-foreground'>0</div>
          <div className='text-xs text-muted-foreground'>Online</div>
        </div>
        <div>
          <div className='text-xl font-bold text-foreground'>1</div>
          <div className='text-xs text-muted-foreground'>Admins</div>
        </div>
      </div>

      {isOwner ? (
        <div className='space-y-3'>
          <Button
            className='w-full uppercase'
            variant='secondary'
            onClick={handleEditClick}
          >
            Edit group details
          </Button>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className='w-full uppercase bg-destructive text-destructive-foreground hover:bg-destructive/80'
                variant='destructive'
                disabled={isDeleting}
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Delete group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this group?</DialogTitle>
                <DialogDescription>
                  This action permanently removes the group, its members, classroom content, posts, and stored media. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  type='button'
                  variant='destructive'
                  className='bg-destructive text-destructive-foreground hover:bg-destructive/80'
                  onClick={handleDeleteGroup}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting…' : 'Delete group'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <JoinGroupButton />
      )}
    </aside>
  )
}
