import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exportiereZuSevDesk, testeSevDeskVerbindung, uploadPdfZuSevDesk } from '@/lib/sevdesk'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/sevdesk?action=test
// GET /api/sevdesk?action=status&id=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  const { data: setting } = await sb.from('admin_settings').select('value').eq('key', 'sevdesk_settings').single()
  const cfg = setting?.value || {}

  if (action === 'test') {
    // apiKey kann aus Query-Parameter ODER aus DB kommen
    const queryApiKey = searchParams.get('apiKey')
    const keyToTest = queryApiKey || cfg.api_key || ''
    const result = await testeSevDeskVerbindung(keyToTest)
    return NextResponse.json(result)
  }

  return NextResponse.json({ ok: true, konfiguriert: !!(cfg.api_key), aktiv: cfg.aktiv })
}

// POST /api/sevdesk - Rechnung(en) exportieren
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { rechnung_id, rechnung_ids, alle_offen } = body

  const { data: setting } = await sb.from('admin_settings').select('value').eq('key', 'sevdesk_settings').single()
  const cfg = setting?.value || {}

  const { data: vorlageSetting } = await sb.from('admin_settings').select('value').eq('key', 'rechnungs_vorlage').single()
  const vorlage = vorlageSetting?.value || {}

  if (!cfg.api_key) {
    return NextResponse.json({ ok: false, fehler: 'Kein sevDesk API-Key konfiguriert. Bitte unter Administration → sevDesk hinterlegen.' }, { status: 400 })
  }

  // IDs sammeln — einzeln, Array, oder alle offenen
  let ids: string[] = []
  if (rechnung_ids && Array.isArray(rechnung_ids)) ids = rechnung_ids
  else if (rechnung_id) ids = [rechnung_id]
  else if (alle_offen) {
    const { data: docs } = await sb.from('finanzen_dokumente')
      .select('id')
      .eq('typ', 'rechnung')
      .neq('status', 'storniert')
      .or('sevdesk_id.is.null,sevdesk_id.eq.')
    ids = (docs || []).map((d: any) => d.id)
  }

  if (ids.length === 0) return NextResponse.json({ ok: false, fehler: 'Keine Rechnungen gefunden' })

  const { data: docs } = await sb.from('finanzen_dokumente').select('*').in('id', ids)
  const ergebnisse = []

  for (const dok of docs || []) {
    // Positionen tief extrahieren — data kann einfach oder doppelt verschachtelt sein
    const dd = dok.data || {}
    const ddInner = dd.data || dd
    let rawPos = ddInner.positionen || dd.positionen || []

    // Leeres Array → Fallback aus Rechnungsbetrag
    if (!rawPos.length) {
      const brutto = Number(dok.summe_brutto || ddInner.summeBrutto || 0)
      rawPos = [{ bezeichnung: `24h-Personenbetreuung ${dok.klient_name || ''}`, menge: 28, preis: brutto > 0 ? brutto / 28 : 80 }]
    }

    // Normalisieren — alle möglichen Feldnamen abdecken
    const posNorm = rawPos.map((p: any) => {
      const menge = Number(p.menge || p.quantity || p.anzahl || 1)
      const preis = Number(p.einzelpreis || p.preis || p.price ||
        (p.bruttoBetrag && menge ? p.bruttoBetrag / menge : 0) ||
        Number(dok.summe_brutto || 0))
      return {
        bezeichnung: String(p.bezeichnung || p.name || p.description || `Betreuung ${dok.klient_name}`),
        menge,
        preis: preis > 0 ? preis : Number(dok.summe_brutto || 0),
      }
    })

    let result = await exportiereZuSevDesk(
      { apiKey: cfg.api_key, baseUrl: cfg.api_url },
      {
        id: dok.id,
        dokument_nr: dok.dokument_nr || ddInner.dokumentNr || '',
        klient_name: dok.klient_name || ddInner.klientName || '',
        betreuerin_name: dok.betreuerin_name || ddInner.betreuerinName || '',
        betrag: Number(dok.summe_brutto || ddInner.summeBrutto || 0),
        datum: dok.rechnungs_datum || ddInner.rechnungsDatum || new Date().toISOString().split('T')[0],
        faellig: dok.zahlungsziel || ddInner.zahlungsziel || '',
        status: dok.status || ddInner.status || 'erstellt',
        positionen: posNorm,
      },
      vorlage.kleinunternehmer !== false
    )

    if (result.ok && result.sevdeskId) {
      await sb.from('finanzen_dokumente').update({ sevdesk_id: result.sevdeskId }).eq('id', dok.id)

      // PDF-Rechnung generieren und zu sevDesk hochladen
      try {
        const pdfRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://vbetreut-erp.vercel.app'}/api/generate-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dokument_id: dok.id, typ: 'rechnung' }),
        })
        if (pdfRes.ok) {
          const { pdf_base64 } = await pdfRes.json()
          if (pdf_base64) {
            const uploadResult = await uploadPdfZuSevDesk(
              { apiKey: cfg.api_key, baseUrl: cfg.api_url },
              result.sevdeskId,
              pdf_base64,
              `${dok.dokument_nr || 'Rechnung'}.pdf`
            )
            result = { ...result, pdf_hochgeladen: uploadResult.ok, pdf_fehler: uploadResult.fehler }
          }
        }
      } catch { /* PDF-Upload optional — Fehler ignorieren */ }
    }

    ergebnisse.push({ id: dok.id, nr: dok.dokument_nr, ...result })
  }

  return NextResponse.json({ ok: true, ergebnisse, exportiert: ergebnisse.filter(e => e.ok).length })
}

// PATCH /api/sevdesk - Settings speichern
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { data: existing } = await sb.from('admin_settings').select('key').eq('key', 'sevdesk_settings').single()

  if (existing) {
    await sb.from('admin_settings').update({ value: body }).eq('key', 'sevdesk_settings')
  } else {
    await sb.from('admin_settings').insert({ key: 'sevdesk_settings', value: body })
  }
  return NextResponse.json({ ok: true })
}
