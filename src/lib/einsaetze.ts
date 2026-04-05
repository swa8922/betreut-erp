// src/lib/einsaetze.ts
// Turnusliste — das zentrale Verbindungsstück zwischen
// Klient:innen ↔ Betreuerinnen ↔ Wechselliste ↔ Abrechnung

// ── Typen ────────────────────────────────────────────────────────────────────

export type EinsatzStatus =
  | 'geplant'       // erstellt, noch nicht aktiv
  | 'aktiv'         // läuft gerade
  | 'wechsel_offen' // Turnus endet bald, Nachfolge nicht geplant
  | 'beendet'       // regulär abgeschlossen
  | 'abgebrochen'   // vorzeitig beendet

export type WechselTyp =
  | 'wechsel'       // alte BG geht, neue kommt
  | 'verlaengerung' // selbe BG bleibt länger
  | 'erstanreise'   // erster Einsatz bei diesem Klienten
  | 'neustart'      // nach Pause wieder aktiv

export type AbrechnungsStatus =
  | 'offen'
  | 'erstellt'
  | 'versendet'
  | 'bezahlt'
  | 'storniert'

// ── Hauptmodell: ein Turnus ───────────────────────────────────────────────────

export interface Einsatz {
  id: string

  // Verknüpfungen (IDs)
  klientId: string
  klientName: string     // denormalisiert für schnellen Zugriff
  klientOrt: string      // denormalisiert

  betreuerinId: string
  betreuerinName: string // denormalisiert

  // Zeitraum
  von: string            // ISO date
  bis: string            // ISO date
  turnusTage: number     // 14 oder 28 (oder individuell)

  // Status
  status: EinsatzStatus
  wechselTyp: WechselTyp

  // Abrechnung (Vorbereitung für Rechnungsmodul)
  tagessatz: number        // € pro Tag
  gesamtbetrag: number     // berechnet: tagessatz × turnusTage
  abrechnungsStatus: AbrechnungsStatus
  rechnungsId: string      // wird vom Rechnungsmodul befüllt

  // Wechsellogistik
  taxiHin: string          // Taxi-Info Anreise
  taxiRueck: string        // Taxi-Info Abreise
  taxiKosten: number
  uebergabeNotiz: string   // Was die neue BG wissen muss

  // Nachfolgeplanung (Vorbereitung Wechselliste)
  nachfolgerBetreuerinId: string
  nachfolgerBetreuerinName: string
  wechselGeplantAm: string   // Datum des geplanten Wechsels

  // Meta
  zustaendig: string
  notizen: string
  erstelltAm: string
  aktualisiertAm: string
}

// ── Seed-Daten ────────────────────────────────────────────────────────────────

function seed(): Einsatz[] {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)
  const subDays = (d: Date, n: number) => new Date(d.getTime() - n * 86400000)

  return [
    {
      id: '1',
      klientId: '1', klientName: 'Irene Baumgartl', klientOrt: 'Bregenz',
      betreuerinId: '1', betreuerinName: 'Mirjana Licina',
      von: fmt(subDays(today, 30)), bis: fmt(addDays(today, 2)),
      turnusTage: 28,
      status: 'wechsel_offen', wechselTyp: 'wechsel',
      tagessatz: 80, gesamtbetrag: 80 * 28, abrechnungsStatus: 'offen', rechnungsId: '',
      taxiHin: 'Taxi Bregenz +43 5574 12345', taxiRueck: 'Taxi Bregenz +43 5574 12345',
      taxiKosten: 45,
      uebergabeNotiz: 'Medikamente im Bad. Sohn Peter informiert. Arzttermin 28.03.',
      nachfolgerBetreuerinId: '', nachfolgerBetreuerinName: '',
      wechselGeplantAm: fmt(addDays(today, 2)),
      zustaendig: 'Stefan Wagner',
      notizen: 'Verlängerung auf Wunsch der Familie möglich.',
      erstelltAm: fmt(subDays(today, 35)), aktualisiertAm: fmt(today),
    },
    {
      id: '2',
      klientId: '2', klientName: 'Maria Huber', klientOrt: 'Wien',
      betreuerinId: '2', betreuerinName: 'Andrea Leitner',
      von: fmt(subDays(today, 10)), bis: fmt(addDays(today, 18)),
      turnusTage: 28,
      status: 'aktiv', wechselTyp: 'wechsel',
      tagessatz: 85, gesamtbetrag: 85 * 28, abrechnungsStatus: 'offen', rechnungsId: '',
      taxiHin: 'Taxi Wien Mitte +43 1 40100', taxiRueck: 'Taxi Wien Mitte +43 1 40100',
      taxiKosten: 30,
      uebergabeNotiz: 'Diabetische Kost. Insulinpen im Kühlschrank.',
      nachfolgerBetreuerinId: '', nachfolgerBetreuerinName: '',
      wechselGeplantAm: fmt(addDays(today, 18)),
      zustaendig: 'Lisa Koller',
      notizen: 'Förderbescheid noch offen, Tochter informiert.',
      erstelltAm: fmt(subDays(today, 15)), aktualisiertAm: fmt(today),
    },
    {
      id: '3',
      klientId: '3', klientName: 'Josef Koller', klientOrt: 'Dornbirn',
      betreuerinId: '', betreuerinName: '',
      von: fmt(addDays(today, 14)), bis: fmt(addDays(today, 42)),
      turnusTage: 28,
      status: 'geplant', wechselTyp: 'erstanreise',
      tagessatz: 75, gesamtbetrag: 75 * 28, abrechnungsStatus: 'offen', rechnungsId: '',
      taxiHin: '', taxiRueck: '',
      taxiKosten: 0,
      uebergabeNotiz: 'Erstanreise — Einweisung durch Familie nötig.',
      nachfolgerBetreuerinId: '', nachfolgerBetreuerinName: '',
      wechselGeplantAm: fmt(addDays(today, 42)),
      zustaendig: 'Stefan Wagner',
      notizen: 'Betreuerin noch nicht zugewiesen. Michaela Stern vorgemerkt.',
      erstelltAm: fmt(today), aktualisiertAm: fmt(today),
    },
    {
      id: '4',
      klientId: '1', klientName: 'Irene Baumgartl', klientOrt: 'Bregenz',
      betreuerinId: '2', betreuerinName: 'Andrea Leitner',
      von: fmt(subDays(today, 80)), bis: fmt(subDays(today, 52)),
      turnusTage: 28,
      status: 'beendet', wechselTyp: 'wechsel',
      tagessatz: 80, gesamtbetrag: 80 * 28, abrechnungsStatus: 'bezahlt', rechnungsId: 'RE-2025-018',
      taxiHin: 'Taxi Bregenz', taxiRueck: 'Taxi Bregenz',
      taxiKosten: 45,
      uebergabeNotiz: '',
      nachfolgerBetreuerinId: '1', nachfolgerBetreuerinName: 'Mirjana Licina',
      wechselGeplantAm: fmt(subDays(today, 52)),
      zustaendig: 'Stefan Wagner',
      notizen: '',
      erstelltAm: fmt(subDays(today, 85)), aktualisiertAm: fmt(subDays(today, 52)),
    },
  ]
}

// ── localStorage CRUD ─────────────────────────────────────────────────────────

const KEY = 'vb_einsaetze'

export function getEinsaetze(): Einsatz[] {
  if (typeof window === 'undefined') return []
  const raw = (typeof window!=='undefined' ? localStorage.getItem(KEY) : null)
  if (!raw) {
    const initial = seed()
    if (typeof window !== 'undefined') { localStorage.setItem(KEY, JSON.stringify(initial)) }
    return initial
  }
  return JSON.parse(raw)
}

export function saveEinsaetze(list: Einsatz[]) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list))
}

export function addEinsatz(e: Omit<Einsatz, 'id' | 'erstelltAm' | 'aktualisiertAm'>): Einsatz {
  const list = getEinsaetze()
  const neu: Einsatz = {
    ...e,
    id: Date.now().toString(),
    erstelltAm: new Date().toISOString().split('T')[0],
    aktualisiertAm: new Date().toISOString().split('T')[0],
  }
  saveEinsaetze([...list, neu])
  return neu
}

export function updateEinsatz(id: string, data: Partial<Einsatz>) {
  const list = getEinsaetze()
  saveEinsaetze(list.map(e =>
    e.id === id ? { ...e, ...data, aktualisiertAm: new Date().toISOString().split('T')[0] } : e
  ))
}

export function deleteEinsatz(id: string) {
  saveEinsaetze(getEinsaetze().filter(e => e.id !== id))
}

// ── Berechnungen ──────────────────────────────────────────────────────────────

export function berechneGesamtbetrag(tagessatz: number, von: string, bis: string): number {
  if (!von || !bis) return 0
  const diff = new Date(bis).getTime() - new Date(von).getTime()
  const tage = Math.round(diff / 86400000)
  return tagessatz * tage
}

export function daysRemaining(bis: string): number {
  const diff = new Date(bis).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

export function isEndigSoon(bis: string, days = 7): boolean {
  const rem = daysRemaining(bis)
  return rem >= 0 && rem <= days
}

// ── Status automatisch berechnen ──────────────────────────────────────────────
export function getEffectiveStatus(e: Einsatz): EinsatzStatus {
  const today = new Date().toISOString().split('T')[0]
  if (e.status === 'beendet' || e.status === 'abgebrochen') return e.status
  if (e.von > today) return 'geplant'
  if (e.bis < today) return e.status === 'aktiv' ? 'beendet' : e.status
  if (isEndigSoon(e.bis, 7) && !e.nachfolgerBetreuerinId) return 'wechsel_offen'
  return 'aktiv'
}

// ── Labels & Colors ───────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<EinsatzStatus, string> = {
  geplant:       'Geplant',
  aktiv:         'Aktiv',
  wechsel_offen: 'Wechsel offen',
  beendet:       'Beendet',
  abgebrochen:   'Abgebrochen',
}

export const STATUS_COLORS: Record<EinsatzStatus, string> = {
  geplant:       'bg-sky-50 text-sky-700 border-sky-200',
  aktiv:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  wechsel_offen: 'bg-amber-50 text-amber-700 border-amber-200',
  beendet:       'bg-slate-100 text-slate-500 border-slate-200',
  abgebrochen:   'bg-rose-50 text-rose-600 border-rose-200',
}

export const WECHSEL_LABELS: Record<WechselTyp, string> = {
  wechsel:      'Wechsel',
  verlaengerung:'Verlängerung',
  erstanreise:  'Erstanreise',
  neustart:     'Neustart',
}

export const WECHSEL_COLORS: Record<WechselTyp, string> = {
  wechsel:      'bg-sky-50 text-sky-700 border-sky-200',
  verlaengerung:'bg-emerald-50 text-emerald-700 border-emerald-200',
  erstanreise:  'bg-violet-50 text-violet-700 border-violet-200',
  neustart:     'bg-amber-50 text-amber-700 border-amber-200',
}

export const ABRECHNUNG_LABELS: Record<AbrechnungsStatus, string> = {
  offen:     'Offen',
  erstellt:  'Erstellt',
  versendet: 'Versendet',
  bezahlt:   'Bezahlt',
  storniert: 'Storniert',
}

export const ABRECHNUNG_COLORS: Record<AbrechnungsStatus, string> = {
  offen:     'bg-amber-50 text-amber-700 border-amber-200',
  erstellt:  'bg-sky-50 text-sky-700 border-sky-200',
  versendet: 'bg-blue-50 text-blue-700 border-blue-200',
  bezahlt:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  storniert: 'bg-rose-50 text-rose-600 border-rose-200',
}
