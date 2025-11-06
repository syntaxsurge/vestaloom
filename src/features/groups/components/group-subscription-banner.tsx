import { useMemo } from 'react'

import { AlertTriangle, Clock, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { SUBSCRIPTION_PRICE_LABEL } from '@/lib/pricing'
import { formatTimestampRelative } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useGroupContext } from '../context/group-context'
import { useRenewSubscription } from '../hooks/use-renew-subscription'

export function GroupSubscriptionBanner() {
  const { isOwner, subscription } = useGroupContext()
  const { renew, isRenewing } = useRenewSubscription()

  const shouldShowBanner = isOwner && (subscription.isExpired || subscription.isRenewalDue)

  const statusLabel = useMemo(() => {
    if (subscription.isExpired) {
      return `Expired ${subscription.endsOn ? formatTimestampRelative(subscription.endsOn) : 'recently'}`
    }
    if (subscription.endsOn) {
      return `Renews ${formatTimestampRelative(subscription.endsOn)}`
    }
    return 'Renewal required soon'
  }, [subscription.endsOn, subscription.isExpired])

  if (!shouldShowBanner) {
    return null
  }

  const handleRenew = async () => {
    try {
      const result = await renew()
      toast.success(
        `Subscription renewed. Next renewal ${result.endsOn ? formatTimestampRelative(result.endsOn) : 'scheduled in 30 days'}.`
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to renew the subscription. Please try again.'
      )
    }
  }

  const isExpired = subscription.isExpired

  return (
    <div
      className={cn(
        'border-b',
        isExpired
          ? 'border-destructive/40 bg-destructive/10'
          : 'border-amber-500/30 bg-amber-500/10'
      )}
    >
      <div className='mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-start gap-3'>
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full border',
              isExpired
                ? 'border-destructive/40 bg-destructive/20 text-destructive'
                : 'border-amber-500/30 bg-amber-500/20 text-amber-600'
            )}
          >
            {isExpired ? (
              <AlertTriangle className='h-5 w-5' />
            ) : (
              <Clock className='h-5 w-5' />
            )}
          </span>
          <div className='space-y-1'>
            <p className='text-sm font-semibold text-foreground'>
              {isExpired
                ? 'Your group is paused until you renew.'
                : 'Renew soon to keep your community online.'}
            </p>
            <p className='text-xs text-muted-foreground'>
              {statusLabel}. Pay {SUBSCRIPTION_PRICE_LABEL} to extend access for 30 days.
            </p>
          </div>
        </div>

        <Button
          onClick={handleRenew}
          disabled={isRenewing}
          className='inline-flex items-center gap-2 self-start sm:self-auto'
        >
          <RefreshCcw className='h-4 w-4' />
          {isRenewing ? 'Processing...' : 'Renew subscription'}
        </Button>
      </div>
    </div>
  )
}
