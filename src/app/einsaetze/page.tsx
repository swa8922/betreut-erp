'use client'
import { useState, Suspense, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useEinsaetze } from '@/hooks/useEinsaetze'
import { Btn, Badge, SectionCard } from '@/components/ui'
import EinsatzForm from '@/components/EinsatzForm'
import EinsatzDetail from '@/components/EinsatzDetail'
import Sidebar from '@/components/Sidebar'
import {
  STATUS_LABELS, STATUS_COLORS, WECHSEL_LABELS, WECHSEL_COLORS,
  ABRECHNUNG_LABELS, ABRECHNUNG_COLORS, daysRemaining, isEndigSoon,
  type Einsatz, type EinsatzStatus,
} from '@/lib/einsaetze'
import clsx from 'clsx'

function EinsaetzePageInner() {
  const { user, loading } = useAuth()
  const { einsaetze, add, update, remove } = useEinsaetze()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('alle')
  const [viewMode, setViewMode] = useState<'turnusliste'|'cards'|'zeitlinie'>('turnusliste')
  const [showForm, setShowForm] = useState(false)
  const [editE, setEditE] = useState<Einsatz|null>(null)
  const [detailE, setDetailE] = useState<Einsatz|null>(null)
  const [delConfirm, setDelConfirm] = useState<string|null>(null)

  useEffect(()=>{
    if(searchParams.get('neu')==='1'){setShowForm(true);router.replace('/einsaetze')}
  },[searchParams,router])

  const filtered = useMemo(()=>{
    const ORDER:Record<EinsatzStatus,number>={wechsel_offen:0,aktiv:1,geplant:2,beendet:3,abgebrochen:4}
    let list = einsaetze
    if(statusFilter!=='alle') list=list.filter(e=>e.status===statusFilter)
    const q=search.toLowerCase().trim()
    if(q) list=list.filter(e=>[e.klientName,e.klientOrt,e.betreuerinName,e.zustaendig,e.notizen,e.uebergabeNotiz,e.nachfolgerBetreuerinName].join(' ').toLowerCase().includes(q))
    return [...list].sort((a,b)=>ORDER[a.status]!==ORDER[b.status]?ORDER[a.status]-ORDER[b.status]:new Date(a.bis).getTime()-new Date(b.bis).getTime())
  },[einsaetze,search,statusFilter])

  const counts=useMemo(()=>({
    alle:einsaetze.length,
    aktiv:einsaetze.filter(e=>e.status==='aktiv').length,
    geplant:einsaetze.filter(e=>e.status==='geplant').length,
    wechsel_offen:einsaetze.filter(e=>e.status==='wechsel_offen').length,
    beendet:einsaetze.filter(e=>e.status==='beendet').length,
    abgebrochen:einsaetze.filter(e=>e.status==='abgebrochen').length,
  }),[einsaetze])

  const fin=useMemo(()=>{
    const offen=einsaetze.filter(e=>e.abrechnungsStatus==='offen'&&e.status!=='geplant')
    return {
      laufend:einsaetze.filter(e=>e.status==='aktiv'||e.status==='wechsel_offen').reduce((s,e)=>s+e.gesamtbetrag,0),
      offenBetrag:offen.reduce((s,e)=>s+e.gesamtbetrag,0),
      offenAnzahl:offen.length,
    }
  },[einsaetze])

  if(loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>
  if(!user) return null

  const fmt=(n:number)=>n.toLocaleString('de-AT',{style:'currency',currency:'EUR'})

  return (
    <div className="flex min-h-screen">
      <Sidebar/>
      <main className="flex-1 overflow-auto p-8">

        {detailE && <EinsatzDetail einsatz={detailE} canEdit={user?.role!=='mitarbeiter'}
          onEdit={()=>{setEditE(detailE);setDetailE(null)}} onClose={()=>setDetailE(null)}
          onDelete={id=>{setDelConfirm(id);setDetailE(null)}}
          onStatusChange={(id,_)=>{update(id,{abrechnungsStatus:'erstellt'});setDetailE(null)}}/>}

        {(showForm||editE) && <EinsatzForm initial={editE??undefined}
          onSave={data=>{if(editE)update(editE.id,data);else add(data);setShowForm(false);setEditE(null)}}
          onClose={()=>{setShowForm(false);setEditE(null)}}/>}

        {delConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
            <div className="bg-white rounded-3xl p-8 shadow-2xl w-96">
              <h2 className="text-xl font-bold mb-2">Einsatz löschen?</h2>
              <p className="text-slate-500 text-sm mb-6">Dieser Eintrag wird unwiderruflich gelöscht.</p>
              <div className="flex gap-3 justify-end">
                <Btn onClick={()=>setDelConfirm(null)}>Abbrechen</Btn>
                <Btn danger onClick={()=>{remove(delConfirm);setDelConfirm(null)}}>Löschen</Btn>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-2">VBetreut · ERP</div>
              <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-2">Einsatzplanung</h1>
              <p className="text-base text-slate-500 max-w-2xl">Turnusliste — verbindet Klient:innen, Betreuerinnen, Wechselliste und Abrechnung.</p>
            </div>
            <Btn teal onClick={()=>setShowForm(true)}>+ Neuer Einsatz</Btn>
          </div>
          <div className="mt-6 flex gap-3">
            <div className="flex-1 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-slate-400 text-lg">🔎</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suche nach Klient:in, Betreuerin, Ort ..."
                className="flex-1 bg-transparent border-none text-sm text-slate-800 placeholder-slate-400 outline-none"/>
              {search&&<button onClick={()=>setSearch('')} className="text-slate-400 text-sm cursor-pointer bg-transparent border-none">✕</button>}
            </div>
            <div className="flex rounded-2xl border border-slate-200 overflow-hidden">
              {([['turnusliste','≡ Turnusliste'],['cards','⊞ Karten'],['zeitlinie','📅 Zeitlinie']] as const).map(([m,l])=>(
                <button key={m} onClick={()=>setViewMode(m)} className={clsx('px-4 py-3 text-sm font-medium cursor-pointer border-none transition-all whitespace-nowrap',viewMode===m?'bg-slate-900 text-white':'bg-white text-slate-500 hover:bg-slate-50')}>{l}</button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            {([['alle',`Alle (${counts.alle})`],['aktiv',`Aktiv (${counts.aktiv})`],['wechsel_offen',`⚠️ Wechsel offen (${counts.wechsel_offen})`],['geplant',`Geplant (${counts.geplant})`],['beendet',`Beendet (${counts.beendet})`]] as const).map(([val,label])=>(
              <button key={val} onClick={()=>setStatusFilter(val)} className={clsx('rounded-full px-4 py-2 text-sm font-medium border cursor-pointer transition-all',statusFilter===val?(val==='wechsel_offen'?'bg-amber-600 text-white border-amber-600':'bg-slate-900 text-white border-slate-900'):'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>{label}</button>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="mt-5 grid grid-cols-4 gap-4">
          {([
            ['Laufende Einsätze',counts.aktiv+counts.wechsel_offen,'aktiv + Wechsel offen'],
            ['Geplante Einsätze',counts.geplant,'noch nicht gestartet'],
            ['Offene Rechnungen',`${fin.offenAnzahl}×`,fmt(fin.offenBetrag)+' offen'],
            ['Laufender Umsatz',fmt(fin.laufend),'aus aktiven Einsätzen'],
          ] as const).map(([t,v,s])=>(
            <div key={t} className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
              <div className="text-sm text-slate-500 mb-2">{t}</div>
              <div className="text-4xl font-bold text-slate-900 leading-none mb-1">{v}</div>
              <div className="text-sm text-slate-400">{s}</div>
            </div>
          ))}
        </div>

        {/* Wechsel-Alert */}
        {counts.wechsel_offen>0&&(
          <div className="mt-5 rounded-3xl border border-amber-300 bg-amber-50 p-6">
            <h3 className="text-lg font-bold text-amber-800 mb-3">⚠️ {counts.wechsel_offen} Wechsel ohne Nachfolgerin</h3>
            <div className="space-y-2">
              {einsaetze.filter(e=>e.status==='wechsel_offen').map(e=>(
                <div key={e.id} className="flex items-center justify-between rounded-2xl bg-white border border-amber-200 px-5 py-3">
                  <div>
                    <span className="font-semibold text-slate-900">{e.klientName}</span>
                    <span className="text-slate-500 text-sm ml-2">· {e.betreuerinName||'keine BG'} · endet {new Date(e.bis).toLocaleDateString('de-AT')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600 font-bold text-sm">{daysRemaining(e.bis)} Tage</span>
                    {user?.role!=='mitarbeiter'&&(
                      <button onClick={()=>setEditE(e)} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-amber-700">Nachfolgerin zuweisen</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-700 mt-3">Sobald eine Nachfolgerin zugewiesen ist, wird die Wechselliste automatisch aktualisiert.</p>
          </div>
        )}

        {/* TURNUSLISTE */}
        {viewMode==='turnusliste'&&(
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Turnusliste <span className="text-base font-normal text-slate-400">({filtered.length})</span></h2>
              <div className="text-sm text-slate-400">Sortiert nach Dringlichkeit</div>
            </div>
            <div className="grid border-b border-slate-100 bg-slate-50 px-7 py-3 text-xs font-bold uppercase tracking-wider text-slate-400" style={{gridTemplateColumns:'1fr 1fr 160px 110px 100px 120px 120px'}}>
              <div>Klient:in</div><div>Betreuerin</div><div>Zeitraum</div><div>Verbleibend</div><div>Typ</div><div>Abrechnung</div><div>Status</div>
            </div>
            {filtered.length===0&&<div className="text-center py-16 text-slate-400"><div className="text-4xl mb-3">📋</div><div className="font-medium">Keine Einträge</div></div>}
            {filtered.map(e=>{
              const rem=daysRemaining(e.bis)
              const rc=rem<0?'text-slate-400':rem<=3?'text-rose-600 font-bold':rem<=7?'text-amber-600 font-bold':'text-emerald-600'
              return(
                <div key={e.id} className={clsx('grid items-center border-b border-slate-50 px-7 py-4 cursor-pointer transition-colors hover:bg-slate-50',isEndigSoon(e.bis,7)&&e.status!=='beendet'&&'bg-amber-50/50 hover:bg-amber-50')} style={{gridTemplateColumns:'1fr 1fr 160px 110px 100px 120px 120px'}} onClick={()=>setDetailE(e)}>
                  <div><div className="font-bold text-slate-900 text-base">{e.klientName}</div><div className="text-xs text-slate-500">📍 {e.klientOrt}</div></div>
                  <div>
                    {e.betreuerinName?<div className="font-medium text-slate-800">{e.betreuerinName}</div>:<div className="text-amber-600 text-sm font-semibold">⚠️ Nicht zugewiesen</div>}
                    {e.nachfolgerBetreuerinName&&<div className="text-xs text-teal-600 mt-0.5">↓ {e.nachfolgerBetreuerinName}</div>}
                  </div>
                  <div className="text-sm text-slate-600"><div>{new Date(e.von).toLocaleDateString('de-AT')}</div><div>– {new Date(e.bis).toLocaleDateString('de-AT')}</div><div className="text-xs text-slate-400">{e.turnusTage} Tage</div></div>
                  <div className={clsx('text-base',rc)}>{rem<0?<span className="text-slate-400 text-sm">abgesch.</span>:rem===0?'Heute!':rem+' Tage'}</div>
                  <div><Badge label={WECHSEL_LABELS[e.wechselTyp]} className={clsx('text-xs',WECHSEL_COLORS[e.wechselTyp])}/></div>
                  <div><Badge label={ABRECHNUNG_LABELS[e.abrechnungsStatus]} className={clsx('text-xs',ABRECHNUNG_COLORS[e.abrechnungsStatus])}/><div className="text-xs text-slate-400 mt-1">{fmt(e.gesamtbetrag)}</div></div>
                  <div onClick={ev=>ev.stopPropagation()}>
                    <Badge label={STATUS_LABELS[e.status]} className={clsx('text-xs',STATUS_COLORS[e.status])}/>
                    {user?.role!=='mitarbeiter'&&(
                      <div className="flex gap-1 mt-2">
                        <button onClick={()=>setEditE(e)} className="rounded-lg bg-teal-700 px-2 py-1 text-xs font-semibold text-white cursor-pointer border-none hover:bg-teal-800">Edit</button>
                        <button onClick={()=>setDelConfirm(e.id)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-rose-500 cursor-pointer hover:bg-rose-50">✕</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CARDS */}
        {viewMode==='cards'&&(
          <SectionCard title="Einsätze" sub={`${filtered.length} Einträge`}>
            {filtered.length===0&&<div className="text-center py-16 text-slate-400"><div className="text-4xl mb-3">📋</div><div className="font-medium">Keine Einträge</div></div>}
            <div className="grid grid-cols-3 gap-5">
              {filtered.map(e=>{
                const rem=daysRemaining(e.bis)
                return(
                  <div key={e.id} className={clsx('rounded-3xl border p-6 cursor-pointer transition-all hover:shadow-sm',e.status==='wechsel_offen'?'border-amber-300 bg-amber-50/50 hover:bg-amber-50':e.status==='aktiv'?'border-emerald-200 bg-slate-50 hover:border-teal-300 hover:bg-white':'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white')} onClick={()=>setDetailE(e)}>
                    <div className="flex items-start justify-between mb-3">
                      <Badge label={STATUS_LABELS[e.status]} className={STATUS_COLORS[e.status]}/>
                      <Badge label={WECHSEL_LABELS[e.wechselTyp]} className={clsx('text-xs',WECHSEL_COLORS[e.wechselTyp])}/>
                    </div>
                    <div className="mb-4">
                      <div className="text-xl font-bold text-slate-900">{e.klientName}</div>
                      <div className="text-sm text-slate-500 mt-0.5">📍 {e.klientOrt}</div>
                      <div className={clsx('text-sm mt-1.5',e.betreuerinName?'text-slate-700':'text-amber-600 font-semibold')}>{e.betreuerinName?'👤 '+e.betreuerinName:'⚠️ Betreuerin fehlt'}</div>
                      {e.nachfolgerBetreuerinName&&<div className="text-xs text-teal-600 mt-0.5">↓ Nachfolge: {e.nachfolgerBetreuerinName}</div>}
                    </div>
                    <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 mb-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">{new Date(e.von).toLocaleDateString('de-AT')} – {new Date(e.bis).toLocaleDateString('de-AT')}</span>
                        <span className="font-medium text-slate-600">{e.turnusTage}d</span>
                      </div>
                      {rem>=0&&e.status!=='beendet'&&(
                        <div className={clsx('text-sm mt-1 font-semibold',rem<=3?'text-rose-600':rem<=7?'text-amber-600':'text-emerald-600')}>{rem===0?'🔴 Endet heute!':rem+' Tage verbleibend'}</div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-slate-900">{fmt(e.gesamtbetrag)}</span>
                      <Badge label={ABRECHNUNG_LABELS[e.abrechnungsStatus]} className={clsx('text-xs',ABRECHNUNG_COLORS[e.abrechnungsStatus])}/>
                    </div>
                    {user?.role!=='mitarbeiter'&&(
                      <div className="flex gap-2 mt-4" onClick={ev=>ev.stopPropagation()}>
                        <button onClick={()=>setEditE(e)} className="flex-1 rounded-xl bg-teal-700 py-2.5 text-xs font-bold text-white cursor-pointer border-none hover:bg-teal-800">Bearbeiten</button>
                        <button onClick={()=>setDelConfirm(e.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-rose-500 cursor-pointer hover:bg-rose-50">✕</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}

        {/* ZEITLINIE */}
        {viewMode==='zeitlinie'&&(
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="px-7 py-5 border-b border-slate-100"><h2 className="text-xl font-bold text-slate-900">Zeitlinie</h2><p className="text-sm text-slate-500 mt-1">Alle Einsätze chronologisch mit Fortschrittsbalken</p></div>
            <div className="p-7 space-y-3">
              {filtered.map(e=>{
                const rem=daysRemaining(e.bis)
                const prog=e.von&&e.bis?Math.min(100,Math.max(0,(Date.now()-new Date(e.von).getTime())/(new Date(e.bis).getTime()-new Date(e.von).getTime())*100)):0
                return(
                  <div key={e.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 cursor-pointer hover:border-teal-300 hover:bg-white transition-all" onClick={()=>setDetailE(e)}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-slate-900">{e.klientName}</span>
                          {e.betreuerinName&&<span className="text-sm text-slate-500">· {e.betreuerinName}</span>}
                          <span className="text-xs text-slate-400">{e.klientOrt}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge label={STATUS_LABELS[e.status]} className={clsx('text-xs',STATUS_COLORS[e.status])}/>
                        <span className="text-sm font-bold text-slate-900">{fmt(e.gesamtbetrag)}</span>
                      </div>
                    </div>
                    {e.status!=='geplant'&&e.status!=='beendet'&&(
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span>{new Date(e.von).toLocaleDateString('de-AT')}</span>
                          <span className={clsx(rem<=3?'text-rose-600 font-bold':rem<=7?'text-amber-600 font-bold':'text-slate-500')}>{rem<0?'abgeschlossen':rem===0?'Endet heute!':rem+' Tage bis '+new Date(e.bis).toLocaleDateString('de-AT')}</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className={clsx('h-2 rounded-full transition-all',e.status==='wechsel_offen'?'bg-amber-500':'bg-teal-500')} style={{width:prog+'%'}}/>
                        </div>
                      </div>
                    )}
                    {e.status==='geplant'&&<div className="text-sm text-sky-600">📅 Startet {new Date(e.von).toLocaleDateString('de-AT')} · {e.turnusTage} Tage</div>}
                    {e.status==='beendet'&&<div className="text-sm text-slate-400">✓ {new Date(e.von).toLocaleDateString('de-AT')} – {new Date(e.bis).toLocaleDateString('de-AT')}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function EinsaetzePage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>}><EinsaetzePageInner /></Suspense>
}
