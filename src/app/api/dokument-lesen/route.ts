// src/app/api/dokument-lesen/route.ts
// Server-seitiger Dokument-Leser
// Word (.docx) via mammoth (läuft nur server-seitig, nicht im Browser)
// PDF via Claude Vision API
// TXT direkt dekodiert

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { base64, dateiName, mediaType } = body as {
      base64: string
      dateiName: string
      mediaType: string
    }

    if (!base64 || !dateiName) {
      return NextResponse.json({ error: 'base64 und dateiName erforderlich' }, { status: 400 })
    }

    const ext = dateiName.split('.').pop()?.toLowerCase() || ''
    const buffer = Buffer.from(base64, 'base64')

    // ── WORD (.docx / .doc) ────────────────────────────────
    if (ext === 'docx' || ext === 'doc') {
      // Zuerst mammoth versuchen
      try {
        const mammoth = await import('mammoth')
        const cleanBuffer = Buffer.from(buffer)
        const [htmlResult, textResult] = await Promise.all([
          mammoth.convertToHtml({ buffer: cleanBuffer }),
          mammoth.extractRawText({ buffer: cleanBuffer }),
        ])
        if (textResult.value && textResult.value.trim().length > 10) {
          return NextResponse.json({
            ok: true, dateiTyp: 'docx',
            text: textResult.value || '',
            html: htmlResult.value || '',
            warnungen: htmlResult.messages?.map((m: any) => m.message) || [],
          })
        }
        throw new Error('Kein Text extrahiert')
      } catch (mammothErr: any) {
        // Fallback: Claude Vision API für DOCX (als Binärdatei analysieren)
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          return NextResponse.json({
            ok: false, dateiTyp: 'docx', text: '', html: '',
            fehler: `Word konnte nicht gelesen werden: ${mammothErr.message}. Bitte als PDF oder TXT speichern.`,
          })
        }
        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4000,
              messages: [{
                role: 'user',
                content: [
                  { type: 'document', source: { type: 'base64', media_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: base64 } },
                  { type: 'text', text: 'Extrahiere den vollständigen Text aus diesem Word-Dokument. Nur reiner Text, keine Kommentare.' }
                ]
              }]
            })
          })
          const data = await response.json()
          const text = data.content?.[0]?.text || ''
          if (text) {
            const html = text.split('\n\n').filter(Boolean).map((p: string) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('\n')
            return NextResponse.json({ ok: true, dateiTyp: 'docx', text, html, warnungen: [] })
          }
        } catch {}
        return NextResponse.json({
          ok: false, dateiTyp: 'docx', text: '', html: '',
          fehler: `Word konnte nicht gelesen werden: ${mammothErr.message}. Bitte als PDF oder TXT speichern.`,
        })
      }

    }

    // ── PDF ────────────────────────────────────────────────
    else if (ext === 'pdf') {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey || apiKey.includes('HIER')) {
        return NextResponse.json({
          ok: false,
          dateiTyp: 'pdf',
          text: '',
          html: '',
          fehler: 'ANTHROPIC_API_KEY nicht konfiguriert. Bitte in .env.local eintragen.',
        })
      }

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: base64,
                  },
                },
                {
                  type: 'text',
                  text: 'Lies den gesamten Text aus diesem Dokument. Gib NUR den reinen Text zurück, keine Kommentare oder Erklärungen. Bewahre Absätze, Überschriften und Struktur.',
                },
              ],
            }],
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          return NextResponse.json({
            ok: false,
            dateiTyp: 'pdf',
            text: '',
            html: '',
            fehler: `Claude API Fehler: ${data.error?.message || response.status}`,
          })
        }

        const text: string = data.content?.[0]?.text || ''
        // Einfache HTML-Konvertierung für Lesbarkeit
        const html = text
          .split('\n\n')
          .filter(Boolean)
          .map(p => {
            const trimmed = p.trim()
            if (trimmed.match(/^#{1,3}\s/)) {
              return `<h3>${trimmed.replace(/^#{1,3}\s/, '')}</h3>`
            }
            return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`
          })
          .join('\n')

        return NextResponse.json({ ok: true, dateiTyp: 'pdf', text, html, warnungen: [] })
      } catch (err: any) {
        return NextResponse.json({
          ok: false,
          dateiTyp: 'pdf',
          text: '',
          html: '',
          fehler: `Netzwerkfehler: ${err.message}`,
        })
      }
    }

    // ── TXT ────────────────────────────────────────────────
    else if (ext === 'txt') {
      const text = buffer.toString('utf-8')
      const html = text
        .split('\n')
        .map(l => `<p>${l || '&nbsp;'}</p>`)
        .join('\n')
      return NextResponse.json({ ok: true, dateiTyp: 'txt', text, html, warnungen: [] })
    }

    else {
      return NextResponse.json({
        ok: false,
        dateiTyp: 'sonstig',
        text: '',
        html: '',
        fehler: `Dateityp .${ext} nicht unterstützt. Bitte .docx, .pdf oder .txt verwenden.`,
      })
    }
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, fehler: `Server-Fehler: ${err.message}`, text: '', html: '' },
      { status: 500 }
    )
  }
}
