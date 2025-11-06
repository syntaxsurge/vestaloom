'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  ShieldCheck,
  Tag,
  Users
} from 'lucide-react'
import { Address } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'

import { formatTimestampRelative } from '@/lib/time'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MEMBERSHIP_CONTRACT_ADDRESS, SOMNIA_EXPLORER_URL } from '@/lib/config'
import { MembershipPassService } from '@/lib/onchain/services/membershipPassService'
import { ACTIVE_CHAIN } from '@/lib/wagmi'
import { GroupDescriptionEditor } from './group-description-editor'
import { GroupMediaCarousel } from './group-media-carousel'
import { useGroupContext } from '../context/group-context'
import { normalizePassExpiry, resolveMembershipCourseId } from '../utils/membership'
import { formatGroupPriceLabel } from '../utils/price'

type CourseVerificationState =
  | { status: 'checking' }
  | { status: 'verified' }
  | { status: 'missing'; message: string }
  | { status: 'error'; message: string }

export function GroupAboutSection() {
  const { group, owner, isOwner, memberCount, membership, currentUser, administrators } = useGroupContext()
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN.id })
  const membershipAddress = useMemo(() => {
    const value = MEMBERSHIP_CONTRACT_ADDRESS?.trim()
    return value ? (value as `0x${string}`) : null
  }, [])
  const membershipService = useMemo(() => {
    if (!publicClient || !membershipAddress) return null
    return new MembershipPassService({
      publicClient: publicClient as any,
      address: membershipAddress
    })
  }, [publicClient, membershipAddress])
  const membershipCourseId = useMemo(() => resolveMembershipCourseId(group), [group])
  const [passExpiryMs, setPassExpiryMs] = useState<number | null>(() => {
    const normalized = normalizePassExpiry(membership.passExpiresAt)
    return normalized ?? null
  })
  const [courseVerification, setCourseVerification] = useState<CourseVerificationState>(() =>
    membershipCourseId
      ? { status: 'checking' }
      : { status: 'missing', message: 'Membership course ID not assigned.' }
  )

  useEffect(() => {
    const normalized = normalizePassExpiry(membership.passExpiresAt)
    setPassExpiryMs(normalized ?? null)
  }, [membership.passExpiresAt])

  useEffect(() => {
    if (!membershipCourseId) {
      setCourseVerification({
        status: 'missing',
        message: 'Membership course ID not assigned.'
      })
      return
    }

    if (!membershipAddress) {
      setCourseVerification({
        status: 'error',
        message: 'Membership contract address is not configured.'
      })
      return
    }

    if (!membershipService) {
      setCourseVerification({ status: 'checking' })
      return
    }

    let cancelled = false
    setCourseVerification({ status: 'checking' })

    membershipService
      .getCourse(membershipCourseId)
      .then(() => {
        if (!cancelled) {
          setCourseVerification({ status: 'verified' })
        }
      })
      .catch(error => {
        if (cancelled) return
        const errorMessage = error instanceof Error ? error.message : ''
        const notFound = /CourseNotFound/i.test(errorMessage)
        if (!notFound) {
          console.error('Failed to verify membership course for about page', error)
        }
        setCourseVerification(
          notFound
            ? {
                status: 'missing',
                message:
                  'No on-chain course found for this ID. Contact the creator to refresh registration.'
              }
            : {
                status: 'error',
                message: 'Unable to confirm on-chain course. Try again later.'
              }
        )
      })

    return () => {
      cancelled = true
    }
  }, [membershipAddress, membershipCourseId, membershipService])

  useEffect(() => {
    if (
      membership.status !== 'active' ||
      !membershipService ||
      !membershipCourseId
    ) {
      return
    }

    const walletAddress = (address ?? currentUser?.walletAddress) as Address | undefined
    if (!walletAddress) return

    let cancelled = false
    membershipService
      .getPassState(membershipCourseId, walletAddress)
      .then(state => normalizePassExpiry(state.expiresAt))
      .then(expiry => {
        if (!cancelled) {
          setPassExpiryMs(expiry ?? null)
        }
      })
      .catch(error => {
        console.error('Failed to resolve membership expiry for about page', error)
      })

    return () => {
      cancelled = true
    }
  }, [
    address,
    currentUser?.walletAddress,
    membership.status,
    membershipService,
    membershipCourseId
  ])

  const mediaSources = useMemo(() => {
    const sources: string[] = []
    if (group.aboutUrl) sources.push(group.aboutUrl)
    if (Array.isArray(group.galleryUrls)) {
      sources.push(...group.galleryUrls)
    }
    return sources
  }, [group.aboutUrl, group.galleryUrls])

  const privacy =
    group.visibility === 'public'
      ? { icon: Globe, label: 'Public community' }
      : { icon: Lock, label: 'Private community' }

  const totalMembers =
    typeof memberCount === 'number'
      ? memberCount
      : group.memberNumber ?? 0

  const priceLabel = formatGroupPriceLabel(
    group.price,
    group.billingCadence,
    { includeCadence: true }
  )

  const creatorName =
    owner?.displayName ??
    owner?.handle ??
    (owner?.walletAddress
      ? `${owner.walletAddress.slice(0, 6)}...${owner.walletAddress.slice(-4)}`
      : 'Unknown creator')

  const creatorInitials = useMemo(() => {
    if (!creatorName) return '?'
    const parts = creatorName.split(' ').filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }, [creatorName])

  const isAdmin = useMemo(() => {
    if (isOwner) return true
    if (!currentUser) return false
    return administrators?.some(a => a.user._id === currentUser._id) ?? false
  }, [administrators, currentUser, isOwner])

  const adminPrivilegeMessage = useMemo(() => {
    if (!isAdmin) return null
    return isOwner
      ? 'You own this group. Owner privileges include full administrative control without relying on a membership pass.'
      : 'You are an administrator for this group. Admin privileges provide full access without relying on a membership pass.'
  }, [isAdmin, isOwner])

  const membershipExpiryLabel = useMemo(() => {
    if (membership.status !== 'active' || isAdmin) return null
    if (!passExpiryMs) {
      return 'No expiry scheduled'
    }

    const expirySeconds = Math.floor(passExpiryMs / 1000)
    const relative = formatTimestampRelative(expirySeconds)
    const absolute = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(passExpiryMs))

    return `${absolute} (${relative})`
  }, [isAdmin, membership.status, passExpiryMs])

  const memberCountLabel = useMemo(() => {
    const formatter = new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1
    })
    const value = Number.isFinite(totalMembers) ? totalMembers : 0
    const membersLabel = value === 1 ? 'member' : 'members'
    return `${formatter.format(value)} ${membersLabel}`
  }, [totalMembers])

  const membershipCourseIdLabel = membershipCourseId ? membershipCourseId.toString() : 'Not assigned'
  const explorerName = ACTIVE_CHAIN.blockExplorers?.default.name ?? 'block explorer'
  const explorerUrl = useMemo(() => {
    if (!membershipCourseId || !membershipAddress) return null
    const baseUrl = ACTIVE_CHAIN.blockExplorers?.default.url ?? SOMNIA_EXPLORER_URL
    if (!baseUrl) {
      return null
    }
    return `${baseUrl}/token/${membershipAddress}?a=${membershipCourseId.toString()}`
  }, [membershipAddress, membershipCourseId])
  const verificationNode = useMemo(() => {
    switch (courseVerification.status) {
      case 'checking':
        return (
          <div className='inline-flex items-center gap-2 text-muted-foreground'>
            <Loader2 className='h-3 w-3 animate-spin' />
            <span>Checking on-chain deployment...</span>
          </div>
        )
      case 'verified':
        return (
          <div className='inline-flex flex-wrap items-center gap-2 text-emerald-600 dark:text-emerald-400'>
            <CheckCircle2 className='h-4 w-4' />
            <span>Course verified on chain.</span>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1 font-medium underline decoration-dotted underline-offset-4'
              >
                View on {explorerName}
                <ExternalLink className='h-3 w-3' />
              </a>
            ) : null}
          </div>
        )
      case 'missing':
        return (
          <div className='inline-flex items-start gap-2 text-amber-600 dark:text-amber-400'>
            <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
            <span>{courseVerification.message}</span>
          </div>
        )
      case 'error':
        return (
          <div className='inline-flex items-start gap-2 text-destructive'>
            <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
            <span>{courseVerification.message}</span>
          </div>
        )
      default:
        return null
    }
  }, [courseVerification, explorerName, explorerUrl])

  return (
    <div className='space-y-8'>
      <div className='space-y-4'>
        <h1 className='text-4xl font-bold text-foreground'>{group.name}</h1>
        <GroupMediaCarousel
          sources={mediaSources}
          fallbackImage={group.thumbnailUrl}
        />
      </div>

      <div className='flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-5 py-3'>
        <div className='flex items-center gap-2 text-sm text-foreground'>
          <privacy.icon className='h-4 w-4 text-muted-foreground' />
          <span className='font-medium'>{privacy.label}</span>
        </div>
        <div className='h-4 w-px bg-border' />
        <div className='flex items-center gap-2 text-sm text-foreground'>
          <Users className='h-4 w-4 text-muted-foreground' />
          <span className='font-medium'>{memberCountLabel}</span>
        </div>
        <div className='h-4 w-px bg-border' />
        <div className='flex items-center gap-2 text-sm text-foreground'>
          <Tag className='h-4 w-4 text-muted-foreground' />
          <span className='font-medium'>{priceLabel}</span>
        </div>
        {owner ? (
          <>
            <div className='h-4 w-px bg-border' />
            <div className='flex items-center gap-2 text-sm text-foreground'>
              <Avatar className='h-6 w-6'>
                {owner.avatarUrl ? <AvatarImage src={owner.avatarUrl} alt={creatorName} /> : null}
                <AvatarFallback className='text-xs font-semibold'>
                  {creatorInitials}
                </AvatarFallback>
              </Avatar>
              <span className='font-medium'>By {creatorName}</span>
            </div>
          </>
        ) : null}
      </div>

      {adminPrivilegeMessage ? (
        <div className='rounded-lg border border-border bg-card px-5 py-3 text-sm text-muted-foreground'>
          <ShieldCheck className='mr-2 inline h-4 w-4' />
          {adminPrivilegeMessage}
        </div>
      ) : membershipExpiryLabel && membership.status === 'active' ? (
        <div className='rounded-lg border border-border bg-card px-5 py-3 text-sm text-muted-foreground'>
          <Calendar className='mr-2 inline h-4 w-4' />
          Your pass expires {membershipExpiryLabel}
        </div>
      ) : null}

      <GroupDescriptionEditor
        editable={isOwner}
        groupId={group._id}
        initialContent={group.description}
      />

      {membershipCourseId && (
        <div className='rounded-lg border border-border bg-card p-5'>
          <div className='space-y-3'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Membership course ID
              </p>
              <p className='mt-1 font-mono text-sm text-foreground'>
                {membershipCourseIdLabel}
              </p>
            </div>
            <div className='text-sm'>{verificationNode}</div>
          </div>
        </div>
      )}
    </div>
  )
}
