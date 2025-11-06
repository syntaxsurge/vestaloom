'use client'

import { useMemo, useState } from 'react'

import { useQuery } from 'convex/react'

import { LoadingIndicator } from '@/components/feedback/loading-indicator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import { useAppRouter } from '@/hooks/use-app-router'

import { GroupCard } from './group-card'

type DirectoryEntry = {
  group: Doc<'groups'>
  owner: Doc<'users'> | null
  memberCount: number
}

export function GroupDirectory() {
  const router = useAppRouter()
  const entries = useQuery(api.groups.directory, {}) as
    | DirectoryEntry[]
    | undefined

  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string>('all')

  const allTags = useMemo(() => {
    if (!entries) return []
    const tagSet = new Set<string>()
    for (const entry of entries) {
      for (const tag of entry.group.tags ?? []) {
        tagSet.add(tag)
      }
    }
    return Array.from(tagSet).sort()
  }, [entries])

  const filteredEntries = useMemo(() => {
    if (!entries) return []
    return entries.filter(({ group }) => {
      const matchesTag =
        activeTag === 'all' ||
        (group.tags ?? []).some(tag => tag === activeTag)

      if (!matchesTag) return false

      if (!search.trim()) return true

      const query = search.trim().toLowerCase()
      return (
        group.name.toLowerCase().includes(query) ||
        (group.shortDescription ?? '').toLowerCase().includes(query)
      )
    })
  }, [activeTag, entries, search])

  if (entries === undefined) {
    return <LoadingIndicator fullScreen />
  }

  if (!entries.length) {
    return (
      <div className='w-full rounded-xl border border-border/50 bg-card/60 px-6 py-20 text-center backdrop-blur-sm'>
        <div className='mx-auto max-w-md space-y-4'>
          <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/50'>
            <svg
              className='h-8 w-8 text-muted-foreground'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
              />
            </svg>
          </div>
          <h3 className='text-xl font-bold text-foreground'>
            No Communities Yet
          </h3>
          <p className='text-sm text-muted-foreground'>
            No communities found yet. Create one to get started and build your community.
          </p>
          <div className='pt-2'>
            <Button onClick={() => router.push('/create')} size='lg'>
              Create a Group
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='w-full space-y-10'>
      {/* Section Header */}
      <div className='space-y-6'>
        <div className='space-y-3'>
          <h2 className='text-4xl font-bold text-foreground'>
            Discover Communities
          </h2>
          <p className='text-base text-muted-foreground'>
            Explore communities or{' '}
            <button
              onClick={() => router.push('/create')}
              className='font-semibold text-primary underline-offset-4 hover:underline'
            >
              create your own
            </button>
          </p>
        </div>

        {/* Search and Filters Row */}
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex-1 sm:max-w-md'>
            <Input
              placeholder='Search communities...'
              value={search}
              onChange={event => setSearch(event.target.value)}
              className='h-11 text-base'
            />
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <button
              type='button'
              onClick={() => setActiveTag('all')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeTag === 'all'
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                type='button'
                onClick={() => setActiveTag(tag)}
                className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition-all ${
                  activeTag === tag
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      {filteredEntries.length ? (
        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
          {filteredEntries.map(entry => (
            <GroupCard
              key={entry.group._id}
              group={entry.group}
              owner={entry.owner}
              memberCount={entry.memberCount}
            />
          ))}
        </div>
      ) : (
        <div className='rounded-xl border border-border/50 bg-card/60 py-16 text-center backdrop-blur-sm'>
          <p className='text-sm text-muted-foreground'>
            No communities match your filters. Try another tag or clear your search.
          </p>
        </div>
      )}
    </div>
  )
}
