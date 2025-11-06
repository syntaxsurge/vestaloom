import Link from 'next/link'
import { ArrowLeft, Compass } from 'lucide-react'

type NotFoundViewProps = {
  title?: string
  message?: string
}

export function NotFoundView({
  title = 'Page not found',
  message = 'The page you’re looking for either moved or no longer exists.'
}: NotFoundViewProps) {
  return (
    <div className='relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-background via-background to-muted/40 px-6 py-16 text-center shadow-xl sm:px-10'>
      <div className='absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(79,_70,_229,_0.12),_transparent_55%)]' />
      <span className='inline-flex items-center rounded-full border border-muted-foreground/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
        404 error
      </span>
      <h1 className='mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl'>
        {title}
      </h1>
      <p className='mt-4 max-w-xl text-base text-muted-foreground sm:text-lg'>
        {message}
      </p>
      <div className='mt-10 flex flex-col items-center gap-3 sm:flex-row'>
        <Link
          href='/'
          className='inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
        >
          <ArrowLeft className='h-4 w-4' aria-hidden='true' />
          Go back home
        </Link>
        <Link
          href='/groups'
          className='inline-flex items-center justify-center gap-2 rounded-full border border-border/70 px-6 py-3 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
        >
          <Compass className='h-4 w-4' aria-hidden='true' />
          Explore communities
        </Link>
      </div>
    </div>
  )
}
