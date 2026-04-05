'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import { Badge } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useEinsaetze } from '@/hooks/useEinsaetze'
import { einsaetzeToWechselliste } from '@/lib/wechselliste'
import {
  getBusse, saveBusse, getTouren, saveTour, deleteTour, berechneTour, busStats, plzDistanzKm,
  TOUR_STATUS_LABELS, TOUR_STATUS_COLORS, BUS_STATUS_COLORS, BUS_FARBEN, BUS_LIGHT, BUS_HEADER,
  OPTIMIERUNG_LABELS, minZuText,
  type Bus, type Tour, type TourStopp, type TourStatus, type Prioritaet, type Optimierungsmodus, type PlausiWarnung,
} from '@/lib/touren'
import { getPartner, partnerByPIN } from '@/lib/partner'
import clsx from 'clsx'

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'
const fmtDateShort = (d: string) => d ? new Date(d).toLocaleDateString('de-AT') : '–'
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]

type Ansicht = 'planung' | 'disposition' | 'bus' | 'karte' | 'historie'

// ── Warnung-Anzeige ────────────────────────────────────────────
function WarnungBadge({ w }: { w: PlausiWarnung }) {
  return (
    <div className={clsx('rounded-xl px-3 py-2 text-xs flex items-start gap-2 border',
      w.schwere === 'fehler' ? 'bg-rose-50 border-rose-300 text-rose-800' :
      w.schwere === 'warnung' ? 'bg-amber-50 border-amber-300 text-amber-800' :
      'bg-sky-50 border-sky-200 text-sky-800')}>
      <span>{w.schwere === 'fehler' ? '❌' : w.schwere === 'warnung' ? '⚠️' : 'ℹ️'}</span>
      <span>{w.text}</span>
    </div>
  )
}

// ── Bus-Formular ───────────────────────────────────────────────
function BusForm({ initial, onSave, onClose }: { initial?: Bus; onSave: (b: Bus) => void; onClose: () => void }) {
  const [f, setF] = useState<Bus>(initial || {
    id: uid(), fahrzeugNr: `Bus ${Date.now() % 100}`, kennzeichen: '',
    kapazitaetStopps: 8, kapazitaetKg: 0,
    verfuegbarVon: '06:00', verfuegbarBis: '20:00',
    maxTagesfahrzeitMin: 480, maxStopps: 8,
    depotAdresse: 'Schweizer Straße 1', depotPlz: '6845', depotOrt: 'Hohenems',
    endpunktAdresse: '', fahrer: '', bevorzugteRegion: '',
    status: 'verfuegbar', notizen: '',
  })
  const set = (k: keyof Bus, v: any) => setF(x => ({ ...x, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-teal-700 px-7 py-5 flex items-center justify-between">
          <h3 className="font-bold text-white text-lg">{initial ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer bg-transparent border-none text-2xl">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          {([
            ['fahrzeugNr', 'Fahrzeug-Nr *', 'text'],
            ['kennzeichen', 'Kennzeichen', 'text'],
            ['kapazitaetStopps', 'Max. Stopps', 'number'],
            ['fahrer', 'Fahrer (optional)', 'text'],
            ['verfuegbarVon', 'Verfügbar von', 'time'],
            ['verfuegbarBis', 'Verfügbar bis', 'time'],
            ['maxTagesfahrzeitMin', 'Max. Fahrzeit (min)', 'number'],
            ['bevorzugteRegion', 'Bevorzugte Region', 'text'],
            ['depotOrt', 'Depot-Ort', 'text'],
            ['depotPlz', 'Depot-PLZ', 'text'],
            ['depotAdresse', 'Depot-Adresse', 'text'],
            ['notizen', 'Notizen', 'text'],
          ] as const).map(([field, label, type]) => (
            <div key={field} className={field === 'depotAdresse' || field === 'notizen' ? 'col-span-2' : ''}>
              <div className="text-xs text-slate-500 mb-1">{label}</div>
              <input type={type} value={(f as any)[field] ?? ''}
                onChange={e => set(field, type === 'number' ? +e.target.value : e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
            </div>
          ))}
          <div>
            <div className="text-xs text-slate-500 mb-1">Status</div>
            <select value={f.status} onChange={e => set('status', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none">
              <option value="verfuegbar">✅ Verfügbar</option>
              <option value="werkstatt">🔧 Werkstatt</option>
              <option value="gesperrt">🚫 Gesperrt</option>
            </select>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">Abbrechen</button>
          <button onClick={() => { if (!f.fahrzeugNr) return; onSave(f) }}
            className="flex-1 rounded-xl bg-teal-700 text-white px-5 py-2.5 text-sm font-bold cursor-pointer border-none hover:bg-teal-800">Speichern</button>
        </div>
      </div>
    </div>
  )
}

// ── Stopp-Bearbeitungs-Modal ───────────────────────────────────
function StoppModal({ stopp, onSave, onClose }: { stopp: TourStopp; onSave: (s: TourStopp) => void; onClose: () => void }) {
  const [f, setF] = useState(stopp)
  const set = (k: keyof TourStopp, v: any) => setF(x => ({ ...x, [k]: v }))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-800 px-7 py-5 flex items-center justify-between">
          <div>
            <div className="text-xs text-white/60 mb-0.5">Stopp bearbeiten</div>
            <h3 className="font-bold text-white">{stopp.klientName}</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer bg-transparent border-none text-2xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Zeitfenster von</div>
              <input type="time" value={f.zeitfensterVon || '08:00'} onChange={e => set('zeitfensterVon', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Zeitfenster bis</div>
              <input type="time" value={f.zeitfensterBis || '18:00'} onChange={e => set('zeitfensterBis', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Dauer (Minuten)</div>
              <input type="number" value={f.dauerMinuten} min={5} step={5}
                onChange={e => set('dauerMinuten', +e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Priorität</div>
              <select value={f.prioritaet} onChange={e => set('prioritaet', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none">
                <option value="normal">Normal</option>
                <option value="hoch">Hoch</option>
                <option value="dringend">Dringend</option>
              </select>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Adresse (korrigieren)</div>
            <input value={f.klientAdresse} onChange={e => set('klientAdresse', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">PLZ</div>
            <input value={f.klientPlz} onChange={e => set('klientPlz', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Bemerkungen</div>
            <textarea value={f.bemerkungen} onChange={e => set('bemerkungen', e.target.value)} rows={2}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none resize-none" />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => set('fixiert', !f.fixiert)}
              className={clsx('w-10 h-6 rounded-full border-none cursor-pointer relative', f.fixiert ? 'bg-amber-500' : 'bg-slate-300')}>
              <span className={clsx('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all', f.fixiert ? 'left-5' : 'left-1')} />
            </button>
            <span className="text-sm text-slate-700">Position fixieren (nicht vom Algorithmus verschieben)</span>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">Abbrechen</button>
            <button onClick={() => onSave(f)} className="flex-1 rounded-xl bg-slate-900 text-white px-5 py-2.5 text-sm font-bold cursor-pointer border-none">Speichern</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// HAUPTSEITE
// ══════════════════════════════════════════════════════════════
export default function TourenplanungPage() {
  const { user, loading } = useAuth()
  const { einsaetze } = useEinsaetze()

  const [busse, setBusse] = useState<Bus[]>([])
  const [touren, setTouren] = useState<Tour[]>([])
  const [aktiveTour, setAktiveTour] = useState<Tour | null>(null)
  const [ansicht, setAnsicht] = useState<Ansicht>('planung')

  // Maske 1
  const [datum, setDatum] = useState(today())
  const [modus, setModus] = useState<Optimierungsmodus>('schnellste_route')
  const [berechnung, setBerechnung] = useState(false)
  const [zeitfensterOverride, setZeitfensterOverride] = useState({ von: '08:00', bis: '18:00' })
  const [dauerDefault, setDauerDefault] = useState(30)

  // Modals
  const [showBusForm, setShowBusForm] = useState(false)
  const [editBus, setEditBus] = useState<Bus | null>(null)
  const [editStopp, setEditStopp] = useState<TourStopp | null>(null)
  const [filterBus, setFilterBus] = useState<string>('alle')

  // Drag & Drop
  const dragId = useRef<string | null>(null)

  // Partner-Zugang (Taxi)
  const partnerPIN = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('pin') || '' : ''
  const partnerZugang = partnerPIN ? partnerByPIN(partnerPIN) : null

  useEffect(() => {
    setBusse(getBusse())
    setTouren(getTouren())
  }, [])

  const wechselliste = useMemo(() => {
    const alle = einsaetzeToWechselliste(einsaetze)
    let liste = alle.filter(w => w.wechselDatum === datum && w.status !== 'durchgefuehrt')
    if (partnerZugang) liste = liste.filter(w => w.taxiHin?.includes(partnerZugang.kurzname) || w.taxiRueck?.includes(partnerZugang.kurzname))
    return liste
  }, [einsaetze, datum, partnerZugang])

  const vorhandeneTour = useMemo(() => touren.find(t => t.datum === datum), [touren, datum])
  const verfuegbareBusse = busse.filter(b => b.status === 'verfuegbar')

  // Fehlende Adressen prüfen
  const adressWarnungen = wechselliste.filter(w => !w.klientPlz && !w.klientStrasse)

  function starte() {
    setBerechnung(true)
    setTimeout(() => {
      const eingang = wechselliste.map(w => ({
        einsatzId: w.einsatzId,
        klientId: w.klientId,
        klientName: w.klientName,
        klientOrt: w.klientOrt,
        klientStrasse: w.klientStrasse || '',
        klientPlz: w.klientPlz || '',
        klientTelefon: w.klientTelefon || '',
        ansprechpartner: w.ansprechpartner || '',
        wechselDatum: w.wechselDatum,
        zeitfensterVon: zeitfensterOverride.von,
        zeitfensterBis: zeitfensterOverride.bis,
        dauerMinuten: dauerDefault,
        wechselTyp: w.typ,
        prioritaet: 'normal' as Prioritaet,
        taxiHin: w.taxiHin || '',
        taxiRueck: w.taxiRueck || '',
        betreuerinAbreise: w.gehtBetreuerinName,
        betreuerinAnreise: w.kommtBetreuerinName,
        bemerkungen: w.uebergabeNotiz || '',
      }))
      const tour = berechneTour(datum, eingang, verfuegbareBusse, modus)
      setAktiveTour(tour)
      setBerechnung(false)
      setAnsicht('disposition')
    }, 1000)
  }

  function neuOptimieren() {
    if (!aktiveTour) return
    setBerechnung(true)
    setTimeout(() => {
      const eingang = aktiveTour.stopps.map(s => ({
        einsatzId: s.einsatzId, klientId: s.klientId,
        klientName: s.klientName, klientOrt: s.klientOrt,
        klientStrasse: s.klientStrasse, klientPlz: s.klientPlz,
        klientTelefon: s.telefon, ansprechpartner: s.ansprechpartner,
        wechselDatum: s.wechselDatum, zeitfensterVon: s.zeitfensterVon,
        zeitfensterBis: s.zeitfensterBis, dauerMinuten: s.dauerMinuten,
        wechselTyp: s.wechselTyp, prioritaet: s.prioritaet,
        taxiHin: s.taxiHin, taxiRueck: s.taxiRueck,
        betreuerinAbreise: s.betreuerinAbreise, betreuerinAnreise: s.betreuerinAnreise,
        bemerkungen: s.bemerkungen,
      }))
      const neu = berechneTour(datum, eingang, verfuegbareBusse, modus)
      // fixierte beibehalten
      const mitFix = neu.stopps.map(s => {
        const alt = aktiveTour.stopps.find(x => x.id === s.id)
        return alt?.fixiert ? { ...s, fixiert: true, reihenfolge: alt.reihenfolge } : s
      })
      setAktiveTour({ ...neu, id: aktiveTour.id, status: 'manuell_angepasst', stopps: mitFix })
      setBerechnung(false)
    }, 700)
  }

  function handleBusChange(stoppId: string, busId: string) {
    if (!aktiveTour) return
    setAktiveTour({ ...aktiveTour, status: 'manuell_angepasst', stopps: aktiveTour.stopps.map(s => s.id === stoppId ? { ...s, busId } : s) })
  }

  function handleStoppSave(updated: TourStopp) {
    if (!aktiveTour) return
    setAktiveTour({ ...aktiveTour, status: 'manuell_angepasst', stopps: aktiveTour.stopps.map(s => s.id === updated.id ? updated : s) })
    setEditStopp(null)
  }

  function handlePrio(stoppId: string, p: Prioritaet) {
    if (!aktiveTour) return
    setAktiveTour({ ...aktiveTour, status: 'manuell_angepasst', stopps: aktiveTour.stopps.map(s => s.id === stoppId ? { ...s, prioritaet: p } : s) })
  }

  function handleFixieren(stoppId: string) {
    if (!aktiveTour) return
    setAktiveTour({ ...aktiveTour, status: 'manuell_angepasst', stopps: aktiveTour.stopps.map(s => s.id === stoppId ? { ...s, fixiert: !s.fixiert } : s) })
  }

  function handleDrop(targetId: string) {
    if (!aktiveTour || !dragId.current || dragId.current === targetId) return
    const stopps = [...aktiveTour.stopps]
    const fromIdx = stopps.findIndex(s => s.id === dragId.current)
    const toIdx = stopps.findIndex(s => s.id === targetId)
    const [moved] = stopps.splice(fromIdx, 1)
    stopps.splice(toIdx, 0, moved)
    setAktiveTour({ ...aktiveTour, status: 'manuell_angepasst', stopps: stopps.map((s, i) => ({ ...s, reihenfolge: i + 1 })) })
    dragId.current = null
  }

  function speichern() {
    if (!aktiveTour) return
    saveTour({ ...aktiveTour, aktualisiertAm: today() })
    setTouren(getTouren())
  }

  function freigeben() {
    if (!aktiveTour) return
    const t: Tour = { ...aktiveTour, status: 'freigegeben', freigegebenVon: user?.name || '', freigegebenAm: today(), aktualisiertAm: today() }
    saveTour(t); setAktiveTour(t); setTouren(getTouren())
  }

  function tourLaden(t: Tour) {
    setAktiveTour(t); setDatum(t.datum); setAnsicht('disposition')
  }

  const tourBusse = aktiveTour?.busse || []
  const sichtbareStopps = useMemo(() => {
    if (!aktiveTour) return []
    let s = [...aktiveTour.stopps]
    if (filterBus !== 'alle') s = s.filter(x => x.busId === filterBus)
    return s.sort((a, b) => {
      const bi = tourBusse.findIndex(b => b.id === a.busId)
      const bj = tourBusse.findIndex(b => b.id === b.busId)
      if (bi !== bj) return bi - bj
      return a.reihenfolge - b.reihenfolge
    })
  }, [aktiveTour, filterBus, tourBusse])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden …</div>
  if (!user) return null

  const canEdit = user?.role !== 'mitarbeiter'

  return (
    <div className="flex min-h-screen bg-slate-100">
      {!partnerZugang && <Sidebar />}
      <main className="flex-1 overflow-auto p-6 lg:p-8">

        {showBusForm && (
          <BusForm initial={editBus || undefined}
            onSave={b => {
              const list = getBusse()
              const idx = list.findIndex(x => x.id === b.id)
              if (idx >= 0) list[idx] = b; else list.push(b)
              saveBusse(list); setBusse(getBusse())
              setShowBusForm(false); setEditBus(null)
            }}
            onClose={() => { setShowBusForm(false); setEditBus(null) }} />
        )}
        {editStopp && (
          <StoppModal stopp={editStopp} onSave={handleStoppSave} onClose={() => setEditStopp(null)} />
        )}

        {/* ── HEADER ── */}
        <div className="rounded-[32px] border border-slate-200 bg-white px-8 py-7 shadow-sm mb-6">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="flex gap-2 mb-3 flex-wrap">
                <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-700">🚌 Tourenplanung</span>
                {aktiveTour && <Badge label={TOUR_STATUS_LABELS[aktiveTour.status]} className={clsx('text-xs', TOUR_STATUS_COLORS[aktiveTour.status])} />}
                {partnerZugang && <Badge label={`Partner: ${partnerZugang.name}`} className="text-xs bg-sky-100 text-sky-700 border-sky-200" />}
              </div>
              <h1 className="text-4xl font-bold text-slate-900 mb-1">Wechsel-Tourenplanung</h1>
              <p className="text-slate-500 text-sm">Wechselaufträge automatisch auf Busse verteilen · Disponieren · Freigeben</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Aufträge', wechselliste.length, 'text-slate-900'],
                ['Busse frei', verfuegbareBusse.length, verfuegbareBusse.length === 0 ? 'text-rose-600' : 'text-emerald-700'],
                ['Touren ges.', touren.length, 'text-slate-900'],
              ].map(([l, v, c]) => (
                <div key={String(l)} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-center shadow-sm">
                  <div className="text-xs text-slate-400 mb-1">{l}</div>
                  <div className={clsx('text-3xl font-bold', c)}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── NAVIGATION ── */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {([
            ['planung', '① Planung'],
            ['disposition', '② Disposition'],
            ['bus', '③ Tour je Bus'],
            ['karte', '④ Karte'],
            ['historie', 'Archiv'],
          ] as const).map(([v, l]) => (
            <button key={v} onClick={() => setAnsicht(v)}
              className={clsx('rounded-2xl px-4 py-2.5 text-sm font-semibold cursor-pointer border transition-all',
                ansicht === v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
              {l}
            </button>
          ))}
          {aktiveTour && canEdit && (
            <div className="ml-auto flex gap-2">
              <button onClick={speichern} className="rounded-2xl border border-teal-200 bg-teal-50 text-teal-700 px-4 py-2.5 text-sm font-semibold cursor-pointer hover:bg-teal-100">💾 Speichern</button>
              {aktiveTour.status !== 'freigegeben' && aktiveTour.status !== 'erledigt' && (
                <button onClick={freigeben} className="rounded-2xl bg-emerald-600 text-white px-5 py-2.5 text-sm font-bold cursor-pointer border-none hover:bg-emerald-700">✓ Freigeben</button>
              )}
            </div>
          )}
        </div>

        {/* ════ MASKE 1: PLANUNG STARTEN ════ */}
        {ansicht === 'planung' && (
          <div className="grid xl:grid-cols-[400px_1fr] gap-6">

            {/* Links: Einstellungen */}
            <div className="space-y-5">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900 mb-5">Tourenplanung starten</h2>
                <div className="space-y-4">

                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Datum</div>
                    <div className="text-xs text-teal-600 font-semibold mb-1">
                      {datum ? new Date(datum + 'T12:00:00').toLocaleDateString('de-AT', {weekday:'long', day:'2-digit', month:'2-digit', year:'numeric'}) : ''}
                    </div>
                    <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none font-semibold" />
                    {datum && <div className="text-xs text-slate-400 mt-1">{fmtDate(datum)}</div>}
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Optimierungsmodus</div>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.entries(OPTIMIERUNG_LABELS) as [Optimierungsmodus, string][]).map(([k, v]) => (
                        <button key={k} type="button" onClick={() => setModus(k)}
                          className={clsx('rounded-xl px-3 py-2.5 text-xs font-semibold cursor-pointer border transition-all text-left',
                            modus === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Standard-Zeitfenster & Dauer</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Von</div>
                        <input type="time" value={zeitfensterOverride.von}
                          onChange={e => setZeitfensterOverride(f => ({ ...f, von: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Bis</div>
                        <input type="time" value={zeitfensterOverride.bis}
                          onChange={e => setZeitfensterOverride(f => ({ ...f, bis: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Dauer (min)</div>
                        <input type="number" value={dauerDefault} min={5} step={5}
                          onChange={e => setDauerDefault(+e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none" />
                      </div>
                    </div>
                  </div>

                  {/* Wechselaufträge Vorschau */}
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Wechselaufträge am {fmtDateShort(datum)} ({wechselliste.length})
                    </div>
                    {wechselliste.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-slate-400 text-sm">
                        Keine offenen Wechsel an diesem Tag
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {wechselliste.map(w => (
                          <div key={w.einsatzId} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900">{w.klientName}</span>
                              <span className="text-xs text-slate-400">{w.typ}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {w.klientStrasse ? `${w.klientStrasse}, ` : ''}{w.klientPlz} {w.klientOrt}
                              {!w.klientPlz && !w.klientStrasse && <span className="text-amber-600 font-semibold"> ⚠️ Adresse fehlt</span>}
                            </div>
                            {(w.taxiHin || w.taxiRueck) && <div className="text-xs text-slate-400 mt-0.5">🚕 {w.taxiHin || w.taxiRueck}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Warnungen */}
                  {adressWarnungen.length > 0 && (
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3">
                      <div className="text-xs font-bold text-amber-800 mb-1">⚠️ {adressWarnungen.length} unvollständige Adressen</div>
                      <div className="text-xs text-amber-700">{adressWarnungen.map(w => w.klientName).join(', ')}</div>
                      <div className="text-xs text-amber-600 mt-1">Bitte Adressen im Klientenstamm ergänzen</div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button onClick={starte} disabled={wechselliste.length === 0 || verfuegbareBusse.length === 0 || berechnung}
                      className="flex-1 rounded-2xl bg-slate-900 text-white px-5 py-3.5 text-sm font-bold cursor-pointer border-none hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-2">
                      {berechnung ? <><span className="animate-spin inline-block">⟳</span> Berechne …</> : '🔄 Touren berechnen'}
                    </button>
                  </div>

                  {vorhandeneTour && (
                    <button onClick={() => tourLaden(vorhandeneTour)}
                      className="w-full rounded-2xl border border-teal-200 bg-teal-50 text-teal-700 px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-teal-100">
                      📋 Bestehende Tour laden · {TOUR_STATUS_LABELS[vorhandeneTour.status]}
                    </button>
                  )}
                </div>
              </div>

              {/* Plausibilitäts-Panel */}
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-3">Plausibilität & Warnungen</h3>
                <div className="space-y-2">
                  {verfuegbareBusse.length === 0 && (
                    <WarnungBadge w={{ typ: 'kein_bus', schwere: 'fehler', text: 'Keine verfügbaren Busse — Fahrzeugstamm prüfen' }} />
                  )}
                  {busse.filter(b => b.status === 'werkstatt').map(b => (
                    <WarnungBadge key={b.id} w={{ typ: 'kein_bus', schwere: 'warnung', text: `${b.fahrzeugNr} in der Werkstatt${b.notizen ? ': ' + b.notizen : ''}` }} />
                  ))}
                  {adressWarnungen.length > 0 && (
                    <WarnungBadge w={{ typ: 'adresse', schwere: 'warnung', text: `${adressWarnungen.length} Aufträge ohne vollständige Adresse` }} />
                  )}
                  {wechselliste.length > 0 && verfuegbareBusse.length > 0 && (
                    <WarnungBadge w={{ typ: 'kein_bus', schwere: 'info', text: `${wechselliste.length} Aufträge auf ${verfuegbareBusse.length} Bus${verfuegbareBusse.length > 1 ? 'se' : ''} — bereit zur Berechnung` }} />
                  )}
                  {aktiveTour?.warnungen.map((w, i) => <WarnungBadge key={i} w={w} />)}
                  {!aktiveTour && wechselliste.length === 0 && verfuegbareBusse.length > 0 && (
                    <div className="text-sm text-slate-400 text-center py-4">Kein Handlungsbedarf</div>
                  )}
                </div>
              </div>
            </div>

            {/* Rechts: Fahrzeugstamm */}
            <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Fahrzeugstamm</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{verfuegbareBusse.length} verfügbar · {busse.length} gesamt</p>
                </div>
                {canEdit && (
                  <button onClick={() => { setEditBus(null); setShowBusForm(true) }}
                    className="rounded-2xl bg-teal-700 text-white px-4 py-2.5 text-sm font-bold cursor-pointer border-none hover:bg-teal-800">
                    + Fahrzeug
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-50">
                {busse.map((bus, i) => (
                  <div key={bus.id} className="px-6 py-5 flex items-start gap-4">
                    <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0',
                      bus.status === 'verfuegbar' ? BUS_FARBEN[i % BUS_FARBEN.length] : 'bg-slate-300')}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="font-bold text-slate-900 text-base">{bus.fahrzeugNr}</span>
                        <span className="text-xs text-slate-400 font-mono">{bus.kennzeichen}</span>
                        <Badge label={bus.status === 'verfuegbar' ? '✅ Verfügbar' : bus.status === 'werkstatt' ? '🔧 Werkstatt' : '🚫 Gesperrt'}
                          className={clsx('text-xs', BUS_STATUS_COLORS[bus.status])} />
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500">
                        <span>Max. Stopps: <strong className="text-slate-800">{bus.maxStopps || bus.kapazitaetStopps}</strong></span>
                        <span>Zeit: <strong className="text-slate-800">{bus.verfuegbarVon} – {bus.verfuegbarBis}</strong></span>
                        <span>Depot: <strong className="text-slate-800">{bus.depotOrt} {bus.depotPlz}</strong></span>
                        {bus.fahrer && <span>Fahrer: <strong className="text-slate-800">{bus.fahrer}</strong></span>}
                        {bus.bevorzugteRegion && <span>Region: <strong className="text-slate-800">{bus.bevorzugteRegion}</strong></span>}
                        {bus.maxTagesfahrzeitMin > 0 && <span>Max. Fahrzeit: <strong className="text-slate-800">{minZuText(bus.maxTagesfahrzeitMin)}</strong></span>}
                      </div>
                      {bus.notizen && <div className="text-xs text-amber-700 mt-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">{bus.notizen}</div>}
                    </div>
                    {canEdit && (
                      <button onClick={() => { setEditBus(bus); setShowBusForm(true) }}
                        className="rounded-xl border border-slate-200 text-slate-500 text-xs px-3 py-2 cursor-pointer hover:bg-slate-50 flex-shrink-0">✏️</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ MASKE 2: DISPOSITION ════ */}
        {ansicht === 'disposition' && (
          <div className="space-y-5">
            {!aktiveTour ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-16 text-center text-slate-400">
                <div className="text-5xl mb-3">🔄</div>
                <div className="text-lg font-medium mb-3">Noch keine Tour berechnet</div>
                <button onClick={() => setAnsicht('planung')} className="rounded-2xl bg-teal-700 text-white px-6 py-3 text-sm font-bold cursor-pointer border-none">→ Zur Planung</button>
              </div>
            ) : (
              <>
                {/* Bus-Kacheln */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {tourBusse.map((bus, i) => {
                    const meine = aktiveTour.stopps.filter(s => s.busId === bus.id)
                    const ausl = Math.round((meine.length / (bus.maxStopps || bus.kapazitaetStopps)) * 100)
                    return (
                      <div key={bus.id} className={clsx('rounded-2xl border p-4', BUS_LIGHT[i % BUS_LIGHT.length])}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className={clsx('w-8 h-8 rounded-xl text-white text-xs font-bold flex items-center justify-center', BUS_FARBEN[i % BUS_FARBEN.length])}>{i + 1}</div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{bus.fahrzeugNr}</div>
                            <div className="text-[10px] text-slate-500">{bus.kennzeichen}</div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-600 space-y-1">
                          <div className="flex justify-between"><span>Stopps</span><span className="font-bold">{meine.length}/{bus.maxStopps || bus.kapazitaetStopps}</span></div>
                          <div className="flex justify-between"><span>Zeit</span><span>{bus.verfuegbarVon}–{bus.verfuegbarBis}</span></div>
                          {bus.fahrer && <div className="flex justify-between"><span>Fahrer</span><span>{bus.fahrer}</span></div>}
                        </div>
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Auslastung</span><span>{ausl}%</span></div>
                          <div className="h-1.5 bg-white/60 rounded-full"><div className={clsx('h-full rounded-full', BUS_FARBEN[i % BUS_FARBEN.length])} style={{ width: `${Math.min(ausl, 100)}%` }} /></div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Toolbar */}
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 flex items-center gap-3 flex-wrap shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Bus:</span>
                    <select value={filterBus} onChange={e => setFilterBus(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none">
                      <option value="alle">Alle Busse</option>
                      {tourBusse.map((b, i) => <option key={b.id} value={b.id}>{b.fahrzeugNr}</option>)}
                    </select>
                  </div>
                  <Badge label={TOUR_STATUS_LABELS[aktiveTour.status]} className={clsx('text-xs', TOUR_STATUS_COLORS[aktiveTour.status])} />
                  <span className="text-xs text-slate-400">{aktiveTour.stopps.length} Aufträge · ~{aktiveTour.gesamtKm} km</span>
                  {canEdit && (
                    <button onClick={neuOptimieren} disabled={berechnung}
                      className="ml-auto rounded-xl border border-slate-200 text-slate-600 text-xs px-4 py-2 cursor-pointer hover:bg-slate-50 font-semibold">
                      {berechnung ? '⟳ …' : '🔄 Neu optimieren'}
                    </button>
                  )}
                </div>

                {/* Disposition-Tabelle */}
                <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                  {/* Spalten-Header */}
                  <div className="grid text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 bg-slate-50 sticky top-0 z-10"
                    style={{ gridTemplateColumns: '28px 36px 1fr 110px 80px 70px 80px 90px 80px 48px' }}>
                    <div /><div />
                    <div className="px-3 py-3">Auftrag / Kunde</div>
                    <div className="px-2 py-3">Adresse</div>
                    <div className="px-2 py-3">Zeitfenster</div>
                    <div className="px-2 py-3">Dauer</div>
                    <div className="px-2 py-3">ETA</div>
                    <div className="px-2 py-3">Bus</div>
                    <div className="px-2 py-3">Priorität</div>
                    <div />
                  </div>

                  {sichtbareStopps.map((s, idx) => {
                    const busIdx = tourBusse.findIndex(b => b.id === s.busId)
                    const prevStopp = sichtbareStopps[idx - 1]
                    const showBusHeader = !prevStopp || prevStopp.busId !== s.busId
                    const bus = tourBusse[busIdx]
                    const hatWarnung = s.verspaetungMin > 0 || s.warnungen.length > 0

                    return (
                      <div key={s.id}>
                        {showBusHeader && bus && (
                          <div className={clsx('flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider', BUS_LIGHT[busIdx % BUS_LIGHT.length])}>
                            <div className={clsx('w-4 h-4 rounded text-white text-[9px] font-bold flex items-center justify-center', BUS_FARBEN[busIdx % BUS_FARBEN.length])}>
                              {busIdx + 1}
                            </div>
                            {bus.fahrzeugNr} {bus.fahrer && `· ${bus.fahrer}`} · {aktiveTour.stopps.filter(x => x.busId === bus.id).length} Stopps
                          </div>
                        )}
                        <div
                          draggable={canEdit}
                          onDragStart={() => { dragId.current = s.id }}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => handleDrop(s.id)}
                          className={clsx('grid items-center border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors',
                            canEdit && 'cursor-grab',
                            s.fixiert && 'bg-amber-50/30',
                            hatWarnung && 'border-l-2 border-l-amber-400',
                          )}
                          style={{ gridTemplateColumns: '28px 36px 1fr 110px 80px 70px 80px 90px 80px 48px' }}>

                          <div className="flex items-center justify-center text-slate-300 text-sm pl-2">{canEdit ? '⠿' : ''}</div>

                          <div className="flex items-center justify-center">
                            <div className={clsx('w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center',
                              busIdx >= 0 ? BUS_FARBEN[busIdx % BUS_FARBEN.length] : 'bg-slate-300')}>
                              {s.reihenfolge}
                            </div>
                          </div>

                          <div className="px-3 py-3">
                            <div className="font-semibold text-slate-900 text-sm leading-tight">{s.klientName}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{s.auftragNr} · {s.wechselTyp}</div>
                            {s.betreuerinAbreise && <div className="text-[10px] text-slate-400">↓ {s.betreuerinAbreise}</div>}
                            {s.betreuerinAnreise && <div className="text-[10px] text-slate-400">↑ {s.betreuerinAnreise}</div>}
                          </div>

                          <div className="px-2 py-3">
                            <div className="text-xs text-slate-700 leading-tight">{s.klientStrasse || s.klientOrt}</div>
                            <div className="text-[10px] text-slate-400">{s.klientPlz} {s.klientOrt}</div>
                            {!s.klientPlz && !s.klientStrasse && <div className="text-[10px] text-amber-600 font-semibold">⚠️ Fehlt</div>}
                          </div>

                          <div className="px-2 py-3 text-xs text-slate-600">
                            {s.zeitfensterVon || '–'} – {s.zeitfensterBis || '–'}
                          </div>

                          <div className="px-2 py-3 text-xs text-slate-600">{s.dauerMinuten}min</div>

                          <div className="px-2 py-3">
                            <div className={clsx('font-mono text-sm font-bold', s.verspaetungMin > 0 ? 'text-rose-600' : 'text-slate-800')}>
                              {s.etaAnkunft || '–'}
                            </div>
                            {s.verspaetungMin > 0 && <div className="text-[10px] text-rose-600">+{s.verspaetungMin}min</div>}
                            <div className="text-[10px] text-slate-400">→ {s.etaAbfahrt}</div>
                          </div>

                          {canEdit ? (
                            <div className="px-2 py-3">
                              <select value={s.busId} onChange={e => handleBusChange(s.id, e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs outline-none">
                                {tourBusse.map(b => <option key={b.id} value={b.id}>{b.fahrzeugNr}</option>)}
                              </select>
                            </div>
                          ) : (
                            <div className="px-2 py-3 text-xs text-slate-600">{bus?.fahrzeugNr || '–'}</div>
                          )}

                          {canEdit ? (
                            <div className="px-2 py-3">
                              <select value={s.prioritaet} onChange={e => handlePrio(s.id, e.target.value as Prioritaet)}
                                className={clsx('w-full rounded-lg border px-1.5 py-1 text-xs outline-none',
                                  s.prioritaet === 'dringend' ? 'border-rose-300 bg-rose-50 text-rose-700' :
                                  s.prioritaet === 'hoch' ? 'border-amber-300 bg-amber-50 text-amber-700' :
                                  'border-slate-200 bg-white text-slate-600')}>
                                <option value="normal">Normal</option>
                                <option value="hoch">Hoch</option>
                                <option value="dringend">Dringend</option>
                              </select>
                            </div>
                          ) : (
                            <div className="px-2 py-3">
                              <Badge label={s.prioritaet} className={clsx('text-[10px]',
                                s.prioritaet === 'dringend' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                s.prioritaet === 'hoch' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-slate-50 text-slate-500 border-slate-200')} />
                            </div>
                          )}

                          <div className="flex items-center justify-center gap-1 pr-2">
                            {canEdit && (
                              <>
                                <button onClick={() => setEditStopp(s)} title="Bearbeiten"
                                  className="rounded-lg border border-slate-200 text-slate-400 text-xs p-1.5 cursor-pointer hover:bg-slate-50">✏️</button>
                                <button onClick={() => handleFixieren(s.id)} title={s.fixiert ? 'Freigeben' : 'Fixieren'}
                                  className={clsx('rounded-lg border text-xs p-1.5 cursor-pointer', s.fixiert ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-300 hover:bg-slate-50')}>
                                  {s.fixiert ? '🔒' : '🔓'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Nicht planbare Aufträge */}
                {aktiveTour.nichtPlanbar.length > 0 && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                    <div className="font-bold text-rose-800 mb-2">❌ Nicht planbare Aufträge ({aktiveTour.nichtPlanbar.length})</div>
                    <div className="space-y-1">
                      {aktiveTour.nichtPlanbar.map(s => (
                        <div key={s.id} className="text-sm text-rose-700">{s.klientName} · {s.klientOrt} — Alle Busse ausgelastet</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnungen aus Berechnung */}
                {aktiveTour.warnungen.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Konflikte & Optimierungshinweise</div>
                    {aktiveTour.warnungen.map((w, i) => <WarnungBadge key={i} w={w} />)}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════ MASKE 3: TOUR JE BUS ════ */}
        {ansicht === 'bus' && (
          <div>
            {!aktiveTour ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-16 text-center text-slate-400">
                <div className="text-5xl mb-3">🚌</div>
                <div className="text-lg font-medium">Keine aktive Tour</div>
              </div>
            ) : (
              <div className="grid xl:grid-cols-2 gap-5">
                {tourBusse.map((bus, i) => {
                  const stats = busStats(aktiveTour, bus.id)
                  if (!stats || stats.stopps.length === 0) return null

                  return (
                    <div key={bus.id} className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                      {/* Bus-Header */}
                      <div className={clsx('px-6 py-5 text-white', BUS_HEADER[i % BUS_HEADER.length])}>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="text-xs text-white/60 uppercase tracking-widest mb-0.5">{bus.kennzeichen}</div>
                            <div className="text-2xl font-bold">{bus.fahrzeugNr}</div>
                            {bus.fahrer && <div className="text-sm text-white/80">Fahrer: {bus.fahrer}</div>}
                          </div>
                          <div className="text-right">
                            <div className="text-4xl font-bold">{stats.stopps.length}</div>
                            <div className="text-xs text-white/60">Stopps</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            ['Startzeit', stats.startzeit],
                            ['Rückkehr', stats.endzeit],
                            ['~km', `${stats.km} km`],
                            ['Dauer', minZuText(stats.dauerMin)],
                          ].map(([l, v]) => (
                            <div key={l} className="rounded-xl bg-white/15 px-3 py-2 text-center">
                              <div className="text-[10px] text-white/60">{l}</div>
                              <div className="font-bold text-sm">{v}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] text-white/60 mb-1">
                            <span>Auslastung</span><span>{stats.auslastungProzent}%</span>
                          </div>
                          <div className="h-1.5 bg-white/25 rounded-full">
                            <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(stats.auslastungProzent, 100)}%` }} />
                          </div>
                        </div>
                        {stats.verspaetungen.length > 0 && (
                          <div className="mt-2 rounded-xl bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200">
                            ⚠️ {stats.verspaetungen.length} Stopp{stats.verspaetungen.length > 1 ? 's' : ''} mit Verspätung
                          </div>
                        )}
                      </div>

                      {/* Stoppliste */}
                      <div>
                        {/* Depot → */}
                        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-3 text-xs text-slate-500">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-[10px] flex-shrink-0">D</div>
                          <div>Depot: {bus.depotAdresse || bus.depotOrt} · Start {bus.verfuegbarVon}</div>
                        </div>

                        {stats.stopps.map((s, si) => {
                          const hatWarnung = s.verspaetungMin > 0 || s.warnungen.length > 0
                          return (
                            <div key={s.id} className={clsx('grid items-start gap-0 px-5 py-4 border-b border-slate-50 last:border-0',
                              hatWarnung ? 'bg-rose-50/30' : si % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}
                              style={{ gridTemplateColumns: '28px 1fr 90px' }}>
                              <div className={clsx('w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5', BUS_FARBEN[i % BUS_FARBEN.length])}>
                                {si + 1}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 text-sm">{s.klientName}</div>
                                <div className="text-xs text-slate-500">{s.klientStrasse || ''}{s.klientStrasse ? ', ' : ''}{s.klientPlz} {s.klientOrt}</div>
                                {s.ansprechpartner && <div className="text-[10px] text-slate-400">👤 {s.ansprechpartner} {s.telefon && `· ${s.telefon}`}</div>}
                                <div className="flex gap-3 mt-1 text-[10px] text-slate-400 flex-wrap">
                                  {s.betreuerinAbreise && <span>↓ Abreise: {s.betreuerinAbreise}</span>}
                                  {s.betreuerinAnreise && <span>↑ Anreise: {s.betreuerinAnreise}</span>}
                                  {(s.taxiHin || s.taxiRueck) && <span>🚕 {s.taxiHin || s.taxiRueck}</span>}
                                </div>
                                {s.bemerkungen && <div className="text-[10px] text-amber-800 bg-amber-50 rounded-lg px-2 py-1 mt-1 border border-amber-200">{s.bemerkungen}</div>}
                                {s.warnungen.map((w, wi) => <div key={wi} className="text-[10px] text-rose-700 mt-0.5">⚠️ {w}</div>)}
                              </div>
                              <div className="text-right">
                                <div className={clsx('font-mono font-bold text-base', s.verspaetungMin > 0 ? 'text-rose-600' : 'text-slate-900')}>{s.etaAnkunft}</div>
                                <div className="text-[10px] text-slate-400">→ {s.etaAbfahrt}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{s.dauerMinuten}min</div>
                                {s.verspaetungMin > 0 && <div className="text-[10px] text-rose-600 font-semibold">+{s.verspaetungMin}min</div>}
                              </div>
                            </div>
                          )
                        })}

                        {/* → Depot */}
                        <div className="px-5 py-2.5 bg-slate-50 flex items-center gap-3 text-xs text-slate-500">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-[10px] flex-shrink-0">D</div>
                          <div>Rückfahrt → Depot {bus.depotOrt} · Ende ~{stats.endzeit}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ MASKE 4: KARTE (vereinfacht) ════ */}
        {ansicht === 'karte' && (
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">Kartenansicht</h2>
              <p className="text-sm text-slate-500 mt-0.5">Geografische Übersicht der geplanten Stopps nach Bus</p>
            </div>
            {!aktiveTour ? (
              <div className="p-16 text-center text-slate-400">
                <div className="text-5xl mb-3">🗺️</div>
                <div>Keine Tour aktiv — zuerst eine Tour berechnen</div>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-800">
                  ℹ️ Für eine echte Kartenansicht wird ein Routing-Dienst (Google Maps API oder OpenRouteService) benötigt. Die folgende Liste zeigt die PLZ-basierte Reihenfolge.
                </div>
                {tourBusse.map((bus, i) => {
                  const stopps = aktiveTour.stopps.filter(s => s.busId === bus.id).sort((a, b) => a.reihenfolge - b.reihenfolge)
                  if (stopps.length === 0) return null
                  return (
                    <div key={bus.id} className={clsx('rounded-2xl border p-4', BUS_LIGHT[i % BUS_LIGHT.length])}>
                      <div className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <div className={clsx('w-6 h-6 rounded text-white text-xs font-bold flex items-center justify-center', BUS_FARBEN[i % BUS_FARBEN.length])}>{i + 1}</div>
                        {bus.fahrzeugNr} — Route
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <div className="rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">🏁 {bus.depotOrt}</div>
                        {stopps.map((s, si) => (
                          <div key={s.id} className="flex items-center gap-1">
                            <span className="text-slate-300 text-sm">→</span>
                            <div className={clsx('rounded-xl border px-3 py-1.5 text-xs font-semibold',
                              s.prioritaet === 'dringend' ? 'bg-rose-100 border-rose-300 text-rose-800' :
                              s.verspaetungMin > 0 ? 'bg-amber-100 border-amber-300 text-amber-800' :
                              'bg-white border-slate-200 text-slate-700')}>
                              {si + 1}. {s.klientOrt} ({s.klientPlz || '–'})
                              {s.etaAnkunft && <span className="ml-1 font-mono text-[10px]">{s.etaAnkunft}</span>}
                            </div>
                          </div>
                        ))}
                        <span className="text-slate-300 text-sm">→</span>
                        <div className="rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">🏁 {bus.depotOrt}</div>
                      </div>
                    </div>
                  )
                })}

                {/* Überschneidungs-Check */}
                {(() => {
                  const ueberschneidungen: string[] = []
                  const busStopps = tourBusse.map(b => ({
                    bus: b,
                    stopps: aktiveTour.stopps.filter(s => s.busId === b.id).sort((a, z) => a.reihenfolge - z.reihenfolge)
                  }))
                  // Grobe Prüfung: gleiche PLZ zur gleichen ETA?
                  for (let i = 0; i < busStopps.length; i++) {
                    for (let j = i + 1; j < busStopps.length; j++) {
                      for (const s1 of busStopps[i].stopps) {
                        for (const s2 of busStopps[j].stopps) {
                          if (s1.klientPlz === s2.klientPlz && s1.etaAnkunft === s2.etaAnkunft) {
                            ueberschneidungen.push(`${busStopps[i].bus.fahrzeugNr} + ${busStopps[j].bus.fahrzeugNr} in ${s1.klientOrt} um ${s1.etaAnkunft}`)
                          }
                        }
                      }
                    }
                  }
                  return ueberschneidungen.length > 0 ? (
                    <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4">
                      <div className="font-bold text-rose-800 mb-2">⚠️ Mögliche Überschneidungen</div>
                      {ueberschneidungen.map((u, i) => <div key={i} className="text-sm text-rose-700">{u}</div>)}
                    </div>
                  ) : null
                })()}
              </div>
            )}
          </div>
        )}

        {/* ════ ARCHIV / HISTORISCHE TOUREN ════ */}
        {ansicht === 'historie' && (
          <div className="space-y-4">
            {touren.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-16 text-center text-slate-400">
                <div className="text-5xl mb-3">📁</div>
                <div className="text-lg font-medium">Noch keine gespeicherten Touren</div>
              </div>
            ) : (
              [...touren].sort((a, b) => b.datum.localeCompare(a.datum)).map(t => (
                <div key={t.id} className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm flex items-center gap-5 cursor-pointer hover:border-teal-300 hover:shadow-md transition-all"
                  onClick={() => tourLaden(t)}>
                  <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 flex flex-col items-center justify-center flex-shrink-0">
                    <div className="text-xl font-bold text-teal-700">{new Date(t.datum).getDate()}</div>
                    <div className="text-[10px] text-teal-500">{new Date(t.datum).toLocaleDateString('de-AT', { month: 'short' })}</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-slate-900 text-lg">{fmtDate(t.datum)}</span>
                      <Badge label={TOUR_STATUS_LABELS[t.status]} className={clsx('text-xs', TOUR_STATUS_COLORS[t.status])} />
                    </div>
                    <div className="text-sm text-slate-500 flex gap-4 flex-wrap">
                      <span>{t.stopps.length} Stopps</span>
                      <span>{t.busse.length} Busse</span>
                      <span>~{t.gesamtKm} km</span>
                      <span>{OPTIMIERUNG_LABELS[t.optimierungsmodus]}</span>
                      {t.freigegebenVon && <span>Freigabe: {t.freigegebenVon}</span>}
                    </div>
                    {t.warnungen.filter(w => w.schwere === 'fehler').length > 0 && (
                      <div className="text-xs text-rose-600 mt-1">⚠️ {t.warnungen.filter(w => w.schwere === 'fehler').length} Fehler</div>
                    )}
                  </div>
                  {canEdit && (
                    <button onClick={ev => {
                      ev.stopPropagation()
                      if (confirm('Tour löschen?')) { deleteTour(t.id); setTouren(getTouren()); if (aktiveTour?.id === t.id) setAktiveTour(null) }
                    }} className="rounded-xl border border-rose-200 text-rose-500 text-xs px-3 py-2 cursor-pointer hover:bg-rose-50 flex-shrink-0">✕</button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </main>
    </div>
  )
}
