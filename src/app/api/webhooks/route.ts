import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const logs = searchParams.get('logs')
  const webhookId = searchParams.get('webhookId')

  if (logs) {
    let q = sb.from('webhook_log').select('*').order('erstellt_am', { ascending: false }).limit(100)
    if (webhookId) q = q.eq('webhook_id', webhookId)
    const { data } = await q
    return NextResponse.json(data || [])
  }

  const { data } = await sb.from('webhooks').select('*').order('erstellt_am', { ascending: false })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, url, events, secret } = body
  if (!name || !url) return NextResponse.json({ error: 'Name und URL fehlen' }, { status: 400 })

  // URL-Format validieren
  try { new URL(url) } catch { return NextResponse.json({ error: 'Ungültige URL' }, { status: 400 }) }

  const record = {
    id: uid(),
    name,
    url,
    events: events || [],
    secret: secret || '',
    aktiv: true,
    erstellt_am: new Date().toISOString(),
    fehler_count: 0,
  }
  const { error } = await sb.from('webhooks').insert(record)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(record)
}

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })
  const body = await req.json()
  await sb.from('webhooks').update(body).eq('id', id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })
  await sb.from('webhooks').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
