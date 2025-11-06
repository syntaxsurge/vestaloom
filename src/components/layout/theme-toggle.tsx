'use client'

import { useEffect, useState } from 'react'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === 'dark'

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  const icon = isDark ? <Sun className='h-4 w-4' /> : <Moon className='h-4 w-4' />
  const label = mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle theme'

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      aria-label={label}
      title={label}
      onClick={handleToggle}
      className='rounded-full'
    >
      {mounted ? icon : <div className='h-4 w-4' />}
    </Button>
  )
}
