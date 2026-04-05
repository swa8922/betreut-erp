// src/app/api/ai/route.ts — Alfred, Doris, Leselotte
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht gesetzt' }, { status: 503 })

  try {
    const body = await req.json()

    // MIME-Types normalisieren — Word-Dokumente haben verschiedene MIME-Typen
    const normalizeMessages = (messages: any[]) => messages.map((msg: any) => ({
      ...msg,
      content: Array.isArray(msg.content) ? msg.content.map((c: any) => {
        if (c.type === 'document' && c.source?.media_type) {
          // Word-Dokumente normalisieren
          const mt = c.source.media_type
          if (mt.includes('msword') || mt.includes('openxmlformats') || mt.includes('word')) {
            return { ...c, source: { ...c.source, media_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } }
          }
        }
        return c
      }) : msg.content
    }))

    const requestBody: any = {
      model: body.model || 'claude-sonnet-4-20250514',
      max_tokens: body.max_tokens || 1024,
      messages: normalizeMessages(body.messages),
    }
    if (body.system) requestBody.system = body.system
    if (body.tools) requestBody.tools = body.tools      // Leselotte web_search
    if (body.betas) requestBody.betas = body.betas

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',   // für Leselotte
      },
      body: JSON.stringify(requestBody),
      cache: 'no-store',
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('[AI] Fehler:', res.status, data.error?.message)
      return NextResponse.json({ error: data.error?.message || `HTTP ${res.status}`, details: data }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('[AI] Exception:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
