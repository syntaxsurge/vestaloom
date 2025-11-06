'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from 'convex/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { parseUnits } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { z } from 'zod'

import { Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import {
  MARKETPLACE_CONTRACT_ADDRESS,
  MEMBERSHIP_CONTRACT_ADDRESS,
  MEMBERSHIP_DURATION_SECONDS,
  MEMBERSHIP_TRANSFER_COOLDOWN_SECONDS,
  REGISTRAR_CONTRACT_ADDRESS
} from '@/lib/config'
import { registrarAbi } from '@/lib/onchain/abi'
import { RegistrarService } from '@/lib/onchain/services/registrarService'
import { MembershipPassService } from '@/lib/onchain/services/membershipPassService'
import { ACTIVE_CHAIN } from '@/lib/wagmi'
import { SUBSCRIPTION_PRICE_LABEL } from '@/lib/pricing'
import { formatTimestampRelative } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useGroupContext } from '../context/group-context'
import { resolveMembershipCourseId } from '../utils/membership'
import { GroupMediaFields } from './group-media-fields'
import { isValidMediaReference, normalizeMediaInput } from '../utils/media'
import { useRenewSubscription } from '../hooks/use-renew-subscription'
import { useAppRouter } from '@/hooks/use-app-router'

const administratorSchema = z.object({
  walletAddress: z
    .string()
    .trim()
    .min(1, 'Wallet address is required')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Enter a valid wallet address'),
  share: z
    .string()
    .trim()
    .min(1, 'Share is required')
    .refine(value => !Number.isNaN(Number(value)), 'Enter a valid percentage')
    .refine(value => Number(value) > 0, 'Share must be greater than 0')
    .refine(value => Number(value) <= 100, 'Share cannot exceed 100')
})

const settingsSchema = z
  .object({
    shortDescription: z
      .string()
      .max(200, 'Keep the summary under 200 characters')
      .optional(),
    aboutUrl: z
      .string()
      .trim()
      .url('Enter a valid URL')
      .optional()
      .or(z.literal('')),
    thumbnailUrl: z.string().optional(),
    galleryUrls: z.array(z.string()).default([]),
    tags: z.string().optional(),
    visibility: z.enum(['public', 'private']).default('private'),
    billingCadence: z.enum(['free', 'monthly']).default('free'),
    price: z.string().optional(),
    administrators: z.array(administratorSchema).optional()
  })
  .superRefine((data, ctx) => {
    if (data.billingCadence === 'monthly') {
      if (!data.price || data.price.trim() === '') {
        ctx.addIssue({
          path: ['price'],
          code: z.ZodIssueCode.custom,
          message: 'Monthly pricing is required'
        })
      } else if (Number.isNaN(Number(data.price))) {
        ctx.addIssue({
          path: ['price'],
          code: z.ZodIssueCode.custom,
          message: 'Enter a valid number'
        })
      } else if (Number(data.price) <= 0) {
        ctx.addIssue({
          path: ['price'],
          code: z.ZodIssueCode.custom,
          message: 'Price must be greater than zero'
        })
      }

      if (data.visibility !== 'private') {
        ctx.addIssue({
          path: ['visibility'],
          code: z.ZodIssueCode.custom,
          message: 'Paid memberships must be private.'
        })
      }
    }
    const admins = data.administrators ?? []
    if (admins.length > 0) {
      const seen = new Set<string>()
      let totalShare = 0

      admins.forEach((admin, index) => {
        const normalizedWallet = admin.walletAddress.trim().toLowerCase()
        if (seen.has(normalizedWallet)) {
          ctx.addIssue({
            path: ['administrators', index, 'walletAddress'],
            code: z.ZodIssueCode.custom,
            message: 'Duplicate administrator'
          })
        } else {
          seen.add(normalizedWallet)
        }

        const shareValue = Number(admin.share)
        if (!Number.isNaN(shareValue)) {
          totalShare += shareValue
        }
      })

      if (totalShare > 100) {
        ctx.addIssue({
          path: ['administrators'],
          code: z.ZodIssueCode.custom,
          message: 'Total share cannot exceed 100%.'
        })
      }
    }

    if (!isValidMediaReference(data.thumbnailUrl)) {
      ctx.addIssue({
        path: ['thumbnailUrl'],
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid image URL or upload a file.'
      })
    }

    data.galleryUrls?.forEach((entry, index) => {
      if (!isValidMediaReference(entry)) {
        ctx.addIssue({
          path: ['galleryUrls', index],
          code: z.ZodIssueCode.custom,
          message: 'Provide a valid image URL or upload a file.'
        })
      }
    })
  })

type GroupSettingsFormProps = {
  group: Doc<'groups'>
}

type GroupSettingsValues = z.infer<typeof settingsSchema>

type RegistrationState =
  | { status: 'checking' }
  | { status: 'registered' }
  | { status: 'missing'; message: string }
  | { status: 'error'; message: string }

export function GroupSettingsForm({ group }: GroupSettingsFormProps) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN.id })
  const { owner, administrators: existingAdministrators, media, subscription } = useGroupContext()
  const updateSettings = useMutation(api.groups.updateSettings)
  const resetSubscriptionIdMutation = useMutation(api.groups.resetSubscriptionId)
  const generateUploadUrl = useMutation(api.media.generateUploadUrl)
  const [isSaving, setIsSaving] = useState(false)
  const [isRegisteringCourse, setIsRegisteringCourse] = useState(false)
  const [isResettingCourseId, setIsResettingCourseId] = useState(false)
  const { renew: triggerRenewSubscription, isRenewing: isSubscriptionRenewing } = useRenewSubscription()
  const membershipCourseId = useMemo(() => resolveMembershipCourseId(group), [group])
  const membershipAddress = MEMBERSHIP_CONTRACT_ADDRESS as `0x${string}` | ''
  const registrarAddress = REGISTRAR_CONTRACT_ADDRESS as `0x${string}` | ''
  const marketplaceAddress = MARKETPLACE_CONTRACT_ADDRESS as `0x${string}` | ''
  const membershipService = useMemo(() => {
    if (!publicClient || !membershipAddress) return null
    return new MembershipPassService({
      publicClient: publicClient as any,
      address: membershipAddress
    })
  }, [membershipAddress, publicClient])
  const [registrationState, setRegistrationState] = useState<RegistrationState>(() =>
    membershipCourseId
      ? { status: 'checking' }
      : { status: 'missing', message: 'Membership course ID not assigned.' }
  )
  const router = useAppRouter()
  const ownerAddress = owner?.walletAddress?.toLowerCase() ?? null

  const initialThumbnailSource = normalizeMediaInput(
    media.thumbnail?.source ?? group.thumbnailUrl ?? ''
  )
  const initialGallerySources = media.gallery.map(item => item.source)

  const form = useForm<GroupSettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      shortDescription: group.shortDescription ?? '',
      aboutUrl: group.aboutUrl ?? '',
      thumbnailUrl: initialThumbnailSource,
      galleryUrls: initialGallerySources,
      tags: (group.tags ?? []).join(', '),
      visibility: group.visibility ?? 'private',
      billingCadence: group.billingCadence ?? (group.price > 0 ? 'monthly' : 'free'),
      price: group.price ? String(group.price) : '',
      administrators: existingAdministrators.map(admin => ({
        walletAddress: admin.user.walletAddress,
        share: (admin.shareBps / 100).toString()
      }))
    }
  })

  const billingCadence = form.watch('billingCadence')

  useEffect(() => {
    if (
      billingCadence === 'monthly' &&
      form.getValues('visibility') !== 'private'
    ) {
      form.setValue('visibility', 'private', {
        shouldDirty: true,
        shouldValidate: true
      })
    }
  }, [billingCadence, form])

  useEffect(() => {
    if (!membershipCourseId) {
      setRegistrationState({
        status: 'missing',
        message: 'Membership course ID not assigned.'
      })
      return
    }

    if (!membershipAddress) {
      setRegistrationState({
        status: 'error',
        message: 'Membership contract address is not configured.'
      })
      return
    }

    if (!membershipService) {
      setRegistrationState({ status: 'checking' })
      return
    }

    let cancelled = false
    setRegistrationState({ status: 'checking' })

    membershipService
      .getCourse(membershipCourseId)
      .then(() => {
        if (!cancelled) {
          setRegistrationState({ status: 'registered' })
        }
      })
      .catch(error => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        const notFound = /CourseNotFound/i.test(message)
        if (!notFound) {
          console.error('Failed to verify course registration', error)
        }
        setRegistrationState(
          notFound
            ? {
                status: 'missing',
                message:
                  'No on-chain course found for this ID. Register it to enable paid memberships.'
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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'administrators'
  })

  const courseIdDisplay =
    group.subscriptionId ??
    (membershipCourseId ? membershipCourseId.toString() : 'Not assigned')
  const canRegisterOnchain =
    !!ownerAddress && address?.toLowerCase() === ownerAddress
  const registrationActionLabel =
    registrationState.status === 'error' ? 'Retry registration' : 'Register on-chain'
  const registrationStatusText =
    registrationState.status === 'registered'
      ? 'Registered on-chain'
      : registrationState.status === 'checking'
        ? 'Checking…'
        : registrationState.status === 'missing'
          ? 'Not registered'
          : 'Status unknown'
  const registrationDescription =
    registrationState.status === 'registered'
      ? 'Course is active on-chain. You can update pricing or listing options whenever you are ready to sell memberships.'
      : registrationState.status === 'checking'
        ? 'Confirming on-chain course details…'
        : registrationState.message ?? 'Unable to resolve course status.'
  const showRegistrationButton =
    canRegisterOnchain &&
    membershipCourseId !== null &&
    (registrationState.status === 'missing' ||
      registrationState.status === 'error')
  const canResetCourseId =
    canRegisterOnchain && registrationState.status !== 'registered'

  const subscriptionRenewalLabel = subscription.endsOn
    ? formatTimestampRelative(subscription.endsOn)
    : 'Not scheduled'
  const subscriptionLastPaidLabel = subscription.lastPaidAt
    ? formatTimestampRelative(subscription.lastPaidAt)
    : null
  const subscriptionCardDescription = subscription.isExpired
    ? 'Renew now to reactivate your community for another month.'
    : subscription.isRenewalDue
      ? 'Renew soon to avoid an interruption to your community access.'
      : 'Your platform subscription is active.'
  const subscriptionCardClasses = cn(
    'space-y-3 rounded-xl border border-border p-4',
    subscription.isExpired
      ? 'border-destructive/40 bg-destructive/5'
      : subscription.isRenewalDue
        ? 'border-amber-500/30 bg-amber-500/10'
        : 'border-border/60 bg-card/30'
  )

  const handleRenewSubscription = useCallback(async () => {
    try {
      const result = await triggerRenewSubscription()
      toast.success(
        `Subscription renewed. Next renewal ${
          result.endsOn
            ? formatTimestampRelative(result.endsOn)
            : 'scheduled in 30 days'
        }.`
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to renew the subscription. Please try again.'
      )
    }
  }, [triggerRenewSubscription])

  const handleRegisterCourse = useCallback(async () => {
    if (!canRegisterOnchain) {
      toast.error('Only the group owner can register the course on-chain.')
      return
    }
    if (!membershipCourseId) {
      toast.error('Membership course ID is not available.')
      return
    }
    if (!publicClient) {
      toast.error('Blockchain client unavailable. Please try again.')
      return
    }
    if (!walletClient) {
      toast.error('Connect your wallet to continue.')
      return
    }
    if (!registrarAddress) {
      toast.error('Registrar contract address not configured.')
      return
    }
    if (!marketplaceAddress) {
      toast.error('Marketplace contract address not configured.')
      return
    }
    const ownerWalletAddress = owner?.walletAddress as `0x${string}` | undefined
    if (!ownerWalletAddress) {
      toast.error('Owner wallet address unavailable.')
      return
    }

    try {
      setIsRegisteringCourse(true)

      const registrarMarketplace = (await publicClient.readContract({
        address: registrarAddress as `0x${string}`,
        abi: registrarAbi,
        functionName: 'marketplace'
      })) as `0x${string}`
      if (
        !registrarMarketplace ||
        registrarMarketplace === '0x0000000000000000000000000000000000000000'
      ) {
        toast.error(
          'Registrar is not configured with a marketplace address. Contact an admin.'
        )
        return
      }

      const priceValue =
        typeof group.price === 'number' && Number.isFinite(group.price)
          ? group.price
          : 0
      const membershipPriceAmount = parseUnits(priceValue.toString(), 6)

      await publicClient.simulateContract({
        address: registrarAddress as `0x${string}`,
        abi: registrarAbi,
        functionName: 'registerCourse',
        args: [
          membershipCourseId,
          membershipPriceAmount,
          [ownerWalletAddress],
          [10000],
          BigInt(MEMBERSHIP_DURATION_SECONDS),
          BigInt(MEMBERSHIP_TRANSFER_COOLDOWN_SECONDS)
        ],
        account: address as `0x${string}`
      })

      const registrarService = new RegistrarService({
        publicClient: publicClient as any,
        walletClient: walletClient as any,
        address: registrarAddress as `0x${string}`
      })

      const txHash = await registrarService.registerCourse(
        membershipCourseId,
        membershipPriceAmount,
        [ownerWalletAddress],
        [10000],
        BigInt(MEMBERSHIP_DURATION_SECONDS),
        BigInt(MEMBERSHIP_TRANSFER_COOLDOWN_SECONDS),
        { account: address as `0x${string}` }
      )

      await publicClient.waitForTransactionReceipt({ hash: txHash })
      setRegistrationState({ status: 'registered' })
      toast.success('Membership course registered on-chain.')
    } catch (error: any) {
      console.error('Failed to register course on-chain', error)
      const message =
        error?.shortMessage ??
        error?.message ??
        'Course registration failed. Review your configuration and try again.'
      toast.error(message)
    } finally {
      setIsRegisteringCourse(false)
    }
  }, [
    address,
    canRegisterOnchain,
    group.price,
    marketplaceAddress,
    membershipCourseId,
    owner?.walletAddress,
    publicClient,
    registrarAddress,
    walletClient
  ])

  const handleResetCourseId = useCallback(async () => {
    if (!canRegisterOnchain) {
      toast.error('Only the group owner can reset the course ID.')
      return
    }
    if (!address) {
      toast.error('Connect your wallet to continue.')
      return
    }

    try {
      setIsResettingCourseId(true)
      const result = (await resetSubscriptionIdMutation({
        groupId: group._id,
        ownerAddress: address
      })) as { subscriptionId?: string } | undefined

      const newId = result?.subscriptionId ?? null
      if (newId) {
        setRegistrationState({ status: 'checking' })
      } else {
        setRegistrationState({
          status: 'missing',
          message: 'Membership course ID not assigned.'
        })
      }
      toast.success('Generated a new membership course ID.')
      router.refresh()
    } catch (error) {
      console.error('Failed to reset subscription ID', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to reset the membership course ID.'
      )
    } finally {
      setIsResettingCourseId(false)
    }
  }, [address, canRegisterOnchain, group._id, resetSubscriptionIdMutation, router])

  const mediaSnapshot = useMemo(
    () => ({
      thumbnailSource: media.thumbnail?.source ?? group.thumbnailUrl ?? '',
      thumbnailUrl: media.thumbnail?.url ?? null,
      gallery: media.gallery.map(entry => ({
        source: entry.source,
        url: entry.url,
        storageId: entry.storageId
      }))
    }),
    [group.thumbnailUrl, media.gallery, media.thumbnail?.source, media.thumbnail?.url]
  )

  const requestUploadUrl = useCallback(() => generateUploadUrl({}), [generateUploadUrl])

  const administratorsValues = form.watch('administrators') ?? []
  const totalAdminShare = administratorsValues.reduce((total, admin) => {
    const share = Number(admin?.share)
    if (!Number.isFinite(share) || share < 0) {
      return total
    }
    return total + share
  }, 0)
  const ownerShare = Math.max(0, Number((100 - totalAdminShare).toFixed(2)))
  const onSubmit = async (values: GroupSettingsValues) => {
    if (!address) {
      toast.error('Connect your wallet to update settings.')
      return
    }

    try {
      setIsSaving(true)

      if (ownerAddress) {
        let ownerConflict = false
        values.administrators?.forEach((admin, index) => {
          const normalized = admin.walletAddress.trim().toLowerCase()
          if (normalized === ownerAddress) {
            form.setError(
              `administrators.${index}.walletAddress` as const,
              {
                type: 'manual',
                message:
                  'The group owner receives the remaining share automatically. Remove this wallet to continue.'
              }
            )
            ownerConflict = true
          }
        })
        if (ownerConflict) {
          setIsSaving(false)
          return
        }
      }

      const priceRaw =
        values.billingCadence === 'monthly' && values.price
          ? Number(values.price)
          : 0

      const parsedPrice = Number.isFinite(priceRaw) ? Math.max(0, priceRaw) : 0

      const thumbnailSource = normalizeMediaInput(values.thumbnailUrl)

      const gallery = (values.galleryUrls ?? [])
        .map(url => normalizeMediaInput(url))
        .filter(Boolean)

      const tags = values.tags
        ?.split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean)

      const resolvedVisibility =
        values.billingCadence === 'monthly' ? 'private' : values.visibility

      const administratorPayload = (
        values.administrators?.map(admin => {
          const wallet = admin.walletAddress.trim()
          const shareNumeric = Number(admin.share)
          if (
            !wallet ||
            Number.isNaN(shareNumeric) ||
            shareNumeric <= 0
          ) {
            return null
          }
          return {
            walletAddress: wallet,
            shareBps: Math.round(shareNumeric * 100)
          }
        }) ?? []
      ).filter(
        (
          admin
        ): admin is { walletAddress: string; shareBps: number } => admin !== null
      )

      if (administratorPayload.length > 0) {
        const totalBps = administratorPayload.reduce(
          (total, admin) => total + admin.shareBps,
          0
        )
        if (totalBps > 10000) {
          const diff = totalBps - 10000
          const last = administratorPayload[administratorPayload.length - 1]
          last.shareBps = Math.max(0, last.shareBps - diff)
        }
      }

      const normalizedAdministrators = administratorPayload.filter(
        admin => admin.shareBps > 0
      )

      await updateSettings({
        id: group._id,
        ownerAddress: address,
        shortDescription: values.shortDescription?.trim(),
        aboutUrl: values.aboutUrl?.trim() || undefined,
        thumbnailUrl: thumbnailSource || undefined,
        galleryUrls: gallery,
        tags,
        visibility: resolvedVisibility,
        billingCadence: parsedPrice > 0 ? 'monthly' : values.billingCadence,
        price: parsedPrice,
        administrators: normalizedAdministrators
      })

      toast.success('Group settings updated')
    } catch (error) {
      console.error('Failed to update group settings', error)
      toast.error('Unable to save settings. Please retry.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <div className={subscriptionCardClasses}>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='space-y-1'>
              <h3 className='text-sm font-semibold text-foreground'>
                Platform subscription
              </h3>
              <p className='text-xs text-muted-foreground'>
                {subscriptionCardDescription} Pay {SUBSCRIPTION_PRICE_LABEL} to extend access for 30 days.
              </p>
            </div>
            <div className='text-xs text-muted-foreground sm:text-right'>
              <div className='font-mono text-sm text-foreground'>
                {subscription.isExpired ? 'Expired' : 'Renews'} {subscriptionRenewalLabel}
              </div>
              {subscriptionLastPaidLabel && (
                <div>Last paid {subscriptionLastPaidLabel}</div>
              )}
              {subscription.daysRemaining !== null && !subscription.isExpired && (
                <div>
                  {subscription.daysRemaining} day{subscription.daysRemaining === 1 ? '' : 's'} remaining
                </div>
              )}
            </div>
          </div>
          <div className='flex flex-col gap-2 sm:flex-row sm:justify-end'>
            <Button
              type='button'
              onClick={handleRenewSubscription}
              disabled={isSubscriptionRenewing}
              className='inline-flex items-center gap-2 self-start sm:self-auto'
              variant={subscription.isExpired ? 'destructive' : 'default'}
            >
              <RefreshCcw className='h-4 w-4' />
              {isSubscriptionRenewing ? 'Processing...' : 'Renew subscription'}
            </Button>
          </div>
        </div>

        <div className='space-y-3 rounded-xl border border-border p-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <h3 className='text-sm font-semibold text-foreground'>
                Membership course
              </h3>
              <p className='text-xs text-muted-foreground'>
                Register this group&apos;s course on-chain so you can enable paid memberships or marketplace listings later.
              </p>
            </div>
            <div className='text-right text-xs'>
              <div className='uppercase tracking-wide text-muted-foreground'>Course ID</div>
              <div className='font-mono text-sm text-foreground'>{courseIdDisplay}</div>
            </div>
          </div>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <p className='text-xs text-muted-foreground sm:flex-1'>
              {registrationDescription}
            </p>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2'>
              {showRegistrationButton ? (
                <Button
                  type='button'
                  onClick={handleRegisterCourse}
                  disabled={isRegisteringCourse}
                >
                  {isRegisteringCourse ? 'Registering…' : registrationActionLabel}
                </Button>
              ) : (
                <span className='inline-flex items-center justify-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground'>
                  {registrationStatusText}
                </span>
              )}
              {canResetCourseId && (
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => {
                    void handleResetCourseId()
                  }}
                  disabled={isResettingCourseId}
                >
                  {isResettingCourseId ? 'Resetting…' : 'Reset course ID'}
                </Button>
              )}
            </div>
          </div>
          {ownerAddress &&
            !canRegisterOnchain &&
            registrationState.status !== 'registered' && (
              <p className='text-xs text-muted-foreground'>
                Connect the owner wallet to register this course on-chain.
              </p>
            )}
        </div>

        <FormField
          control={form.control}
          name='shortDescription'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tagline</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder='Summarize your community in a sentence or two.'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='grid gap-4 md:grid-cols-2'>
          <FormField
            control={form.control}
            name='visibility'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Visibility</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={billingCadence === 'monthly'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Choose visibility' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem
                      value='public'
                      disabled={billingCadence === 'monthly'}
                    >
                      Public
                    </SelectItem>
                    <SelectItem value='private'>Private</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Public groups let anyone explore your content before joining.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='billingCadence'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Membership pricing</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={value => {
                    field.onChange(value)
                    if (value === 'free') {
                      form.setValue('price', '')
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select pricing style' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='free'>Free for members</SelectItem>
                    <SelectItem value='monthly'>Paid subscription</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {billingCadence === 'monthly' && (
          <FormField
            control={form.control}
            name='price'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monthly price (USDC)</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min='0'
                    step='0.01'
                    placeholder='49'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Members will pay this amount when they join.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className='space-y-3 rounded-xl border border-border p-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h3 className='text-sm font-semibold text-foreground'>
                Revenue administrators
              </h3>
              <p className='text-xs text-muted-foreground'>
                Add collaborators who should receive a share of each paid membership. The owner automatically keeps the remaining{' '}
                <span className='font-medium text-foreground'>
                  {ownerShare.toFixed(2)}%
                </span>
                .
              </p>
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => append({ walletAddress: '', share: '' })}
            >
              <Plus className='mr-2 h-4 w-4' />
              Add collaborator
            </Button>
          </div>

          {fields.length === 0 ? (
            <p className='rounded-md bg-muted/40 p-3 text-xs text-muted-foreground'>
              No additional revenue collaborators configured.
            </p>
          ) : (
            <div className='space-y-3'>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className='grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,1fr)_140px_auto] md:items-start'
                >
                  <FormField
                    control={form.control}
                    name={`administrators.${index}.walletAddress`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wallet address</FormLabel>
                        <FormControl>
                          <Input placeholder='0x...' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`administrators.${index}.share`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Share (%)</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min='0'
                            max='100'
                            step='0.01'
                            placeholder='10'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className='flex items-start justify-end pt-6'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => remove(index)}
                    >
                      <Trash2 className='mr-2 h-4 w-4' />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className='rounded-md bg-muted/40 p-3 text-xs text-muted-foreground'>
            Owner share updates automatically. Current owner share:{' '}
            <span className='font-medium text-foreground'>
              {ownerShare.toFixed(2)}%
            </span>
          </div>
        </div>

        <GroupMediaFields
          form={form}
          requestUploadUrl={requestUploadUrl}
          initialMedia={mediaSnapshot}
        />

        <FormField
          control={form.control}
          name='aboutUrl'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Intro video URL</FormLabel>
              <FormControl>
                <Input placeholder='https://youtube.com/watch?v=...' {...field} />
              </FormControl>
              <FormDescription>
                Paste a YouTube, Vimeo, or direct video link to showcase the community.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='tags'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags</FormLabel>
              <FormControl>
                <Input placeholder='community, tech, wellness' {...field} />
              </FormControl>
              <FormDescription>
                Separate tags with commas so members can find the group easily.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='flex justify-end'>
          <Button type='submit' disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save settings'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
