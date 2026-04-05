'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useEinsaetze } from '@/hooks/useEinsaetze'
import { Badge } from '@/components/ui'
import Sidebar from '@/components/Sidebar'
import { einsaetzeToWechselliste, getOffeneStellen, WECHSEL_STATUS_LABELS, WECHSEL_STATUS_COLORS, TYP_COLORS, type WechselEintrag } from '@/lib/wechselliste'
import { exportWechsellistePDF, exportWechsellisteExcel, exportTaxiListePDF, exportWechsellisteTaxiExcel, druckeWechselliste } from '@/lib/exportWechselliste'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'

function daysUntil(d:string){return Math.ceil((new Date(d).getTime()-Date.now())/86400000)}

export default function WechsellistePage(){
  const {user,loading}=useAuth()
  const {einsaetze}=useEinsaetze()
  const router=useRouter()
  const [statusFilter,setStatusFilter]=useState('alle')
  const [taxiFilter,setTaxiFilter]=useState('alle')
  const [datumVon,setDatumVon]=useState('')
  const [datumBis,setDatumBis]=useState('')
  const [selected,setSelected]=useState<WechselEintrag|null>(null)

  // Partner-Taxi Leserecht prüfen (PIN in URL: ?pin=1234)
  const [partnerPIN] = useState(() => typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('pin') || '' : '')
  const [partnerZugang] = useState(() => {
    if (!partnerPIN) return null
    try { const { partnerByPIN } = require('@/lib/partner'); return partnerByPIN(partnerPIN) } catch { return null }
  })

  const alleTaxis = useMemo(() => {
    const taxi = new Set<string>()
    einsaetze.forEach(e => { if (e.taxiHin) taxi.add(e.taxiHin); if (e.taxiRueck) taxi.add(e.taxiRueck) })
    return [...taxi].sort()
  }, [einsaetze])

  const wechselliste=useMemo(()=>einsaetzeToWechselliste(einsaetze),[einsaetze])
  const filtered=useMemo(()=>{
    let list = statusFilter==='alle' ? wechselliste : wechselliste.filter(w=>w.status===statusFilter)
    if (partnerZugang) list = list.filter(w => w.taxiHin?.includes(partnerZugang.kurzname) || w.taxiRueck?.includes(partnerZugang.kurzname))
    if (taxiFilter !== 'alle') list = list.filter(w => w.taxiHin === taxiFilter || w.taxiRueck === taxiFilter)
    if (datumVon) list = list.filter(w => (w.wechselDatum || '') >= datumVon)
    if (datumBis) list = list.filter(w => (w.wechselDatum || '') <= datumBis)
    return list.sort((a,b) => (a.wechselDatum||'').localeCompare(b.wechselDatum||''))
  }, [wechselliste, statusFilter, taxiFilter, partnerZugang, datumVon, datumBis])

  // Nächste 4 anstehende Wechsel
  const heute = new Date().toISOString().split('T')[0]
  const naechsteWechsel = useMemo(() =>
    wechselliste
      .filter(w => (w.wechselDatum||'') >= heute && w.status !== 'durchgefuehrt')
      .sort((a,b) => (a.wechselDatum||'').localeCompare(b.wechselDatum||''))
      .slice(0, 4)
  , [wechselliste, heute])
  const counts=useMemo(()=>({
    alle:wechselliste.length,
    vorbereitung:wechselliste.filter(w=>w.status==='vorbereitung').length,
    bestaetigt:wechselliste.filter(w=>w.status==='bestaetigt').length,
    durchgefuehrt:wechselliste.filter(w=>w.status==='durchgefuehrt').length,
  }),[wechselliste])

  const [showExport, setShowExport] = useState(false)
  const [showSpaltenConfig, setShowSpaltenConfig] = useState(false)
  const [spalten, setSpalten] = useState({
    reistAb: true,
    reistAn: true,
    typ: true,
    taxi: true,
    status: true,
    adresse: false,
    telefon: false,
    ansprechpartner: false,
  })

  // Frühwarnung: Stellen die in 14 Tagen nicht besetzt sind
  const offeneStellen = useMemo(() => getOffeneStellen(einsaetze, 14), [einsaetze])

  if(loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>
  if(!user) return null

  const filterLabel = [
    statusFilter !== 'alle' ? WECHSEL_STATUS_LABELS[statusFilter as any] : '',
    taxiFilter !== 'alle' ? `Taxi: ${taxiFilter}` : '',
  ].filter(Boolean).join(' · ') || 'Alle Wechsel'

  return (
    <div className="flex min-h-screen">
      <Sidebar/>
      <main className="flex-1 overflow-auto p-8">

        {selected&&(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={()=>setSelected(null)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
              <div className="bg-teal-700 rounded-t-3xl px-8 py-7 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/60 mb-1">{selected.typ}</div>
                    <h2 className="text-3xl font-bold">{selected.klientName}</h2>
                    <div className="text-white/70 mt-1">📍 {selected.klientOrt} · {new Date(selected.wechselDatum).toLocaleDateString('de-AT')}</div>
                  </div>
                  <button onClick={()=>setSelected(null)} className="text-white/70 hover:text-white text-2xl bg-transparent border-none cursor-pointer">✕</button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge label={WECHSEL_STATUS_LABELS[selected.status]} className={WECHSEL_STATUS_COLORS[selected.status]}/>
                  <Badge label={selected.turnusTage+' Tage'} className="border-white/20 bg-white/10 text-white"/>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Wechseltag</div>
                    <div className="text-xl font-bold">{new Date(selected.wechselDatum).toLocaleDateString('de-AT')}</div>
                    {daysUntil(selected.wechselDatum)>=0?<div className="text-sm text-white/70 mt-0.5">in {daysUntil(selected.wechselDatum)} Tagen</div>:<div className="text-sm text-emerald-300 mt-0.5">durchgeführt</div>}
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Taxikosten</div>
                    <div className="text-xl font-bold">{selected.taxiKosten?selected.taxiKosten+' €':'–'}</div>
                  </div>
                </div>
              </div>
              <div className="px-8 py-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <div className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-2">Geht ab</div>
                    <div className="font-bold text-slate-900 text-lg">{selected.gehtBetreuerinName||'—'}</div>
                    <div className="text-sm text-slate-500 mt-1">Abreise: {selected.abreiseDatum?new Date(selected.abreiseDatum).toLocaleDateString('de-AT'):'–'}</div>
                    {selected.taxiRueck&&<div className="text-xs text-slate-500 mt-1">🚕 {selected.taxiRueck}</div>}
                  </div>
                  <div className={clsx('rounded-2xl border p-4',selected.kommtBetreuerinName?'border-emerald-200 bg-emerald-50':'border-amber-200 bg-amber-50')}>
                    <div className={clsx('text-xs font-bold uppercase tracking-widest mb-2',selected.kommtBetreuerinName?'text-emerald-600':'text-amber-600')}>Reist an</div>
                    <div className="font-bold text-slate-900 text-lg">{selected.kommtBetreuerinName||'⚠️ Noch offen'}</div>
                    <div className="text-sm text-slate-500 mt-1">Anreise: {selected.anreiseDatum?new Date(selected.anreiseDatum).toLocaleDateString('de-AT'):'–'}</div>
                    {selected.taxiHin&&<div className="text-xs text-slate-500 mt-1">🚕 {selected.taxiHin}</div>}
                  </div>
                </div>
                {selected.uebergabeNotiz&&(
                  <div>
                    <div className="text-sm font-bold text-slate-700 mb-2">Übergabenotiz</div>
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-900 whitespace-pre-wrap">{selected.uebergabeNotiz}</div>
                  </div>
                )}
                <div className="flex gap-3 justify-between">
                  <button onClick={()=>{setSelected(null);router.push('/einsaetze')}} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-teal-700 cursor-pointer hover:bg-slate-50">→ Einsatz öffnen</button>
                  {!selected.kommtBetreuerinName&&user?.role!=='mitarbeiter'&&(
                    <button onClick={()=>{setSelected(null);router.push('/einsaetze')}} className="rounded-2xl bg-amber-600 px-5 py-3 text-sm font-bold text-white cursor-pointer border-none hover:bg-amber-700">Nachfolgerin zuweisen →</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        {/* ═══ NÄCHSTE WECHSEL SCHNELLVORSCHAU ═══ */}
        {naechsteWechsel.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">⚡ Nächste Wechsel</div>
            <div className="grid grid-cols-2 gap-3" style={{gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))'}}>
              {naechsteWechsel.map(w => {
                const tage = Math.round((new Date(w.wechselDatum).getTime() - new Date().getTime()) / 86400000)
                const dringend = tage <= 3
                return (
                  <div key={w.id} onClick={()=>setSelected(w)}
                    className={`rounded-2xl border-2 p-4 cursor-pointer hover:shadow-md transition-all ${dringend ? 'border-rose-300 bg-rose-50' : 'border-teal-200 bg-teal-50'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${dringend ? 'bg-rose-200 text-rose-800' : 'bg-teal-200 text-teal-800'}`}>
                        {tage === 0 ? '🔴 HEUTE' : tage === 1 ? '🟠 MORGEN' : `in ${tage} Tagen`}
                      </div>
                      <div className="text-xs text-slate-500">{new Date(w.wechselDatum).toLocaleDateString('de-AT')}</div>
                    </div>
                    <div className="font-bold text-slate-900 text-sm">{w.klientName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">📍 {w.klientOrt}</div>
                    <div className="flex gap-2 mt-2 text-xs">
                      <span className="text-rose-600">↑ {w.gehtBetreuerinName || '?'}</span>
                      <span className="text-slate-300">→</span>
                      <span className={w.kommtBetreuerinName ? 'text-teal-700' : 'text-amber-600 font-bold'}>
                        {w.kommtBetreuerinName || '⚠️ offen'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-2">VBetreut · ERP</div>
              <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-2">Wechselliste</h1>
              <p className="text-base text-slate-500 max-w-2xl">Automatisch aus Turnus-Beginn und -Ende abgeleitet. An-/Abreisen und Wechsel erscheinen automatisch.</p>
              {offeneStellen.length > 0 && (
                <div className="mt-4 rounded-2xl bg-rose-50 border border-rose-300 px-5 py-4">
                  <div className="font-bold text-rose-800 mb-2">⚠️ {offeneStellen.length} Stelle{offeneStellen.length > 1 ? 'n' : ''} nicht besetzt (nächste 14 Tage)</div>
                  <div className="space-y-1">
                    {offeneStellen.map(e => (
                      <div key={e.id} className="text-sm text-rose-700">
                        • <strong>{e.klientName}</strong> — Einsatz endet {new Date(e.bis + 'T12:00:00').toLocaleDateString('de-AT')}, kein Nachfolger geplant
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              {/* Export-Menü */}
              <div className="relative">
                <button onClick={() => setShowExport(v => !v)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 flex items-center gap-2">
                  📥 Export <span className="text-slate-400">▾</span>
                </button>
                {showExport && (
                  <div className="absolute right-0 top-12 z-30 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 min-w-52" onClick={() => setShowExport(false)}>
                    <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wechselliste ({filtered.length})</div>
                    <button onClick={() => exportWechsellistePDF(filtered, 'Wechselliste', { filterLabel, mitUebergabe: true })}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                      📄 PDF (Querformat, mit Übergaben)
                    </button>
                    <button onClick={() => exportWechsellistePDF(filtered, 'Wechselliste', { filterLabel, mitUebergabe: false, querformat: false })}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                      📄 PDF (Hochformat, kompakt)
                    </button>
                    <button onClick={() => exportWechsellistePDF(filtered.filter(w => !w.kommtBetreuerinName), 'Offene Wechsel', { filterLabel: 'Noch ohne Nachfolge', nurOffene: true })}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                      📄 PDF — nur offene Wechsel
                    </button>
                    <button onClick={() => exportWechsellisteExcel(filtered)}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                      📊 Excel (.xlsx)
                    </button>
                    <button onClick={() => druckeWechselliste(filtered, `Wechselliste · ${filterLabel}`)}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                      🖨️ Drucken
                    </button>
                    {taxiFilter !== 'alle' && (
                      <>
                        <div className="border-t border-slate-100 my-1" />
                        <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Taxi-Auftrag: {taxiFilter}</div>
                        <button onClick={() => exportTaxiListePDF(filtered, taxiFilter)}
                          className="w-full text-left px-4 py-2.5 text-sm text-teal-700 hover:bg-teal-50 cursor-pointer flex items-center gap-2">
                          📄 Taxi-Auftragsliste PDF
                        </button>
                        <button onClick={() => exportWechsellisteTaxiExcel(filtered, taxiFilter)}
                          className="w-full text-left px-4 py-2.5 text-sm text-teal-700 hover:bg-teal-50 cursor-pointer flex items-center gap-2">
                          📊 Taxi-Auftrag Excel
                        </button>
                      </>
                    )}
                    {alleTaxis.length > 0 && (
                      <>
                        <div className="border-t border-slate-100 my-1" />
                        <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alle Taxi-Partner</div>
                        {alleTaxis.map(taxi => (
                          <button key={taxi} onClick={() => exportTaxiListePDF(wechselliste, taxi)}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                            🚕 {taxi} — Auftragsliste PDF
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              <button onClick={()=>router.push('/turnus')} className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-bold text-white cursor-pointer border-none hover:bg-teal-800 flex-shrink-0">→ Turnusverwaltung</button>
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-teal-50 border border-teal-200 px-5 py-4 text-sm text-teal-800">
            💡 <strong>Automatisch befüllt</strong> aus der Einsatzplanung. Änderungen direkt in der Turnusliste vornehmen — die Wechselliste aktualisiert sich sofort.
          </div>
          {partnerZugang && (
            <div className="mt-3 rounded-2xl bg-sky-50 border border-sky-200 px-5 py-3 text-sm text-sky-800">
              🚕 <strong>Partner-Ansicht:</strong> Sie sehen nur Wechsel mit {partnerZugang.name}
            </div>
          )}
          <div className="mt-5 flex gap-2 flex-wrap items-center">
            {([['alle',`Alle (${counts.alle})`],['vorbereitung',`In Vorbereitung (${counts.vorbereitung})`],['bestaetigt',`Bestätigt (${counts.bestaetigt})`],['durchgefuehrt',`Durchgeführt (${counts.durchgefuehrt})`]] as const).map(([val,label])=>(
              <button key={val} onClick={()=>setStatusFilter(val)} className={clsx('rounded-full px-4 py-2 text-sm font-medium border cursor-pointer transition-all',statusFilter===val?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>{label}</button>
            ))}
            {/* Datumsfilter */}
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs text-slate-400">📅 Von:</span>
              <input type="date" value={datumVon} onChange={e=>setDatumVon(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none cursor-pointer" />
              <span className="text-xs text-slate-400">Bis:</span>
              <input type="date" value={datumBis} onChange={e=>setDatumBis(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none cursor-pointer" />
              {(datumVon||datumBis) && (
                <button onClick={()=>{setDatumVon('');setDatumBis('')}}
                  className="rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs px-2 py-1.5 cursor-pointer hover:bg-rose-100">✕</button>
              )}
            </div>
            {alleTaxis.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-slate-400">🚕 Taxi:</span>
                <select value={taxiFilter} onChange={e => setTaxiFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none">
                  <option value="alle">Alle Taxis</option>
                  {alleTaxis.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="mt-5 grid grid-cols-4 gap-4">
          {([['Wechsel gesamt',counts.alle,'geplant/durchgeführt'],['In Vorbereitung',counts.vorbereitung,counts.vorbereitung>0?'⚠️ Nachfolgerin fehlt':'✓ Alle versorgt'],['Bestätigt',counts.bestaetigt,'Nachfolgerin zugewiesen'],['Durchgeführt',counts.durchgefuehrt,'abgeschlossen']] as const).map(([t,v,s])=>(
            <div key={t} className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
              <div className="text-sm text-slate-500 mb-2">{t}</div>
              <div className={clsx('text-5xl font-bold leading-none mb-1',t==='In Vorbereitung'&&Number(v)>0?'text-amber-600':'text-slate-900')}>{v}</div>
              <div className="text-sm text-slate-400">{s}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Wechsel <span className="font-normal text-slate-400">({filtered.length})</span></h2>
            <div className="flex items-center gap-2">
              <div className="text-sm text-slate-400 mr-2">Sortiert nach Dringlichkeit</div>
              <button onClick={() => exportWechsellistePDF(filtered, 'Wechselliste', { filterLabel })}
                className="rounded-xl border border-slate-200 text-slate-600 text-xs px-3 py-2 cursor-pointer hover:bg-slate-50 font-semibold">📄 PDF</button>
              <button onClick={() => exportWechsellisteExcel(filtered)}
                className="rounded-xl border border-slate-200 text-slate-600 text-xs px-3 py-2 cursor-pointer hover:bg-slate-50 font-semibold">📊 Excel</button>
              <button onClick={() => druckeWechselliste(filtered, 'Wechselliste')}
                className="rounded-xl border border-slate-200 text-slate-600 text-xs px-3 py-2 cursor-pointer hover:bg-slate-50 font-semibold">🖨️ Drucken</button>
              <button onClick={() => setShowSpaltenConfig(s => !s)}
                className={`rounded-xl border text-xs px-3 py-2 cursor-pointer font-semibold ${showSpaltenConfig ? 'bg-teal-50 border-teal-300 text-teal-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                ⚙️ Spalten
              </button>
            </div>
          </div>
          {showSpaltenConfig && (
            <div className="px-7 py-3 border-b border-slate-200 bg-teal-50 flex gap-4 flex-wrap">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest self-center">Spalten:</div>
              {([
                ['reistAb', 'Reist ab'],
                ['reistAn', 'Reist an'],
                ['typ', 'Typ'],
                ['taxi', 'Taxi/Partner'],
                ['status', 'Status'],
                ['adresse', '📍 Adresse'],
                ['telefon', '📞 Telefon'],
                ['ansprechpartner', '👤 Kontakt'],
              ] as [keyof typeof spalten, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600">
                  <input type="checkbox" checked={spalten[key]}
                    onChange={e => setSpalten(s => ({...s, [key]: e.target.checked}))}
                    className="accent-teal-600 w-3.5 h-3.5" />
                  {label}
                </label>
              ))}
            </div>
          )}

          <div className="grid bg-slate-50 px-7 py-3 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400" style={{gridTemplateColumns:`1fr${spalten.reistAb?' 160px':''}${spalten.reistAn?' 160px':''}${spalten.typ?' 120px':''}${spalten.taxi?' 120px':''}${(spalten.adresse||spalten.telefon||spalten.ansprechpartner)?' 160px':''}${spalten.status?' 120px':''}`}}>
            <div>Klient:in / Datum</div>
            {spalten.reistAb && <div>Reist ab</div>}
            {spalten.reistAn && <div>Reist an</div>}
            {spalten.typ && <div>Typ</div>}
            {spalten.taxi && <div>Taxi / Partner</div>}
            {(spalten.adresse||spalten.telefon||spalten.ansprechpartner) && <div>Adresse / Kontakt</div>}
            {spalten.status && <div>Status</div>}
          </div>

          {filtered.length===0&&(
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-4">🔄</div>
              <div className="text-lg font-semibold text-slate-600 mb-2">Keine Wechsel geplant</div>
              <div className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
                Wechsel werden automatisch aus der Turnusverwaltung generiert.
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 max-w-md mx-auto text-left space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">So erstellen Sie einen Wechsel:</div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-teal-600 font-bold flex-shrink-0">1.</span>
                  <span>Turnusverwaltung öffnen → Einsatz auswählen</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-teal-600 font-bold flex-shrink-0">2.</span>
                  <span>Im Einsatz-Dialog: Wechseldatum setzen</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-teal-600 font-bold flex-shrink-0">3.</span>
                  <span>Neue Betreuerin für den Wechsel zuweisen</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-teal-600 font-bold flex-shrink-0">4.</span>
                  <span>Wechsel erscheint hier automatisch mit Countdown</span>
                </div>
              </div>
            </div>
          )}

          {filtered.map((w,idx)=>{
            const days=daysUntil(w.wechselDatum)
            const dc=days<0?'text-slate-400':days<=2?'text-rose-600 font-bold':days<=7?'text-amber-600 font-bold':'text-slate-600'
            return(
              <div key={w.einsatzId+idx} className={clsx('grid items-center border-b border-slate-50 px-7 py-5 cursor-pointer transition-colors hover:bg-slate-50',w.status==='vorbereitung'&&!w.kommtBetreuerinName&&'bg-amber-50/40 hover:bg-amber-50')} style={{gridTemplateColumns:`1fr${spalten.reistAb?' 160px':''}${spalten.reistAn?' 160px':''}${spalten.typ?' 120px':''}${spalten.taxi?' 120px':''}${(spalten.adresse||spalten.telefon||spalten.ansprechpartner)?' 160px':''}${spalten.status?' 120px':''}`}} onClick={()=>setSelected(w)}>
                <div>
                  <div className="font-bold text-slate-900 text-lg flex items-center gap-2">
                    {w.klientName}
                    {w.warnung && <span className="text-xs text-rose-600 font-semibold">{w.warnung}</span>}
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">📍 {w.klientOrt}</div>
                  <div className={clsx('text-sm mt-1',dc)}>{new Date(w.wechselDatum).toLocaleDateString('de-AT')}{days>=0&&<span className="ml-2 text-xs">({days===0?'heute':'in '+days+' Tagen'})</span>}</div>
                </div>
                {spalten.reistAb && <div>
                  <div className={clsx('text-sm font-semibold',w.gehtBetreuerinName?'text-rose-700':'text-slate-400')}>{w.gehtBetreuerinName||'—'}</div>
                  {w.abreiseDatum&&<div className="text-xs text-slate-400 mt-0.5">ab {new Date(w.abreiseDatum).toLocaleDateString('de-AT')}</div>}
                </div>}
                {spalten.reistAn && <div>
                  {w.kommtBetreuerinName?<>
                    <div className="text-sm font-semibold text-emerald-700">{w.kommtBetreuerinName}</div>
                    {w.anreiseDatum&&<div className="text-xs text-slate-400 mt-0.5">an {new Date(w.anreiseDatum).toLocaleDateString('de-AT')}</div>}
                  </>:<div className="text-sm font-semibold text-amber-600">⚠️ Noch offen</div>}
                </div>}
                {spalten.typ && <div><Badge label={w.typ} className={clsx('text-xs',TYP_COLORS[w.typ]||'bg-slate-100 text-slate-600 border-slate-200')}/><div className="text-xs text-slate-400 mt-1">{w.turnusTage} Tage</div></div>}
                {spalten.taxi && <div className="text-sm text-slate-600">
                  {(w.taxiHin || w.taxiRueck) ? (
                    <div>
                      {w.taxiHin && <div className="text-xs text-teal-700">↓ {w.taxiHin}</div>}
                      {w.taxiRueck && <div className="text-xs text-slate-500">↑ {w.taxiRueck}</div>}
                    </div>
                  ) : <span className="text-slate-300">—</span>}
                </div>}
                {(spalten.adresse||spalten.telefon||spalten.ansprechpartner) && (
                  <div className="text-xs text-slate-500 space-y-0.5">
                    {spalten.adresse && w.klientStrasse && <div className="truncate">📍 {w.klientStrasse}, {w.klientPlz}</div>}
                    {spalten.telefon && w.klientTelefon && <div>📞 {w.klientTelefon}</div>}
                    {spalten.ansprechpartner && w.ansprechpartner && <div>👤 {w.ansprechpartner}</div>}
                  </div>
                )}
                {spalten.status && <div><Badge label={WECHSEL_STATUS_LABELS[w.status]} className={clsx('text-xs',WECHSEL_STATUS_COLORS[w.status])}/>{w.zustaendig&&<div className="text-xs text-slate-400 mt-1">{w.zustaendig}</div>}</div>}
              </div>
            )
          })}
        </div>

        {/* Übergabenotizen */}
        {filtered.some(w=>w.uebergabeNotiz)&&(
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-5">Übergabenotizen</h2>
            <div className="grid grid-cols-2 gap-4">
              {filtered.filter(w=>w.uebergabeNotiz).map((w,i)=>(
                <div key={i} className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold text-slate-900">{w.klientName}</div>
                    <div className="text-xs text-slate-500">{new Date(w.wechselDatum).toLocaleDateString('de-AT')}</div>
                  </div>
                  <div className="text-sm text-amber-900 whitespace-pre-wrap">{w.uebergabeNotiz}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
