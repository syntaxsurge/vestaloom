import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const headerKey = request.headers.get('x-kwala-api-key') ?? ''
    if (process.env.KWALA_ACTION_API_KEY && headerKey !== process.env.KWALA_ACTION_API_KEY) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    console.info('kwala action status callback', payload)

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
