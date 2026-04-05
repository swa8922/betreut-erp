import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const status = searchParams.get('status')
  const betreuerinId = searchParams.get('betreuerinId')

  if (id) {
    const { data } = await sb.from('honorarnoten').select('*').eq('id', id).single()
    return NextResponse.json(data || null)
  }

  let q = sb.from('honorarnoten').select('*').order('erstellt_am', { ascending: false })
  if (status) q = q.eq('status', status)
  if (betreuerinId) q = q.eq('betreuerin_id', betreuerinId)

  const { data } = await q
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await sb.from('honorarnoten').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })
  const body = await req.json()
  const { data, error } = await sb.from('honorarnoten').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })
  await sb.from('honorarnoten').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
