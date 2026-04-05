/**
 * sevDesk API v1/v2 Integration
 * Docs: https://api.sevdesk.de/
 * Benötigt: API-Key aus sevDesk → Einstellungen → Benutzer → API-Token
 */

const SEVDESK_BASE = 'https://my.sevdesk.de/api/v1'

export interface SevDeskConfig {
  apiKey: string
  baseUrl?: string
}

export interface SevDeskRechnung {
  id: string
  dokument_nr: string
  klient_name: string
  klient_id?: string
  betreuerin_name: string
  betrag: number
  datum: string
  faellig: string
  status: string
  positionen: { bezeichnung: string; menge: number; preis: number }[]
}

/** Erstellt oder findet Kontakt in sevDesk */
async function getOderErstelleKontakt(cfg: SevDeskConfig, name: string): Promise<string | null> {
  try {
    // Suche nach bestehendem Kontakt
    const suchRes = await fetch(
      `${cfg.baseUrl || SEVDESK_BASE}/Contact?name=${encodeURIComponent(name)}&customerNumber=&limit=5`,
      { headers: { Authorization: cfg.apiKey } }
    )
    if (suchRes.ok) {
      const data = await suchRes.json()
      if (data.objects?.length > 0) {
        return data.objects[0].id
      }
    }

    // Kontakt anlegen
    const teile = name.trim().split(' ')
    const vorname = teile.slice(0, -1).join(' ')
    const nachname = teile[teile.length - 1]

    const createRes = await fetch(`${cfg.baseUrl || SEVDESK_BASE}/Contact`, {
      method: 'POST',
      headers: { Authorization: cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectName: 'Contact',
        mapAll: true,
        name: name.trim(),
        surename: vorname || '',
        familyname: nachname || name.trim(),
        status: '100',
        customerNumber: `VB-${Date.now().toString(36).toUpperCase()}`,
        category: { id: '3', objectName: 'Category' },
      }),
    })
    if (createRes.ok) {
      const d = await createRes.json()
      return d.objects?.id || d.id || null
    }
    // Fehler loggen
    const errText = await createRes.text().catch(() => '')
    console.error('sevDesk Kontakt anlegen Fehler:', createRes.status, errText.substring(0, 200))
  } catch (e) {
    console.error('sevDesk Kontakt Fehler:', e)
  }
  return null
}

/** Exportiert eine Rechnung zu sevDesk */
export async function exportiereZuSevDesk(
  cfg: SevDeskConfig,
  rechnung: SevDeskRechnung,
  kleinunternehmer: boolean = true
): Promise<{ ok: boolean; sevdeskId?: string; fehler?: string }> {
  try {
    if (!cfg.apiKey) return { ok: false, fehler: 'Kein API-Key konfiguriert' }

    // 1. Kontakt finden/erstellen
    const kontaktId = await getOderErstelleKontakt(cfg, rechnung.klient_name)
    if (!kontaktId) return { ok: false, fehler: 'Kontakt konnte nicht erstellt werden' }

    // 2. Rechnungspositionen
    const positionen = rechnung.positionen.map((p, i) => ({
      objectName: 'InvoicePos',
      mapAll: true,
      name: p.bezeichnung,
      quantity: p.menge,
      price: p.preis,
      unity: { id: '1', objectName: 'Unity' }, // Stück
      taxRate: kleinunternehmer ? 0 : 20,
      sumGross: p.menge * p.preis,
      sumNet: p.menge * p.preis,
    }))

    // 3. Rechnung erstellen
    const invoiceData = {
      objectName: 'Invoice',
      mapAll: true,
      invoiceType: 'RE',
      // invoiceNumber: sevDesk vergibt automatisch — eigene Nummer verursacht "Correct number abort"
      contact: { id: kontaktId, objectName: 'Contact' },
      invoiceDate: (rechnung.datum || new Date().toISOString().split('T')[0]).replace(/-/g, '/'),
      dueDate: rechnung.faellig ? rechnung.faellig.replace(/-/g, '/') : '',
      header: `Rechnung ${rechnung.dokument_nr}`,
      headText: `Betreuungsleistung durch ${rechnung.betreuerin_name}`,
      footText: 'Kleinunternehmer gemäß § 6 Abs. 1 Z 27 UStG – keine Umsatzsteuer ausgewiesen.',
      timeToPay: 14,
      discount: 0,
      addressName: rechnung.klient_name,
      status: '200', // Erstellt (nicht Entwurf)
      taxRate: kleinunternehmer ? 0 : 20,
      taxText: kleinunternehmer ? 'Umsatzsteuerfrei (Kleinunternehmer)' : '20% MwSt.',
      taxType: kleinunternehmer ? 'noteu' : 'default',
      taxSet: null,
      currency: 'EUR',
      InvoicePos: positionen,
    }

    const res = await fetch(`${cfg.baseUrl || SEVDESK_BASE}/Invoice/Factory/saveInvoice`, {
      method: 'POST',
      headers: { Authorization: cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice: invoiceData, invoicePosSave: positionen }),
    })

    const resText = await res.text()
    let resData: any = {}
    try { resData = JSON.parse(resText) } catch {}

    if (res.ok) {
      // sevDesk gibt id in verschiedenen Strukturen zurück
      const id = resData.objects?.invoice?.id ||
                 resData.objects?.id ||
                 resData.invoice?.id ||
                 resData.id
      return { ok: true, sevdeskId: id || 'exported' }
    }

    // Fehler: detailliert auslesen
    const fehlerMsg = resData.error?.message ||
                      resData.message ||
                      resData.error ||
                      resText.substring(0, 200)
    return { ok: false, fehler: `sevDesk HTTP ${res.status}: ${fehlerMsg}` }
  } catch (e: any) {
    return { ok: false, fehler: e.message || 'Unbekannter Fehler' }
  }
}

/** Holt Kontostand / Rechnungsübersicht aus sevDesk */
export async function ladeSevDeskUebersicht(cfg: SevDeskConfig): Promise<{
  offeneRechnungen: number
  bezahlt: number
  gesamt: number
} | null> {
  try {
    const res = await fetch(
      `${cfg.baseUrl || SEVDESK_BASE}/Invoice?status=200&limit=100`,
      { headers: { Authorization: cfg.apiKey } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const rechnungen = data.objects || []
    const offen = rechnungen.filter((r: any) => r.status === '200').length
    const bezahlt = rechnungen.filter((r: any) => r.status === '1000').length
    return { offeneRechnungen: offen, bezahlt, gesamt: rechnungen.length }
  } catch {
    return null
  }
}

/** Testet die API-Verbindung */
export async function testeSevDeskVerbindung(apiKey: string): Promise<{ ok: boolean; name?: string; fehler?: string }> {
  try {
    const res = await fetch(`${SEVDESK_BASE}/SevUser`, {
      headers: { Authorization: apiKey },
    })
    if (res.ok) {
      const data = await res.json()
      const user = data.objects?.[0]
      return { ok: true, name: `${user?.forename} ${user?.surname}`.trim() || 'sevDesk User' }
    }
    return { ok: false, fehler: `HTTP ${res.status} — Bitte API-Key prüfen` }
  } catch (e: any) {
    return { ok: false, fehler: e.message }
  }
}

/** Lädt ein PDF als Anhang zu einer sevDesk-Rechnung hoch */
export async function uploadPdfZuSevDesk(
  cfg: SevDeskConfig,
  sevdeskInvoiceId: string,
  pdfBase64: string,
  dateiname: string
): Promise<{ ok: boolean; fehler?: string }> {
  try {
    // Konvertiere Base64 zu Blob
    const binaryStr = atob(pdfBase64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })

    const formData = new FormData()
    formData.append('file', blob, dateiname)
    formData.append('object[id]', sevdeskInvoiceId)
    formData.append('object[objectName]', 'Invoice')

    const res = await fetch(`${cfg.baseUrl || SEVDESK_BASE}/Document/Factory/saveDocument`, {
      method: 'POST',
      headers: { Authorization: cfg.apiKey },
      body: formData,
    })

    if (res.ok) return { ok: true }
    const errText = await res.text()
    return { ok: false, fehler: `PDF-Upload HTTP ${res.status}: ${errText.substring(0, 200)}` }
  } catch (e: any) {
    return { ok: false, fehler: e.message }
  }
}
