import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generiereApiKey } from '@/lib/api-engine'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

export async function GET() {
  const { data } = await sb.from('api_keys').select('id,name,key_prefix,berechtigungen,erstellt_am,letzter_zugriff,aktiv,beschreibung').order('erstellt_am', { ascending: false })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const { name, berechtigungen, beschreibung } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name fehlt' }, { status: 400 })

  const { key, prefix, hash } = generiereApiKey()
  const record = {
    id: uid(),
    name,
    key_hash: hash,
    key_prefix: prefix,
    berechtigungen: berechtigungen || ['read'],
    beschreibung: beschreibung || '',
    erstellt_am: new Date().toISOString(),
    aktiv: true,
  }

  const { error } = await sb.from('api_keys').insert(record)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Key NUR einmal zurückgeben — danach nicht mehr abrufbar!
  return NextResponse.json({ ...record, key, key_hash: undefined })
}

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })
  const body = await req.json()
  await sb.from('api_keys').update(body).eq('id', id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })
  await sb.from('api_keys').update({ aktiv: false }).eq('id', id)
  return NextResponse.json({ ok: true })
}
