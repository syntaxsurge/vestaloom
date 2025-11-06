'use client'

import type { ReactNode } from 'react'

import type { Id } from '@/convex/_generated/dataModel'

import { GroupNavTabs } from './group-nav-tabs'
import { GroupSidebar } from './group-sidebar'
import { GroupProvider } from '../context/group-context'
import { GroupSubscriptionBanner } from './group-subscription-banner'

type GroupLayoutShellProps = {
  groupId: Id<'groups'>
  children: ReactNode
  hideSidebar?: boolean
}

export function GroupLayoutShell({ groupId, children, hideSidebar = false }: GroupLayoutShellProps) {
  return (
    <GroupProvider groupId={groupId}>
      <div className='flex min-h-screen flex-col'>
        <GroupNavTabs />
        <GroupSubscriptionBanner />
        <div className='mx-auto w-full max-w-7xl px-6 py-8'>
          {hideSidebar ? (
            <section className='w-full'>{children}</section>
          ) : (
            <div className='flex gap-8'>
              <section className='flex-1 min-w-0'>{children}</section>
              <div className='hidden lg:block sticky top-24 self-start'>
                <GroupSidebar />
              </div>
            </div>
          )}
        </div>
      </div>
    </GroupProvider>
  )
}
