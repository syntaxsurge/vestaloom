'use client'

import { GroupAboutSection } from '@/features/groups/components/group-about-section'

type GroupAboutPageProps = {
  params: Promise<{
    groupId: string
  }>
}

export default function GroupAboutPage(_props: GroupAboutPageProps) {
  return <GroupAboutSection />
}
