'use client'
import { useState, Suspense, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useBetreuerinnen } from '@/hooks/useBetreuerinnen'
import { Btn, Badge, SectionCard } from '@/components/ui'
import BetreuerinForm from '@/components/BetreuerinForm'
import BetreuerinDetail from '@/components/BetreuerinDetail'
import Sidebar from '@/components/Sidebar'
import {
  STATUS_LABELS, STATUS_COLORS, ROLLE_LABELS, TURNUS_LABELS,
} from '@/lib/betreuerinnen'
import type { Betreuerin } from '@/lib/betreuerinnen'
import { exportBetreuerinnenPDF, exportBetreuerinnenExcel } from '@/lib/exportBetreuerinnen'
import clsx from 'clsx'

const BEWERTUNG_COLORS: Record<string, string> = {
  '5': 'text-emerald-600', '4': 'text-teal-600', '3': 'text-amber-600',
  '2': 'text-orange-600', '1': 'text-rose-600',
}

const RING_COLORS = [
  'border-teal-300 text-teal-700 bg-teal-50',
  'border-sky-300 text-sky-700 bg-sky-50',
  'border-violet-300 text-violet-700 bg-violet-50',
  'border-emerald-300 text-emerald-700 bg-emerald-50',
  'border-amber-300 text-amber-700 bg-amber-50',
  'border-rose-300 text-rose-700 bg-rose-50',
]

function stars(r: string) {
  const n = parseInt(r) || 0
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}
function age(dob: string) {
  if (!dob) return ''
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000*60*60*24*365.25)) + ' J.'
}

function BetreuerinnenPageInner() {
  const { user, loading } = useAuth()
  const { betreuerinnen, add, update, remove } = useBetreuerinnen()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('alle')
  const [rolleFilter, setRolleFilter] = useState('alle')
  const [showForm, setShowForm] = useState(false)
  const [editBG, setEditBG] = useState<Betreuerin | null>(null)
  const [detailBG, setDetailBG] = useState<Betreuerin | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState('')
  const [viewMode, setViewMode] = useState<'cards'|'table'>('cards')
  const today = new Date()

  useEffect(() => {
    if (searchParams.get('neu') === '1') { setShowForm(true); router.replace('/betreuerinnen') }
  }, [searchParams, router])

  const filtered = useMemo(() => {
    let list = betreuerinnen
    if (statusFilter !== 'alle') list = list.filter(b => b.status === statusFilter)
    if (rolleFilter !== 'alle') list = list.filter(b => b.rolle === rolleFilter)
    const q = search.toLowerCase().trim()
    if (q) list = list.filter(b =>
      [b.vorname,b.nachname,b.nationalitaet,b.region,b.telefon,b.email,b.zustaendig,b.notizen,b.hauptwohnsitzOrt,b.nebenwohnsitzOrt].join(' ').toLowerCase().includes(q)
    )
    return list
  }, [betreuerinnen, search, statusFilter, rolleFilter])

  const counts = useMemo(() => ({
    alle: betreuerinnen.length,
    im_einsatz: betreuerinnen.filter(b=>b.status==='im_einsatz').length,
    verfuegbar: betreuerinnen.filter(b=>b.status==='verfuegbar').length,
    aktiv: betreuerinnen.filter(b=>b.status==='aktiv').length,
    pause: betreuerinnen.filter(b=>b.status==='pause').length,
    inaktiv: betreuerinnen.filter(b=>b.status==='inaktiv').length,
  }), [betreuerinnen])

  const warningCount = betreuerinnen.reduce((acc,b) => acc + b.qualifikationen.filter(q => {
    if (!q.ablaufdatum) return false
    const d = new Date(q.ablaufdatum)
    return d < today || (d.getTime()-today.getTime()) < 90*24*60*60*1000
  }).length, 0)

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>
  if (!user) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">

        {detailBG && <BetreuerinDetail b={detailBG} canGF={user?.role==='gf'}
          onEdit={()=>{setEditBG(detailBG);setDetailBG(null)}} onClose={()=>setDetailBG(null)}
          onDelete={()=>{setDeleteConfirm(detailBG.id);setDetailBG(null)}} />}

        {(showForm||editBG) && <BetreuerinForm initial={editBG??undefined}
          onSave={data=>{ if(editBG) update(editBG.id,data); else add(data); setShowForm(false);setEditBG(null) }}
          onClose={()=>{setShowForm(false);setEditBG(null)}} />}

        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
            <div className="bg-white rounded-3xl p-8 shadow-2xl w-96">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Betreuerin löschen?</h2>
              <p className="text-slate-500 text-sm mb-6">Dieser Eintrag wird unwiderruflich gelöscht.</p>
              <div className="flex gap-3 justify-end">
                <Btn onClick={()=>setDeleteConfirm(null)}>Abbrechen</Btn>
                <Btn danger onClick={()=>{remove(deleteConfirm);setDeleteConfirm(null)}}>Löschen</Btn>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-2">VBetreut · ERP</div>
              <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-3">Betreuerinnen</h1>
              <p className="text-base text-slate-500 max-w-xl">Profile, Qualifikationen, Verfügbarkeiten und Einsatzhistorie aller Betreuungskräfte.</p>
            </div>
            <div className="flex gap-3 flex-shrink-0 pt-1">
              {user?.role !== 'mitarbeiter' && <>
                <Btn onClick={async()=>{setExportLoading('xlsx');await exportBetreuerinnenExcel(filtered);setExportLoading('')}} disabled={exportLoading==='xlsx'}>{exportLoading==='xlsx'?'...':'Excel'}</Btn>
                <Btn onClick={async()=>{setExportLoading('pdf');await exportBetreuerinnenPDF(filtered);setExportLoading('')}} disabled={exportLoading==='pdf'}>{exportLoading==='pdf'?'...':'PDF'}</Btn>
              </>}
              <Btn teal onClick={()=>setShowForm(true)}>+ Neue Betreuerin</Btn>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <div className="flex-1 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-slate-400 text-lg">🔎</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suche nach Name, Region, Nationalität, Qualifikation ..."
                className="flex-1 bg-transparent border-none text-sm text-slate-800 placeholder-slate-400 outline-none" />
              {search && <button onClick={()=>setSearch('')} className="text-slate-400 text-sm cursor-pointer bg-transparent border-none">✕</button>}
            </div>
            <div className="flex rounded-2xl border border-slate-200 overflow-hidden">
              {([['cards','⊞'],['table','☰']] as const).map(([m,icon])=>(
                <button key={m} onClick={()=>setViewMode(m)} className={clsx('px-4 py-3 text-base cursor-pointer border-none transition-all',viewMode===m?'bg-slate-900 text-white':'bg-white text-slate-500 hover:bg-slate-50')}>{icon}</button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex gap-2 flex-wrap items-center">
            {([['alle',`Alle (${counts.alle})`],['im_einsatz',`Im Einsatz (${counts.im_einsatz})`],['verfuegbar',`Verfügbar (${counts.verfuegbar})`],['aktiv',`Aktiv (${counts.aktiv})`],['pause',`Pause (${counts.pause})`],['inaktiv',`Inaktiv (${counts.inaktiv})`]] as const).map(([val,label])=>(
              <button key={val} onClick={()=>setStatusFilter(val)} className={clsx('rounded-full px-4 py-2 text-sm font-medium border cursor-pointer transition-all',statusFilter===val?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>{label}</button>
            ))}
            <div className="ml-auto flex gap-2">
              {([['alle','Alle'],['betreuerin','Betreuerinnen'],['springerin','Springerinnen'],['teamleitung','Teamleitung']] as const).map(([val,label])=>(
                <button key={val} onClick={()=>setRolleFilter(val)} className={clsx('rounded-full px-4 py-2 text-sm font-medium border cursor-pointer transition-all',rolleFilter===val?'bg-teal-700 text-white border-teal-700':'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="mt-5 grid grid-cols-4 gap-4">
          {([['Gesamt',counts.alle,'in der Kartei'],['Im Einsatz',counts.im_einsatz,'aktive Betreuungen'],['Verfügbar',counts.verfuegbar,'sofort einsetzbar'],['Qualifikationen',warningCount>0?`${warningCount} ⚠️`:'✓ Alle ok',warningCount>0?'ablaufend/abgelaufen':'Alle Zertifikate gültig']] as const).map(([t,v,s])=>(
            <div key={t} className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
              <div className="text-sm text-slate-500 mb-2">{t}</div>
              <div className={clsx('text-5xl font-bold leading-none mb-1',String(v).includes('⚠️')?'text-amber-600':'text-slate-900')}>{v}</div>
              <div className="text-sm text-slate-400">{s}</div>
            </div>
          ))}
        </div>

        {/* Card View */}
        {viewMode === 'cards' && (
          <SectionCard title="Betreuerinnen" sub={`${filtered.length} Einträge`}>
            {filtered.length === 0 && <div className="text-center py-16 text-slate-400"><div className="text-4xl mb-3">🔍</div><div className="text-lg font-medium">Keine Einträge gefunden</div></div>}
            <div className="grid grid-cols-3 gap-5">
              {filtered.map((b,idx)=>{
                const ring = RING_COLORS[idx%RING_COLORS.length]
                const ini = (b.vorname[0]||'')+(b.nachname[0]||'')
                const aktive = b.einsaetze.filter(e=>e.status==='aktiv')
                const hasWarn = b.qualifikationen.some(q=>{
                  if(!q.ablaufdatum) return false
                  const d=new Date(q.ablaufdatum)
                  return d<today||(d.getTime()-today.getTime())<90*24*60*60*1000
                })
                return (
                  <div key={b.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-6 cursor-pointer transition-all hover:border-teal-300 hover:bg-white hover:shadow-sm" onClick={()=>setDetailBG(b)}>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-start gap-4">
                        <div className={clsx('flex items-center justify-center rounded-full border font-bold text-lg flex-shrink-0',ring)} style={{width:52,height:52}}>{ini}</div>
                        <div>
                          <div className="text-xl font-bold text-slate-900 leading-tight">{b.nachname} {b.vorname}</div>
                          <div className="text-sm text-slate-500 mt-0.5">{b.nationalitaet}{b.geburtsdatum&&` · ${age(b.geburtsdatum)}`}</div>
                        </div>
                      </div>
                      {hasWarn && <span title="Qualifikation läuft ab" className="text-amber-500 text-lg flex-shrink-0">⚠️</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge label={STATUS_LABELS[b.status]} className={STATUS_COLORS[b.status]}/>
                      <Badge label={ROLLE_LABELS[b.rolle]} className="border-slate-200 bg-slate-100 text-slate-600"/>
                      <Badge label={TURNUS_LABELS[b.turnus]} className="border-slate-200 bg-white text-slate-500"/>
                    </div>
                    <div className="space-y-1.5 text-sm text-slate-600 mb-4">
                      {b.telefon&&<div className="flex items-center gap-1.5">📞 {b.telefon}{b.telefonWhatsapp&&<span className="text-xs bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 ml-1">WA</span>}</div>}
                      {b.region&&<div>📍 {b.region}</div>}
                      <div>🇩🇪 Deutsch: {b.deutschkenntnisse}</div>
                      {b.verfuegbarAb&&<div>📅 Verfügbar: {new Date(b.verfuegbarAb).toLocaleDateString('de-AT')}</div>}
                    </div>
                    <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-3">
                      <span className={clsx('font-medium',BEWERTUNG_COLORS[b.bewertung]||'text-slate-500')}>{stars(b.bewertung)}</span>
                      {aktive.length>0
                        ?<span className="text-xs bg-sky-50 border border-sky-200 text-sky-700 rounded-full px-2 py-1">{aktive.length} Einsatz{aktive.length>1?'e':''}</span>
                        :<span className="text-xs text-slate-400">Kein aktiver Einsatz</span>}
                    </div>
                    {user?.role!=='mitarbeiter'&&(
                      <div className="flex gap-2 mt-4" onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>setEditBG(b)} className="flex-1 rounded-xl bg-teal-700 py-2.5 text-xs font-bold text-white cursor-pointer border-none hover:bg-teal-800">Bearbeiten</button>
                        <button onClick={()=>setDeleteConfirm(b.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-rose-500 cursor-pointer hover:bg-rose-50">Löschen</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}

        {/* Table View */}
        {viewMode === 'table' && (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100"><h2 className="text-xl font-bold text-slate-900">{filtered.length} Einträge</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Name','Status','Rolle','Region','Telefon','Deutsch','Verfügbar ab','Bewertung','Einsätze',''].map(h=>(
                      <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b=>(
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={()=>setDetailBG(b)}>
                      <td className="px-5 py-4"><div className="font-semibold text-slate-900">{b.nachname} {b.vorname}</div><div className="text-xs text-slate-400">{b.nationalitaet}</div></td>
                      <td className="px-5 py-4"><Badge label={STATUS_LABELS[b.status]} className={STATUS_COLORS[b.status]}/></td>
                      <td className="px-5 py-4 text-slate-600">{ROLLE_LABELS[b.rolle]}</td>
                      <td className="px-5 py-4 text-slate-600">{b.region||'–'}</td>
                      <td className="px-5 py-4"><div>{b.telefon||'–'}</div>{b.telefonWhatsapp&&<div className="text-xs text-green-600">WhatsApp</div>}</td>
                      <td className="px-5 py-4 text-slate-600">{b.deutschkenntnisse}</td>
                      <td className="px-5 py-4 text-slate-600">{b.verfuegbarAb?new Date(b.verfuegbarAb).toLocaleDateString('de-AT'):'–'}</td>
                      <td className="px-5 py-4"><span className={clsx('font-medium',BEWERTUNG_COLORS[b.bewertung]||'')}>{stars(b.bewertung)}</span></td>
                      <td className="px-5 py-4 text-slate-600">{b.einsaetze.filter(e=>e.status==='aktiv').length} aktiv</td>
                      <td className="px-5 py-4" onClick={e=>e.stopPropagation()}>
                        {user?.role!=='mitarbeiter'&&(
                          <div className="flex gap-2">
                            <button onClick={()=>setEditBG(b)} className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer border-none hover:bg-teal-800">Edit</button>
                            <button onClick={()=>setDeleteConfirm(b.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-rose-500 cursor-pointer hover:bg-rose-50">✕</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length===0&&<div className="text-center py-16 text-slate-400"><div className="text-4xl mb-3">🔍</div><div className="font-medium">Keine Einträge gefunden</div></div>}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function BetreuerinnenPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>}><BetreuerinnenPageInner /></Suspense>
}
