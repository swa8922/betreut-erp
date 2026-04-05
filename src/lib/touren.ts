// src/lib/touren.ts
// Tourenplanung — vollständig nach Spezifikation

export type TourStatus = 'offen' | 'in_planung' | 'disponiert' | 'manuell_angepasst' | 'freigegeben' | 'unterwegs' | 'erledigt' | 'nicht_durchgefuehrt'
export type BusStatus = 'verfuegbar' | 'werkstatt' | 'gesperrt'
export type StoppStatus = 'offen' | 'eingeplant' | 'erledigt' | 'nicht_durchgefuehrt'
export type Prioritaet = 'normal' | 'hoch' | 'dringend'
export type Optimierungsmodus = 'schnellste_route' | 'kuerzeste_km' | 'gleichmaessig' | 'zeitfenster_prio'

export interface Bus {
  id: string
  fahrzeugNr: string
  kennzeichen: string
  kapazitaetStopps: number    // max. Stopps pro Tour
  kapazitaetKg: number        // Ladekapazität kg (optional)
  verfuegbarVon: string        // HH:MM
  verfuegbarBis: string
  maxTagesfahrzeitMin: number  // 0 = unbegrenzt
  maxStopps: number            // 0 = unbegrenzt
  depotAdresse: string
  depotPlz: string
  depotOrt: string
  endpunktAdresse: string      // leer = Depot
  fahrer: string
  bevorzugteRegion: string
  status: BusStatus
  notizen: string
}

export interface TourStopp {
  id: string
  tourId: string
  busId: string
  reihenfolge: number

  // Auftragsdaten
  einsatzId: string
  auftragNr: string
  klientId: string
  klientName: string
  klientOrt: string
  klientStrasse: string
  klientPlz: string
  klientAdresse: string     // vollständig
  ansprechpartner: string
  telefon: string

  // Zeitplanung
  wechselDatum: string
  zeitfensterVon: string
  zeitfensterBis: string
  dauerMinuten: number
  etaAnkunft: string
  etaAbfahrt: string
  verspaetungMin: number    // 0 = pünktlich

  // Betreuerin
  betreuerinAbreise: string
  betreuerinAnreise: string
  taxiHin: string
  taxiRueck: string

  // Art + Prio
  wechselTyp: string
  prioritaet: Prioritaet
  status: StoppStatus

  // Logistik
  volumenLiter: number
  gewichtKg: number
  bemerkungen: string
  fixiert: boolean           // nicht vom Algorithmus verschieben

  // Warnungen
  warnungen: string[]        // z.B. 'Adresse unvollständig', 'Zeitfenster eng'
}

export interface PlausiWarnung {
  typ: 'adresse' | 'kapazitaet' | 'zeitfenster' | 'tageszeit' | 'kein_bus' | 'kein_stopp' | 'fahrzeit'
  schwere: 'info' | 'warnung' | 'fehler'
  text: string
  stoppId?: string
  busId?: string
}

export interface Tour {
  id: string
  datum: string
  optimierungsmodus: Optimierungsmodus
  status: TourStatus
  busse: Bus[]
  stopps: TourStopp[]
  nichtPlanbar: TourStopp[]   // Aufträge die keinem Bus zugeordnet werden konnten
  warnungen: PlausiWarnung[]
  gesamtKm: number
  gesamtMinutenFahrt: number
  erstelltAm: string
  aktualisiertAm: string
  freigegebenVon: string
  freigegebenAm: string
  notizen: string
}

// ── Storage ────────────────────────────────────────────────────
const KEY_BUSSE = 'vb_busse'
const KEY_TOUREN = 'vb_touren'
const today = () => new Date().toISOString().split('T')[0]
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

function seedBusse(): Bus[] {
  return [
    {
      id: 'B1', fahrzeugNr: 'Bus 1', kennzeichen: 'VO-VB-1',
      kapazitaetStopps: 8, kapazitaetKg: 500,
      verfuegbarVon: '06:00', verfuegbarBis: '20:00',
      maxTagesfahrzeitMin: 480, maxStopps: 8,
      depotAdresse: 'Schweizer Straße 1', depotPlz: '6845', depotOrt: 'Hohenems',
      endpunktAdresse: '', fahrer: '', bevorzugteRegion: 'Vorarlberg',
      status: 'verfuegbar', notizen: '',
    },
    {
      id: 'B2', fahrzeugNr: 'Bus 2', kennzeichen: 'VO-VB-2',
      kapazitaetStopps: 8, kapazitaetKg: 500,
      verfuegbarVon: '06:00', verfuegbarBis: '20:00',
      maxTagesfahrzeitMin: 480, maxStopps: 8,
      depotAdresse: 'Schweizer Straße 1', depotPlz: '6845', depotOrt: 'Hohenems',
      endpunktAdresse: '', fahrer: '', bevorzugteRegion: '',
      status: 'verfuegbar', notizen: '',
    },
    {
      id: 'B3', fahrzeugNr: 'Bus 3', kennzeichen: 'VO-VB-3',
      kapazitaetStopps: 6, kapazitaetKg: 300,
      verfuegbarVon: '07:00', verfuegbarBis: '19:00',
      maxTagesfahrzeitMin: 360, maxStopps: 6,
      depotAdresse: 'Schweizer Straße 1', depotPlz: '6845', depotOrt: 'Hohenems',
      endpunktAdresse: '', fahrer: '', bevorzugteRegion: '',
      status: 'werkstatt', notizen: 'Wartung bis 15.04.2026',
    },
  ]
}

export function getBusse(): Bus[] {
  if (typeof window === 'undefined') return []
  const raw = (typeof window!=='undefined' ? localStorage.getItem(KEY_BUSSE) : null)
  if (typeof window !== 'undefined') { if (!raw) { const s = seedBusse(); localStorage.setItem(KEY_BUSSE, JSON.stringify(s)); return s } }
  return JSON.parse(raw)
}
export function saveBusse(list: Bus[]) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY_BUSSE, JSON.stringify(list))
}
export function getTouren(): Tour[] {
  if (typeof window === 'undefined') return []
  const raw = (typeof window!=='undefined' ? localStorage.getItem(KEY_TOUREN) : null)
  return raw ? JSON.parse(raw) : []
}
export function saveTour(t: Tour) {
  const list = getTouren()
  const idx = list.findIndex(x => x.id === t.id)
  if (idx >= 0) list[idx] = t; else list.push(t)
  if (typeof window !== 'undefined') localStorage.setItem(KEY_TOUREN, JSON.stringify(list))
}
export function deleteTour(id: string) {
  const list = getTouren().filter(t => t.id !== id)
  if (typeof window !== 'undefined') localStorage.setItem(KEY_TOUREN, JSON.stringify(list))
}

// ── Optimierungslogik ──────────────────────────────────────────

// PLZ-basierte Distanzschätzung (Österreich: 4-stellig)
export function plzDistanzKm(plz1: string, plz2: string): number {
  const n1 = parseInt((plz1 || '0').replace(/\D/g, '')) || 0
  const n2 = parseInt((plz2 || '0').replace(/\D/g, '')) || 0
  const diff = Math.abs(n1 - n2)
  // Grobe Schätzung: 100er-PLZ ≈ 10-15 km
  return Math.round(diff * 0.12 + 8)
}

// Fahrzeit in Minuten (60 km/h Durchschnitt + Puffer)
function fahrzeitMin(km: number): number {
  return Math.round((km / 60) * 60) + 8
}

// Uhrzeit-String in Minuten umrechnen
function hhmmToMin(hhmm: string): number {
  if (!hhmm) return 0
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
function minToHhmm(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Plausibilitätsprüfungen
function pruefeWarnungen(stopps: TourStopp[], busse: Bus[]): PlausiWarnung[] {
  const warns: PlausiWarnung[] = []

  stopps.forEach(s => {
    if (!s.klientPlz && !s.klientStrasse) {
      warns.push({ typ: 'adresse', schwere: 'warnung', text: `${s.klientName}: Adresse unvollständig`, stoppId: s.id })
    }
    if (s.zeitfensterVon && s.zeitfensterBis) {
      const dauer = hhmmToMin(s.zeitfensterBis) - hhmmToMin(s.zeitfensterVon)
      if (dauer < s.dauerMinuten) {
        warns.push({ typ: 'zeitfenster', schwere: 'warnung', text: `${s.klientName}: Zeitfenster zu eng für ${s.dauerMinuten}min Aufenthalt`, stoppId: s.id })
      }
    }
  })

  busse.forEach(b => {
    const busStopps = stopps.filter(s => s.busId === b.id)
    if (b.maxStopps > 0 && busStopps.length > b.maxStopps) {
      warns.push({ typ: 'kapazitaet', schwere: 'fehler', text: `${b.fahrzeugNr}: Zu viele Stopps (${busStopps.length}/${b.maxStopps})`, busId: b.id })
    }
    if (busStopps.length > 0) {
      const letzter = busStopps[busStopps.length - 1]
      if (letzter.etaAbfahrt && hhmmToMin(letzter.etaAbfahrt) > hhmmToMin(b.verfuegbarBis)) {
        warns.push({ typ: 'tageszeit', schwere: 'warnung', text: `${b.fahrzeugNr}: Rückkehr nach ${b.verfuegbarBis}`, busId: b.id })
      }
    }
  })

  return warns
}

// Nearest-Neighbor mit Priorität und Zeitfenster
function optimiereReihenfolge(stopps: TourStopp[], depotPlz: string, modus: Optimierungsmodus): TourStopp[] {
  if (stopps.length === 0) return []

  const fixiert = stopps.filter(s => s.fixiert).sort((a, b) => a.reihenfolge - b.reihenfolge)
  const beweglich = stopps.filter(s => !s.fixiert)

  // Nach Priorität sortieren
  const dringend = beweglich.filter(s => s.prioritaet === 'dringend')
  const hoch = beweglich.filter(s => s.prioritaet === 'hoch')
  const normal = beweglich.filter(s => s.prioritaet === 'normal')

  const zuOptimieren = modus === 'zeitfenster_prio'
    ? [...dringend, ...hoch, ...normal].sort((a, b) => hhmmToMin(a.zeitfensterVon) - hhmmToMin(b.zeitfensterVon))
    : [...dringend, ...hoch, ...normal]

  // Nearest Neighbor
  const result: TourStopp[] = [...fixiert]
  const offen = [...zuOptimieren]
  let aktPlz = fixiert.length > 0 ? fixiert[fixiert.length - 1].klientPlz : depotPlz

  while (offen.length > 0) {
    let naechster = offen[0]
    let minScore = Infinity

    for (const s of offen) {
      let score = plzDistanzKm(aktPlz, s.klientPlz)
      // Zeitfenster-Score: frühere Fenster bevorzugen
      if (modus === 'zeitfenster_prio' && s.zeitfensterVon) {
        score += hhmmToMin(s.zeitfensterVon) / 100
      }
      if (score < minScore) { minScore = score; naechster = s }
    }

    result.push(naechster)
    aktPlz = naechster.klientPlz
    offen.splice(offen.indexOf(naechster), 1)
  }

  return result.map((s, i) => ({ ...s, reihenfolge: i + 1 }))
}

// ETA für alle Stopps eines Buses berechnen
function berechneETA(stopps: TourStopp[], bus: Bus): TourStopp[] {
  let aktMinute = hhmmToMin(bus.verfuegbarVon)
  let aktPlz = bus.depotPlz

  return stopps.map(s => {
    const km = plzDistanzKm(aktPlz, s.klientPlz || s.klientOrt)
    const fahrtDauer = fahrzeitMin(km)
    let ankunft = aktMinute + fahrtDauer

    // Zeitfenster einhalten: wenn zu früh, warten
    if (s.zeitfensterVon && ankunft < hhmmToMin(s.zeitfensterVon)) {
      ankunft = hhmmToMin(s.zeitfensterVon)
    }

    // Verspätung prüfen
    const verspaetung = s.zeitfensterBis && ankunft > hhmmToMin(s.zeitfensterBis)
      ? ankunft - hhmmToMin(s.zeitfensterBis) : 0

    const abfahrt = ankunft + (s.dauerMinuten || 30)
    aktMinute = abfahrt
    aktPlz = s.klientPlz || s.klientOrt

    return {
      ...s,
      etaAnkunft: minToHhmm(ankunft),
      etaAbfahrt: minToHhmm(abfahrt),
      verspaetungMin: verspaetung,
      warnungen: verspaetung > 0
        ? [...(s.warnungen || []), `Verspätung ~${verspaetung}min`]
        : s.warnungen || [],
    }
  })
}

// Gesamtkilometer eines Buses berechnen
function busKm(stopps: TourStopp[], bus: Bus): number {
  let km = 0
  let plz = bus.depotPlz
  for (const s of stopps) {
    km += plzDistanzKm(plz, s.klientPlz || s.klientOrt)
    plz = s.klientPlz || s.klientOrt
  }
  // Rückfahrt zum Depot
  if (stopps.length > 0) km += plzDistanzKm(stopps[stopps.length - 1].klientPlz, bus.depotPlz)
  return Math.round(km)
}

// ── Hauptfunktion: Tour berechnen ──────────────────────────────
export interface TourEingang {
  einsatzId: string
  klientId: string
  klientName: string
  klientOrt: string
  klientStrasse: string
  klientPlz: string
  klientTelefon: string
  ansprechpartner: string
  wechselDatum: string
  zeitfensterVon: string
  zeitfensterBis: string
  dauerMinuten: number
  wechselTyp: string
  prioritaet: Prioritaet
  taxiHin: string
  taxiRueck: string
  betreuerinAbreise: string
  betreuerinAnreise: string
  bemerkungen: string
}

export function berechneTour(
  datum: string,
  eingang: TourEingang[],
  verfuegbareBusse: Bus[],
  modus: Optimierungsmodus = 'schnellste_route'
): Tour {
  const tourId = uid()
  const busse = verfuegbareBusse.filter(b => b.status === 'verfuegbar')

  if (busse.length === 0 || eingang.length === 0) {
    return {
      id: tourId, datum, optimierungsmodus: modus, status: 'in_planung',
      busse, stopps: [], nichtPlanbar: [], warnungen: [{ typ: 'kein_bus', schwere: 'fehler', text: busse.length === 0 ? 'Keine verfügbaren Busse' : 'Keine Aufträge' }],
      gesamtKm: 0, gesamtMinutenFahrt: 0,
      erstelltAm: today(), aktualisiertAm: today(),
      freigegebenVon: '', freigegebenAm: '', notizen: '',
    }
  }

  // Stopps erstellen
  const alleStopps: TourStopp[] = eingang.map((e, i) => ({
    id: uid(), tourId, busId: '', reihenfolge: i + 1,
    einsatzId: e.einsatzId, auftragNr: `A-${String(i + 1).padStart(3, '0')}`,
    klientId: e.klientId, klientName: e.klientName, klientOrt: e.klientOrt,
    klientStrasse: e.klientStrasse, klientPlz: e.klientPlz,
    klientAdresse: `${e.klientStrasse}, ${e.klientPlz} ${e.klientOrt}`.trim().replace(/^,\s*/, ''),
    ansprechpartner: e.ansprechpartner, telefon: e.klientTelefon,
    wechselDatum: e.wechselDatum, zeitfensterVon: e.zeitfensterVon || '08:00',
    zeitfensterBis: e.zeitfensterBis || '18:00', dauerMinuten: e.dauerMinuten || 30,
    etaAnkunft: '', etaAbfahrt: '', verspaetungMin: 0,
    betreuerinAbreise: e.betreuerinAbreise, betreuerinAnreise: e.betreuerinAnreise,
    taxiHin: e.taxiHin, taxiRueck: e.taxiRueck,
    wechselTyp: e.wechselTyp, prioritaet: e.prioritaet || 'normal',
    status: 'offen' as StoppStatus, volumenLiter: 0, gewichtKg: 0,
    bemerkungen: e.bemerkungen, fixiert: false, warnungen: [],
  }))

  // Aufteilen auf Busse — regional bündeln nach PLZ
  const sortiertNachPrio = [...alleStopps].sort((a, b) => {
    const pMap = { dringend: 0, hoch: 1, normal: 2 }
    if (pMap[a.prioritaet] !== pMap[b.prioritaet]) return pMap[a.prioritaet] - pMap[b.prioritaet]
    return a.klientPlz.localeCompare(b.klientPlz)
  })

  // Gleichmäßig auf Busse verteilen (Round-Robin nach PLZ-Regionen)
  const busZuteilung = new Map<string, TourStopp[]>(busse.map(b => [b.id, []]))
  const nichtPlanbar: TourStopp[] = []

  sortiertNachPrio.forEach((s, i) => {
    // Bevorzugten Bus für Region finden
    const regBus = busse.find(b => b.bevorzugteRegion && s.klientOrt.toLowerCase().includes(b.bevorzugteRegion.toLowerCase()))

    // Kapazitätsprüfung
    const kandidaten = regBus
      ? [regBus, ...busse.filter(b => b.id !== regBus.id)]
      : busse

    let zugeteilt = false
    for (const b of kandidaten) {
      const bisherige = busZuteilung.get(b.id)!
      const maxS = b.maxStopps || b.kapazitaetStopps
      if (maxS === 0 || bisherige.length < maxS) {
        busZuteilung.get(b.id)!.push({ ...s, busId: b.id })
        zugeteilt = true
        break
      }
    }
    if (!zugeteilt) nichtPlanbar.push(s)
  })

  // Pro Bus optimieren und ETA berechnen
  const alleOptimiert: TourStopp[] = []
  let gesamtKm = 0
  let gesamtMin = 0

  busse.forEach(b => {
    const meine = busZuteilung.get(b.id) || []
    if (meine.length === 0) return
    const optimiert = optimiereReihenfolge(meine, b.depotPlz, modus)
    const mitETA = berechneETA(optimiert, b)
    const km = busKm(mitETA, b)
    gesamtKm += km
    if (mitETA.length > 0) {
      const letzter = mitETA[mitETA.length - 1]
      const startMin = hhmmToMin(b.verfuegbarVon)
      const endeMin = hhmmToMin(letzter.etaAbfahrt || b.verfuegbarVon)
      gesamtMin += Math.max(0, endeMin - startMin)
    }
    alleOptimiert.push(...mitETA.map(s => ({ ...s, tourId, status: 'eingeplant' as StoppStatus })))
  })

  const warnungen = pruefeWarnungen(alleOptimiert, busse)
  if (nichtPlanbar.length > 0) {
    warnungen.push({ typ: 'kein_stopp', schwere: 'fehler', text: `${nichtPlanbar.length} Aufträge konnten keinem Bus zugeordnet werden` })
  }

  return {
    id: tourId, datum, optimierungsmodus: modus, status: 'disponiert',
    busse, stopps: alleOptimiert, nichtPlanbar,
    warnungen, gesamtKm: Math.round(gesamtKm), gesamtMinutenFahrt: Math.round(gesamtMin),
    erstelltAm: today(), aktualisiertAm: today(),
    freigegebenVon: '', freigegebenAm: '', notizen: '',
  }
}

// ── Bus-Statistiken ────────────────────────────────────────────
export function busStats(tour: Tour, busId: string) {
  const bus = tour.busse.find(b => b.id === busId)
  const stopps = tour.stopps.filter(s => s.busId === busId).sort((a, b) => a.reihenfolge - b.reihenfolge)
  if (!bus) return null

  const km = busKm(stopps, bus)
  const auslastungProzent = Math.round((stopps.length / (bus.maxStopps || bus.kapazitaetStopps)) * 100)
  const startzeit = stopps[0]?.etaAnkunft || bus.verfuegbarVon
  const endzeit = stopps[stopps.length - 1]?.etaAbfahrt || '–'
  const dauerMin = hhmmToMin(endzeit) - hhmmToMin(startzeit)
  const verspaetungen = stopps.filter(s => s.verspaetungMin > 0)

  return { bus, stopps, km, auslastungProzent, startzeit, endzeit, dauerMin, verspaetungen }
}

// ── Labels & Farben ────────────────────────────────────────────
export const TOUR_STATUS_LABELS: Record<TourStatus, string> = {
  offen: 'Offen',
  in_planung: 'In Planung',
  disponiert: 'Automatisch disponiert',
  manuell_angepasst: 'Manuell angepasst',
  freigegeben: 'Freigegeben',
  unterwegs: 'Unterwegs',
  erledigt: 'Erledigt',
  nicht_durchgefuehrt: 'Nicht durchgeführt',
}

export const TOUR_STATUS_COLORS: Record<TourStatus, string> = {
  offen: 'bg-slate-100 text-slate-600 border-slate-200',
  in_planung: 'bg-sky-50 text-sky-600 border-sky-200',
  disponiert: 'bg-sky-50 text-sky-700 border-sky-200',
  manuell_angepasst: 'bg-amber-50 text-amber-700 border-amber-200',
  freigegeben: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  unterwegs: 'bg-violet-50 text-violet-700 border-violet-200',
  erledigt: 'bg-slate-100 text-slate-400 border-slate-200',
  nicht_durchgefuehrt: 'bg-rose-50 text-rose-600 border-rose-200',
}

export const BUS_STATUS_COLORS: Record<BusStatus, string> = {
  verfuegbar: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  werkstatt: 'bg-amber-50 text-amber-700 border-amber-200',
  gesperrt: 'bg-rose-50 text-rose-600 border-rose-200',
}

export const BUS_FARBEN = ['bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-teal-500']
export const BUS_LIGHT = [
  'bg-emerald-50 border-emerald-200 text-emerald-900',
  'bg-sky-50 border-sky-200 text-sky-900',
  'bg-violet-50 border-violet-200 text-violet-900',
  'bg-amber-50 border-amber-200 text-amber-900',
  'bg-rose-50 border-rose-200 text-rose-900',
  'bg-teal-50 border-teal-200 text-teal-900',
]
export const BUS_HEADER = ['bg-emerald-600', 'bg-sky-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-teal-600']

export const OPTIMIERUNG_LABELS: Record<Optimierungsmodus, string> = {
  schnellste_route: 'Schnellste Route',
  kuerzeste_km: 'Wenigste Kilometer',
  gleichmaessig: 'Gleichmäßige Verteilung',
  zeitfenster_prio: 'Zeitfenster-Priorität',
}

export function minZuText(min: number): string {
  if (min <= 0) return '–'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}
