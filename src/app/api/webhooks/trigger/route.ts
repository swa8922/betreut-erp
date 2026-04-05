import { NextRequest, NextResponse } from 'next/server'
import { loescheWebhook, type WebhookEvent } from '@/lib/api-engine'

export async function POST(req: NextRequest) {
  const { event, data } = await req.json()
  if (!event) return NextResponse.json({ error: 'Event fehlt' }, { status: 400 })

  const ergebnisse = await loescheWebhook(event as WebhookEvent, data || {})
  return NextResponse.json({ ok: true, ausgeloest: ergebnisse?.length || 0 })
}
