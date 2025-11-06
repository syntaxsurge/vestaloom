'use client'

import Image from 'next/image'

import { cn } from '@/lib/utils'

const DEFAULT_LOGO_WIDTH = 190
const DEFAULT_LOGO_HEIGHT = 40
const ASPECT_RATIO = DEFAULT_LOGO_WIDTH / DEFAULT_LOGO_HEIGHT

interface LogoProps {
  className?: string
  width?: number
  height?: number
  priority?: boolean
  sizes?: string
}

export const Logo = ({
  className,
  width,
  height,
  priority = true,
  sizes = '(max-width: 640px) 112px, 160px'
}: LogoProps) => {
  let resolvedWidth = width
  let resolvedHeight = height

  if (resolvedWidth && !resolvedHeight) {
    resolvedHeight = Math.round(resolvedWidth / ASPECT_RATIO)
  } else if (!resolvedWidth && resolvedHeight) {
    resolvedWidth = Math.round(resolvedHeight * ASPECT_RATIO)
  }

  resolvedWidth ??= DEFAULT_LOGO_WIDTH
  resolvedHeight ??= DEFAULT_LOGO_HEIGHT

  return (
    <Image
      src='/images/vestaloom-logo.png'
      alt='Vestaloom logo'
      width={resolvedWidth}
      height={resolvedHeight}
      priority={priority}
      sizes={sizes}
      className={cn('h-auto w-auto', className)}
    />
  )
}
