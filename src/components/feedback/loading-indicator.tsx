import { Loader2 } from 'lucide-react'

type LoadingIndicatorProps = {
  fullScreen?: boolean
}

export function LoadingIndicator({
  fullScreen = false
}: LoadingIndicatorProps) {
  return (
    <div
      className={[
        'flex w-full items-center justify-center',
        fullScreen
          ? 'min-h-[60vh] px-4 py-24'
          : 'h-24 px-4'
      ].join(' ')}
    >
      <Loader2
        className='h-16 w-16 animate-spin text-muted-foreground duration-700'
        aria-hidden='true'
      />
      <span className='sr-only'>Loading</span>
    </div>
  )
}
