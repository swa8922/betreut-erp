import { NextRequest, NextResponse } from 'next/server'

// Cache deaktivieren
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Kein API Key' }, { status: 503 })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Antworte nur: DORIS_OK' }]
    }),
    cache: 'no-store',
  })
  
  const data = await res.json()
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    http_status: res.status,
    ok: res.ok,
    antwort: data.content?.[0]?.text || null,
    fehler: data.error || null,
    api_key_laenge: apiKey.length,
  }, { headers: { 'Cache-Control': 'no-store, no-cache' } })
}
