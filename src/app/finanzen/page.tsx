'use client'
import React, { useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import EmailModal from '@/components/EmailModal'
import { useFinanzen } from '@/hooks/useFinanzen'
import { useEinsaetze } from '@/hooks/useEinsaetze'
import Sidebar from '@/components/Sidebar'
import { Badge, Btn } from '@/components/ui'
import DokumentEditor from '@/components/DokumentEditor'
import DokumentDetailPanel from '@/components/DokumentDetailPanel'
import GutschriftDialog from '@/components/GutschriftDialog'
import ArtikelVerwaltung from '@/components/ArtikelVerwaltung'
import {
  type Dokument, type DokumentTyp, type DokumentStatus,
  TYP_LABELS, TYP_COLORS, STATUS_LABELS, STATUS_COLORS,
} from '@/lib/finanzen'
import { exportDokumentPDF, exportDokumenteExcel, exportKundenlisteRechnungenPDF, exportKundenlisteRechnungenExcel } from '@/lib/exportFinanzen'
import { getFirmendaten } from '@/lib/admin'
import clsx from 'clsx'

const TABS = ['Cockpit','Rechnungen','Angebote','BG-Abrechnungen','Auszahlungen','Bankabgleich','Taxi','Artikel'] as const
type Tab = typeof TABS[number]

const fmt = (n: number) => n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('de-AT') : '–'

export default function FinanzenPage() {
  const { user, loading } = useAuth()
  const fin = useFinanzen()
  const { einsaetze, loading: einsaetzeLoading } = useEinsaetze()

  const [tab, setTab] = useState<Tab>('Cockpit')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('alle')

  // Zeitraum State auf Komponentenebene (nicht in Cockpit-Funktion!)
  const [zeitraum, setZeitraum] = useState<'monat'|'quartal'|'jahr'|'benutzerdefiniert'>('monat')
  const [datumVon, setDatumVon] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })
  const [datumBis, setDatumBis] = useState(() => new Date().toISOString().split('T')[0])
  const [showKundenAnsicht, setShowKundenAnsicht] = useState(false)
  const [kundeFilter, setKundeFilter] = useState('')

  const [showEditor, setShowEditor] = useState(false)
  const [editorTyp, setEditorTyp] = useState<DokumentTyp>('rechnung')
  const [editDok, setEditDok] = useState<Dokument|null>(null)
  const [detailDok, setDetailDok] = useState<Dokument|null>(null)
  const [gutschriftFor, setGutschriftFor] = useState<Dokument|null>(null)
  const [stornoConfirm, setStornoConfirm] = useState<string|null>(null)
  const [exportLoading, setExportLoading] = useState('')

  const openEditor = (typ: DokumentTyp, dok?: Dokument) => { setEditorTyp(typ); setEditDok(dok||null); setShowEditor(true) }
  const closeEditor = () => { setShowEditor(false); setEditDok(null) }
  const handleEditorSave = useCallback((dok: Dokument) => {
    if (editDok) fin.updateDokument(dok.id, dok, user!.name, 'Bearbeitet')
    else fin.createDokument(dok)
    closeEditor()
  }, [editDok, fin, user])

  const filteredDoks = useMemo(() => {
    let list = fin.dokumente
    if (tab==='Rechnungen') list = list.filter(d=>['rechnung','storno','gutschrift'].includes(d.typ))
    else if (tab==='Angebote') list = list.filter(d=>d.typ==='angebot')
    else if (tab==='BG-Abrechnungen') list = list.filter(d=>d.typ==='bg_abrechnung')
    else if (tab==='Taxi') list = list.filter(d=>d.typ==='taxi_rechnung')
    if (statusFilter!=='alle') list = list.filter(d=>d.status===statusFilter)
    const q = search.toLowerCase().trim()
    if (q) list = list.filter(d=>[d.dokumentNr,d.klientName,d.betreuerinName,d.notizen,d.bezugDokumentNr].join(' ').toLowerCase().includes(q))
    return [...list].sort((a,b)=>(b.erstelltAm||'').localeCompare(a.erstelltAm||''))
  }, [fin.dokumente, tab, statusFilter, search])

  const cockpit = useMemo(() => {
    const jetzt = new Date()
    const q = Math.floor(jetzt.getMonth()/3)+1
    const zeitraumFilter = (d: { rechnungsDatum?: string }) => {
      const dat = d.rechnungsDatum; if (!dat) return false
      if (zeitraum==='monat') { const m=`${jetzt.getFullYear()}-${String(jetzt.getMonth()+1).padStart(2,'0')}`; return dat.startsWith(m) }
      if (zeitraum==='quartal') { const s=new Date(jetzt.getFullYear(),(q-1)*3,1).toISOString().split('T')[0]; const e=new Date(jetzt.getFullYear(),q*3,0).toISOString().split('T')[0]; return dat>=s&&dat<=e }
      if (zeitraum==='benutzerdefiniert') return dat>=datumVon&&dat<=datumBis
      return dat.startsWith(String(jetzt.getFullYear()))
    }
    const re = fin.dokumente.filter(d=>d.typ==='rechnung')
    const reZ = re.filter(zeitraumFilter)
    const offen = re.filter(d=>['erstellt','versendet','mahnung','teilbezahlt'].includes(d.status))
    const bezahlt = reZ.filter(d=>d.status==='bezahlt')
    const ueberfaellig = offen.filter(d=>d.zahlungsziel&&new Date(d.zahlungsziel)<new Date())
    const mwst20 = reZ.reduce((s,d)=>s+(d.summeSteuern?.['20']||0),0)
    const mwst10 = reZ.reduce((s,d)=>s+(d.summeSteuern?.['10']||0),0)
    const monat: Record<string,number> = {}
    for (let i=5;i>=0;i--) { const d=new Date(); d.setMonth(d.getMonth()-i); monat[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`]=0 }
    re.forEach(r=>{ const k=r.rechnungsDatum?.substring(0,7); if(k&&k in monat) monat[k]+=r.summeBrutto })
    const zeitraumLabel = zeitraum==='monat' ? jetzt.toLocaleDateString('de-AT',{month:'long',year:'numeric'})
      : zeitraum==='quartal' ? `Q${q} ${jetzt.getFullYear()}`
      : zeitraum==='benutzerdefiniert' ? `${fmtDate(datumVon)} – ${fmtDate(datumBis)}`
      : `${jetzt.getFullYear()}`
    return {
      umsatzBezahlt: bezahlt.reduce((s,d)=>s+(Number(d.summeBrutto)||0),0),
      umsatzGesamt: reZ.reduce((s,d)=>s+(Number(d.summeBrutto)||0),0),
      umsatzOffen: offen.reduce((s,d)=>s+(Number(d.offenerBetrag)||0),0),
      ueberfaellig: ueberfaellig.length,
      mahnungen: re.filter(d=>d.status==='mahnung').length,
      stornos: fin.dokumente.filter(d=>d.typ==='storno').length,
      gutschriften: fin.dokumente.filter(d=>d.typ==='gutschrift').length,
      mwst20, mwst10, monat, zeitraumLabel,
      klaerfaelle: (fin.zahlungen||[]).filter(z=>z.status==='klaerung').length,
      anzahlRechnungen: reZ.length,
    }
  }, [fin.dokumente, fin.zahlungen, zeitraum, datumVon, datumBis])

  const heute = new Date().toISOString().split('T')[0]
  const einsaetzeOhneRechnung = useMemo(()=> {
    return einsaetze.filter(e=> {
      if (!e.von) return false
      // Nur Einsätze die bereits begonnen haben (von <= heute)
      if (e.von > heute) return false
      // Bereits abgerechnet (mehrere Checks)
      if ((e as any).kunden_abgerechnet === true) return false
      if (e.abrechnungsStatus === 'abgerechnet') return false
      if (e.rechnungsId) return false
      // Keine bestehende Rechnung für diesen Einsatz
      if (fin.dokumente.find(d => d.einsatzId === e.id && d.typ === 'rechnung')) return false
      // Klient muss vorhanden sein
      if (!e.klientName) return false
      return true
    })
  } ,[einsaetze, fin.dokumente, heute])

  const faelligAuszahlung = useMemo(()=>{
    const in7=new Date(Date.now()+7*86400000).toISOString().split('T')[0]
    return (einsaetze||[]).filter((e:any)=>e.status==='aktiv'&&e.bis&&e.bis<=in7&&!(fin.auszahlungen||[]).find((a:any)=>a.einsatzId===e.id))
  },[einsaetze,fin.auszahlungen])

  if (loading || einsaetzeLoading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>
  if (!user) return null

  const canEdit = user?.role !== 'mitarbeiter'
  const canGF = user?.role === 'gf'
  const firma = getFirmendaten()
  const ccEmail = firma.emailRechnungenKontrolle || ''

  function Cockpit() {
    const jetzt = new Date()
    const q = Math.floor(jetzt.getMonth()/3)+1
    const maxU = Math.max(...Object.values(cockpit.monat),1)
    const angebote = fin.dokumente.filter(d=>d.typ==='angebot')
    const angenommen = angebote.filter(d=>d.status==='angenommen')

    return <div className="space-y-5">
      {/* Zeitraum */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500 font-medium mr-1">Zeitraum:</span>
          {(['monat','quartal','jahr','benutzerdefiniert'] as const).map(z=>(
            <button key={z} onClick={()=>setZeitraum(z)}
              className={clsx('rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer border transition-all',
                zeitraum===z?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
              {z==='monat'?'Diesen Monat':z==='quartal'?`Q${q} ${jetzt.getFullYear()}`:z==='jahr'?'Dieses Jahr':'Benutzerdefiniert'}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button onClick={()=>setShowKundenAnsicht(v=>!v)}
              className={clsx('rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer border transition-all',
                showKundenAnsicht?'bg-teal-700 text-white border-teal-700':'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100')}>
              👤 Pro Kunde
            </button>
            <button onClick={()=>exportDokumenteExcel(fin.dokumente.filter(d=>d.typ==='rechnung'))}
              className="rounded-xl border border-slate-200 bg-white text-slate-600 text-xs px-4 py-2 cursor-pointer hover:bg-slate-50 font-semibold">
              📥 Excel
            </button>
          </div>
        </div>
        {zeitraum==='benutzerdefiniert'&&(
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
            <span className="text-sm text-slate-500">Von:</span>
            <input type="date" value={datumVon} onChange={e=>setDatumVon(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400"/>
            <span className="text-sm text-slate-500">Bis:</span>
            <input type="date" value={datumBis} onChange={e=>setDatumBis(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400"/>
            <span className="text-xs text-slate-400 ml-2">→ {cockpit.anzahlRechnungen} Rechnungen</span>
          </div>
        )}
      </div>

      {/* KPIs — Einnahmen + Ausgaben + USt */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          ['📈 Einnahmen (Rechnungen)', fmt(cockpit.umsatzGesamt), `${cockpit.anzahlRechnungen} Rechnungen · ${cockpit.zeitraumLabel}`,'text-teal-700','border-teal-200 bg-teal-50'],
          ['✅ Davon bezahlt', fmt(cockpit.umsatzBezahlt), 'Eingegangen auf Konto','text-emerald-600','border-emerald-200 bg-emerald-50'],
          ['⏳ Offene Forderungen', fmt(cockpit.umsatzOffen), cockpit.ueberfaellig>0?`⚠️ ${cockpit.ueberfaellig} überfällig`:'Alle aktuell', cockpit.ueberfaellig>0?'text-amber-600':'text-slate-900','border-amber-200 bg-amber-50'],
          ['📊 USt-Pflicht (20%)', fmt(cockpit.mwst20), 'Aus Rechnungen im Zeitraum','text-slate-700','border-slate-200 bg-white'],
        ] as const).map(([t,v,s,tc,bc])=>(
          <div key={t} className={clsx('rounded-3xl border px-5 py-5 shadow-sm',bc)}>
            <div className="text-sm text-slate-500 mb-2">{t}</div>
            <div className={clsx('text-2xl font-bold leading-none mb-1',tc)}>{v}</div>
            <div className="text-xs text-slate-400">{s}</div>
          </div>
        ))}
      </div>

      {/* Auszahlungen (Honorarnoten) separat */}
      <HonorarCockpit />

      {/* Aktions-Kacheln */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Rechnungsvorschläge Banner — immer sichtbar im Cockpit */}
        {einsaetzeOhneRechnung.length>0&&(tab==='Cockpit'||tab==='Rechnungen')&&canEdit&&(
          <div className="rounded-3xl border-2 border-teal-400 bg-teal-50 p-5 flex items-center justify-between">
            <div>
              <div className="font-bold text-teal-800 text-lg">💡 {einsaetzeOhneRechnung.length} Einsatz{einsaetzeOhneRechnung.length>1?'e':''} warten auf Abrechnung</div>
              <div className="text-sm text-teal-600 mt-0.5">Anreise erfolgt — Rechnung noch nicht erstellt</div>
            </div>
            <button onClick={()=>setTab('Rechnungen')}
              className="rounded-2xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white cursor-pointer border-none hover:bg-teal-800">
              → Zum Rechnungsmodul
            </button>
          </div>
        )}

        {einsaetzeOhneRechnung.length>0&&(
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 cursor-pointer hover:bg-teal-100" onClick={()=>setTab('Rechnungen')}>
            <div className="text-2xl font-bold text-teal-700">{einsaetzeOhneRechnung.length}</div>
            <div className="text-xs font-semibold text-teal-700 mt-1">Zu verrechnen</div>
            <div className="text-[10px] text-teal-500 mt-0.5">→ Rechnungen</div>
          </div>
        )}
        {faelligAuszahlung.length>0&&(
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 cursor-pointer hover:bg-violet-100" onClick={()=>setTab('Auszahlungen')}>
            <div className="text-2xl font-bold text-violet-700">{faelligAuszahlung.length}</div>
            <div className="text-xs font-semibold text-violet-700 mt-1">Auszahlungen</div>
            <div className="text-[10px] text-violet-500 mt-0.5">7T vor Abreise</div>
          </div>
        )}
        {cockpit.klaerfaelle>0&&(
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 cursor-pointer hover:bg-amber-100" onClick={()=>setTab('Bankabgleich')}>
            <div className="text-2xl font-bold text-amber-700">{cockpit.klaerfaelle}</div>
            <div className="text-xs font-semibold text-amber-700 mt-1">Klärfälle</div>
            <div className="text-[10px] text-amber-500 mt-0.5">→ Bankabgleich</div>
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 cursor-pointer hover:bg-slate-50" onClick={()=>setTab('Angebote')}>
          <div className="text-2xl font-bold text-slate-900">{angenommen.length}</div>
          <div className="text-xs font-semibold text-slate-700 mt-1">Angebote aktiv</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{angebote.length} gesamt</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className={clsx('text-2xl font-bold',cockpit.mahnungen>0?'text-rose-600':'text-slate-400')}>{cockpit.mahnungen}</div>
          <div className="text-xs font-semibold text-slate-700 mt-1">Mahnungen</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-2xl font-bold text-slate-900">{cockpit.stornos+cockpit.gutschriften}</div>
          <div className="text-xs font-semibold text-slate-700 mt-1">Stornos/GS</div>
        </div>
      </div>

      {/* Kunden-Ansicht */}
      {showKundenAnsicht&&canGF&&(()=>{
        const byKunde: Record<string,{name:string;doks:Dokument[];gesamt:number;bezahlt:number;offen:number}> = {}
        fin.dokumente.filter(d=>d.typ==='rechnung').forEach(d=>{
          const k=d.klientName||'–'
          if (!byKunde[k]) byKunde[k]={name:k,doks:[],gesamt:0,bezahlt:0,offen:0}
          byKunde[k].doks.push(d); byKunde[k].gesamt+=d.summeBrutto
          if (d.status==='bezahlt') byKunde[k].bezahlt+=d.summeBrutto; else byKunde[k].offen+=d.offenerBetrag
        })
        const liste = Object.values(byKunde).sort((a,b)=>b.gesamt-a.gesamt)
        const gefiltert = kundeFilter ? liste.filter(k=>k.name.toLowerCase().includes(kundeFilter.toLowerCase())) : liste
        return (
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
              <h3 className="text-xl font-bold text-slate-900">Rechnungen pro Kunde</h3>
              <input value={kundeFilter} onChange={e=>setKundeFilter(e.target.value)} placeholder="Kunde suchen ..."
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-teal-400 w-56"/>
            </div>
            <div className="grid text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-7 py-3 border-b"
              style={{gridTemplateColumns:'1fr 110px 110px 110px 210px'}}>
              <div>Kunde</div><div>Gesamt</div><div>Bezahlt</div><div>Offen</div><div className="text-right">Aktionen</div>
            </div>
            {gefiltert.map(k=>(
              <div key={k.name} className="grid items-center px-7 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
                style={{gridTemplateColumns:'1fr 110px 110px 110px 210px'}}>
                <div>
                  <div className="font-semibold text-slate-900">{k.name}</div>
                  <div className="text-xs text-slate-400">{k.doks.length} Rechnung{k.doks.length!==1?'en':''}</div>
                </div>
                <div className="text-sm font-bold text-slate-900">{fmt(k.gesamt)}</div>
                <div className="text-sm text-emerald-700">{fmt(k.bezahlt)}</div>
                <div className={clsx('text-sm font-semibold',k.offen>0?'text-amber-600':'text-slate-400')}>{k.offen>0?fmt(k.offen):'–'}</div>
                <div className="flex gap-1 justify-end">
                  <button onClick={async()=>{setExportLoading('lp-'+k.name);await exportKundenlisteRechnungenPDF(k.name,k.doks);setExportLoading('')}}
                    disabled={exportLoading==='lp-'+k.name}
                    className="rounded-lg bg-teal-700 text-white text-xs px-2.5 py-1.5 cursor-pointer border-none hover:bg-teal-800 disabled:opacity-50 font-semibold">
                    {exportLoading==='lp-'+k.name?'…':'📋 PDF'}
                  </button>
                  <button onClick={async()=>{setExportLoading('xl-'+k.name);await exportKundenlisteRechnungenExcel(k.name,k.doks);setExportLoading('')}}
                    disabled={exportLoading==='xl-'+k.name}
                    className="rounded-lg border border-slate-200 text-slate-600 text-xs px-2.5 py-1.5 cursor-pointer hover:bg-slate-50 disabled:opacity-50">
                    {exportLoading==='xl-'+k.name?'…':'📊 Excel'}
                  </button>
                  <button onClick={()=>{
                    const to=k.doks[0]?.klientEmail||''
                    const subj=encodeURIComponent(`Rechnungen ${k.name} – VBetreut`)
                    const body=encodeURIComponent(`Sehr geehrte Damen und Herren,\n\nanbei Ihre Rechnungsübersicht.\nAnzahl: ${k.doks.length} | Gesamt: ${fmt(k.gesamt)}\n\nMit freundlichen Grüßen\nVBetreut 24h-Betreuungsagentur`)
                    window.open(`mailto:${to}?cc=${ccEmail}&subject=${subj}&body=${body}`)
                  }} className="rounded-lg border border-sky-200 bg-sky-50 text-sky-700 text-xs px-2.5 py-1.5 cursor-pointer hover:bg-sky-100">
                    📧
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Monatschart */}
      {/* Grafisches Monatschart */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">📊 Umsatz & Ausgaben</h3>
            <div className="text-xs text-slate-400 mt-0.5">Letzte 6 Monate</div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-teal-600"/><span className="text-slate-500">Einnahmen</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-violet-400"/><span className="text-slate-500">Auszahlungen</span></div>
            <button onClick={()=>exportDokumenteExcel(fin.dokumente.filter(d=>d.typ==='rechnung'))}
              className="rounded-xl border border-slate-200 text-slate-600 text-xs px-3 py-1.5 cursor-pointer hover:bg-slate-50">📥</button>
          </div>
        </div>
        <div className="flex items-end gap-3 h-40 mb-3">
          {Object.entries(cockpit.monat).map(([key,betrag])=>{
            const h=maxU>0?(betrag/maxU)*100:0
            const [y,m]=key.split('-')
            const isAktuell = key===`${jetzt.getFullYear()}-${String(jetzt.getMonth()+1).padStart(2,'0')}`
            const monatNamen = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
            const mName = monatNamen[(parseInt(m||'1')-1)] || m
            return (
              <div key={key} className="flex-1 flex flex-col items-center gap-1">
                {betrag>0 && <div className="text-[10px] font-bold text-teal-700">{betrag>=1000?(betrag/1000).toFixed(1)+'k':betrag.toFixed(0)}</div>}
                <div className="w-full flex flex-col items-center justify-end" style={{height:'120px'}}>
                  <div
                    className={clsx('w-full rounded-t-lg transition-all duration-500',
                      isAktuell ? 'bg-teal-600 shadow-sm shadow-teal-200' : 'bg-teal-300 hover:bg-teal-400')}
                    style={{height:`${Math.max(h,betrag>0?4:1)}%`}}
                    title={`${mName} ${y}: ${fmt(betrag)}`}
                  />
                </div>
                <div className={clsx('text-[10px] font-medium', isAktuell?'text-teal-700 font-bold':'text-slate-400')}>{mName}</div>
              </div>
            )
          })}
        </div>
        {/* Untere Kennzahlen */}
        <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-100">
          <div className="text-center rounded-xl bg-slate-50 p-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Ø/Monat</div>
            <div className="font-bold text-slate-800 text-sm">{fmt(Object.values(cockpit.monat).reduce((s,v)=>s+v,0)/Math.max(Object.values(cockpit.monat).filter(v=>v>0).length,1))}</div>
          </div>
          <div className="text-center rounded-xl bg-teal-50 p-3">
            <div className="text-[10px] text-teal-500 uppercase tracking-wide mb-1">Bester Monat</div>
            <div className="font-bold text-teal-700 text-sm">{fmt(Math.max(...Object.values(cockpit.monat),0))}</div>
          </div>
          <div className="text-center rounded-xl bg-slate-50 p-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">6-Monate</div>
            <div className="font-bold text-slate-800 text-sm">{fmt(Object.values(cockpit.monat).reduce((s,v)=>s+v,0))}</div>
          </div>
          <div className="text-center rounded-xl bg-emerald-50 p-3">
            <div className="text-[10px] text-emerald-500 uppercase tracking-wide mb-1">Bezahlt</div>
            <div className="font-bold text-emerald-700 text-sm">{fmt(cockpit.umsatzBezahlt)}</div>
          </div>
        </div>
      </div>

      {/* Top Klienten */}
      {canGF&&fin.dokumente.filter(d=>d.typ==='rechnung'&&d.status==='bezahlt').length>0&&(
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Top Klienten nach Umsatz</h3>
            <span className="text-xs text-slate-400">Nur für Geschäftsführung</span>
          </div>
          {(()=>{
            const byKlient: Record<string,number> = {}
            fin.dokumente.filter(d=>d.typ==='rechnung'&&d.status==='bezahlt').forEach(d=>{ byKlient[d.klientName||'–']=(byKlient[d.klientName||'–']||0)+d.summeBrutto })
            return Object.entries(byKlient).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,betrag],i)=>(
              <div key={name} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold">{i+1}</div>
                <div className="flex-1 text-sm font-semibold text-slate-800">{name}</div>
                <div className="font-bold text-teal-700">{fmt(betrag)}</div>
              </div>
            ))
          })()}
        </div>
      )}
    </div>
  }

  // Note: jetzt muss im Cockpit scope zugänglich sein
  const jetzt = new Date()

  function DokumentListe() {
    const statusOptions: DokumentStatus[] = ['entwurf','erstellt','versendet','bezahlt','teilbezahlt','mahnung','storniert','angenommen','abgelehnt','abgelaufen']
    return <div className="space-y-4">
      {einsaetzeOhneRechnung.length>0&&tab==='Rechnungen'&&canEdit&&(
        <div className="rounded-3xl border border-teal-200 bg-teal-50 p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-teal-800">💡 {einsaetzeOhneRechnung.length} Einsatz{einsaetzeOhneRechnung.length>1?'e':''} bereit zur Abrechnung</h3>
              <p className="text-sm text-teal-600 mt-0.5">Nach Anreise — noch nicht verrechnet · Doppelverrechnung automatisch verhindert</p>
            </div>
            <button onClick={()=>{ einsaetzeOhneRechnung.forEach(e=>{ fin.createRechnungAusEinsatz({einsatz:e as any,erstelltVon:user?.name ?? 'System'}) }) }}
              className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-bold text-white cursor-pointer border-none hover:bg-teal-800">
              Alle erstellen →
            </button>
          </div>
          <div className="space-y-2">
            {einsaetzeOhneRechnung.map(e=>(
              <div key={e.id} className="flex items-center justify-between rounded-2xl bg-white border border-teal-200 px-4 py-3">
                <div>
                  <span className="font-semibold text-slate-900">{e.klientName}</span>
                  <span className="text-sm text-slate-500 ml-2">· {e.betreuerinName}</span>
                  <span className="text-sm text-slate-400 ml-2">· {e.von ? new Date(e.von+'T12:00:00').toLocaleDateString('de-AT') : ''} – {e.bis ? new Date(e.bis+'T12:00:00').toLocaleDateString('de-AT') : 'laufend'}</span>
                  <span className="text-sm font-semibold text-teal-700 ml-2">· {fmt(e.gesamtbetrag || (e.turnusTage * e.tagessatz))}</span>
                </div>
                <button onClick={()=>fin.createRechnungAusEinsatz({einsatz:e as any,erstelltVon:user?.name ?? 'System'})}
                  className="rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white cursor-pointer border-none hover:bg-teal-800">📄 Rechnung erstellen →</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {stornoConfirm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="bg-white rounded-3xl p-8 shadow-2xl w-96">
            <h2 className="text-xl font-bold mb-2">Rechnung stornieren?</h2>
            <p className="text-slate-500 text-sm mb-6">Eine Stornorechnung wird erstellt. Nicht rückgängig machbar.</p>
            <div className="flex gap-3 justify-end">
              <Btn onClick={()=>setStornoConfirm(null)}>Abbrechen</Btn>
              <Btn danger onClick={()=>{ fin.createStorno(stornoConfirm,user?.name ?? 'System'); setStornoConfirm(null) }}>Storno erstellen</Btn>
            </div>
          </div>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>setStatusFilter('alle')} className={clsx('rounded-full px-4 py-2 text-sm font-medium border cursor-pointer transition-all',statusFilter==='alle'?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>Alle ({filteredDoks.length})</button>
        {statusOptions.filter(s=>fin.dokumente.some(d=>d.status===s)).map(s=>(
          <button key={s} onClick={()=>setStatusFilter(s)} className={clsx('rounded-full px-4 py-2 text-sm font-medium border cursor-pointer transition-all',statusFilter===s?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-7 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-slate-900 mr-2">{filteredDoks.length} Einträge</h2>
          {canEdit&&<>
            <button onClick={async()=>{setExportLoading('xlsx');await exportDokumenteExcel(filteredDoks);setExportLoading('')}} disabled={exportLoading==='xlsx'}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 disabled:opacity-50">📊 Excel</button>
            <button onClick={async()=>{setExportLoading('ap');for(const d of filteredDoks) await exportDokumentPDF(d);setExportLoading('')}} disabled={exportLoading==='ap'}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 disabled:opacity-50">{exportLoading==='ap'?'…':'📄 Alle PDFs'}</button>
          </>}
        </div>
        <div className="grid bg-slate-50 px-7 py-3 border-b text-xs font-bold uppercase tracking-wider text-slate-400" style={{gridTemplateColumns:'130px 1fr 1fr 110px 110px 140px 110px'}}>
          <div>Nr.</div><div>Klient:in</div><div>Betreuerin</div><div>Betrag</div><div>Datum/Fällig</div><div>Status</div><div>Aktionen</div>
        </div>
        {filteredDoks.length===0&&<div className="text-center py-16 text-slate-400"><div className="text-5xl mb-3">🧾</div><div className="text-lg font-medium">Keine Dokumente</div></div>}
        {filteredDoks.map(d=>{
          const ue=d.zahlungsziel&&!['bezahlt','storniert'].includes(d.status)&&new Date(d.zahlungsziel)<new Date()
          return(
            <div key={d.id} className={clsx('grid items-center border-b border-slate-50 px-7 py-4 cursor-pointer hover:bg-slate-50/80 transition-colors',ue&&'bg-rose-50/30')}
              style={{gridTemplateColumns:'130px 1fr 1fr 110px 110px 140px 110px'}} onClick={()=>setDetailDok(d)}>
              <div>
                <div className="font-mono text-sm font-bold text-teal-700">{d.dokumentNr}</div>
                <Badge label={TYP_LABELS[d.typ]} className={clsx('text-xs mt-0.5',TYP_COLORS[d.typ])}/>
              </div>
              <div>
                <div className="font-semibold text-slate-900">{d.klientName}</div>
                {d.bezugDokumentNr&&<div className="text-xs text-slate-400">Bezug: {d.bezugDokumentNr}</div>}
              </div>
              <div className="text-sm text-slate-600">{d.betreuerinName||'–'}</div>
              <div>
                <div className="font-bold text-slate-900">{fmt(d.summeBrutto)}</div>
                {d.offenerBetrag>0&&d.offenerBetrag!==d.summeBrutto&&<div className="text-xs text-amber-600">offen: {fmt(d.offenerBetrag)}</div>}
              </div>
              <div>
                <div className="text-sm text-slate-600">{fmtDate(d.rechnungsDatum)}</div>
                <div className={clsx('text-xs',ue?'text-rose-600 font-bold':'text-slate-400')}>fällig: {fmtDate(d.zahlungsziel)}</div>
              </div>
              <div><Badge label={STATUS_LABELS[d.status]} className={clsx('text-xs',STATUS_COLORS[d.status])}/></div>
              <div onClick={e=>e.stopPropagation()} className="flex gap-1">
                <button onClick={async()=>{setExportLoading(d.id);await exportDokumentPDF(d);setExportLoading('')}} disabled={exportLoading===d.id}
                  className="rounded-lg bg-teal-700 px-2 py-1.5 text-xs font-bold text-white cursor-pointer border-none hover:bg-teal-800 disabled:opacity-50" title="PDF">
                  {exportLoading===d.id?'…':'📄'}
                </button>
                <button onClick={() => setEmailDok(d)}
                  className="rounded-lg border border-sky-200 bg-sky-50 text-sky-700 px-2 py-1.5 text-xs cursor-pointer hover:bg-sky-100" title="E-Mail senden">
                  📧
                </button>
                {canEdit&&!['storniert','bezahlt'].includes(d.status)&&(
                  <button onClick={()=>openEditor(d.typ,d)}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 cursor-pointer hover:bg-slate-50">✏️</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  }

  function Auszahlungen() {
    return <div className="space-y-5">
      {faelligAuszahlung.length>0&&canEdit&&(
        <div className="rounded-3xl border border-violet-200 bg-violet-50 p-6">
          <h3 className="text-lg font-bold text-violet-800 mb-3">💡 {faelligAuszahlung.length} Auszahlungen fällig (7 Tage vor Abreise)</h3>
          <div className="space-y-2">
            {faelligAuszahlung.map(e=>(
              <div key={e.id} className="flex items-center justify-between rounded-2xl bg-white border border-violet-200 px-4 py-3">
                <div><span className="font-semibold text-slate-900">{e.betreuerinName||'–'}</span><span className="text-sm text-slate-500 ml-2">bei {e.klientName} · bis {fmtDate(e.bis)}</span></div>
                <span className="font-bold text-slate-900">{fmt(e.tagessatz*e.turnusTage)}</span>
                <button className="rounded-xl bg-violet-700 px-3 py-1.5 text-xs font-bold text-white cursor-pointer border-none hover:bg-violet-800">Vorbereiten</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {fin.auszahlungen.filter(a=>a.status==='vorbereitet').length>0&&(
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 flex items-center justify-between">
          <div><div className="font-bold text-sky-800">{fin.auszahlungen.filter(a=>a.status==='vorbereitet').length} Auszahlungen bereit</div><div className="text-sm text-sky-600 mt-0.5">Als SEPA-XML exportieren</div></div>
          <button onClick={()=>{
            const ids=fin.auszahlungen.filter(a=>a.status==='vorbereitet').map(a=>a.id)
            const xml=fin.exportSepa(ids)
            const blob=new Blob([xml],{type:'application/xml'})
            const url=URL.createObjectURL(blob)
            const a=document.createElement('a'); a.href=url; a.download=`sepa-${new Date().toISOString().split('T')[0]}.xml`; a.click()
          }} className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-bold text-white cursor-pointer border-none hover:bg-sky-800">SEPA-XML exportieren →</button>
        </div>
      )}
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-7 py-5 border-b"><h2 className="text-xl font-bold">Auszahlungen ({fin.auszahlungen.length})</h2></div>
        {fin.auszahlungen.length===0?<div className="text-center py-16 text-slate-400"><div className="text-5xl mb-3">💸</div><div>Keine Auszahlungen</div></div>:(
          <div className="divide-y divide-slate-50">
            {fin.auszahlungen.map(az=>(
              <div key={az.id} className="flex items-center justify-between px-7 py-4">
                <div><div className="font-semibold text-slate-900">{az.betreuerinName}</div><div className="text-sm text-slate-500">{fmtDate(az.zeitraumVon)} – {fmtDate(az.zeitraumBis)}</div></div>
                <div className="text-right"><div className="font-bold text-slate-900">{fmt(az.nettoBetrag)}</div><Badge label={az.status==='vorbereitet'?'Vorbereitet':az.status==='exportiert'?'Exportiert':'Bezahlt'} className={az.status==='bezahlt'?'bg-emerald-50 text-emerald-700 border-emerald-200 text-xs':'bg-sky-50 text-sky-700 border-sky-200 text-xs'}/></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  }

  function Bankabgleich() {
    return <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="font-semibold text-slate-700 mb-1">Bankimport (CAMT.053 / CSV)</div>
        <p className="text-sm text-slate-500 mb-3">Bankdatei hochladen — importierte Zahlungen werden automatisch abgeglichen.</p>
        <label className="inline-block cursor-pointer rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800">
          Bankdatei importieren<input type="file" accept=".csv,.xml" className="hidden" onChange={()=>{}}/>
        </label>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-7 py-5 border-b"><h2 className="text-xl font-bold">Zahlungen ({fin.zahlungen.length})</h2></div>
        {fin.zahlungen.length===0?<div className="text-center py-16 text-slate-400"><div className="text-5xl mb-3">🏦</div><div>Keine Zahlungen importiert</div></div>:(
          fin.zahlungen.map(z=>(
            <div key={z.id} className="flex items-center justify-between border-b border-slate-50 px-7 py-4">
              <div><div className="font-semibold text-slate-900">{z.auftraggeber}</div><div className="text-xs text-slate-500">{z.verwendungszweck}</div></div>
              <div className="font-bold text-slate-900">{fmt(z.betrag)}</div>
              <Badge label={z.status==='abgeglichen'?'Abgeglichen':z.status==='klaerung'?'⚠️ Klärung':'Offen'} className={z.status==='abgeglichen'?'bg-emerald-50 text-emerald-700 border-emerald-200 text-xs':z.status==='klaerung'?'bg-amber-50 text-amber-700 border-amber-200 text-xs':'bg-sky-50 text-sky-700 border-sky-200 text-xs'}/>
              {z.status==='offen'&&<button onClick={()=>{
                const r=fin.zahlungsabgleich(z)
                if(r.match==='eindeutig'&&r.kandidaten[0]) {
                  fin.updateDokument(r.kandidaten[0].id,{status:'bezahlt',zahlungseingangAm:z.buchungsDatum,offenerBetrag:0},user?.name ?? 'System','Automatisch abgeglichen')
                  fin.updateZahlung(z.id,{status:'abgeglichen',zugeordnetDokumentId:r.kandidaten[0].id,zugeordnetDokumentNr:r.kandidaten[0].dokumentNr})
                } else {
                  alert(`Klärungsbedarf: ${r.hinweis}`)
                  fin.updateZahlung(z.id,{status:'klaerung',klaerungsHinweis:r.hinweis})
                }
              }} className="rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white cursor-pointer border-none hover:bg-teal-800">Abgleich</button>}
            </div>
          ))
        )}
      </div>
    </div>
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar/>
      <main className="flex-1 overflow-auto p-8">
        {gutschriftFor&&(
          <GutschriftDialog original={gutschriftFor}
            onConfirm={pos=>{ fin.createGutschrift(gutschriftFor.id,pos,user?.name ?? 'System'); setGutschriftFor(null) }}
            onClose={()=>setGutschriftFor(null)}/>
        )}
        {showEditor&&(
          <DokumentEditor typ={editorTyp} initial={editDok||undefined} artikel={fin.artikel}
            bezugDokument={editorTyp==='gutschrift'&&editDok?fin.dokumente.find(d=>d.id===editDok.bezugDokumentId)||undefined:undefined}
            erstelltVon={user?.name ?? 'System'} onSave={handleEditorSave} onClose={closeEditor}/>
        )}
        {detailDok&&(
          <DokumentDetailPanel dokument={detailDok} canEdit={canEdit} canGF={canGF}
            onEdit={()=>openEditor(detailDok.typ,detailDok)}
            onClose={()=>setDetailDok(null)}
            onStorno={()=>{ setStornoConfirm(detailDok.id); setDetailDok(null) }}
            onGutschrift={()=>{ setGutschriftFor(detailDok); setDetailDok(null) }}
            onStatusChange={status=>{
              fin.updateDokument(detailDok.id,{status,...(status==='bezahlt'?{zahlungseingangAm:new Date().toISOString().split('T')[0],offenerBetrag:0}:{})},user?.name ?? 'System',`Status → ${STATUS_LABELS[status]}`)
              setDetailDok(prev=>prev?{...prev,status}:null)
            }}
            onAngebotAnnehmen={()=>{
              fin.updateDokument(detailDok.id,{status:'angenommen',angebotAngenommenAm:new Date().toISOString().split('T')[0]},user?.name ?? 'System','Angebot angenommen')
              setDetailDok(prev=>prev?{...prev,status:'angenommen'}:null)
            }}
            onAngebotInRechnung={()=>{
              const re=fin.createDokument({...detailDok,typ:'rechnung',status:'entwurf',bezugDokumentId:detailDok.id,bezugDokumentNr:detailDok.dokumentNr,erstelltVon:user?.name ?? 'System'})
              setDetailDok(null); setEditDok(re); setEditorTyp('rechnung'); setShowEditor(true)
            }}
            onPDF={async()=>{ await exportDokumentPDF(detailDok) }}/>
        )}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-2">VBetreut · ERP</div>
              <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-2">Finanzen & Abrechnung</h1>
              <p className="text-base text-slate-500 max-w-2xl">Kundenrechnungen, BG-Abrechnungen, Angebote, Gutschriften, Stornos, Bankabgleich und Cockpit.</p>
            </div>
            {canEdit&&['Rechnungen','Angebote','BG-Abrechnungen','Taxi'].includes(tab)&&(
              <div className="flex gap-2 flex-shrink-0 pt-1">
                {tab==='Rechnungen'&&<Btn teal onClick={()=>openEditor('rechnung')}>+ Neue Rechnung</Btn>}
                {tab==='Angebote'&&<Btn teal onClick={()=>openEditor('angebot')}>+ Neues Angebot</Btn>}
                {tab==='BG-Abrechnungen'&&<Btn teal onClick={()=>openEditor('bg_abrechnung')}>+ Neue BG-Abrechnung</Btn>}
                {tab==='Taxi'&&<Btn teal onClick={()=>openEditor('taxi_rechnung')}>+ Taxi-Rechnung</Btn>}
              </div>
            )}
          </div>
          {['Rechnungen','Angebote','BG-Abrechnungen','Taxi'].includes(tab)&&(
            <div className="mt-5 flex gap-3">
              <div className="flex-1 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-slate-400 text-lg">🔎</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suche nach Nr., Klient:in, Betreuerin ..."
                  className="flex-1 bg-transparent border-none text-sm text-slate-800 placeholder-slate-400 outline-none"/>
                {search&&<button onClick={()=>setSearch('')} className="text-slate-400 text-sm cursor-pointer bg-transparent border-none">✕</button>}
              </div>
            </div>
          )}
        </div>
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex gap-1 flex-wrap">
            {TABS.map(t=>(
              <button key={t} onClick={()=>{setTab(t);setSearch('');setStatusFilter('alle')}}
                className={clsx('rounded-2xl px-5 py-3 text-sm font-semibold cursor-pointer border-none transition-all',tab===t?'bg-slate-900 text-white':'bg-transparent text-slate-500 hover:bg-slate-100')}>
                {t}
                {t==='Bankabgleich'&&cockpit.klaerfaelle>0&&<span className="ml-1.5 bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-xs">{cockpit.klaerfaelle}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5">
          {tab==='Cockpit'&&<Cockpit/>}
          {['Rechnungen','Angebote','BG-Abrechnungen','Taxi'].includes(tab)&&<DokumentListe/>}
          {tab==='Auszahlungen'&&<Auszahlungen/>}
          {tab==='Bankabgleich'&&<Bankabgleich/>}
          {tab==='Artikel'&&<ArtikelVerwaltung artikel={fin.artikel} canEdit={canEdit} onSave={list=>{ fin.saveArtikel(list) }}/>}
        </div>
      </main>
    </div>
  )
}
// ── Honorar-Cockpit (Mini) ─────────────────────────────────────────────────
function HonorarCockpit() {
  const [noten, setNoten] = React.useState<any[]>([])
  React.useEffect(() => {
    fetch('/api/honorarnoten').then(r => r.json()).then(d => setNoten(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])
  const gesamt = noten.reduce((s, n) => s + Number(n.betrag_brutto || 0), 0)
  const bezahlt = noten.filter(n => n.status === 'bezahlt').reduce((s, n) => s + Number(n.betrag_brutto || 0), 0)
  const offen = gesamt - bezahlt
  const fmt = (n: number) => n.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  return (
    <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold text-violet-900">📤 Auszahlungen (Honorarnoten)</div>
        <a href="/auszahlungen" className="text-xs text-violet-700 underline cursor-pointer">→ Auszahlungen öffnen</a>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-violet-200 p-4 text-center">
          <div className="text-xs text-slate-500 mb-1">Gesamt</div>
          <div className="text-xl font-bold text-violet-700">{fmt(gesamt)}</div>
          <div className="text-xs text-slate-400">{noten.length} Honorarnoten</div>
        </div>
        <div className="rounded-2xl bg-white border border-violet-200 p-4 text-center">
          <div className="text-xs text-slate-500 mb-1">Bezahlt</div>
          <div className="text-xl font-bold text-emerald-600">{fmt(bezahlt)}</div>
          <div className="text-xs text-slate-400">{noten.filter(n => n.status === 'bezahlt').length} Noten</div>
        </div>
        <div className="rounded-2xl bg-white border border-violet-200 p-4 text-center">
          <div className="text-xs text-slate-500 mb-1">Offen</div>
          <div className="text-xl font-bold text-amber-600">{fmt(offen)}</div>
          <div className="text-xs text-slate-400">{noten.filter(n => n.status !== 'bezahlt').length} Noten</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-violet-200 flex items-center justify-between">
        <div className="text-sm text-violet-700">
          <span className="font-bold">Ergebnis:</span> {fmt(gesamt - offen - gesamt)} · 
          Einnahmen {fmt(0)} − Ausgaben {fmt(gesamt)} = <span className="font-bold">{fmt(gesamt * -1)}</span>
        </div>
      </div>
    </div>
  )
}
