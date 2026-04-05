import { NextRequest, NextResponse } from 'next/server'

// Body-Limit: Next.js App Router unterstützt kein config-Export mehr — Standard-Limit gilt
import { createClient } from '@supabase/supabase-js'

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

// GET alle Vorlagen (ohne pdf_base64 für Liste)
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const db = getDb()

  if (id) {
    // Einzelne Vorlage mit PDF
    const { data, error } = await db.from('pdf_vorlagen').select('*').eq('id', id).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(data)
  }

  // Liste ohne pdf_base64 (zu groß)
  const { data, error } = await db.from('pdf_vorlagen')
    .select('id, name, beschreibung, typ, platzhalter, erstellt_am, erstellt_von, aktiv')
    .eq('aktiv', true)
    .order('erstellt_am', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST neue Vorlage
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { data, error } = await db.from('pdf_vorlagen').insert({
    id: body.id,
    name: body.name,
    beschreibung: body.beschreibung || '',
    typ: body.typ || 'sonstiges',
    pdf_base64: body.pdf_base64,
    platzhalter: body.platzhalter || [],
    positionen: body.positionen || [],
    erstellt_am: body.erstellt_am || new Date().toISOString().split('T')[0],
    erstellt_von: body.erstellt_von || '',
    aktiv: true,
  }).select().single()
  if (error) {
    console.error('[PDF-Vorlagen POST]', error)
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

// PATCH Vorlage aktualisieren
export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })
  const db = getDb()
  const body = await req.json()
  const update: any = {}
  if (body.name !== undefined) update.name = body.name
  if (body.beschreibung !== undefined) update.beschreibung = body.beschreibung
  if (body.typ !== undefined) update.typ = body.typ
  if (body.pdf_base64 !== undefined) update.pdf_base64 = body.pdf_base64
  if (body.platzhalter !== undefined) update.platzhalter = body.platzhalter
  if (body.positionen !== undefined) update.positionen = body.positionen
  const { data, error } = await db.from('pdf_vorlagen').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })
  const db = getDb()
  const { error } = await db.from('pdf_vorlagen').update({ aktiv: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
