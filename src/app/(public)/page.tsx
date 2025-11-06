'use client'

import Link from 'next/link'
import { useEffect } from 'react'

import { useMutation } from 'convex/react'
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { useAccount } from 'wagmi'

import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'

const highlights = [
  { label: 'Live quests processed', value: '12,800+' },
  { label: 'Badges minted on Somnia', value: '4,600+' },
  { label: 'Automation success rate', value: '99.7%' }
]

const features = [
  {
    title: 'Somnia-first credentials',
    description:
      'Capture proof-of-work with Somnia Data Streams so learners, DAOs, and partners can trust every submission in real time.'
  },
  {
    title: 'Automation without servers',
    description:
      'Trigger Kwala YAML workflows whenever quests resolve to mint badges, notify teams, or mirror data cross-chain – no backend to maintain.'
  },
  {
    title: 'Composable primitives',
    description:
      'Extend Vestaloom’s quest schemas and badge contracts inside your own dApp or hackathon project with just a few imports.'
  }
]

const steps = [
  {
    title: 'Define a quest',
    detail:
      'Describe the skill signal you want to capture, attach a proof URI, and share the Somnia quest link with your community.'
  },
  {
    title: 'Watch SDS in action',
    detail:
      'Learners complete quests and Vestaloom publishes structured data to Somnia Data Streams, powering dashboards and live feeds instantly.'
  },
  {
    title: 'Automate rewards',
    detail:
      'Kwala nodes pick up the on-chain event, mint a badge, and optionally mirror achievements anywhere else you need them.'
  }
]

const testimonials = [
  {
    name: 'Taylor Morgan',
    role: 'Founder, Creator Commons',
    quote:
      '“Vestaloom gives us verifiable progress without building infra. Somnia Data Streams and Kwala let the team focus on content, not ops.”'
  },
  {
    name: 'Avery Chen',
    role: 'Lead Instructor, Somnia Academy',
    quote:
      '“Shipping hackathon quests has never been faster. The YAML automations deploy in minutes and the SDS feed keeps mentors in sync.”'
  }
]

export default function HomePage() {
  const { address } = useAccount()
  const storeUser = useMutation(api.users.store)
  useEffect(() => {
    if (!address) return
    storeUser({ address }).catch(() => {
      /* ignore duplicate upsert errors */
    })
  }, [address, storeUser])

  return (
    <main className='relative overflow-hidden'>
      <div
        className='pointer-events-none absolute inset-x-0 top-[-12rem] h-[32rem] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_65%)] sm:top-[-18rem]'
        aria-hidden='true'
      />

      <div className='mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col gap-24 px-6 pb-24 pt-20 sm:pt-28'>
        <section className='grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center'>
          <div className='space-y-8'>
            <span className='inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground shadow-sm backdrop-blur'>
              <Sparkles className='h-3.5 w-3.5 text-primary' aria-hidden='true' />
              Build the community you always imagined
            </span>
            <div className='space-y-6'>
              <h1 className='text-balance text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl'>
                The modern home for your paid community and courses
              </h1>
              <p className='max-w-xl text-lg text-muted-foreground'>
                Vestaloom is the fastest way to launch verifiable quests on Somnia. Stream progress over SDS, trigger
                Kwala automations, and reward your community without managing custom infrastructure.
              </p>
            </div>
            <div className='flex flex-col items-start gap-3 sm:flex-row sm:items-center'>
              <Button size='lg' asChild>
                <Link href='/create'>
                  Launch a community
                  <ArrowRight className='ml-2 h-4 w-4' aria-hidden='true' />
                </Link>
              </Button>
              <Button size='lg' variant='ghost' asChild>
                <Link href='/groups'>Explore your communities</Link>
              </Button>
            </div>
            <dl className='grid gap-6 sm:grid-cols-3'>
              {highlights.map(item => (
                <div key={item.label}>
                  <dt className='text-xs uppercase tracking-wide text-muted-foreground'>{item.label}</dt>
                  <dd className='mt-1 text-2xl font-semibold text-foreground'>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className='relative'>
            <div className='absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-2xl' />
            <div className='relative rounded-3xl border border-border/80 bg-card/90 p-6 shadow-2xl backdrop-blur'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-xs uppercase tracking-wide text-muted-foreground'>Revenue this month</p>
                  <p className='text-3xl font-semibold text-foreground'>$82,460</p>
                </div>
                <span className='inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary'>
                  +18% vs last month
                </span>
              </div>
              <div className='mt-8 space-y-5'>
                {[
                  { title: 'Active members', value: '1,204', trend: '+96' },
                  { title: 'Renewals processed', value: '312', trend: '+12%' },
                  { title: 'Courses completed', value: '486', trend: '+53' }
                ].map(metric => (
                  <div key={metric.title} className='flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm'>
                    <div>
                      <p className='text-sm font-medium text-foreground'>{metric.title}</p>
                      <p className='text-xs text-muted-foreground'>{metric.trend} this week</p>
                    </div>
                    <p className='text-lg font-semibold text-foreground'>{metric.value}</p>
                  </div>
                ))}
              </div>
              <div className='mt-8 flex items-center gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground'>
                <ShieldCheck className='h-5 w-5 text-primary' aria-hidden='true' />
                <span>USDC payments settle instantly to your treasury wallet.</span>
              </div>
            </div>
          </div>
        </section>

        <section className='space-y-12'>
          <div className='space-y-4 text-center'>
            <p className='text-xs font-medium uppercase tracking-wide text-primary'>Why creators choose Vestaloom</p>
            <h2 className='text-3xl font-semibold text-foreground sm:text-4xl'>
              Everything you need to run a thriving membership
            </h2>
            <p className='mx-auto max-w-2xl text-base text-muted-foreground'>
              Combine vibrant discussions, structured learning, and recurring revenue in one elegant hub branded as
              your own.
            </p>
          </div>
          <div className='grid gap-6 md:grid-cols-3'>
            {features.map(feature => (
              <div
                key={feature.title}
                className='h-full rounded-3xl border border-border/70 bg-gradient-to-br from-background/95 via-background/70 to-background/95 p-8 text-left shadow-lg'
              >
                <h3 className='text-xl font-semibold text-foreground'>{feature.title}</h3>
                <p className='mt-3 text-sm text-muted-foreground'>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className='grid gap-10 rounded-3xl border border-border/70 bg-card/90 p-10 shadow-xl backdrop-blur-md lg:grid-cols-[1fr_1.1fr]'>
          <div className='space-y-4'>
            <h2 className='text-3xl font-semibold text-foreground'>How it works</h2>
            <p className='text-base text-muted-foreground'>
              We rebuilt the community stack from the ground up so you can deliver premium experiences without
              compromising ownership or speed.
            </p>
            <div className='mt-8 space-y-6'>
              {steps.map((step, index) => (
                <div key={step.title} className='flex items-start gap-4'>
                  <span className='flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary'>
                    {index + 1}
                  </span>
                  <div>
                    <h3 className='text-lg font-medium text-foreground'>{step.title}</h3>
                    <p className='mt-1 text-sm text-muted-foreground'>{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className='grid gap-6 lg:grid-cols-2'>
            {testimonials.map(testimonial => (
              <figure
                key={testimonial.name}
                className='flex h-full flex-col justify-between rounded-3xl border border-border/60 bg-background/80 p-6 shadow-md'
              >
                <blockquote className='text-sm text-muted-foreground'>{testimonial.quote}</blockquote>
                <figcaption className='mt-6'>
                  <p className='text-sm font-semibold text-foreground'>{testimonial.name}</p>
                  <p className='text-xs text-muted-foreground'>{testimonial.role}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className='space-y-6 rounded-3xl border border-border/70 bg-card/90 p-10 shadow-xl backdrop-blur-md'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='space-y-2'>
              <h2 className='text-3xl font-semibold text-foreground sm:text-4xl'>Ready to see your communities?</h2>
              <p className='max-w-xl text-sm text-muted-foreground'>
                Browse every group you own or participate in, manage memberships, and jump into the conversation from a
                dedicated overview page.
              </p>
            </div>
            <div className='flex flex-col gap-3 sm:flex-row'>
              <Button asChild>
                <Link href='/groups'>
                  View your groups
                  <ArrowRight className='ml-2 h-4 w-4' aria-hidden='true' />
                </Link>
              </Button>
              <Button asChild variant='outline'>
                <Link href='/create'>
                  Create a group
                  <Sparkles className='ml-2 h-4 w-4' aria-hidden='true' />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
