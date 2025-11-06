'use client'

import { useEffect } from 'react'

import { useAppRouter } from '@/hooks/use-app-router'

import { Button } from '@/components/ui/button'
import { GroupDescriptionEditor } from '@/features/groups/components/group-description-editor'
import { GroupNameEditor } from '@/features/groups/components/group-name-editor'
import { GroupSettingsForm } from '@/features/groups/components/group-settings-form'
import { useGroupContext } from '@/features/groups/context/group-context'

type GroupEditPageProps = {
  params: Promise<{
    groupId: string
  }>
}

export default function GroupEditPage(_props: GroupEditPageProps) {
  const router = useAppRouter()
  const { group, isOwner } = useGroupContext()

  useEffect(() => {
    if (!isOwner) {
      router.replace(`/${group._id}`)
    }
  }, [group._id, isOwner, router])

  if (!isOwner) {
    return null
  }

  return (
    <div className='mx-auto max-w-4xl space-y-6'>
      <div className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
        <GroupNameEditor groupId={group._id} name={group.name} />
      </div>

      <div className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
        <GroupSettingsForm group={group} />
      </div>

      <div className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
        <GroupDescriptionEditor
          editable
          groupId={group._id}
          initialContent={group.description}
        />
      </div>

      <div className='flex justify-end'>
        <Button
          type='button'
          size='lg'
          onClick={() => router.push(`/${group._id}/about`)}
        >
          View Live Group
        </Button>
      </div>
    </div>
  )
}
