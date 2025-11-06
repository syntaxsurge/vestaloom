'use client'

import { useEffect } from 'react'

import { useMutation } from 'convex/react'
import { useAccount } from 'wagmi'

import { api } from '@/convex/_generated/api'
import { GroupDirectory } from '@/features/groups/components/group-directory'

export default function GroupsPage() {
  const { address } = useAccount()
  const storeUser = useMutation(api.users.store)

  useEffect(() => {
    if (!address) return
    storeUser({ address }).catch(() => {
      /* ignore duplicate upsert errors */
    })
  }, [address, storeUser])

  return (
    <div className='relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/20'>
      {/* Decorative background elements */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -left-20 top-20 h-96 w-96 rounded-full bg-primary/5 blur-3xl' />
        <div className='absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-accent/5 blur-3xl' />
        <div className='absolute bottom-0 left-1/2 h-72 w-72 rounded-full bg-primary/5 blur-3xl' />
      </div>

      <main className='relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col gap-12 px-6 pb-24 pt-16 sm:pt-20'>
        {/* Hero Header */}
        <div className='relative overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-10 py-12 text-white shadow-2xl md:px-14'>
          <div className='absolute -right-12 top-12 h-64 w-64 rounded-full bg-primary/20 blur-3xl' />
          <div className='absolute -bottom-12 left-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl' />

          <div className='relative space-y-4'>
            <div className='inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm'>
              <div className='h-2 w-2 rounded-full bg-primary animate-pulse' />
              <p className='text-xs font-semibold uppercase tracking-wider text-white/90'>
                Your Communities
              </p>
            </div>

            <h1 className='text-5xl font-bold leading-tight sm:text-6xl'>
              Manage Your
              <br />
              <span className='bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent'>
                Communities
              </span>
            </h1>

            <p className='max-w-2xl text-lg leading-relaxed text-slate-300'>
              Connect your wallet to instantly access every community you manage or participate in.
              Jump into discussions, courses, and marketplace listings.
            </p>
          </div>
        </div>

        {/* Content */}
        <section className='flex flex-1 flex-col'>
          <GroupDirectory />
        </section>
      </main>
    </div>
  )
}
