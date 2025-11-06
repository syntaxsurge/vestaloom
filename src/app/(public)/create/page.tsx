'use client'

import { useCallback, useEffect } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { erc20Abi, parseUnits } from 'viem'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Logo } from '@/components/layout/logo'
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
import {
  MEMBERSHIP_DURATION_SECONDS,
  MEMBERSHIP_TRANSFER_COOLDOWN_SECONDS,
  PLATFORM_TREASURY_ADDRESS,
  REGISTRAR_CONTRACT_ADDRESS,
  USDC_CONTRACT_ADDRESS
} from '@/lib/config'
import {
  SUBSCRIPTION_PRICE_AMOUNT,
  SUBSCRIPTION_PRICE_LABEL
} from '@/lib/pricing'
import { ACTIVE_CHAIN } from '@/lib/wagmi'
import { registrarAbi } from '@/lib/onchain/abi'
import { GroupMediaFields } from '@/features/groups/components/group-media-fields'
import { generateMembershipCourseId } from '@/features/groups/utils/membership'
import { isValidMediaReference, normalizeMediaInput } from '@/features/groups/utils/media'
import { useAppRouter } from '@/hooks/use-app-router'

const createGroupSchema = z
  .object({
    name: z.string().min(2, 'Group name is required').max(80),
    shortDescription: z
      .string()
      .min(20, 'Describe the group in at least 20 characters')
      .max(200, 'Keep the summary under 200 characters'),
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
    price: z.string().optional()
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

    if (!isValidMediaReference(data.thumbnailUrl)) {
      ctx.addIssue({
        path: ['thumbnailUrl'],
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid image URL or upload a file.'
      })
    }

    data.galleryUrls.forEach((value, index) => {
      if (!isValidMediaReference(value)) {
        ctx.addIssue({
          path: ['galleryUrls', index],
          code: z.ZodIssueCode.custom,
          message: 'Provide a valid image URL or upload a file.'
        })
      }
    })
  })

type CreateGroupFormValues = z.infer<typeof createGroupSchema>

const DEFAULT_VALUES: CreateGroupFormValues = {
  name: '',
  shortDescription: '',
  aboutUrl: '',
  thumbnailUrl: '',
  galleryUrls: [],
  tags: '',
  visibility: 'private',
  billingCadence: 'free',
  price: ''
}

export default function Create() {
  const router = useAppRouter()
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN.id })
  const createGroup = useMutation(api.groups.create)
  const generateUploadUrl = useMutation(api.media.generateUploadUrl)
  const requestUploadUrl = useCallback(() => generateUploadUrl({}), [generateUploadUrl])

  const form = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: DEFAULT_VALUES
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

  const isProcessing = form.formState.isSubmitting

  const handleSubmit = async (values: CreateGroupFormValues) => {
    let txHash: `0x${string}` | null = null

    if (!address) {
      toast.error('Connect your wallet to continue')
      return
    }

    const treasuryAddress = PLATFORM_TREASURY_ADDRESS as `0x${string}` | ''
    const usdcTokenAddress = USDC_CONTRACT_ADDRESS as `0x${string}`
    const registrarAddress = REGISTRAR_CONTRACT_ADDRESS as `0x${string}` | ''

    if (!treasuryAddress) {
      toast.error('Treasury address not configured')
      return
    }

    if (!registrarAddress) {
      toast.error('Registrar contract address not configured')
      return
    }

    if (!publicClient) {
      toast.error('Blockchain client unavailable. Please try again.')
      return
    }

    try {
      const balance = (await publicClient.readContract({
        address: usdcTokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address]
      })) as bigint

      if (balance < SUBSCRIPTION_PRICE_AMOUNT) {
        toast.error(
          `Insufficient USDC balance. You need ${SUBSCRIPTION_PRICE_LABEL}.`
        )
        return
      }

      // Precompute price & course id so we can preflight the registrar call
      const priceString =
        values.billingCadence === 'monthly' && values.price
          ? values.price.trim()
          : ''
      const formattedPrice =
        priceString !== '' ? Math.max(0, Number(priceString)) : 0
      const membershipPriceAmount =
        priceString !== '' ? parseUnits(priceString, 6) : 0n
      const courseIdStr = generateMembershipCourseId()
      const courseId = BigInt(courseIdStr)

      // Sanity: Registrar must have marketplace configured and match env
      const registrarMarketplace = (await publicClient.readContract({
        address: registrarAddress,
        abi: registrarAbi,
        functionName: 'marketplace'
      })) as `0x${string}`
      if (
        !registrarMarketplace ||
        registrarMarketplace === '0x0000000000000000000000000000000000000000'
      ) {
        toast.error(
          'Registrar is not configured with a marketplace address. Contact the admin to set it.'
        )
        return
      }

      // Preflight the registrar call so we fail fast before charging the platform fee
      try {
        await publicClient.simulateContract({
          address: registrarAddress,
          abi: registrarAbi,
          functionName: 'registerCourse',
          args: [
            courseId,
            membershipPriceAmount,
            [address as `0x${string}`],
            [10000],
            BigInt(MEMBERSHIP_DURATION_SECONDS),
            BigInt(MEMBERSHIP_TRANSFER_COOLDOWN_SECONDS)
          ],
          account: address as `0x${string}`
        })
      } catch (err: any) {
        console.error('Preflight registerCourse failed', err)
        toast.error(
          err?.shortMessage ??
            'Registrar rejected course registration. Check configuration.'
        )
        return
      }

      // Platform fee payment (after preflight so we don’t charge if wiring is broken)
      const hash = await writeContractAsync({
        address: usdcTokenAddress,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [treasuryAddress, SUBSCRIPTION_PRICE_AMOUNT]
      })

      txHash = hash
      await publicClient.waitForTransactionReceipt({ hash })

      const registerHash = await writeContractAsync({
        address: registrarAddress,
        abi: registrarAbi,
        functionName: 'registerCourse',
        args: [
          courseId,
          membershipPriceAmount,
          [address as `0x${string}`],
          [10000],
          BigInt(MEMBERSHIP_DURATION_SECONDS),
          BigInt(MEMBERSHIP_TRANSFER_COOLDOWN_SECONDS)
        ]
      })
      await publicClient.waitForTransactionReceipt({ hash: registerHash })

      const thumbnailSource = normalizeMediaInput(values.thumbnailUrl)

      const gallery = (values.galleryUrls ?? [])
        .map(entry => normalizeMediaInput(entry))
        .filter(Boolean)

      const tags = values.tags
        ?.split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean)

      const resolvedVisibility =
        values.billingCadence === 'monthly' ? 'private' : values.visibility

      const groupId = await createGroup({
        ownerAddress: address,
        name: values.name.trim(),
        description: undefined,
        shortDescription: values.shortDescription.trim(),
        aboutUrl: normalizeMediaInput(values.aboutUrl) || undefined,
        thumbnailUrl: thumbnailSource || undefined,
        galleryUrls: gallery.length ? gallery : undefined,
        tags,
        visibility: resolvedVisibility,
        billingCadence:
          formattedPrice > 0 ? 'monthly' : values.billingCadence,
        price: formattedPrice,
        subscriptionId: courseIdStr,
        subscriptionPaymentTxHash: txHash ?? undefined
      } as any)

      toast.success('Your group is live!')
      router.push(`/${groupId}/about`)
    } catch (error: any) {
      console.error('Failed to complete group creation', error)
      const message =
        txHash !== null
          ? 'Group creation payment succeeded but the finalization failed. Please refresh — your group may appear shortly.'
          : 'Payment failed. Please try again.'
      toast.error(message)
    }
  }

  return (
    <div className='relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/30'>
      {/* Decorative background elements */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -left-4 top-0 h-72 w-72 rounded-full bg-primary/5 blur-3xl' />
        <div className='absolute -right-4 top-1/4 h-96 w-96 rounded-full bg-accent/5 blur-3xl' />
        <div className='absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-primary/5 blur-3xl' />
      </div>

      <div className='relative mx-auto max-w-6xl px-6 py-12'>
        {/* Header */}
        <div className='mb-12 text-center'>
          <div className='mb-6 flex justify-center'>
            <Logo width={180} height={40} />
          </div>
          <h1 className='mb-4 text-5xl font-bold tracking-tight text-foreground md:text-6xl'>
            Launch your community
          </h1>
          <p className='mx-auto max-w-2xl text-lg text-muted-foreground'>
            Build, engage, and monetize your community with powerful tools designed for modern creators
          </p>
        </div>

        {/* Main Content */}
        <div className='mx-auto max-w-3xl'>
          {/* Pricing Banner */}
          <div className='mb-8 rounded-2xl border border-border/50 bg-card/80 p-6 shadow-lg backdrop-blur-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>Platform fee</p>
                <p className='text-3xl font-bold text-foreground'>{SUBSCRIPTION_PRICE_LABEL}</p>
              </div>
              <div className='rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary'>
                Renews monthly
              </div>
            </div>
            <p className='mt-4 text-sm text-muted-foreground'>
              Billed once every 30 days. Renew before the window closes to keep your community online without interruption.
            </p>
          </div>

          {/* Features Grid */}
          <div className='mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {[
              { icon: '🚀', title: 'Drive Engagement', desc: 'Keep your community active' },
              { icon: '💖', title: 'Easy Setup', desc: 'Launch in minutes' },
              { icon: '💸', title: 'Monetize', desc: 'Somnia-native payments' },
              { icon: '📱', title: 'Mobile Ready', desc: 'iOS & Android apps' },
              { icon: '🌍', title: 'Global Reach', desc: 'Connect worldwide' },
              { icon: '🎓', title: 'Course Builder', desc: 'Built-in classroom' }
            ].map((feature, i) => (
              <div
                key={i}
                className='rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm transition-all hover:bg-card/80 hover:shadow-md'
              >
                <div className='mb-2 text-2xl'>{feature.icon}</div>
                <h3 className='mb-1 font-semibold text-foreground'>{feature.title}</h3>
                <p className='text-xs text-muted-foreground'>{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Form Card */}
          <div className='rounded-2xl border border-border/50 bg-card/80 p-8 shadow-2xl backdrop-blur-sm md:p-10'>
            <div className='mb-8'>
              <h2 className='text-2xl font-bold text-foreground'>Group Details</h2>
              <p className='mt-2 text-sm text-muted-foreground'>
                Fill in the information below to create your community
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-6'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-sm font-semibold'>Group name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='e.g., AI Automation Society'
                          className='h-12'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className='flex justify-between text-xs text-muted-foreground'>
                        <span>2-80 characters</span>
                        <span>{(field.value?.length ?? 0).toString()} / 80</span>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='shortDescription'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-sm font-semibold'>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder='Describe what makes your community special...'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className='flex justify-between text-xs text-muted-foreground'>
                        <span>20-200 characters</span>
                        <span>{(field.value?.length ?? 0).toString()} / 200</span>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className='grid gap-6 sm:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='visibility'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-sm font-semibold'>Visibility</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={billingCadence === 'monthly'}
                        >
                          <FormControl>
                            <SelectTrigger className='h-12'>
                              <SelectValue placeholder='Select visibility' />
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
                        <FormDescription className='text-xs'>
                          Public groups are discoverable by everyone
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
                        <FormLabel className='text-sm font-semibold'>Membership Type</FormLabel>
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
                            <SelectTrigger className='h-12'>
                              <SelectValue placeholder='Choose pricing' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='free'>Free</SelectItem>
                            <SelectItem value='monthly'>Paid (Monthly)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className='text-xs'>
                          Set your membership model
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {form.watch('billingCadence') === 'monthly' && (
                  <FormField
                    control={form.control}
                    name='price'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-sm font-semibold'>Monthly Price (USDC)</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min='0'
                            step='0.01'
                            placeholder='49.00'
                            className='h-12'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className='text-xs'>
                          Members pay this amount monthly in USDC
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className='space-y-4'>
                  <h3 className='text-sm font-semibold text-foreground'>Media & Branding</h3>
                  <GroupMediaFields
                    form={form}
                    requestUploadUrl={requestUploadUrl}
                  />
                </div>

                <FormField
                  control={form.control}
                  name='aboutUrl'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-sm font-semibold'>Intro Video URL (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='https://youtube.com/watch?v=...'
                          className='h-12'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className='text-xs'>
                        YouTube, Vimeo, or direct video links
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
                      <FormLabel className='text-sm font-semibold'>Tags (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='community, education, technology'
                          className='h-12'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className='text-xs'>
                        Comma-separated tags help members find you
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className='pt-4'>
                  <Button
                    type='submit'
                    disabled={isProcessing}
                    className='h-12 w-full text-base font-semibold uppercase tracking-wide'
                    size='lg'
                  >
                    {isProcessing ? 'Creating Your Community...' : 'Create Community'}
                  </Button>
                  <p className='mt-3 text-center text-xs text-muted-foreground'>
                    By creating a community, you agree to our terms of service
                  </p>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  )
}
