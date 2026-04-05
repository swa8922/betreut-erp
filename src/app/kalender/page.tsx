'use client'
import { useState, useMemo, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useKalender } from '@/hooks/useKalender'
import { useMitarbeiter } from '@/hooks/useMitarbeiter'
import Sidebar from '@/components/Sidebar'
import { Badge, Btn, Field, SelField, TextArea } from '@/components/ui'
import {
  EREIGNIS_LABELS, EREIGNIS_FARBEN, GENEHMIGUNGS_LABELS,
  getOesterreichischeFeiertage, arbeitstageZwischen, tageZwischen,
  type KalenderEreignis, type EreignisTyp, type Fahrzeug,
} from '@/lib/kalender'
import clsx from 'clsx'

const MONATE=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const WOCHENTAGE_KURZ=['Mo','Di','Mi','Do','Fr','Sa','So']
const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString('de-AT'):'–'
const isoDate=(d:Date)=>{
  const y=d.getFullYear()
  const m=String(d.getMonth()+1).padStart(2,'0')
  const day=String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
const MA_FARBEN=['#0f766e','#0284c7','#7c3aed','#be185d','#b45309','#15803d','#b91c1c','#1d4ed8']
function maFarbe(id:string):string{const n=id.split('').reduce((a,c)=>a+c.charCodeAt(0),0);return MA_FARBEN[n%MA_FARBEN.length]}

function EventChip({e,onClick}:{e:KalenderEreignis;onClick:(ev:React.MouseEvent)=>void}){
  const f=EREIGNIS_FARBEN[e.typ]
  return(
    <div onClick={onClick} className={clsx('rounded-lg px-2 py-0.5 text-xs font-medium truncate cursor-pointer hover:opacity-80 transition-opacity border',f.bg,f.text,f.border)}>
      {e.typ==='urlaub'&&'⏳ '}{e.typ==='krankenstand'&&'🤒 '}{e.typ==='firmenevent'&&'🎉 '}{e.typ==='auto_buchung'&&'🚗 '}{e.typ==='feiertag'&&'🎌 '}
      {e.mitarbeiterName?`${e.mitarbeiterName.split(' ')[0]} — `:''}{e.titel}
    </div>
  )
}

interface FormProps{
  initial?:KalenderEreignis;defaultDatum?:string;mitarbeiterId:string;mitarbeiterName:string
  isGF:boolean;mitarbeiterListe:{id:string;name:string}[];fahrzeuge:Fahrzeug[]
  onSave:(data:Omit<KalenderEreignis,'id'|'erstelltAm'|'aktualisiertAm'>)=>void;onClose:()=>void
}
function EreignisForm({initial,defaultDatum,mitarbeiterId,mitarbeiterName,isGF,mitarbeiterListe,fahrzeuge,onSave,onClose}:FormProps){
  const today=isoDate(new Date())
  const[form,setForm]=useState<Omit<KalenderEreignis,'id'|'erstelltAm'|'aktualisiertAm'>>(
    initial?{...initial}:{
      typ:'urlaub',titel:'Urlaub',beschreibung:'',von:defaultDatum||today,bis:defaultDatum||today,
      ganzerTag:true,vonZeit:'',bisZeit:'',
      mitarbeiterId:isGF?'':mitarbeiterId,mitarbeiterName:isGF?'':mitarbeiterName,
      genehmigungsStatus:isGF?'genehmigt':'beantragt',beantragtAm:today,
      genehmigtVon:isGF?mitarbeiterName:'',genehmigtAm:isGF?today:'',ablehnungsGrund:'',
      fahrzeugId:'',fahrzeugName:'',ziel:'',ort:'',teilnehmer:[],pflichttermin:false,
      wiederholung:'keine',farbe:'',notizen:'',erstelltVon:mitarbeiterName,
    }
  )
  function set<K extends keyof typeof form>(k:K,v:typeof form[K]){setForm(f=>({...f,[k]:v}))}
  const arbeitstage=arbeitstageZwischen(form.von,form.bis)
  const kalTage=tageZwischen(form.von,form.bis)
  const TYPEN:any[]=isGF
    ?Object.entries(EREIGNIS_LABELS).filter(([k])=>k!=='feiertag').map(([k,v])=>({value:k,label:v}))
    :[{value:'urlaub',label:'Urlaub beantragen'},{value:'krankenstand',label:'Krankenstand'},{value:'zeitausgleich',label:'Zeitausgleich'},{value:'homeoffice',label:'Home Office'},{value:'termin',label:'Termin'},{value:'auto_buchung',label:'Fahrzeug buchen'}]
  function handleTyp(typ:EreignisTyp){
    const autoTitel:any={urlaub:'Urlaub',urlaub_genehmigt:'Urlaub',krankenstand:'Krankenstand',zeitausgleich:'Zeitausgleich',homeoffice:'Home Office',firmenevent:'Firmenevent',auto_buchung:'Fahrzeug gebucht'}
    setForm(f=>({...f,typ,titel:autoTitel[typ]||f.titel,genehmigungsStatus:(isGF||typ!=='urlaub')?'genehmigt':'beantragt',genehmigtVon:isGF?mitarbeiterName:'',genehmigtAm:isGF?today:''}))
  }
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg" onClick={e=>e.stopPropagation()}>
        <div className="bg-teal-700 rounded-t-3xl px-7 py-5 text-white flex items-center justify-between">
          <h2 className="text-xl font-bold">{initial?'Termin bearbeiten':'Neuer Eintrag'}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl cursor-pointer bg-transparent border-none">✕</button>
        </div>
        <form onSubmit={e=>{e.preventDefault();onSave(form)}}>
          <div className="px-7 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
            <SelField label="Art des Eintrags *" value={form.typ} onChange={v=>handleTyp(v as EreignisTyp)} options={TYPEN}/>
            {['termin','firmenevent','dienstreise','sonderurlaub'].includes(form.typ)&&(
              <Field label="Titel *" value={form.titel} onChange={v=>set('titel',v)} required/>
            )}
            {isGF&&form.typ!=='firmenevent'&&form.typ!=='feiertag'&&(
              <SelField label="Mitarbeiter" value={form.mitarbeiterId} onChange={v=>{const m=mitarbeiterListe.find(m=>m.id===v);setForm(f=>({...f,mitarbeiterId:v,mitarbeiterName:m?.name||''}))}}
                options={[{value:'',label:'— bitte wählen —'},...mitarbeiterListe.map(m=>({value:m.id,label:m.name}))]}/>
            )}
            {form.typ==='firmenevent'&&(
              <div>
                <div className="text-sm font-medium text-slate-600 mb-2">Teilnehmer</div>
                <div className="space-y-1.5">
                  {mitarbeiterListe.map(ma=>(
                    <label key={ma.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.teilnehmer.includes(ma.id)} onChange={e=>set('teilnehmer',e.target.checked?[...form.teilnehmer,ma.id]:form.teilnehmer.filter(t=>t!==ma.id))} className="w-4 h-4 accent-teal-700"/>
                      <span className="text-sm text-slate-700">{ma.name}</span>
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={form.pflichttermin} onChange={e=>set('pflichttermin',e.target.checked)} className="w-4 h-4 accent-teal-700"/>
                  <span className="text-sm font-semibold text-slate-700">Pflichttermin</span>
                </label>
              </div>
            )}
            {['firmenevent','dienstreise','termin'].includes(form.typ)&&(
              <Field label="Ort" value={form.ort} onChange={v=>set('ort',v)} placeholder="Büro, Wien ..."/>
            )}
            {form.typ==='auto_buchung'&&(
              <>
                <SelField label="Fahrzeug *" value={form.fahrzeugId} onChange={v=>{const fz=fahrzeuge.find(f=>f.id===v);setForm(f=>({...f,fahrzeugId:v,fahrzeugName:fz?.name||'',titel:`${fz?.name||'Auto'} gebucht`}))}}
                  options={[{value:'',label:'— wählen —'},...fahrzeuge.filter(f=>f.aktiv).map(f=>({value:f.id,label:`${f.name} · ${f.kennzeichen}`}))]}/>
                <Field label="Ziel / Zweck" value={form.ziel} onChange={v=>set('ziel',v)} placeholder="Wien — Kundenbesuch"/>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Von *" value={form.von} onChange={v=>{set('von',v);if(v>form.bis)set('bis',v)}} type="date" required/>
              <Field label="Bis *" value={form.bis} onChange={v=>set('bis',v)} type="date" required/>
            </div>
            {['urlaub','urlaub_genehmigt','krankenstand','zeitausgleich','sonderurlaub'].includes(form.typ)&&form.von&&form.bis&&(
              <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm flex gap-6">
                <span className="text-slate-500">Kalendertage: <strong className="text-slate-900">{kalTage}</strong></span>
                <span className="text-slate-500">Arbeitstage: <strong className="text-teal-700">{arbeitstage}</strong></span>
              </div>
            )}
            {form.typ==='termin'&&(
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.ganzerTag} onChange={e=>set('ganzerTag',e.target.checked)} className="w-4 h-4 accent-teal-700"/>
                <span className="text-sm text-slate-700">Ganztägig</span>
              </label>
            )}
            {!form.ganzerTag&&form.typ==='termin'&&(
              <div className="grid grid-cols-2 gap-3">
                <Field label="Von (Uhrzeit)" value={form.vonZeit} onChange={v=>set('vonZeit',v)} type="time"/>
                <Field label="Bis (Uhrzeit)" value={form.bisZeit} onChange={v=>set('bisZeit',v)} type="time"/>
              </div>
            )}
            <TextArea label="Notizen" value={form.notizen} onChange={v=>set('notizen',v)} placeholder="Optionale Anmerkungen ..."/>
            {form.typ==='urlaub'&&!isGF&&(
              <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                <strong>Urlaubsantrag</strong> — wird zur Genehmigung eingereicht.
              </div>
            )}
          </div>
          <div className="px-7 py-5 border-t border-slate-100 flex justify-between">
            <Btn onClick={onClose}>Abbrechen</Btn>
            <Btn teal type="submit">{form.typ==='urlaub'&&!isGF?'Antrag einreichen':initial?'Speichern':'Eintragen'}</Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function KalenderPage(){
  const{user,loading}=useAuth()
  const kal=useKalender()
  const mav=useMitarbeiter()
  const now=new Date()
  const[ansicht,setAnsicht]=useState<'monat'|'jahr'|'liste'|'urlaub'|'fahrzeuge'>('monat')
  const[datum,setDatum]=useState({jahr:now.getFullYear(),monat:now.getMonth()})
  const[filterMaId,setFilterMaId]=useState('alle')
  const[showForm,setShowForm]=useState(false)
  const[editEreignis,setEditEreignis]=useState<KalenderEreignis|null>(null)
  const[defaultDatum,setDefaultDatum]=useState('')
  const[detailEreignis,setDetailEreignis]=useState<KalenderEreignis|null>(null)
  const[ablehnungsGrund,setAblehnungsGrund]=useState('')
  const[showFzForm,setShowFzForm]=useState(false)
  const[fzForm,setFzForm]=useState({name:'',kennzeichen:'',typ:'PKW',farbe:'#3b82f6',aktiv:true,notizen:''})

  const isGF=user?.role==='gf'||user?.role==='koordination'
  const canApprove=user?.role==='gf'

  const mitarbeiterListe=useMemo(()=>mav.mitarbeiter.filter(m=>m.status==='aktiv').map(m=>({id:m.id,name:`${m.vorname} ${m.nachname}`})),[mav.mitarbeiter])
  const feiertage=useMemo(()=>getOesterreichischeFeiertage(datum.jahr),[datum.jahr])
  const alleEreignisse=useMemo(()=>{
    const fte=feiertage.map(ft=>({
      id:`FT_${ft.datum}`,typ:'feiertag' as EreignisTyp,titel:ft.name,beschreibung:'',von:ft.datum,bis:ft.datum,
      ganzerTag:true,vonZeit:'',bisZeit:'',mitarbeiterId:'',mitarbeiterName:'',
      genehmigungsStatus:'genehmigt' as any,beantragtAm:'',genehmigtVon:'',genehmigtAm:'',ablehnungsGrund:'',
      fahrzeugId:'',fahrzeugName:'',ziel:'',ort:'',teilnehmer:[],pflichttermin:false,
      wiederholung:'keine' as any,farbe:'',notizen:'',erstelltVon:'',erstelltAm:'',aktualisiertAm:'',
    }))
    return[...kal.ereignisse,...fte]
  },[kal.ereignisse,feiertage])

  const gefilterteEreignisse=useMemo(()=>{
    if(filterMaId==='alle') return alleEreignisse
    return alleEreignisse.filter(e=>!e.mitarbeiterId||e.mitarbeiterId===filterMaId||e.typ==='feiertag'||e.typ==='firmenevent')
  },[alleEreignisse,filterMaId])

  const offeneAntraege=useMemo(()=>kal.ereignisse.filter(e=>e.typ==='urlaub'&&e.genehmigungsStatus==='beantragt'),[kal.ereignisse])

  const currentMaId=mav.mitarbeiter.find(m=>m.email===user?.email||m.loginEmail===user?.email)?.id||'M1'

  function prev(){setDatum(d=>{if(ansicht==='jahr')return{...d,jahr:d.jahr-1};if(d.monat===0)return{jahr:d.jahr-1,monat:11};return{...d,monat:d.monat-1}})}
  function next(){setDatum(d=>{if(ansicht==='jahr')return{...d,jahr:d.jahr+1};if(d.monat===11)return{jahr:d.jahr+1,monat:0};return{...d,monat:d.monat+1}})}

  if(loading)return<div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>
  if(!user)return null

  // ── MONATSKALENDER ──
  function MonatsView(){
    const firstDay=new Date(datum.jahr,datum.monat,1)
    const lastDay=new Date(datum.jahr,datum.monat+1,0)
    let startDow=firstDay.getDay()-1; if(startDow<0)startDow=6
    const cells:(number|null)[]=[]
    for(let i=0;i<startDow;i++)cells.push(null)
    for(let d=1;d<=lastDay.getDate();d++)cells.push(d)
    while(cells.length%7!==0)cells.push(null)
    const heute=isoDate(new Date())
    const monatsEr=gefilterteEreignisse.filter(e=>{
      const first=isoDate(new Date(datum.jahr,datum.monat,1))
      const last=isoDate(new Date(datum.jahr,datum.monat+1,0))
      return (e.von||'')<=last&&(e.bis||e.von||'')>=first
    })
    function erFuerTag(tag:number){
      const d=isoDate(new Date(datum.jahr,datum.monat,tag))
      return monatsEr.filter(e=>(e.von||'')<=d&&(e.bis||e.von||'')>=d)
    }
    return(
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="grid border-b border-slate-200" style={{gridTemplateColumns:'repeat(7,1fr)'}}>
          {WOCHENTAGE_KURZ.map((t,i)=>(
            <div key={t} className={clsx('py-3 text-center text-xs font-bold uppercase tracking-wider',i>=5?'text-rose-400':'text-slate-500')}>{t}</div>
          ))}
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(7,1fr)'}}>
          {cells.map((tag,idx)=>{
            const tagStr=tag?isoDate(new Date(datum.jahr,datum.monat,tag)):''
            const isHeute=tagStr===heute
            const isFT=feiertage.some(f=>f.datum===tagStr)
            const isWE=tag?([0,6].includes(new Date(datum.jahr,datum.monat,tag).getDay())):false
            const ereignisse=tag?erFuerTag(tag):[]
            return(
              <div key={idx}
                className={clsx('min-h-24 border-b border-r border-slate-100 p-1.5 transition-colors',
                  !tag&&'bg-slate-50',isWE&&tag&&'bg-rose-50/20',isFT&&'bg-orange-50/30',tag&&'cursor-pointer hover:bg-slate-50/80')}
                onClick={()=>{if(tag){setDefaultDatum(tagStr);setEditEreignis(null);setShowForm(true)}}}>
                {tag&&(
                  <div className="flex items-center justify-between mb-1">
                    <span className={clsx('text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full',
                      isHeute?'bg-teal-700 text-white':isWE?'text-rose-400':'text-slate-700')}>{tag}</span>
                    {isFT&&<span className="text-xs text-orange-500" title={feiertage.find(f=>f.datum===tagStr)?.name}>🎌</span>}
                  </div>
                )}
                <div className="space-y-0.5">
                  {ereignisse.slice(0,3).map(e=>(
                    <EventChip key={e.id} e={e} onClick={ev=>{ev.stopPropagation();setDetailEreignis(e)}}/>
                  ))}
                  {ereignisse.length>3&&<div className="text-xs text-slate-400 pl-1">+{ereignisse.length-3} weitere</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── JAHRESANSICHT ──
  function JahresView(){
    const aktiveMa=mav.mitarbeiter.filter(m=>m.status==='aktiv')
    return(
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-7 py-5 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Jahresübersicht {datum.jahr} — Alle Mitarbeiter</h2>
          <button onClick={()=>window.print()} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50">🖨️ Drucken</button>
        </div>
        <div className="px-7 py-3 border-b flex gap-4 flex-wrap text-xs">
          {[['Urlaub','#10b981'],['Antrag','#f59e0b'],['Krankenstand','#f43f5e'],['Zeitausgleich','#0ea5e9'],['Firmenevent','#ec4899'],['Feiertag','#f97316']].map(([l,c])=>(
            <div key={l} className="flex items-center gap-1.5 text-slate-600"><div className="w-3 h-3 rounded-sm" style={{backgroundColor:c}}/>{l}</div>
          ))}
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="w-full border-collapse" style={{minWidth:900}}>
            <thead>
              <tr>
                <th className="sticky left-0 bg-white border-b border-r border-slate-200 px-4 py-3 text-left text-sm font-bold text-slate-700 w-44">Mitarbeiter</th>
                {MONATE.map(m=><th key={m} className="border-b border-r border-slate-200 px-2 py-3 text-center text-xs font-bold text-slate-600" style={{minWidth:60}}>{m.substring(0,3)}</th>)}
                <th className="border-b border-slate-200 px-3 py-3 text-center text-xs font-bold text-slate-600">U-Rest</th>
              </tr>
            </thead>
            <tbody>
              {aktiveMa.map(ma=>{
                const konto=kal.getKonto(ma.id,datum.jahr)
                const maEr=alleEreignisse.filter(e=>e.mitarbeiterId===ma.id)
                return(
                  <tr key={ma.id} className="hover:bg-slate-50">
                    <td className="sticky left-0 bg-white border-b border-r border-slate-200 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{backgroundColor:maFarbe(ma.id)}}>
                          {ma.vorname[0]}{ma.nachname[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{ma.vorname} {ma.nachname}</div>
                          <div className="text-xs text-slate-400">{ma.position}</div>
                        </div>
                      </div>
                    </td>
                    {MONATE.map((_,mi)=>{
                      const monEr=maEr.filter(e=>{
                        const v=new Date(e.von),b=new Date(e.bis)
                        return(v.getFullYear()===datum.jahr&&v.getMonth()===mi)||(b.getFullYear()===datum.jahr&&b.getMonth()===mi)
                      })
                      const uTage=monEr.filter(e=>['urlaub_genehmigt','urlaub'].includes(e.typ)).reduce((s,e)=>s+arbeitstageZwischen(e.von,e.bis),0)
                      const kTage=monEr.filter(e=>e.typ==='krankenstand').reduce((s,e)=>s+arbeitstageZwischen(e.von,e.bis),0)
                      const zTage=monEr.filter(e=>e.typ==='zeitausgleich').reduce((s,e)=>s+arbeitstageZwischen(e.von,e.bis),0)
                      const hatEvent=monEr.some(e=>e.typ==='firmenevent')
                      const ftDiesen=feiertage.filter(ft=>new Date(ft.datum).getMonth()===mi&&new Date(ft.datum).getFullYear()===datum.jahr)
                      return(
                        <td key={mi} className="border-b border-r border-slate-100 px-1 py-1.5 text-center align-top" style={{minWidth:60}}>
                          <div className="space-y-0.5">
                            {uTage>0&&<div className="rounded text-xs font-bold py-0.5 px-1" style={{backgroundColor:'#d1fae5',color:'#065f46'}}>{uTage}U</div>}
                            {kTage>0&&<div className="rounded text-xs font-bold py-0.5 px-1" style={{backgroundColor:'#ffe4e6',color:'#9f1239'}}>{kTage}K</div>}
                            {zTage>0&&<div className="rounded text-xs font-bold py-0.5 px-1" style={{backgroundColor:'#e0f2fe',color:'#075985'}}>{zTage}Z</div>}
                            {hatEvent&&<div className="text-xs">🎉</div>}
                            {ftDiesen.length>0&&<div className="text-xs text-orange-500">{ftDiesen.length}🎌</div>}
                          </div>
                        </td>
                      )
                    })}
                    <td className="border-b border-slate-200 px-3 py-3 text-center">
                      <div className="text-sm font-bold text-teal-700">{konto.anspruch+konto.uebertragVorjahr-konto.genommen}</div>
                      <div className="text-xs text-slate-400">/{konto.anspruch}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── LISTENANSICHT ──
  function ListenView(){
    const prefix=`${datum.jahr}-${String(datum.monat+1).padStart(2,'0')}`
    const monEr=gefilterteEreignisse.filter(e=>(e.von||'').startsWith(prefix)||(e.bis||'').startsWith(prefix)).sort((a,b)=>(a.von||'').localeCompare(b.von||''))
    return(
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-7 py-5 border-b flex justify-between">
          <h2 className="text-xl font-bold text-slate-900">{MONATE[datum.monat]} {datum.jahr} — {monEr.length} Einträge</h2>
          <button onClick={()=>window.print()} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium cursor-pointer hover:bg-slate-50">🖨️ Drucken</button>
        </div>
        {monEr.length===0&&<div className="text-center py-16 text-slate-400"><div className="text-4xl mb-2">📅</div><div>Keine Einträge</div></div>}
        {monEr.map(e=>{
          const f=EREIGNIS_FARBEN[e.typ]
          return(
            <div key={e.id} className="flex items-center gap-4 border-b border-slate-50 px-7 py-4 cursor-pointer hover:bg-slate-50" onClick={()=>setDetailEreignis(e)}>
              <div className="w-3 h-12 rounded-full flex-shrink-0" style={{backgroundColor:f.dot}}/>
              <div className="flex-1">
                <div className="font-semibold text-slate-900">{e.titel}</div>
                <div className="text-sm text-slate-500">{e.mitarbeiterName||'Alle'} · {fmtDate(e.von)}{e.von!==e.bis?` – ${fmtDate(e.bis)}`:''}{e.ort?` · 📍 ${e.ort}`:''}</div>
                {['urlaub','urlaub_genehmigt','krankenstand'].includes(e.typ)&&<div className="text-xs text-slate-400 mt-0.5">{arbeitstageZwischen(e.von,e.bis)} Arbeitstage</div>}
              </div>
              <Badge label={EREIGNIS_LABELS[e.typ]} className={clsx('text-xs',f.bg,f.text,f.border)}/>
              {e.genehmigungsStatus&&e.typ!=='feiertag'&&(
                <Badge label={e.genehmigungsStatus==='beantragt'?'⏳ Beantragt':e.genehmigungsStatus==='genehmigt'?'✓ Genehmigt':e.genehmigungsStatus==='abgelehnt'?'✕ Abgelehnt':'Storniert'}
                  className={clsx('text-xs',e.genehmigungsStatus==='genehmigt'?'bg-emerald-50 text-emerald-700 border-emerald-200':e.genehmigungsStatus==='beantragt'?'bg-amber-50 text-amber-700 border-amber-200':'bg-rose-50 text-rose-700 border-rose-200')}/>
              )}
              {canApprove&&e.typ==='urlaub'&&e.genehmigungsStatus==='beantragt'&&(
                <div className="flex gap-2" onClick={ev=>ev.stopPropagation()}>
                  <button onClick={()=>kal.genehmige(e.id,user!.name)} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white cursor-pointer border-none hover:bg-emerald-700">✓</button>
                  <button onClick={()=>setDetailEreignis(e)} className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs text-rose-600 cursor-pointer hover:bg-rose-50">✕</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── URLAUBSKONTEN ──
  function UrlaubView(){
    const aktiveMa=mav.mitarbeiter.filter(m=>m.status==='aktiv')
    return(
      <div className="space-y-5">
        <div className="flex justify-between">
          <h2 className="text-xl font-bold text-slate-900">Urlaubskonten {datum.jahr}</h2>
          <button onClick={()=>window.print()} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium cursor-pointer hover:bg-slate-50">🖨️ Drucken</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {aktiveMa.map(ma=>{
            const k=kal.getKonto(ma.id,datum.jahr)
            const gesamt=k.anspruch+k.uebertragVorjahr
            const pct=gesamt>0?Math.round((k.genommen/gesamt)*100):0
            return(
              <div key={ma.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{backgroundColor:maFarbe(ma.id)}}>
                    {ma.vorname[0]}{ma.nachname[0]}
                  </div>
                  <div><div className="font-bold text-slate-900">{ma.vorname} {ma.nachname}</div><div className="text-xs text-slate-400">{ma.position}</div></div>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5"><span>{k.genommen} genommen</span><span>{gesamt} gesamt</span></div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{width:`${Math.min(pct,100)}%`,backgroundColor:pct>90?'#f43f5e':pct>70?'#f59e0b':'#10b981'}}/>
                  </div>
                  <div className="text-right text-xs text-slate-400 mt-1">{pct}% verbraucht</div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-sm">
                  {[['Anspruch',k.anspruch+' Tage','text-slate-900'],['Übertrag',k.uebertragVorjahr>0?`+${k.uebertragVorjahr}`:'–','text-slate-500'],['Genommen',k.genommen+' Tage','text-slate-900'],['Beantragt',k.beantragt>0?k.beantragt+' Tage':'–','text-amber-600'],['Verbleibend',(gesamt-k.genommen-k.beantragt)+' Tage','text-teal-700 font-bold text-base']].map(([l,v,tc])=>(
                    <div key={String(l)} className="flex justify-between"><span className="text-slate-400">{l}</span><span className={tc as string}>{v}</span></div>
                  ))}
                </div>
                {canApprove&&(
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="text-xs text-slate-400 mb-1.5">Anspruch anpassen:</div>
                    <div className="flex items-center gap-2">
                      <input type="number" defaultValue={k.anspruch} min={0} max={60}
                        className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-center"
                        onChange={e=>{const updated=kal.konten.map(kk=>kk.mitarbeiterId===ma.id&&kk.jahr===datum.jahr?{...kk,anspruch:+e.target.value}:kk);kal.saveKonten(updated)}}/>
                      <span className="text-xs text-slate-400">Tage/Jahr</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* Urlaubsliste des Jahres */}
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="px-7 py-5 border-b"><h3 className="text-lg font-bold">Urlaube {datum.jahr} — Gesamtübersicht</h3></div>
          {aktiveMa.map(ma=>{
            const maUrlaube=kal.ereignisse.filter(e=>e.mitarbeiterId===ma.id&&['urlaub_genehmigt','urlaub'].includes(e.typ)&&(e.von||'').startsWith(String(datum.jahr))).sort((a,b)=>(a.von||'').localeCompare(b.von||''))
            if(!maUrlaube.length)return null
            return(
              <div key={ma.id} className="border-b last:border-0">
                <div className="px-7 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="font-semibold text-slate-800 text-sm">{ma.vorname} {ma.nachname}</div>
                  <div className="text-xs text-slate-500">{maUrlaube.reduce((s,e)=>s+arbeitstageZwischen(e.von,e.bis),0)} Arbeitstage gesamt</div>
                </div>
                {maUrlaube.map(e=>(
                  <div key={e.id} className="flex items-center gap-4 px-7 py-3 border-b border-slate-50 last:border-0">
                    <div className="flex-1 text-sm">{fmtDate(e.von)} – {fmtDate(e.bis)}</div>
                    <div className="text-sm text-slate-600">{arbeitstageZwischen(e.von,e.bis)} Arbeitstage</div>
                    <Badge label={e.genehmigungsStatus==='genehmigt'?'✓ Genehmigt':'⏳ Beantragt'}
                      className={e.genehmigungsStatus==='genehmigt'?'bg-emerald-50 text-emerald-700 border-emerald-200 text-xs':'bg-amber-50 text-amber-700 border-amber-200 text-xs'}/>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── FAHRZEUGE ──
  function FahrzeugView(){
    const buchungen=kal.ereignisse.filter(e=>e.typ==='auto_buchung')
    const heute=isoDate(new Date())
    return(
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Fuhrpark</h3>
            {isGF&&<button onClick={()=>setShowFzForm(v=>!v)} className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-teal-800">+ Fahrzeug</button>}
          </div>
          {showFzForm&&(
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 mb-4 space-y-3">
              <Field label="Name" value={fzForm.name} onChange={v=>setFzForm(f=>({...f,name:v}))} placeholder="VW Passat Kombi"/>
              <Field label="Kennzeichen" value={fzForm.kennzeichen} onChange={v=>setFzForm(f=>({...f,kennzeichen:v}))} placeholder="B-VB 123"/>
              <div className="flex gap-2">
                <Btn onClick={()=>setShowFzForm(false)}>Abbrechen</Btn>
                <Btn teal onClick={()=>{kal.saveFahrzeuge([...kal.fahrzeuge,{...fzForm,id:`F${Date.now()}`}]);setShowFzForm(false)}}>Speichern</Btn>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {kal.fahrzeuge.map(f=>{
              const aktuell=buchungen.find(b=>b.fahrzeugId===f.id&&b.von<=heute&&b.bis>=heute)
              return(
                <div key={f.id} className={clsx('rounded-2xl border p-4',aktuell?'border-rose-200 bg-rose-50':'border-slate-200 bg-slate-50')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🚗</span>
                      <div><div className="font-bold text-slate-900">{f.name}</div><div className="text-xs font-mono text-slate-500">{f.kennzeichen}</div></div>
                    </div>
                    <Badge label={aktuell?'🔴 Belegt':'🟢 Frei'} className={aktuell?'bg-rose-100 text-rose-700 border-rose-300 text-xs':'bg-emerald-100 text-emerald-700 border-emerald-300 text-xs'}/>
                  </div>
                  {aktuell&&<div className="text-xs text-rose-700 mt-2">Gebucht von {aktuell.mitarbeiterName} bis {fmtDate(aktuell.bis)}{aktuell.ziel?` — ${aktuell.ziel}`:''}</div>}
                </div>
              )
            })}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Nächste Buchungen</h3>
          {buchungen.filter(b=>b.bis>=heute).sort((a,b)=>a.von.localeCompare(b.von)).slice(0,10).map(b=>(
            <div key={b.id} className="flex items-center gap-3 border-b border-slate-50 py-3 last:border-0">
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">{b.fahrzeugName}</div>
                <div className="text-xs text-slate-500">{b.mitarbeiterName} · {fmtDate(b.von)}{b.von!==b.bis?` – ${fmtDate(b.bis)}`:''}</div>
                {b.ziel&&<div className="text-xs text-slate-400">📍 {b.ziel}</div>}
              </div>
              <div className={clsx('w-2.5 h-2.5 rounded-full',b.von<=heute&&b.bis>=heute?'bg-rose-500':'bg-emerald-400')}/>
            </div>
          ))}
          {buchungen.filter(b=>b.bis>=heute).length===0&&<div className="text-center py-8 text-slate-400 text-sm">Keine bevorstehenden Buchungen</div>}
        </div>
      </div>
    )
  }

  // ── DETAIL ──
  function DetailPanel(){
    if(!detailEreignis)return null
    const e=detailEreignis
    const f=EREIGNIS_FARBEN[e.typ]
    const istAntrag=e.typ==='urlaub'&&e.genehmigungsStatus==='beantragt'
    const headerColors:Record<string,string>={urlaub_genehmigt:'bg-emerald-600',urlaub:'bg-amber-600',krankenstand:'bg-rose-600',firmenevent:'bg-pink-600',feiertag:'bg-orange-500',auto_buchung:'bg-blue-600',termin:'bg-slate-600',zeitausgleich:'bg-sky-600',homeoffice:'bg-teal-600',dienstreise:'bg-indigo-600',sonderurlaub:'bg-violet-600'}
    return(
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={()=>{setDetailEreignis(null);setAblehnungsGrund('')}}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md" onClick={ev=>ev.stopPropagation()}>
          <div className={clsx('rounded-t-3xl px-7 py-6 text-white',headerColors[e.typ]||'bg-teal-700')}>
            <div className="flex items-start justify-between mb-2">
              <div className="text-xs uppercase tracking-widest text-white/70">{EREIGNIS_LABELS[e.typ]}</div>
              <button onClick={()=>setDetailEreignis(null)} className="text-white/70 hover:text-white cursor-pointer bg-transparent border-none text-xl">✕</button>
            </div>
            <h2 className="text-2xl font-bold">{e.titel}</h2>
            <div className="text-white/80 mt-1">{e.mitarbeiterName||'Alle Mitarbeiter'}</div>
            <div className="text-white/70 text-sm mt-1">
              {fmtDate(e.von)}{e.von!==e.bis?` – ${fmtDate(e.bis)}`:''}
              {['urlaub','urlaub_genehmigt','krankenstand'].includes(e.typ)?` · ${arbeitstageZwischen(e.von,e.bis)} Arbeitstage`:''}
            </div>
          </div>
          <div className="px-7 py-5 space-y-3">
            {e.ort&&<div className="text-sm text-slate-600">📍 {e.ort}</div>}
            {e.fahrzeugName&&<div className="text-sm text-slate-600">🚗 {e.fahrzeugName}{e.ziel?` → ${e.ziel}`:''}</div>}
            {e.pflichttermin&&<Badge label="⚠️ Pflichttermin" className="text-xs bg-rose-50 text-rose-700 border-rose-200"/>}
            {e.teilnehmer.length>0&&<div className="text-sm text-slate-600">👥 {e.teilnehmer.map(id=>mav.mitarbeiter.find(m=>m.id===id)?.vorname||id).join(', ')}</div>}
            {e.notizen&&<div className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3">{e.notizen}</div>}
            {e.genehmigungsStatus&&e.typ!=='feiertag'&&(
              <Badge label={GENEHMIGUNGS_LABELS[e.genehmigungsStatus]}
                className={e.genehmigungsStatus==='genehmigt'?'bg-emerald-50 text-emerald-700 border-emerald-200 text-xs':e.genehmigungsStatus==='abgelehnt'?'bg-rose-50 text-rose-700 border-rose-200 text-xs':'bg-amber-50 text-amber-700 border-amber-200 text-xs'}/>
            )}
            {e.genehmigtVon&&<div className="text-xs text-slate-400">Genehmigt von {e.genehmigtVon}{e.genehmigtAm?` am ${fmtDate(e.genehmigtAm)}`:''}</div>}
            {e.ablehnungsGrund&&<div className="text-sm text-rose-700 bg-rose-50 rounded-xl px-4 py-3">Ablehnungsgrund: {e.ablehnungsGrund}</div>}
            {canApprove&&istAntrag&&(
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="text-sm font-bold text-slate-700">Urlaubsantrag bearbeiten</div>
                <button onClick={()=>{kal.genehmige(e.id,user!.name);setDetailEreignis(null)}} className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white cursor-pointer border-none hover:bg-emerald-700">✓ Urlaub genehmigen</button>
                <input value={ablehnungsGrund} onChange={ev=>setAblehnungsGrund(ev.target.value)} placeholder="Ablehnungsgrund (optional) ..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"/>
                <button onClick={()=>{kal.lehneAb(e.id,ablehnungsGrund);setDetailEreignis(null);setAblehnungsGrund('')}} className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 cursor-pointer hover:bg-rose-100">✕ Ablehnen</button>
              </div>
            )}
            {e.typ!=='feiertag'&&(
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                {(isGF||e.mitarbeiterId===currentMaId)&&(
                  <button onClick={()=>{setDetailEreignis(null);setEditEreignis(e);setShowForm(true)}} className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">✏️ Bearbeiten</button>
                )}
                {(isGF||e.mitarbeiterId===currentMaId)&&(
                  <button onClick={()=>{kal.deleteEreignis(e.id);setDetailEreignis(null)}} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 cursor-pointer hover:bg-rose-100">Löschen</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return(
    <div className="flex min-h-screen">
      <Sidebar/>
      <style>{`@media print{aside,nav,.no-print{display:none!important}main{padding:0!important}}`}</style>
      <main className="flex-1 overflow-auto p-8">
        {showForm&&<EreignisForm initial={editEreignis||undefined} defaultDatum={defaultDatum} mitarbeiterId={currentMaId} mitarbeiterName={user?.name} isGF={isGF} mitarbeiterListe={mitarbeiterListe} fahrzeuge={kal.fahrzeuge} onSave={data=>{kal.createEreignis(data);setShowForm(false);setEditEreignis(null)}} onClose={()=>{setShowForm(false);setEditEreignis(null)}}/>}
        {detailEreignis&&<DetailPanel/>}

        {/* HEADER */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm no-print">
          <div className="flex items-start justify-between gap-6 mb-5">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-2">VBetreut · ERP</div>
              <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-2">Mitarbeiter-Kalender</h1>
              <p className="text-base text-slate-500">Urlaub, Abwesenheiten, Termine, Fahrzeuge — wer wann wo ist.</p>
            </div>
            <div className="flex gap-3 flex-shrink-0 pt-1">
              <button onClick={()=>{setEditEreignis(null);setShowForm(true)}} className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-bold text-white cursor-pointer border-none hover:bg-teal-800">+ Eintragen</button>
              {!isGF&&<button onClick={()=>{setEditEreignis(null);setShowForm(true)}} className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-800 cursor-pointer hover:bg-amber-100">📝 Urlaub beantragen</button>}
            </div>
          </div>

          {/* Offene Anträge Alert */}
          {canApprove&&offeneAntraege.length>0&&(
            <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-300 px-5 py-4 flex items-center justify-between">
              <span className="font-bold text-amber-800">⏳ {offeneAntraege.length} offene{offeneAntraege.length>1?'r':''} Urlaubsantrag — {offeneAntraege.map(e=>`${e.mitarbeiterName.split(' ')[0]} (${fmtDate(e.von)}–${fmtDate(e.bis)})`).join(', ')}</span>
              <button onClick={()=>setAnsicht('liste')} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-amber-700">Prüfen →</button>
            </div>
          )}

          {/* Filter + Navigation */}
          <div className="flex items-center gap-3 flex-wrap">
            <select value={filterMaId} onChange={e=>setFilterMaId(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700">
              <option value="alle">👥 Alle Mitarbeiter</option>
              {mitarbeiterListe.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <button onClick={prev} className="w-7 h-7 rounded-full hover:bg-slate-100 cursor-pointer border-none bg-transparent text-slate-600 font-bold">‹</button>
              <span className="text-sm font-bold text-slate-900 min-w-40 text-center">{ansicht==='jahr'?datum.jahr:`${MONATE[datum.monat]} ${datum.jahr}`}</span>
              <button onClick={next} className="w-7 h-7 rounded-full hover:bg-slate-100 cursor-pointer border-none bg-transparent text-slate-600 font-bold">›</button>
              <button onClick={()=>setDatum({jahr:now.getFullYear(),monat:now.getMonth()})} className="ml-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 cursor-pointer hover:bg-slate-50">Heute</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 flex-wrap">
            {([['monat','📅 Monat'],['jahr','📊 Jahresübersicht'],['liste','≡ Liste'],['urlaub','🏖️ Urlaubskonten'],['fahrzeuge','🚗 Fahrzeuge']] as const).map(([v,l])=>(
              <button key={v} onClick={()=>setAnsicht(v)} className={clsx('rounded-2xl px-4 py-2.5 text-sm font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5',ansicht===v?'bg-slate-900 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {l}
                {v==='liste'&&offeneAntraege.length>0&&canApprove&&<span className="bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-xs">{offeneAntraege.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Legende */}
        {ansicht==='monat'&&(
          <div className="mt-4 flex gap-2 flex-wrap no-print">
            {(Object.entries(EREIGNIS_LABELS) as [EreignisTyp,string][]).filter(([k])=>k!=='feiertag').map(([k,l])=>{const f=EREIGNIS_FARBEN[k];return(
              <div key={k} className={clsx('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border',f.bg,f.text,f.border)}>
                <div className="w-2 h-2 rounded-full" style={{backgroundColor:f.dot}}/>{l}
              </div>
            )})}
          </div>
        )}

        {/* CONTENT */}
        <div className="mt-5">
          {ansicht==='monat'&&<MonatsView/>}
          {ansicht==='jahr'&&<JahresView/>}
          {ansicht==='liste'&&<ListenView/>}
          {ansicht==='urlaub'&&<UrlaubView/>}
          {ansicht==='fahrzeuge'&&<FahrzeugView/>}
        </div>
      </main>
    </div>
  )
}
