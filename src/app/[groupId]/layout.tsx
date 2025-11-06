import { notFound } from 'next/navigation'

import { fetchQuery } from 'convex/nextjs'

import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { GroupLayoutShell } from '@/features/groups/components/group-layout-shell'

type GroupLayoutProps = {
  children: React.ReactNode
  params: Promise<{
    groupId: string
  }>
}

export default async function GroupLayout({
  children,
  params
}: GroupLayoutProps) {
  const resolvedParams = await params
  const rawGroupId = resolvedParams.groupId

  try {
    const group = await fetchQuery(api.groups.get, {
      id: rawGroupId as Id<'groups'>
    })

    if (!group) {
      notFound()
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('ArgumentValidationError') ||
        error.message.includes('Found ID'))
    ) {
      notFound()
    }
    throw error
  }

  const groupId = rawGroupId as Id<'groups'>

  return (
    <GroupLayoutShell groupId={groupId}>{children}</GroupLayoutShell>
  )
}
