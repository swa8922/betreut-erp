// src/lib/abrechnung.ts
// Rechnungsmodul — liest Beträge direkt aus Einsätzen
// Eigene Rechnungsobjekte werden hier gespeichert und mit Einsatz verknüpft

export type RechnungsStatus = 'entwurf' | 'erstellt' | 'versendet' | 'bezahlt' | 'mahnung' | 'storniert'
export type Zahlungsart = 'ueberweisung' | 'lastschrift' | 'bar'

export interface RechnungsPosition {
  bezeichnung: string
  tage: number
  tagessatz: number
  betrag: number
}

export interface Rechnung {
  id: string
  rechnungsNr: string        // RE-2026-001
  einsatzId: string          // Verknüpfung zum Einsatz
  klientId: string
  klientName: string
  klientAdresse: string
  betreuerinName: string

  positionen: RechnungsPosition[]

  nettoBetrag: number
  taxiKosten: number
  gesamtBetrag: number

  status: RechnungsStatus
  zahlungsart: Zahlungsart
  zahlungsziel: string       // ISO date
  zahlungseingangAm: string  // ISO date (wenn bezahlt)

  rechnungsDatum: string
  zeitraumVon: string
  zeitraumBis: string

  notizen: string
  erstelltAm: string
  aktualisiertAm: string
}

const KEY = 'vb_rechnungen'
const NR_KEY = 'vb_rechnung_counter'

function getNextNr(): string {
  if (typeof window === 'undefined') return 'RE-2026-001'
  const n = parseInt((typeof window !== 'undefined' ? localStorage.getItem(NR_KEY) : null) || '0') + 1
  if (typeof window !== 'undefined') localStorage.setItem(NR_KEY, String(n))
  return `RE-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`
}

export function getRechnungen(): Rechnung[] {
  if (typeof window === 'undefined') return []
  const raw = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null
  return raw ? JSON.parse(raw) : []
}

export function saveRechnungen(list: Rechnung[]) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list))
}

export function createRechnungFromEinsatz(einsatz: {
  id: string; klientId: string; klientName: string; klientOrt: string;
  betreuerinName: string; von: string; bis: string; turnusTage: number;
  tagessatz: number; gesamtbetrag: number; taxiKosten: number;
}): Rechnung {
  const today = new Date().toISOString().split('T')[0]
  const zahlungsziel = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]

  const rechnung: Rechnung = {
    id: Date.now().toString(),
    rechnungsNr: getNextNr(),
    einsatzId: einsatz.id,
    klientId: einsatz.klientId,
    klientName: einsatz.klientName,
    klientAdresse: einsatz.klientOrt,
    betreuerinName: einsatz.betreuerinName,
    positionen: [
      {
        bezeichnung: `24h-Betreuung ${new Date(einsatz.von).toLocaleDateString('de-AT')} – ${new Date(einsatz.bis).toLocaleDateString('de-AT')}`,
        tage: einsatz.turnusTage,
        tagessatz: einsatz.tagessatz,
        betrag: einsatz.gesamtbetrag,
      },
      ...(einsatz.taxiKosten > 0 ? [{
        bezeichnung: 'Taxikosten (Anreise/Abreise)',
        tage: 1,
        tagessatz: einsatz.taxiKosten,
        betrag: einsatz.taxiKosten,
      }] : []),
    ],
    nettoBetrag: einsatz.gesamtbetrag,
    taxiKosten: einsatz.taxiKosten,
    gesamtBetrag: einsatz.gesamtbetrag + einsatz.taxiKosten,
    status: 'erstellt',
    zahlungsart: 'ueberweisung',
    zahlungsziel,
    zahlungseingangAm: '',
    rechnungsDatum: today,
    zeitraumVon: einsatz.von,
    zeitraumBis: einsatz.bis,
    notizen: '',
    erstelltAm: today,
    aktualisiertAm: today,
  }

  const list = getRechnungen()
  saveRechnungen([...list, rechnung])
  return rechnung
}

export function updateRechnung(id: string, data: Partial<Rechnung>) {
  const list = getRechnungen()
  saveRechnungen(list.map(r =>
    r.id === id ? { ...r, ...data, aktualisiertAm: new Date().toISOString().split('T')[0] } : r
  ))
}

export function deleteRechnung(id: string) {
  saveRechnungen(getRechnungen().filter(r => r.id !== id))
}

// ── Labels & Colors ────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<RechnungsStatus, string> = {
  entwurf:   'Entwurf',
  erstellt:  'Erstellt',
  versendet: 'Versendet',
  bezahlt:   'Bezahlt',
  mahnung:   'Mahnung',
  storniert: 'Storniert',
}

export const STATUS_COLORS: Record<RechnungsStatus, string> = {
  entwurf:   'bg-slate-100 text-slate-600 border-slate-200',
  erstellt:  'bg-sky-50 text-sky-700 border-sky-200',
  versendet: 'bg-blue-50 text-blue-700 border-blue-200',
  bezahlt:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  mahnung:   'bg-rose-50 text-rose-700 border-rose-200',
  storniert: 'bg-slate-100 text-slate-400 border-slate-200',
}

export const STATUS_NEXT: Partial<Record<RechnungsStatus, RechnungsStatus>> = {
  erstellt:  'versendet',
  versendet: 'bezahlt',
  bezahlt:   'bezahlt',
}

export const ZAHLUNGSART_LABELS: Record<Zahlungsart, string> = {
  ueberweisung: 'Banküberweisung',
  lastschrift:  'Lastschrift',
  bar:          'Barzahlung',
}
