'use client'

import { useEffect, useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { useQuery as useConvexQuery } from 'convex/react'
import { toast } from 'sonner'
import { parseUnits, type Address } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'

import { LoadingIndicator } from '@/components/feedback/loading-indicator'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { api } from '@/convex/_generated/api'
import { getCourseCatalog, type CourseCatalogItem } from '@/lib/catalog/courses'
import {
  MARKETPLACE_CONTRACT_ADDRESS,
  MEMBERSHIP_CONTRACT_ADDRESS,
  PLATFORM_TREASURY_ADDRESS
} from '@/lib/config'
import {
  MarketplaceService,
  MembershipPassService,
  type MarketplaceListing
} from '@/lib/onchain/services'
import {
  SUBSCRIPTION_PRICE_LABEL,
  SUBSCRIPTION_PRICE_USDC
} from '@/lib/pricing'
import { formatDurationShort, formatTimestampRelative } from '@/lib/time'
import { formatUSDC } from '@/lib/usdc'
import { ACTIVE_CHAIN } from '@/lib/wagmi'

const DEFAULT_LISTING_DURATION = 60n * 60n * 24n * 3n // 3 days
const LISTING_DURATION_CHOICES: { label: string; value: bigint }[] = [
  { label: '24 hours', value: 60n * 60n * 24n },
  { label: '3 days', value: 60n * 60n * 24n * 3n },
  { label: '7 days', value: 60n * 60n * 24n * 7n }
]

type MarketplaceCourse = {
  catalog: CourseCatalogItem
  floorPrice: bigint | null
  listings: MarketplaceListing[]
  stats: {
    listingCount: number
    primaryPrice: bigint
    duration: bigint
    cooldown: bigint
  }
  user?: {
    hasPass: boolean
    canTransfer: boolean
    transferAvailableAt: bigint
    expiresAt: bigint
  }
}

type ExpiryFilter = 'any' | '7d' | '30d' | 'no-expiry'

type Filters = {
  search: string
  expiry: ExpiryFilter
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    const { name, message, stack } = error
    const cause = (error as { cause?: unknown }).cause
    return {
      name,
      message,
      stack,
      cause: typeof cause === 'string' ? cause : undefined
    }
  }

  if (error && typeof error === 'object') {
    try {
      return JSON.parse(JSON.stringify(error))
    } catch {
      return { description: Object.prototype.toString.call(error) }
    }
  }

  return { value: String(error) }
}

const defaultFilters: Filters = {
  search: '',
  expiry: 'any'
}

function toListingExpirySeconds(listing: MarketplaceListing): number | null {
  if (listing.expiresAt === 0n) return null
  const value = Number(listing.expiresAt)
  if (!Number.isFinite(value)) return null
  return value
}

function getNextListingExpiry(listings: MarketplaceListing[]): number | null {
  const now = Math.floor(Date.now() / 1000)
  const futureExpiries = listings
    .map(toListingExpirySeconds)
    .filter((value): value is number => value !== null && value > now)
  if (futureExpiries.length === 0) return null
  return futureExpiries.reduce(
    (min, value) => (value < min ? value : min),
    futureExpiries[0]
  )
}

function shortenAddress(address: string) {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function useMarketplaceCore() {
  const catalog = useMemo(() => getCourseCatalog(), [])
  const { address } = useAccount()
  const myGroups = useConvexQuery(
    api.groups.list,
    address ? { address } : { address: undefined }
  ) as any[] | undefined

  const dynamicCatalog = useMemo<CourseCatalogItem[]>(() => {
    const extras: CourseCatalogItem[] = []
    const seen = new Set<string>(catalog.map(c => c.courseId.toString()))
    ;(myGroups ?? []).forEach(group => {
      const subId = group?.subscriptionId
      if (!subId) return
      try {
        const courseId = BigInt(String(subId))
        const key = courseId.toString()
        if (seen.has(key)) return
        seen.add(key)
        extras.push({
          courseId,
          title: group.name ?? `Membership #${key}`,
          subtitle: group.shortDescription ?? 'Community membership',
          category: 'Community',
          difficulty: 'Beginner',
          coverGradient: 'from-slate-500 via-slate-600 to-slate-700',
          tags: Array.isArray(group.tags) ? group.tags : [],
          summary:
            group.shortDescription ??
            'Membership minted via Registrar; duration & cooldown pulled from chain.'
        })
      } catch {}
    })
    return [...catalog, ...extras]
  }, [catalog, myGroups])

  const [listDialog, setListDialog] = useState<{
    open: boolean
    course?: MarketplaceCourse
  }>({
    open: false
  })

  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN.id })
  const { data: walletClient } = useWalletClient()

  const marketplaceAddress = MARKETPLACE_CONTRACT_ADDRESS as Address | undefined
  const membershipAddress = MEMBERSHIP_CONTRACT_ADDRESS as Address | undefined

  const readOnlyMarketplace = useMemo(() => {
    if (!publicClient || !marketplaceAddress) return null
    return new MarketplaceService({
      publicClient: publicClient as any,
      address: marketplaceAddress
    })
  }, [publicClient, marketplaceAddress])

  const readOnlyMembership = useMemo(() => {
    if (!publicClient || !membershipAddress) return null
    return new MembershipPassService({
      publicClient: publicClient as any,
      address: membershipAddress
    })
  }, [publicClient, membershipAddress])

  const writableMarketplace = useMemo(() => {
    if (!publicClient || !walletClient || !marketplaceAddress || !address)
      return null
    return new MarketplaceService({
      publicClient: publicClient as any,
      walletClient,
      account: address,
      address: marketplaceAddress
    })
  }, [publicClient, walletClient, marketplaceAddress, address])

  const writableMembership = useMemo(() => {
    if (!publicClient || !walletClient || !membershipAddress || !address)
      return null
    return new MembershipPassService({
      publicClient: publicClient as any,
      walletClient,
      account: address,
      address: membershipAddress
    })
  }, [publicClient, walletClient, membershipAddress, address])

  const { data, isLoading, refetch } = useQuery({
    queryKey: [
      'marketplace-feed',
      marketplaceAddress,
      membershipAddress,
      address,
      dynamicCatalog.map(c => c.courseId.toString()).join(',')
    ],
    enabled: Boolean(readOnlyMarketplace && readOnlyMembership),
    queryFn: async (): Promise<MarketplaceCourse[]> => {
      if (!readOnlyMarketplace || !readOnlyMembership) return []

      const results: Array<MarketplaceCourse | null> = await Promise.all(
        dynamicCatalog.map(async catalogItem => {
          const courseId = catalogItem.courseId
          try {
            const [courseConfig, listings] = await Promise.all([
              readOnlyMembership.getCourse(courseId),
              readOnlyMarketplace.getActiveListings(courseId)
            ])

            let userState: MarketplaceCourse['user']
            if (address) {
              const [balance, transferInfo, passState] = await Promise.all([
                readOnlyMembership.balanceOf(address as Address, courseId),
                readOnlyMembership.canTransfer(courseId, address as Address),
                readOnlyMembership.getPassState(courseId, address as Address)
              ])

              userState = {
                hasPass: balance > 0n,
                canTransfer: transferInfo.eligible,
                transferAvailableAt: transferInfo.availableAt,
                expiresAt: passState.expiresAt
              }
            }

            const floor = listings.reduce<bigint | null>((lowest, listing) => {
              if (!lowest || listing.priceUSDC < lowest)
                return listing.priceUSDC
              return lowest
            }, null)

            return {
              catalog: catalogItem,
              floorPrice: floor,
              listings,
              stats: {
                listingCount: listings.length,
                primaryPrice: courseConfig.priceUSDC,
                duration: courseConfig.duration,
                cooldown: courseConfig.transferCooldown
              },
              user: userState
            } as MarketplaceCourse
          } catch (error) {
            console.warn('[Marketplace] Failed to hydrate course state', {
              courseId: courseId.toString(),
              error: serializeError(error)
            })
            return null
          }
        })
      )

      return results.filter(
        (entry): entry is MarketplaceCourse => entry !== null
      )
    }
  })

  const ownedCourses = useMemo(() => {
    const entries = (data ?? []).filter(course => course.user?.hasPass)
    return entries.sort((a, b) =>
      a.catalog.title.localeCompare(b.catalog.title)
    )
  }, [data])

  useEffect(() => {
    const ownedIds = ownedCourses.map(course =>
      course.catalog.courseId.toString()
    )
    const groups = (myGroups ?? []).map(group => ({
      id: group?._id,
      subscriptionId: group?.subscriptionId
    }))
    console.log('[Marketplace] Snapshot', {
      wallet: address ?? 'disconnected',
      hydratedCourses: data?.length ?? 0,
      ownedCourseIds: ownedIds,
      myGroupSubscriptions: groups
    })
  }, [address, data, myGroups, ownedCourses])

  const preferredCourse = useMemo(
    () =>
      ownedCourses.find(course => course.user?.canTransfer) ?? ownedCourses[0],
    [ownedCourses]
  )

  const contractsConfigured = Boolean(marketplaceAddress && membershipAddress)

  const openListDialog = (course: MarketplaceCourse) => {
    if (course.user?.hasPass && course.user.canTransfer === false) {
      const availableAt = course.user.transferAvailableAt
      const availabilityLabel =
        availableAt === 0n ? 'soon' : formatTimestampRelative(availableAt)
      toast.info(
        availableAt === 0n
          ? 'Transfer cooldown is still settling. Try again shortly.'
          : `Transfer cooldown ends ${availabilityLabel}. You can prepare your listing details now.`
      )
    }
    setListDialog({ open: true, course })
  }

  const closeListDialog = () => setListDialog({ open: false })

  const handleListFromHero = () => {
    if (!preferredCourse) {
      toast.info('Mint a membership pass before listing.')
      return
    }
    openListDialog(preferredCourse)
  }

  const handlePrimaryPurchase = async (course: MarketplaceCourse) => {
    if (!writableMarketplace) {
      toast.error('Connect your wallet to purchase memberships')
      return
    }
    try {
      const hash = await writableMarketplace.purchasePrimary(
        course.catalog.courseId,
        course.stats.primaryPrice
      )
      await publicClient?.waitForTransactionReceipt({ hash })
      toast.success('Membership minted successfully')
      refetch()
    } catch (error: any) {
      console.error(error)
      toast.error(error?.shortMessage ?? 'Purchase failed')
    }
  }

  const handleBuyFloor = async (course: MarketplaceCourse) => {
    if (!writableMarketplace) {
      toast.error('Connect your wallet to purchase listings')
      return
    }
    if (!course.floorPrice || course.listings.length === 0) {
      toast.error('No listings available right now')
      return
    }

    const floorListing = course.listings.reduce((best, listing) =>
      listing.priceUSDC < best.priceUSDC ? listing : best
    )

    try {
      const hash = await writableMarketplace.buyListing(
        course.catalog.courseId,
        floorListing.seller,
        floorListing.priceUSDC
      )
      await publicClient?.waitForTransactionReceipt({ hash })
      toast.success('Listing purchased successfully')
      refetch()
    } catch (error: any) {
      console.error(error)
      toast.error(error?.shortMessage ?? 'Unable to buy listing')
    }
  }

  const handleRenew = async (course: MarketplaceCourse) => {
    if (!writableMarketplace) {
      toast.error('Connect your wallet to renew memberships')
      return
    }
    try {
      const hash = await writableMarketplace.renew(
        course.catalog.courseId,
        course.stats.primaryPrice
      )
      await publicClient?.waitForTransactionReceipt({ hash })
      toast.success('Membership renewed')
      refetch()
    } catch (error: any) {
      console.error(error)
      toast.error(error?.shortMessage ?? 'Unable to renew membership')
    }
  }

  const handleCreateListing = async (payload: {
    price: string
    duration: bigint
    course: MarketplaceCourse
  }) => {
    if (!writableMarketplace || !writableMembership || !address) {
      toast.error('Connect your wallet to list memberships')
      return
    }

    if (payload.course.user && !payload.course.user.canTransfer) {
      const availableAt = payload.course.user.transferAvailableAt
      const availabilityLabel =
        availableAt === 0n ? 'soon' : formatTimestampRelative(availableAt)
      toast.info(
        availableAt === 0n
          ? 'Transfer cooldown is still settling. Try again shortly.'
          : `Transfer cooldown ends ${availabilityLabel}.`
      )
      return
    }

    try {
      const priceAmount = parseUnits(payload.price, 6)
      const approvalGranted = await writableMembership.isApprovedForAll(
        address as Address,
        marketplaceAddress as Address
      )

      if (!approvalGranted) {
        const approvalHash = await writableMembership.setApprovalForAll(
          marketplaceAddress as Address,
          true
        )
        await publicClient?.waitForTransactionReceipt({ hash: approvalHash })
      }

      const hash = await writableMarketplace.createListing(
        payload.course.catalog.courseId,
        priceAmount,
        payload.duration
      )
      await publicClient?.waitForTransactionReceipt({ hash })
      toast.success('Listing created')
      refetch()
      closeListDialog()
    } catch (error: any) {
      console.error(error)
      toast.error(error?.shortMessage ?? 'Unable to create listing')
    }
  }

  return {
    address,
    data,
    isLoading,
    refetch,
    ownedCourses,
    preferredCourse,
    listDialog,
    openListDialog,
    closeListDialog,
    handleListFromHero,
    handlePrimaryPurchase,
    handleBuyFloor,
    handleRenew,
    handleCreateListing,
    contractsConfigured
  }
}

export function MarketplaceShell() {
  const {
    data,
    isLoading,
    ownedCourses,
    listDialog,
    openListDialog,
    closeListDialog,
    handleListFromHero,
    handlePrimaryPurchase,
    handleBuyFloor,
    handleRenew,
    handleCreateListing,
    contractsConfigured
  } = useMarketplaceCore()

  const [filters, setFilters] = useState<Filters>(defaultFilters)

  const filteredCourses = useMemo(() => {
    if (!data) return []
    const term = filters.search.trim().toLowerCase()
    const nowSeconds = Math.floor(Date.now() / 1000)
    const windowSeconds =
      filters.expiry === '7d'
        ? 7 * 86_400
        : filters.expiry === '30d'
          ? 30 * 86_400
          : null

    const matchesSearch = (entry: MarketplaceCourse) => {
      if (!term) return true
      return (
        entry.catalog.title.toLowerCase().includes(term) ||
        entry.catalog.summary.toLowerCase().includes(term) ||
        entry.catalog.tags.some(tag => tag.toLowerCase().includes(term))
      )
    }

    const matchesExpiry = (entry: MarketplaceCourse) => {
      if (filters.expiry === 'any') return true
      if (entry.listings.length === 0) return false

      if (filters.expiry === 'no-expiry') {
        return entry.listings.some(listing => listing.expiresAt === 0n)
      }

      if (!windowSeconds) return true

      return entry.listings.some(listing => {
        if (listing.expiresAt === 0n) return false
        const expirySeconds = Number(listing.expiresAt)
        if (!Number.isFinite(expirySeconds)) return false
        if (expirySeconds <= nowSeconds) return false
        return expirySeconds - nowSeconds <= windowSeconds
      })
    }

    return data.filter(entry => {
      if (entry.stats.listingCount === 0) return false
      if (!matchesExpiry(entry)) return false
      return matchesSearch(entry)
    })
  }, [data, filters])

  if (!contractsConfigured) {
    return (
      <section className='mx-auto flex max-w-3xl flex-col gap-4 px-6 py-16 text-center'>
        <h1 className='text-3xl font-semibold text-foreground'>
          Marketplace not configured
        </h1>
        <p className='text-muted-foreground'>
          Provide marketplace and membership contract addresses via environment
          variables to enable this view.
        </p>
      </section>
    )
  }

  return (
    <div className='relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/20'>
      {/* Decorative background elements */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -left-12 top-0 h-96 w-96 rounded-full bg-primary/5 blur-3xl' />
        <div className='absolute -right-12 top-1/3 h-80 w-80 rounded-full bg-accent/5 blur-3xl' />
        <div className='absolute bottom-0 left-1/2 h-72 w-72 rounded-full bg-primary/5 blur-3xl' />
      </div>

      <section className='relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-12'>
        <Hero
          listingCount={
            data?.reduce((acc, item) => acc + item.stats.listingCount, 0) ?? 0
          }
          canList={ownedCourses.length > 0}
          onListPass={handleListFromHero}
        />

        <div className='flex flex-col gap-8 lg:flex-row'>
          <aside className='w-full max-w-xs flex-shrink-0 space-y-6 rounded-xl border border-border/50 bg-card/80 p-6 shadow-lg backdrop-blur-sm'>
            <FilterControls filters={filters} onChange={setFilters} />

            <Separator className='bg-border/50' />

            <div className='space-y-4 rounded-lg bg-muted/30 p-4'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                  Primary price
                </p>
                <p className='mt-1 text-2xl font-bold text-foreground'>
                  {SUBSCRIPTION_PRICE_LABEL}
                </p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Settlement: USDC on Somnia
                </p>
              </div>
            </div>

            <div className='space-y-3 text-xs'>
              <div>
                <p className='font-semibold text-muted-foreground'>Treasury</p>
                <p className='mt-1 break-all font-mono text-[0.65rem] text-foreground'>
                  {PLATFORM_TREASURY_ADDRESS}
                </p>
              </div>
              <div>
                <p className='font-semibold text-muted-foreground'>Marketplace</p>
                <p className='mt-1 break-all font-mono text-[0.65rem] text-foreground'>
                  {MARKETPLACE_CONTRACT_ADDRESS}
                </p>
              </div>
            </div>
          </aside>

          <main className='flex-1 space-y-8'>
            {isLoading && (
              <div className='flex flex-col items-center gap-4 rounded-xl border border-border/50 bg-card/60 py-16 text-muted-foreground backdrop-blur-sm'>
                <LoadingIndicator />
                <p className='text-sm font-medium'>Loading marketplace data…</p>
              </div>
            )}

            {!isLoading && filteredCourses.length === 0 && (
              <div className='rounded-xl border border-border/50 bg-card/60 py-16 text-center backdrop-blur-sm'>
                <p className='text-sm text-muted-foreground'>
                  No courses match your filters. Try adjusting your search.
                </p>
              </div>
            )}

            {!isLoading && filteredCourses.length > 0 && (
              <div className='grid gap-6 lg:grid-cols-2'>
                {filteredCourses.map(course => (
                  <CourseCard
                    key={course.catalog.courseId.toString()}
                    course={course}
                    onBuyPrimary={handlePrimaryPurchase}
                    onBuyFloor={handleBuyFloor}
                    onList={openListDialog}
                    onRenew={handleRenew}
                  />
                ))}
              </div>
            )}

            {data && data.some(entry => entry.listings.length > 0) && (
              <LiveListings data={data} />
            )}
          </main>
        </div>

        <ListDialog
          state={listDialog}
          onClose={closeListDialog}
          onSubmit={handleCreateListing}
          eligibleCourses={ownedCourses}
        />
      </section>
    </div>
  )
}

function Hero({
  listingCount,
  canList,
  onListPass
}: {
  listingCount: number
  canList: boolean
  onListPass: () => void
}) {
  return (
    <div className='relative overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-10 py-16 text-white shadow-2xl md:px-14'>
      <div className='absolute -right-12 top-12 h-72 w-72 rounded-full bg-primary/20 blur-3xl' />
      <div className='absolute -bottom-12 left-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl' />
      <div className='relative space-y-6'>
        <div className='inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm'>
          <div className='h-2 w-2 rounded-full bg-primary animate-pulse' />
          <p className='text-xs font-semibold uppercase tracking-wider text-white/90'>
            Vestaloom Marketplace
          </p>
        </div>
        <h1 className='text-5xl font-bold leading-tight sm:text-6xl'>
          Discover & Trade
          <br />
          <span className='bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent'>
            Course Memberships
          </span>
        </h1>
        <p className='max-w-2xl text-lg leading-relaxed text-slate-300'>
          Buy new passes, discover secondary listings, or renew existing memberships.
          All transactions are secured with cooldown-aware transfers on Somnia.
        </p>
        <div className='flex flex-wrap items-center gap-4 pt-4'>
          <Button
            onClick={onListPass}
            disabled={!canList}
            className='h-12 px-8 font-semibold'
            size='lg'
          >
            List Your Membership
          </Button>
          {!canList && (
            <p className='text-sm text-slate-300'>
              Purchase a pass to start listing
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterControls({
  filters,
  onChange
}: {
  filters: Filters
  onChange: (filters: Filters) => void
}) {
  return (
    <div className='space-y-5'>
      <div>
        <h3 className='mb-3 text-sm font-bold text-foreground'>Search</h3>
        <Input
          id='marketplace-search'
          placeholder='Search courses or tags...'
          value={filters.search}
          onChange={event =>
            onChange({ ...filters, search: event.target.value })
          }
          className='h-11'
        />
      </div>

      <div className='space-y-3'>
        <h3 className='text-sm font-bold text-foreground'>Listing Expiration</h3>
        <Select
          value={filters.expiry}
          onValueChange={value =>
            onChange({ ...filters, expiry: value as ExpiryFilter })
          }
        >
          <SelectTrigger id='marketplace-expiry' className='h-11'>
            <SelectValue placeholder='Any expiration' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='any'>Any expiration</SelectItem>
            <SelectItem value='7d'>Ends within 7 days</SelectItem>
            <SelectItem value='30d'>Ends within 30 days</SelectItem>
            <SelectItem value='no-expiry'>No expiry</SelectItem>
          </SelectContent>
        </Select>
        <p className='text-xs leading-relaxed text-muted-foreground'>
          Filter by listing expiration window
        </p>
      </div>
    </div>
  )
}

export function OwnedPassesCard({
  passes,
  onList
}: {
  passes: MarketplaceCourse[]
  onList: (course: MarketplaceCourse) => void
}) {
  return (
    <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
      {passes.map(pass => {
        const userState = pass.user
        const transferStatus = userState?.canTransfer
          ? 'Ready'
          : userState
            ? userState.transferAvailableAt === 0n
              ? 'Cooldown'
              : 'Cooldown'
            : 'Not available'
        const transferStatusFull = userState?.canTransfer
          ? 'Ready to transfer'
          : userState
            ? userState.transferAvailableAt === 0n
              ? 'Cooldown settling'
              : `Available ${formatTimestampRelative(userState.transferAvailableAt)}`
            : 'Not available'
        const expiryStatus = userState
          ? userState.expiresAt === 0n
            ? 'No expiry'
            : formatTimestampRelative(userState.expiresAt)
          : '—'
        const durationLabel = formatDurationShort(pass.stats.duration)

        return (
          <div
            key={pass.catalog.courseId.toString()}
            className='group flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card/80 shadow-lg backdrop-blur-sm transition-all hover:shadow-xl'
          >
            {/* Gradient header with overlay */}
            <div
              className={`relative h-32 bg-gradient-to-br ${pass.catalog.coverGradient}`}
            >
              <div className='absolute inset-0 bg-gradient-to-t from-black/40 to-transparent' />

              {/* Status badge */}
              <div className='absolute right-3 top-3'>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                    userState?.canTransfer
                      ? 'bg-primary/90 text-primary-foreground'
                      : 'bg-destructive/90 text-destructive-foreground'
                  }`}
                >
                  {transferStatus}
                </span>
              </div>

              {/* Title overlay */}
              <div className='absolute bottom-3 left-3 right-3'>
                <p className='text-xs font-semibold uppercase tracking-wider text-white/80'>
                  #{pass.catalog.courseId.toString()}
                </p>
                <h3 className='mt-0.5 text-xl font-bold text-white drop-shadow-lg'>
                  {pass.catalog.title}
                </h3>
              </div>
            </div>

            {/* Card content */}
            <div className='flex flex-1 flex-col gap-4 p-5'>
              {/* Info grid */}
              <dl className='grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-xs'>
                <div>
                  <dt className='text-muted-foreground'>Expires</dt>
                  <dd className='mt-0.5 font-semibold text-foreground'>
                    {expiryStatus}
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>Transfer</dt>
                  <dd className='mt-0.5 font-semibold text-foreground'>
                    {transferStatusFull}
                  </dd>
                </div>
                <div className='col-span-2'>
                  <dt className='text-muted-foreground'>Duration</dt>
                  <dd className='mt-0.5 font-semibold text-foreground'>
                    {durationLabel}
                  </dd>
                </div>
              </dl>

              {/* Cooldown message */}
              {!userState?.canTransfer && userState && (
                <div className='rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive'>
                  {userState.transferAvailableAt === 0n
                    ? 'Transfer cooldown is still settling. Try again shortly.'
                    : `Transfer cooldown ends ${formatTimestampRelative(userState.transferAvailableAt)}.`}
                </div>
              )}

              {/* Action button */}
              <Button
                className='mt-auto w-full'
                variant={userState?.canTransfer ? 'default' : 'outline'}
                onClick={() => onList(pass)}
                title={transferStatusFull}
              >
                List pass
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CourseCard({
  course,
  onBuyPrimary,
  onBuyFloor,
  onList,
  onRenew
}: {
  course: MarketplaceCourse
  onBuyPrimary: (course: MarketplaceCourse) => void
  onBuyFloor: (course: MarketplaceCourse) => void
  onList: (course: MarketplaceCourse) => void
  onRenew: (course: MarketplaceCourse) => void
}) {
  const tags = course.catalog.tags
  const nextListingExpiry = getNextListingExpiry(course.listings)
  const nextListingExpiryLabel =
    course.listings.length === 0
      ? '—'
      : nextListingExpiry
        ? formatTimestampRelative(nextListingExpiry)
        : 'No expiry'
  const userState = course.user
  const userHasPass = Boolean(userState?.hasPass)
  const transferReadyLabel = userState?.hasPass
    ? userState.canTransfer
      ? 'Now'
      : formatTimestampRelative(userState.transferAvailableAt)
    : '—'
  const userExpiryLabel = userState?.hasPass
    ? formatTimestampRelative(userState.expiresAt)
    : '—'
  const listTooltip = !userHasPass
    ? 'Mint a membership pass before listing.'
    : userState && !userState.canTransfer
      ? `Transfer cooldown ends ${formatTimestampRelative(userState.transferAvailableAt)}`
      : undefined

  return (
    <div className='group flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card/80 shadow-lg backdrop-blur-sm transition-all hover:shadow-xl'>
      <div
        className={`relative h-40 bg-gradient-to-br ${course.catalog.coverGradient}`}
      >
        <div className='absolute inset-0 bg-gradient-to-t from-black/40 to-transparent' />
        <div className='absolute bottom-4 left-4 right-4'>
          <p className='text-xs font-semibold uppercase tracking-wider text-white/80'>
            #{course.catalog.courseId.toString()}
          </p>
          <h2 className='mt-1 text-2xl font-bold text-white'>
            {course.catalog.title}
          </h2>
        </div>
      </div>

      <div className='flex flex-1 flex-col gap-4 p-6'>
        <div className='flex items-start justify-between gap-3'>
          <p className='text-sm leading-relaxed text-muted-foreground'>
            {course.catalog.subtitle}
          </p>
          <div className='flex flex-col items-end gap-1 rounded-lg bg-primary/10 px-3 py-2'>
            <p className='text-xs font-medium text-muted-foreground'>Primary</p>
            <p className='text-lg font-bold text-foreground'>
              {formatUSDC(course.stats.primaryPrice)}
            </p>
            {course.floorPrice && (
              <p className='text-xs font-medium text-accent'>
                Floor: {formatUSDC(course.floorPrice)}
              </p>
            )}
          </div>
        </div>

        <p className='line-clamp-2 text-sm text-muted-foreground'>
          {course.catalog.summary}
        </p>

        <div className='flex flex-wrap gap-2'>
          {tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className='rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground'
            >
              {tag}
            </span>
          ))}
        </div>

        <dl className='grid gap-3 rounded-lg bg-muted/40 p-4 text-xs sm:grid-cols-2'>
          <StatItem
            label='Listings'
            value={String(course.stats.listingCount)}
          />
          <StatItem
            label='Duration'
            value={formatDurationShort(course.stats.duration)}
          />
          <StatItem
            label='Cooldown'
            value={formatDurationShort(course.stats.cooldown)}
          />
          <StatItem
            label='Next Expiry'
            value={nextListingExpiryLabel}
          />
        </dl>

        {course.listings.length > 0 && (
          <div className='space-y-2 rounded-lg border border-border/30 bg-muted/20 p-3 text-xs'>
            <p className='font-semibold uppercase tracking-wider text-muted-foreground'>
              Active Offers
            </p>
            <div className='space-y-1.5'>
              {course.listings.slice(0, 2).map(listing => (
                <div
                  key={`${listing.seller}-${listing.listedAt.toString()}`}
                  className='flex items-center justify-between rounded-md bg-card/50 px-2 py-1.5'
                >
                  <span className='font-mono text-[0.65rem] text-foreground'>
                    {shortenAddress(listing.seller)}
                  </span>
                  <span className='font-semibold text-foreground'>
                    {formatUSDC(listing.priceUSDC)}
                  </span>
                </div>
              ))}
              {course.listings.length > 2 && (
                <p className='text-center text-muted-foreground'>
                  +{course.listings.length - 2} more
                </p>
              )}
            </div>
          </div>
        )}

        <div className='grid grid-cols-2 gap-2 pt-2'>
          <Button className='w-full' onClick={() => onBuyPrimary(course)}>
            Buy New
          </Button>
          <Button
            className='w-full'
            variant='secondary'
            disabled={course.listings.length === 0}
            onClick={() => onBuyFloor(course)}
          >
            Buy Floor
          </Button>
          <Button
            className='w-full'
            variant='outline'
            disabled={!userHasPass}
            title={listTooltip}
            onClick={() => onList(course)}
          >
            List
          </Button>
          <Button
            className='w-full'
            variant='ghost'
            disabled={!userHasPass}
            onClick={() => onRenew(course)}
          >
            Renew
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className='text-xs text-muted-foreground'>{label}</dt>
      <dd className='font-medium text-foreground'>{value}</dd>
    </div>
  )
}

function LiveListings({ data }: { data: MarketplaceCourse[] }) {
  const listings = data.flatMap(entry =>
    entry.listings.map(listing => ({ listing, course: entry.catalog }))
  )

  if (listings.length === 0) return null

  return (
    <div className='space-y-5 rounded-xl border border-border/50 bg-card/80 p-6 shadow-lg backdrop-blur-sm'>
      <div>
        <h3 className='text-xl font-bold text-foreground'>Live Market</h3>
        <p className='mt-1 text-sm text-muted-foreground'>
          Secondary market opportunities across all courses
        </p>
      </div>
      <ScrollArea className='h-[400px]'>
        <div className='space-y-3 pr-4'>
          {listings.map(({ listing, course }) => (
            <div
              key={`${course.courseId.toString()}-${listing.seller}-${listing.listedAt.toString()}`}
              className='group rounded-lg border border-border/30 bg-muted/20 p-4 transition-colors hover:bg-muted/40'
            >
              <div className='flex items-start justify-between gap-3'>
                <div className='flex-1'>
                  <p className='font-bold text-foreground'>
                    {course.title}
                  </p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    {shortenAddress(listing.seller)} • Listed{' '}
                    {formatTimestampRelative(listing.listedAt)}
                  </p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    {listing.expiresAt === 0n
                      ? 'No expiry'
                      : `Expires ${formatTimestampRelative(listing.expiresAt)}`}
                  </p>
                </div>
                <div className='flex flex-col items-end gap-1 rounded-lg bg-primary/10 px-3 py-2'>
                  <p className='text-xs font-medium text-muted-foreground'>Price</p>
                  <p className='text-lg font-bold text-foreground'>
                    {formatUSDC(listing.priceUSDC)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

export function ListDialog({
  state,
  onClose,
  onSubmit,
  eligibleCourses
}: {
  state: { open: boolean; course?: MarketplaceCourse }
  onClose: () => void
  onSubmit: (payload: {
    price: string
    duration: bigint
    course: MarketplaceCourse
  }) => Promise<void>
  eligibleCourses: MarketplaceCourse[]
}) {
  const [price, setPrice] = useState(SUBSCRIPTION_PRICE_USDC)
  const [duration, setDuration] = useState<bigint>(DEFAULT_LISTING_DURATION)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<
    MarketplaceCourse | undefined
  >(state.course)

  useEffect(() => {
    if (state.open) {
      setPrice(SUBSCRIPTION_PRICE_USDC)
      setDuration(DEFAULT_LISTING_DURATION)
      const fallback = state.course ?? eligibleCourses[0]
      setSelectedCourse(fallback)
    }
  }, [state.open, state.course, eligibleCourses])

  const handleCourseChange = (courseId: string) => {
    const nextCourse = eligibleCourses.find(
      entry => entry.catalog.courseId.toString() === courseId
    )
    setSelectedCourse(nextCourse)
  }

  const handleSubmit = async () => {
    if (!selectedCourse) return
    setIsSubmitting(true)
    try {
      await onSubmit({ price, duration, course: selectedCourse })
    } finally {
      setIsSubmitting(false)
    }
  }

  const transferStatus = selectedCourse?.user
    ? selectedCourse.user.canTransfer
      ? 'ready now'
      : `available ${formatTimestampRelative(selectedCourse.user.transferAvailableAt)}`
    : null
  const passExpiryStatus = selectedCourse?.user?.hasPass
    ? formatTimestampRelative(selectedCourse.user.expiresAt)
    : '—'

  const transferReady = Boolean(selectedCourse?.user?.canTransfer)
  const listingDisabled = isSubmitting || !selectedCourse || !transferReady
  const cooldownLabel =
    selectedCourse?.user && !selectedCourse.user.canTransfer
      ? selectedCourse.user.transferAvailableAt === 0n
        ? 'Transfer cooldown is still settling. Please retry shortly.'
        : `Transfer cooldown ends ${formatTimestampRelative(selectedCourse.user.transferAvailableAt)}.`
      : null
  const listingDisabledReason = (() => {
    if (isSubmitting) return null
    if (!selectedCourse) return 'Select a membership before creating a listing.'
    if (!transferReady) {
      return cooldownLabel ?? 'Transfer cooldown is still active.'
    }
    return null
  })()
  const showCooldownNotice = !transferReady && typeof cooldownLabel === 'string'

  return (
    <Dialog open={state.open} onOpenChange={open => (!open ? onClose() : null)}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>List membership for sale</DialogTitle>
          <DialogDescription>
            Set your price and listing duration. Marketplace fees apply on
            settlement.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {eligibleCourses.length > 1 && (
            <div className='space-y-2'>
              <Label htmlFor='listing-course'>Membership</Label>
              <Select
                value={selectedCourse?.catalog.courseId.toString() ?? ''}
                onValueChange={handleCourseChange}
              >
                <SelectTrigger id='listing-course'>
                  <SelectValue placeholder='Choose a membership' />
                </SelectTrigger>
                <SelectContent>
                  {eligibleCourses.map(option => (
                    <SelectItem
                      key={option.catalog.courseId.toString()}
                      value={option.catalog.courseId.toString()}
                    >
                      {option.catalog.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className='rounded-2xl bg-muted/40 p-4 text-sm'>
            {selectedCourse ? (
              <>
                <p className='font-medium text-foreground'>
                  {selectedCourse.catalog.title}
                </p>
                <p className='text-muted-foreground'>
                  Transfer status {transferStatus ?? 'unavailable'}
                </p>
                <p className='text-muted-foreground'>
                  Pass expires {passExpiryStatus}
                </p>
                <p className='text-muted-foreground'>
                  Cooldown {formatDurationShort(selectedCourse.stats.cooldown)}
                </p>
              </>
            ) : (
              <p className='text-muted-foreground'>
                No memberships are ready to list. Mint a pass or wait for the
                transfer cooldown to end.
              </p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='listing-price'>Listing price (USDC)</Label>
            <Input
              id='listing-price'
              type='number'
              min='0'
              step='0.01'
              value={price}
              onChange={event => setPrice(event.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label>Listing duration</Label>
            <Select
              value={duration.toString()}
              onValueChange={value => setDuration(BigInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select duration' />
              </SelectTrigger>
              <SelectContent>
                {LISTING_DURATION_CHOICES.map(option => (
                  <SelectItem
                    key={option.label}
                    value={option.value.toString()}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant='ghost' onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={listingDisabled}>
            {isSubmitting ? 'Listing...' : 'Create listing'}
          </Button>
        </DialogFooter>

        {showCooldownNotice ? (
          <div className='pt-3' aria-live='polite'>
            <div
              className='flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-400/50 dark:bg-amber-500/15 dark:text-amber-200'
              role='status'
            >
              <span
                className='h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-300'
                aria-hidden='true'
              />
              <span>{cooldownLabel}</span>
            </div>
          </div>
        ) : listingDisabledReason ? (
          <p className='pt-2 text-xs text-muted-foreground'>
            {listingDisabledReason}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
