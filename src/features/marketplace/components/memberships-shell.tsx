'use client'
import { LoadingIndicator } from '@/components/feedback/loading-indicator'
import {
  ListDialog,
  OwnedPassesCard,
  useMarketplaceCore
} from '@/features/marketplace/components/marketplace-shell'

export function MembershipsShell() {
  const {
    isLoading,
    ownedCourses,
    listDialog,
    openListDialog,
    closeListDialog,
    handleCreateListing,
    contractsConfigured
  } = useMarketplaceCore()

  if (!contractsConfigured) {
    return (
      <section className='mx-auto flex max-w-3xl flex-col gap-4 px-6 py-16 text-center'>
        <h1 className='text-3xl font-semibold text-foreground'>
          Marketplace not configured
        </h1>
        <p className='text-muted-foreground'>
          Provide marketplace and membership contract addresses via environment
          variables to enable listings.
        </p>
      </section>
    )
  }

  return (
    <div className='relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/20'>
      {/* Decorative background elements */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -left-20 top-20 h-96 w-96 rounded-full bg-primary/5 blur-3xl' />
        <div className='absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-accent/5 blur-3xl' />
        <div className='absolute bottom-0 left-1/2 h-72 w-72 rounded-full bg-primary/5 blur-3xl' />
      </div>

      <section className='relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12'>
        {/* Hero Header */}
        <div className='relative overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-10 py-12 text-white shadow-2xl md:px-14'>
          <div className='absolute -right-12 top-12 h-64 w-64 rounded-full bg-primary/20 blur-3xl' />
          <div className='absolute -bottom-12 left-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl' />

          <div className='relative space-y-4'>
            <div className='inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm'>
              <div className='h-2 w-2 rounded-full bg-primary animate-pulse' />
              <p className='text-xs font-semibold uppercase tracking-wider text-white/90'>
                Your Passes
              </p>
            </div>

            <h1 className='text-5xl font-bold leading-tight sm:text-6xl'>
              My
              <br />
              <span className='bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent'>
                Memberships
              </span>
            </h1>

            <p className='max-w-2xl text-lg leading-relaxed text-slate-300'>
              Review all passes owned by your wallet. Track expiration dates and cooldown periods
              for secondary market listings.
            </p>

            {!isLoading && ownedCourses.length > 0 && (
              <div className='flex items-center gap-6 pt-2'>
                <div className='rounded-xl border border-white/20 bg-white/5 px-5 py-3 backdrop-blur-sm'>
                  <p className='text-xs font-medium uppercase tracking-wider text-white/60'>Active Passes</p>
                  <p className='mt-1 text-3xl font-bold text-white'>{ownedCourses.length}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading && (
          <div className='flex flex-col items-center gap-4 rounded-xl border border-border/50 bg-card/60 py-16 text-muted-foreground backdrop-blur-sm'>
            <LoadingIndicator />
            <p className='text-sm font-medium'>Loading your memberships…</p>
          </div>
        )}

        {!isLoading && ownedCourses.length === 0 && (
          <div className='rounded-xl border border-border/50 bg-card/60 px-6 py-16 text-center backdrop-blur-sm'>
            <div className='mx-auto max-w-md space-y-3'>
              <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/50'>
                <svg
                  className='h-8 w-8 text-muted-foreground'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z'
                  />
                </svg>
              </div>
              <h3 className='text-xl font-bold text-foreground'>No Memberships Yet</h3>
              <p className='text-sm text-muted-foreground'>
                Purchase a membership pass from the marketplace to see it here.
              </p>
            </div>
          </div>
        )}

        {!isLoading && ownedCourses.length > 0 && (
          <OwnedPassesCard passes={ownedCourses} onList={openListDialog} />
        )}

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
