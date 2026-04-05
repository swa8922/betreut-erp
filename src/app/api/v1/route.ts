import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validiereApiKey } from '@/lib/api-engine'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.headers.set('X-API-Version', '2026-04-01')
  return res
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(req: NextRequest) {
  const auth = await validiereApiKey(req.headers.get('Authorization'))
  if (!auth.ok) {
    return cors(NextResponse.json({ error: auth.fehler, code: 'unauthorized' }, { status: 401 }))
  }

  const { searchParams } = new URL(req.url)
  const resource = searchParams.get('resource')
  const id = searchParams.get('id')
  const limit = Math.min(Number(searchParams.get('limit') || 50), 500)
  const offset = Number(searchParams.get('offset') || 0)

  const ALLOWED = ['klienten', 'betreuerinnen', 'einsaetze', 'finanzen_dokumente', 'honorarnoten']
  if (!resource || !ALLOWED.includes(resource)) {
    return cors(NextResponse.json({
      error: 'Ressource fehlt oder nicht erlaubt',
      erlaubt: ALLOWED,
      code: 'invalid_resource',
    }, { status: 400 }))
  }

  try {
    if (id) {
      const { data, error } = await sb.from(resource).select('*').eq('id', id).single()
      if (error || !data) return cors(NextResponse.json({ error: 'Nicht gefunden', code: 'not_found' }, { status: 404 }))
      return cors(NextResponse.json({ data, meta: { resource, id } }))
    }

    const { data, count } = await sb.from(resource).select('*', { count: 'exact' }).range(offset, offset + limit - 1)
    return cors(NextResponse.json({
      data: data || [],
      meta: { resource, total: count, limit, offset, version: '2026-04-01' },
    }))
  } catch (e: any) {
    return cors(NextResponse.json({ error: e.message, code: 'server_error' }, { status: 500 }))
  }
}

export async function POST(req: NextRequest) {
  const auth = await validiereApiKey(req.headers.get('Authorization'))
  if (!auth.ok) return cors(NextResponse.json({ error: auth.fehler, code: 'unauthorized' }, { status: 401 }))
  if (!auth.berechtigungen?.includes('write')) {
    return cors(NextResponse.json({ error: 'Keine Schreibberechtigung', code: 'forbidden' }, { status: 403 }))
  }

  const { searchParams } = new URL(req.url)
  const resource = searchParams.get('resource')
  const WRITABLE = ['klienten', 'betreuerinnen', 'einsaetze']
  if (!resource || !WRITABLE.includes(resource)) {
    return cors(NextResponse.json({ error: 'Ressource nicht beschreibbar', code: 'invalid_resource' }, { status: 400 }))
  }

  const body = await req.json()
  const { data, error } = await sb.from(resource).insert(body).select().single()
  if (error) return cors(NextResponse.json({ error: error.message, code: 'db_error' }, { status: 500 }))
  return cors(NextResponse.json({ data, meta: { resource, created: true } }, { status: 201 }))
}
