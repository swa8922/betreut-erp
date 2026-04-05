// src/lib/kalender.ts
// Interner Mitarbeiter-Kalender
// Urlaub, Krankenstand, Termine, Events, Fahrzeugbuchungen

// ══════════════════════════════════════════════════════════════
// TYPEN
// ══════════════════════════════════════════════════════════════

export type EreignisTyp =
  | 'urlaub'           // Urlaub (genehmigungspflichtig)
  | 'urlaub_genehmigt' // Genehmigter Urlaub
  | 'krankenstand'     // Krankenstand
  | 'zeitausgleich'    // Zeitausgleich
  | 'sonderurlaub'     // Hochzeit, Beerdigung etc.
  | 'homeoffice'       // Home Office Tag
  | 'dienstreise'      // Dienstreise
  | 'termin'           // Persönlicher/Büro-Termin
  | 'firmenevent'      // Weihnachtsfeier, Ausflug etc.
  | 'feiertag'         // Österr. Feiertag
  | 'auto_buchung'     // Fahrzeugbuchung

export type GenehmigungsStatus =
  | 'beantragt'
  | 'genehmigt'
  | 'abgelehnt'
  | 'storniert'

export type Wiederholung = 'keine' | 'taeglich' | 'woechentlich' | 'monatlich' | 'jaehrlich'

// ── Kalender-Ereignis ─────────────────────────────────────────

export interface KalenderEreignis {
  id: string
  typ: EreignisTyp
  titel: string
  beschreibung: string

  // Datum/Zeit
  von: string          // ISO date
  bis: string          // ISO date
  ganzerTag: boolean
  vonZeit: string      // HH:mm (wenn nicht ganzer Tag)
  bisZeit: string

  // Mitarbeiter
  mitarbeiterId: string
  mitarbeiterName: string

  // Genehmigung (für Urlaub)
  genehmigungsStatus: GenehmigungsStatus
  beantragtAm: string
  genehmigtVon: string
  genehmigtAm: string
  ablehnungsGrund: string

  // Fahrzeug (für auto_buchung)
  fahrzeugId: string
  fahrzeugName: string
  ziel: string

  // Firmenevent
  ort: string
  teilnehmer: string[]  // MitarbeiterIds
  pflichttermin: boolean

  // Wiederkehrend
  wiederholung: Wiederholung

  // Meta
  farbe: string         // Hex-Farbe oder vordefiniert
  notizen: string
  erstelltVon: string
  erstelltAm: string
  aktualisiertAm: string
}

// ── Fahrzeug ──────────────────────────────────────────────────

export interface Fahrzeug {
  id: string
  name: string          // z.B. "VW Passat · B-VB 123"
  kennzeichen: string
  typ: string           // PKW, Kombi, Transporter
  farbe: string
  aktiv: boolean
  notizen: string
}

// ── Urlaubskonto ──────────────────────────────────────────────

export interface UrlaubsKonto {
  mitarbeiterId: string
  jahr: number
  anspruch: number       // Urlaubstage laut Vertrag
  genommen: number       // bereits genommene Tage
  beantragt: number      // beantragt, noch nicht genehmigt
  rest: number           // anspruch - genommen
  uebertragVorjahr: number
}

// ══════════════════════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════════════════════

const KEYS = {
  ereignisse: 'vb_kal_ereignisse',
  fahrzeuge:  'vb_kal_fahrzeuge',
  konten:     'vb_kal_urlaub_konten',
}

function today() { return new Date().toISOString().split('T')[0] }

function load<T>(key: string, seed?: () => T[]): T[] {
  if (typeof window === 'undefined') return []
  const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null
  if (typeof window !== 'undefined') { if (!raw && seed) { const d = seed(); localStorage.setItem(key, JSON.stringify(d)); return d } }
  return raw ? JSON.parse(raw) : []
}
function store<T>(key: string, data: T[]) {
  if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(data))
}

// ── Seed-Daten ────────────────────────────────────────────────

function seedFahrzeuge(): Fahrzeug[] {
  return [
    { id: 'F1', name: 'VW Passat Kombi', kennzeichen: 'B-VB 101', typ: 'Kombi', farbe: '#3b82f6', aktiv: true, notizen: 'Hauptfahrzeug' },
    { id: 'F2', name: 'Ford Transit', kennzeichen: 'B-VB 202', typ: 'Transporter', farbe: '#10b981', aktiv: true, notizen: 'Materialtransport' },
  ]
}

function seedEreignisse(): KalenderEreignis[] {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')

  function ev(partial: Partial<KalenderEreignis> & { id: string; typ: EreignisTyp; titel: string; von: string; bis: string; mitarbeiterId: string; mitarbeiterName: string }): KalenderEreignis {
    return {
      beschreibung: '', ganzerTag: true, vonZeit: '', bisZeit: '',
      genehmigungsStatus: 'genehmigt', beantragtAm: '', genehmigtVon: 'Stefan Wagner',
      genehmigtAm: today(), ablehnungsGrund: '',
      fahrzeugId: '', fahrzeugName: '', ziel: '', ort: '',
      teilnehmer: [], pflichttermin: false,
      wiederholung: 'keine', farbe: '', notizen: '',
      erstelltVon: 'Stefan Wagner', erstelltAm: today(), aktualisiertAm: today(),
      ...partial,
    }
  }

  return [
    // Genehmigte Urlaube
    ev({ id: 'E1', typ: 'urlaub_genehmigt', titel: 'Urlaub', von: `${y}-${m}-03`, bis: `${y}-${m}-07`, mitarbeiterId: 'M2', mitarbeiterName: 'Lisa Koller', genehmigungsStatus: 'genehmigt' }),
    ev({ id: 'E2', typ: 'urlaub_genehmigt', titel: 'Urlaub', von: `${y}-${m}-17`, bis: `${y}-${m}-21`, mitarbeiterId: 'M3', mitarbeiterName: 'Michaela Stern', genehmigungsStatus: 'genehmigt' }),
    // Urlaubsantrag offen
    ev({ id: 'E3', typ: 'urlaub', titel: 'Urlaubsantrag', von: `${y}-${m}-24`, bis: `${y}-${m}-28`, mitarbeiterId: 'M2', mitarbeiterName: 'Lisa Koller', genehmigungsStatus: 'beantragt', beantragtAm: today(), genehmigtVon: '', genehmigtAm: '' }),
    // Krankenstand
    ev({ id: 'E4', typ: 'krankenstand', titel: 'Krankenstand', von: `${y}-${m}-10`, bis: `${y}-${m}-11`, mitarbeiterId: 'M3', mitarbeiterName: 'Michaela Stern', genehmigungsStatus: 'genehmigt' }),
    // Firmenevent
    ev({ id: 'E5', typ: 'firmenevent', titel: 'Team-Meeting', von: `${y}-${m}-15`, bis: `${y}-${m}-15`, mitarbeiterId: 'M1', mitarbeiterName: 'Stefan Wagner', ort: 'Büro Bregenz', teilnehmer: ['M1', 'M2', 'M3'], pflichttermin: true }),
    // Fahrzeugbuchung
    ev({ id: 'E6', typ: 'auto_buchung', titel: 'Auto gebucht', von: `${y}-${m}-12`, bis: `${y}-${m}-12`, mitarbeiterId: 'M2', mitarbeiterName: 'Lisa Koller', fahrzeugId: 'F1', fahrzeugName: 'VW Passat Kombi', ziel: 'Wien — Kundenbesuch' }),
    // Feiertage Österreich (wenn im aktuellen Monat)
    ...(m === '01' ? [ev({ id: 'FT1', typ: 'feiertag', titel: 'Neujahr', von: `${y}-01-01`, bis: `${y}-01-01`, mitarbeiterId: '', mitarbeiterName: '', ganzerTag: true, genehmigungsStatus: 'genehmigt' })] : []),
    ...(m === '12' ? [ev({ id: 'FT2', typ: 'feiertag', titel: 'Weihnachten', von: `${y}-12-25`, bis: `${y}-12-25`, mitarbeiterId: '', mitarbeiterName: '', ganzerTag: true, genehmigungsStatus: 'genehmigt' })] : []),
  ]
}

function seedKonten(): UrlaubsKonto[] {
  const year = new Date().getFullYear()
  return [
    { mitarbeiterId: 'M1', jahr: year, anspruch: 30, genommen: 5, beantragt: 0, rest: 25, uebertragVorjahr: 0 },
    { mitarbeiterId: 'M2', jahr: year, anspruch: 25, genommen: 5, beantragt: 5, rest: 15, uebertragVorjahr: 0 },
    { mitarbeiterId: 'M3', jahr: year, anspruch: 20, genommen: 0, beantragt: 5, rest: 15, uebertragVorjahr: 2 },
  ]
}

// ── CRUD Ereignisse ───────────────────────────────────────────

export function getEreignisse(): KalenderEreignis[] { return load(KEYS.ereignisse, seedEreignisse) }
export function saveEreignisse(l: KalenderEreignis[]) { store(KEYS.ereignisse, l) }

export function createEreignis(data: Omit<KalenderEreignis, 'id' | 'erstelltAm' | 'aktualisiertAm'>): KalenderEreignis {
  const e: KalenderEreignis = { ...data, id: `E${Date.now()}`, erstelltAm: today(), aktualisiertAm: today() }
  saveEreignisse([...getEreignisse(), e])
  return e
}

export function updateEreignis(id: string, data: Partial<KalenderEreignis>) {
  saveEreignisse(getEreignisse().map(e => e.id === id ? { ...e, ...data, aktualisiertAm: today() } : e))
}

export function deleteEreignis(id: string) {
  saveEreignisse(getEreignisse().filter(e => e.id !== id))
}

// ── Urlaub genehmigen / ablehnen ──────────────────────────────

export function genehmige(id: string, genehmigtVon: string) {
  updateEreignis(id, {
    typ: 'urlaub_genehmigt',
    genehmigungsStatus: 'genehmigt',
    genehmigtVon,
    genehmigtAm: today(),
  })
  // Urlaubskonto aktualisieren
  const e = getEreignisse().find(e => e.id === id)
  if (e) {
    const tage = arbeitstageZwischen(e.von, e.bis)
    aktualisiereKonto(e.mitarbeiterId, tage, 0)
  }
}

export function lehneAb(id: string, grund: string) {
  updateEreignis(id, { genehmigungsStatus: 'abgelehnt', ablehnungsGrund: grund })
  // Beantragte Tage zurückbuchen
  const e = getEreignisse().find(e => e.id === id)
  if (e) {
    const tage = arbeitstageZwischen(e.von, e.bis)
    aktualisiereKonto(e.mitarbeiterId, 0, -tage)
  }
}

// ── Urlaubskonten ─────────────────────────────────────────────

export function getUrlaubsKonten(): UrlaubsKonto[] { return load(KEYS.konten, seedKonten) }
export function saveUrlaubsKonten(l: UrlaubsKonto[]) { store(KEYS.konten, l) }

export function getKontoFuer(mitarbeiterId: string, jahr = new Date().getFullYear()): UrlaubsKonto {
  const konten = getUrlaubsKonten()
  return konten.find(k => k.mitarbeiterId === mitarbeiterId && k.jahr === jahr) || {
    mitarbeiterId, jahr, anspruch: 25, genommen: 0, beantragt: 0, rest: 25, uebertragVorjahr: 0,
  }
}

export function aktualisiereKonto(mitarbeiterId: string, genommen: number, beantragt: number) {
  const jahr = new Date().getFullYear()
  const konten = getUrlaubsKonten()
  const idx = konten.findIndex(k => k.mitarbeiterId === mitarbeiterId && k.jahr === jahr)
  if (idx >= 0) {
    const k = konten[idx]
    konten[idx] = {
      ...k,
      genommen: Math.max(0, k.genommen + genommen),
      beantragt: Math.max(0, k.beantragt + beantragt),
      rest: k.anspruch + k.uebertragVorjahr - k.genommen - genommen,
    }
    saveUrlaubsKonten(konten)
  }
}

// ── Fahrzeuge ─────────────────────────────────────────────────

export function getFahrzeuge(): Fahrzeug[] { return load(KEYS.fahrzeuge, seedFahrzeuge) }
export function saveFahrzeuge(l: Fahrzeug[]) { store(KEYS.fahrzeuge, l) }

// ── Hilfsfunktionen ───────────────────────────────────────────

export function arbeitstageZwischen(von: string, bis: string): number {
  if (!von || !bis) return 0
  try {
    const start = new Date(von + 'T12:00:00')
    const end = new Date(bis + 'T12:00:00')
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0
    let count = 0
    const d = new Date(start)
    let safety = 0
    while (d <= end && safety < 400) {
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) count++
      d.setDate(d.getDate() + 1)
      safety++
    }
    return count
  } catch { return 0 }
}

export function tageZwischen(von: string, bis: string): number {
  if (!von || !bis) return 0
  try {
    const start = new Date(von + 'T12:00:00')
    const end = new Date(bis + 'T12:00:00')
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
  } catch { return 0 }
}

export function ereignisseImMonat(ereignisse: KalenderEreignis[], jahr: number, monat: number): KalenderEreignis[] {
  const first = new Date(jahr, monat, 1).toISOString().split('T')[0]
  const last = new Date(jahr, monat + 1, 0).toISOString().split('T')[0]
  return ereignisse.filter(e => e.von <= last && e.bis >= first)
}

export function ereignisseImJahr(ereignisse: KalenderEreignis[], jahr: number): KalenderEreignis[] {
  return ereignisse.filter(e => e.von.startsWith(String(jahr)) || e.bis.startsWith(String(jahr)))
}

// ── Österreichische Feiertage ─────────────────────────────────

export function getOesterreichischeFeiertage(jahr: number): { datum: string; name: string }[] {
  // Osterberechnung (Gaußsche Formel)
  const a = jahr % 19
  const b = Math.floor(jahr / 100)
  const c = jahr % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  const ostern = new Date(jahr, month - 1, day)
  // Lokales Datum formatieren — KEIN toISOString() wegen UTC-Verschiebung!
  const localDate = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const add = (d: Date, n: number) => {
    const dd = new Date(d)
    dd.setDate(dd.getDate() + n)
    return localDate(dd)
  }
  const fmt = (d: Date) => localDate(d)

  return [
    { datum: `${jahr}-01-01`, name: 'Neujahr' },
    { datum: `${jahr}-01-06`, name: 'Heilige Drei Könige' },
    { datum: add(ostern, -2), name: 'Karfreitag' },
    { datum: fmt(ostern), name: 'Ostersonntag' },
    { datum: add(ostern, 1), name: 'Ostermontag' },
    { datum: `${jahr}-05-01`, name: 'Staatsfeiertag' },
    { datum: add(ostern, 39), name: 'Christi Himmelfahrt' },
    { datum: add(ostern, 49), name: 'Pfingstsonntag' },
    { datum: add(ostern, 50), name: 'Pfingstmontag' },
    { datum: add(ostern, 60), name: 'Fronleichnam' },
    { datum: `${jahr}-08-15`, name: 'Mariä Himmelfahrt' },
    { datum: `${jahr}-10-26`, name: 'Nationalfeiertag' },
    { datum: `${jahr}-11-01`, name: 'Allerheiligen' },
    { datum: `${jahr}-12-08`, name: 'Mariä Empfängnis' },
    { datum: `${jahr}-12-25`, name: 'Christtag' },
    { datum: `${jahr}-12-26`, name: 'Stefanitag' },
  ]
}

// ══════════════════════════════════════════════════════════════
// LABELS & FARBEN
// ══════════════════════════════════════════════════════════════

export const EREIGNIS_LABELS: Record<EreignisTyp, string> = {
  urlaub:           'Urlaubsantrag',
  urlaub_genehmigt: 'Urlaub',
  krankenstand:     'Krankenstand',
  zeitausgleich:    'Zeitausgleich',
  sonderurlaub:     'Sonderurlaub',
  homeoffice:       'Home Office',
  dienstreise:      'Dienstreise',
  termin:           'Termin',
  firmenevent:      'Firmenevent',
  feiertag:         'Feiertag',
  auto_buchung:     'Fahrzeug gebucht',
}

export const EREIGNIS_FARBEN: Record<EreignisTyp, { bg: string; text: string; border: string; dot: string }> = {
  urlaub:           { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', dot: '#f59e0b' },
  urlaub_genehmigt: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', dot: '#10b981' },
  krankenstand:     { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300', dot: '#f43f5e' },
  zeitausgleich:    { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-300', dot: '#0ea5e9' },
  sonderurlaub:     { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300', dot: '#8b5cf6' },
  homeoffice:       { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300', dot: '#14b8a6' },
  dienstreise:      { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300', dot: '#6366f1' },
  termin:           { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300', dot: '#64748b' },
  firmenevent:      { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300', dot: '#ec4899' },
  feiertag:         { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', dot: '#f97316' },
  auto_buchung:     { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', dot: '#3b82f6' },
}

export const GENEHMIGUNGS_LABELS: Record<GenehmigungsStatus, string> = {
  beantragt: 'Beantragt', genehmigt: 'Genehmigt', abgelehnt: 'Abgelehnt', storniert: 'Storniert',
}
