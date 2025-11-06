import { redirect } from 'next/navigation'

type GroupRootPageProps = {
  params: Promise<{
    groupId: string
  }>
}

export default async function GroupRootPage({
  params
}: GroupRootPageProps) {
  const resolvedParams = await params
  redirect(`/${resolvedParams.groupId}/about`)
}
