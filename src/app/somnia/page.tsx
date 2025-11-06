'use client'

import { FormEvent, useMemo, useState } from 'react'

import { formatDistanceToNow } from 'date-fns'
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { zeroAddress } from 'viem'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useQuestFeed } from '@/lib/streams/useQuestFeed'
import { somniaTestnet } from '@/lib/chains/somnia'

const VESTA_QUEST_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'questId', type: 'uint256' },
      { internalType: 'string', name: 'proofUri', type: 'string' }
    ],
    name: 'completeQuest',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

const VESTA_BADGE_ABI = [
  {
    inputs: [],
    name: 'nextTokenId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

const questAddress = (process.env.NEXT_PUBLIC_VESTA_QUEST_ADDRESS ?? zeroAddress) as `0x${string}`
const badgeAddress = (process.env.NEXT_PUBLIC_VESTA_BADGE_ADDRESS ?? zeroAddress) as `0x${string}`

export default function SomniaOpsPage() {
  const { address } = useAccount()
  const [questId, setQuestId] = useState(1)
  const [proofUri, setProofUri] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { entries, error } = useQuestFeed()

  const { writeContractAsync } = useWriteContract()
  const { data: nextTokenId } = useReadContract({
    abi: VESTA_BADGE_ABI,
    address: badgeAddress,
    functionName: 'nextTokenId',
    query: { enabled: badgeAddress !== zeroAddress }
  })

  const badgeCount = useMemo(() => {
    try {
      if (!nextTokenId) return 0
      return typeof nextTokenId === 'bigint' ? Number(nextTokenId) : Number.parseInt(String(nextTokenId), 10)
    } catch {
      return 0
    }
  }, [nextTokenId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (questAddress === zeroAddress) {
      toast.error('Quest contract address is not configured')
      return
    }

    if (!address) {
      toast.error('Connect a wallet to submit a quest')
      return
    }

    try {
      setSubmitting(true)
      const txHash = await writeContractAsync({
        abi: VESTA_QUEST_ABI,
        address: questAddress,
        functionName: 'completeQuest',
        chainId: somniaTestnet.id,
        args: [BigInt(questId), proofUri.trim()]
      })

      toast.success('Quest submitted on Somnia', { description: txHash })

      await fetch('/api/sds/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          player: address,
          questId,
          proofUri: proofUri.trim()
        })
      })

      toast.success('Somnia Data Streams updated')
      setProofUri('')
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Something went wrong while completing the quest'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-12'>
      <section className='space-y-6 rounded-3xl border border-border/70 bg-card/90 p-10 shadow-xl backdrop-blur-md'>
        <span className='inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground shadow-sm'>
          Somnia Shannon testnet • Chain ID {somniaTestnet.id}
        </span>
        <h1 className='text-balance text-4xl font-semibold text-foreground sm:text-5xl'>Vestaloom Somnia Ops</h1>
        <p className='max-w-3xl text-base text-muted-foreground'>
          Complete quests, stream verified progress to Somnia Data Streams, and let Kwala automations mint the badge for
          you. This module powers the Somnia Data Streams Mini Hackathon and the Build with Kwala Hacker House with a
          single deployment.
        </p>
        <div className='grid gap-6 sm:grid-cols-3'>
          <StatCard label='Quests completed (live)' value={entries.length.toString()} />
          <StatCard label='Badges minted' value={badgeCount.toString()} />
          <StatCard label='SDS publisher' value={(process.env.NEXT_PUBLIC_SDS_PUBLISHER_ADDRESS ?? '').toString()} />
        </div>
      </section>

      <section className='grid gap-8 rounded-3xl border border-border/70 bg-background/80 p-8 shadow-lg lg:grid-cols-[1fr_1.1fr]'>
        <div className='space-y-6'>
          <h2 className='text-2xl font-semibold text-foreground'>Complete a quest</h2>
          <p className='text-sm text-muted-foreground'>
            Submit a quest and proof URI from your connected wallet. The transaction fires a `QuestCompleted` event on
            Somnia which is mirrored into Somnia Data Streams and consumed by the Kwala workflow to mint badges.
          </p>
          <form className='space-y-5' onSubmit={handleSubmit}>
            <div className='space-y-2'>
              <Label htmlFor='questId'>Quest ID</Label>
              <Input
                id='questId'
                type='number'
                min={1}
                value={questId}
                onChange={event => setQuestId(Number.parseInt(event.target.value, 10))}
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='proofUri'>Proof URI</Label>
              <Textarea
                id='proofUri'
                value={proofUri}
                onChange={event => setProofUri(event.target.value)}
                required
                placeholder='https://...'
              />
            </div>
            <Button type='submit' size='lg' className='w-full sm:w-auto' disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' />
                  Recording quest...
                </>
              ) : (
                <>
                  Submit quest
                  <ArrowRight className='ml-2 h-4 w-4' aria-hidden='true' />
                </>
              )}
            </Button>
          </form>
        </div>

        <div className='h-full rounded-3xl border border-border/70 bg-card/80 p-6 shadow-inner'>
          <h3 className='text-xl font-semibold text-foreground'>Live quest feed</h3>
          <p className='mt-1 text-xs text-muted-foreground'>
            Updates are fetched from Somnia Data Streams every few seconds using the shared schema defined in
            `src/lib/streams/schemas.ts`.
          </p>
          <div className='mt-6 space-y-4'>
            {error && (
              <div className='rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
                {error}
              </div>
            )}
            {entries.length === 0 ? (
              <div className='rounded-xl border border-border/60 bg-background/60 p-6 text-sm text-muted-foreground'>
                No quest progress yet — complete your first quest to populate the stream.
              </div>
            ) : (
              <ul className='space-y-3'>
                {entries
                  .slice()
                  .reverse()
                  .map(entry => (
                    <li
                      key={entry.id}
                      className='rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-foreground shadow'
                    >
                      <div className='flex items-center justify-between gap-3'>
                        <div className='flex items-center gap-2'>
                          <CheckCircle2 className='h-4 w-4 text-primary' aria-hidden='true' />
                          <span className='font-medium'>Quest {entry.questId.toString()}</span>
                        </div>
                        <span className='text-xs text-muted-foreground'>
                          {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                        </span>
                      </div>
                      <p className='mt-2 text-xs break-words text-muted-foreground'>Player: {entry.player}</p>
                      {entry.proofUri && (
                        <a
                          href={entry.proofUri}
                          target='_blank'
                          rel='noreferrer'
                          className='mt-2 inline-flex text-xs text-primary underline-offset-4 hover:underline'
                        >
                          View proof
                        </a>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

type StatCardProps = {
  label: string
  value: string
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className='rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm'>
      <dt className='text-xs uppercase tracking-wide text-muted-foreground'>{label}</dt>
      <dd className='mt-1 text-2xl font-semibold text-foreground'>{value}</dd>
    </div>
  )
}
