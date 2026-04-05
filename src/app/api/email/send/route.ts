import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      an, anName = '', betreff, inhalt, inhaltHtml,
      typ = 'allgemein', klientId = '', klientName = '',
      betreuerinId = '', betreuerinName = '', dokumentId = '',
      dokumentTyp = '', erstelltVon = 'Stefan Wagner',
      anhaenge = [],
    } = body

    if (!an || !betreff || !inhalt) {
      return NextResponse.json({ error: 'an, betreff und inhalt sind pflicht' }, { status: 400 })
    }

    const RESEND_KEY = process.env.RESEND_API_KEY
    let status = 'gesendet'
    let fehler = ''
    let resendId = ''

    if (RESEND_KEY) {
      // Echten E-Mail-Versand über Resend
      const html = inhaltHtml || inhalt.replace(/\n/g, '<br>')
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'VBetreut GmbH <info@vbetreut.at>',
          to: [an],
          subject: betreff,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #0f766e; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0;">
                <h2 style="margin:0; font-size:20px;">VBetreut GmbH</h2>
                <p style="margin:4px 0 0; font-size:12px; opacity:0.8;">Krüzastraße 4 · 6912 Hörbranz · +43 670 205 1951</p>
              </div>
              <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                ${html}
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 11px; color: #9ca3af;">
                  VBetreut GmbH · Krüzastraße 4 · 6912 Hörbranz<br>
                  Tel: +43 670 205 1951 · info@vbetreut.at<br>
                  BG Bregenz · USt-ID: ATU81299827
                </p>
              </div>
            </div>
          `,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        resendId = data.id || ''
        status = 'gesendet'
      } else {
        const err = await res.text()
        status = 'fehler'
        fehler = err
      }
    } else {
      // Kein API-Key: als "geplant" markieren (mailto-Fallback im Frontend)
      status = 'kein_api_key'
      fehler = 'Kein RESEND_API_KEY konfiguriert'
    }

    // In Email-Log speichern
    const logEintrag = {
      id: uid(),
      betreff,
      empfaenger_email: an,
      empfaenger_name: anName,
      absender_name: 'VBetreut GmbH',
      absender_email: 'info@vbetreut.at',
      inhalt,
      inhalt_html: inhaltHtml || '',
      typ,
      status,
      fehler,
      klient_id: klientId,
      klient_name: klientName,
      betreuerin_id: betreuerinId,
      betreuerin_name: betreuerinName,
      dokument_id: dokumentId,
      dokument_typ: dokumentTyp,
      anhaenge: anhaenge,
      erstellt_von: erstelltVon,
      erstellt_am: new Date().toISOString(),
      data: { resendId },
    }

    await supabase.from('email_log').insert(logEintrag)

    return NextResponse.json({
      success: status === 'gesendet',
      status,
      logId: logEintrag.id,
      hatApiKey: !!RESEND_KEY,
      fehler,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Email-Log abrufen
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const klientId = searchParams.get('klientId')
  const limit = parseInt(searchParams.get('limit') || '50')

  let query = supabase.from('email_log').select('*').order('erstellt_am', { ascending: false }).limit(limit)
  if (klientId) query = query.eq('klient_id', klientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
