'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'

import { cn } from '@/lib/utils'
import { useGroupContext } from '../context/group-context'

const TABS = [
  { label: 'About', suffix: '/about', key: 'about' as const },
  { label: 'Feed', suffix: '/feed', key: 'feed' as const },
  { label: 'Classroom', suffix: '/classroom', key: 'classroom' as const },
  { label: 'Members', suffix: '/members', key: 'members' as const }
]

export function GroupNavTabs() {
  const pathname = usePathname()
  const params = useParams()
  const groupId = typeof params?.groupId === 'string' ? params.groupId : ''
  const { access } = useGroupContext()

  if (!groupId) {
    return null
  }

  return (
    <nav className='border-b border-border bg-card'>
      <ul className='mx-auto flex max-w-6xl items-center gap-1 px-6'>
        {TABS.filter(tab => access[tab.key]).map(tab => {
          const href = `/${groupId}${tab.suffix}`
          const isActive =
            pathname === href ||
            (tab.suffix && pathname?.startsWith(`${href}/`)) ||
            (tab.key === 'about' &&
              (pathname === `/${groupId}` || pathname === `/${groupId}/`))

          return (
            <li key={tab.key}>
              <Link
                href={href}
                className={cn(
                  'relative inline-flex items-center border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
