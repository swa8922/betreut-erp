'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import Sidebar from '@/components/Sidebar'
import { generiereGeorgePain001, downloadXml, berechneHonorarbetrag } from '@/lib/george-export'
import clsx from 'clsx'

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const heute = () => new Date().toISOString().split('T')[0]
function fmtDate(d: string) {
  if (!d) return '–'
  try { return new Date(d + 'T12:00:00').toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return d }
}
function fmtEur(n: number) {
  return (n || 0).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function daysUntil(d: string) {
  if (!d) return null
  return Math.ceil((new Date(d + 'T12:00:00').getTime() - Date.now()) / 86400000)
}

const NOTEN_STATUS: Record<string, { label: string; css: string }> = {
  entwurf:   { label: '📝 Entwurf',   css: 'bg-slate-100 text-slate-600 border-slate-200' },
  bereit:    { label: '✅ Bereit',     css: 'bg-blue-50 text-blue-700 border-blue-200' },
  versendet: { label: '📧 Versendet', css: 'bg-violet-50 text-violet-700 border-violet-200' },
  bezahlt:   { label: '💚 Bezahlt',   css: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

interface HNote {
  id: string; rechnung_nr: string; betreuerin_id: string; betreuerin_name: string
  betreuerin_iban: string; betreuerin_bic: string; klient_name: string; einsatz_id: string
  von: string; bis: string; tage: number; tagessatz: number
  betrag_brutto: number; status: string; faellig_am: string; erstellt_am: string; data: any
}

interface Einz {
  id: string; betreuerinId: string; betreuerinName: string; klientName: string
  von: string; bis: string; turnusTage: number; tagessatz: number; honorar_abgerechnet: boolean
}

export default function AuszahlungenPage() {
  const { user, loading } = useAuth()
  const [tab, setTab] = useState<'vorschlaege' | 'noten' | 'export'>('vorschlaege')
  const [noten, setNoten] = useState<HNote[]>([])
  const [einsaetze, setEinsaetze] = useState<Einz[]>([])
  const [betreuerinnen, setBetreuerinnen] = useState<any[]>([])
  const [laden, setLaden] = useState(true)
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set())
  const [erstelleLoading, setErstelleLoading] = useState('')
  const [filterBis, setFilterBis] = useState('')

  const defaultBis = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const grenzdatum = filterBis || defaultBis

  useEffect(() => {
    if (!user) return
    Promise.all([
      fetch('/api/honorarnoten').then(r => r.json()).catch(() => []),
      fetch('/api/db/einsaetze').then(r => r.json()).catch(() => []),
      fetch('/api/db/betreuerinnen').then(r => r.json()).catch(() => []),
    ]).then(([n, e, b]) => {
      setNoten(Array.isArray(n) ? n : [])
      setEinsaetze((Array.isArray(e) ? e : []).filter((x: any) => x.id).map((x: any) => {
        const d = x.data || {}
        return {
          id: x.id,
          betreuerinId: x.betreuerinId || x.betreuerin_id || d.betreuerinId || '',
          betreuerinName: x.betreuerinName || x.betreuerin_name || d.betreuerinName || '',
          klientName: x.klientName || x.klient_name || d.klientName || '',
          von: x.von || d.von || '',
          bis: x.bis || d.bis || '',
          turnusTage: Number(x.turnusTage || x.turnus_tage || d.turnusTage || 28),
          tagessatz: Number(x.tagessatz || d.tagessatz || 80),
          honorar_abgerechnet: x.honorar_abgerechnet === true,
        } as Einz
      }))
      setBetreuerinnen((Array.isArray(b) ? b : []).map((x: any) => ({ ...x, ...(x.data || {}) })))
      setLaden(false)
    })
  }, [user])

  const vorschlaege = useMemo(() => {
    const heuteStr = heute()
    return einsaetze.filter(e => {
      if (!e.von || e.von > heuteStr) return false
      if (e.honorar_abgerechnet) return false
      if (noten.find(n => n.einsatz_id === e.id)) return false
      if (!e.betreuerinName) return false
      if (e.bis && e.bis > grenzdatum) return false
      return true
    }).sort((a, b) => (a.bis || '9999').localeCompare(b.bis || '9999'))
  }, [einsaetze, noten, grenzdatum])

  async function erstelleNote(e: Einz) {
    setErstelleLoading(e.id)
    const betreuerin = betreuerinnen.find(b => b.id === e.betreuerinId)
    const { tage, betrag } = berechneHonorarbetrag(e.von, e.bis, e.tagessatz)
    const jahr = new Date().getFullYear()
    const nr = `HN-${jahr}-${String(noten.length + 1).padStart(3, '0')}`
    const note: HNote = {
      id: uid(), rechnung_nr: nr,
      betreuerin_id: e.betreuerinId, betreuerin_name: e.betreuerinName,
      betreuerin_iban: betreuerin?.iban || '', betreuerin_bic: betreuerin?.bic || '',
      klient_name: e.klientName, einsatz_id: e.id,
      von: e.von, bis: e.bis,
      tage: tage || e.turnusTage, tagessatz: e.tagessatz,
      betrag_brutto: betrag || e.turnusTage * e.tagessatz,
      status: 'bereit',
      faellig_am: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      erstellt_am: new Date().toISOString(),
      data: {},
    }
    await fetch('/api/honorarnoten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note) })
    await fetch(`/api/db/einsaetze?id=${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ honorar_abgerechnet: true }) }).catch(() => {})
    setNoten(prev => [note, ...prev])
    setEinsaetze(prev => prev.map(x => x.id === e.id ? { ...x, honorar_abgerechnet: true } : x))
    setErstelleLoading('')
  }

  function druckeNote(n: HNote) {
    const betreuerin = betreuerinnen.find(b => b.id === n.betreuerin_id)
    const adr = [betreuerin?.hauptwohnsitzStrasse || betreuerin?.strasse, [betreuerin?.hauptwohnsitzPlz || betreuerin?.plz, betreuerin?.hauptwohnsitzOrt || betreuerin?.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${n.rechnung_nr}</title>
<style>@page{size:A4;margin:15mm 20mm}body{font-family:Arial,sans-serif;font-size:11pt;color:#1e293b;margin:0}.h{display:flex;justify-content:space-between;margin-bottom:10mm}.fn h1{font-size:20pt;color:#0f766e;margin:0 0 3px}.fn p{font-size:9pt;color:#64748b;margin:2px 0}.nr{text-align:right}.nr .typ{font-size:16pt;font-weight:bold;color:#0f766e}table{width:100%;border-collapse:collapse;margin:6mm 0}thead tr{background:#0f766e;color:#fff}th,td{padding:7px 10px;font-size:10pt}th{text-align:left}td{border-bottom:1px solid #f1f5f9}.ges{text-align:right;margin-top:4mm;font-size:13pt;font-weight:bold;color:#0f766e;border-top:2px solid #0f766e;padding-top:4px}.bank{margin-top:8mm;padding:4mm;background:#f8fafc;border:1px solid #e2e8f0}.bank h3{color:#0f766e;margin:0 0 3mm}.fuss{margin-top:15mm;padding-top:4mm;border-top:1px solid #e2e8f0;font-size:8pt;color:#94a3b8;display:flex;justify-content:space-between}.badge{display:inline-block;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;padding:2px 8px;border-radius:20px;font-size:9pt;margin-top:4mm}</style>
</head><body>
<div class="h"><div class="fn"><h1>VBetreut GmbH</h1><p>Krüzastraße 4 · 6912 Hörbranz</p><p>Tel: +43 670 205 1951 · info@vbetreut.at</p><p>USt-ID: ATU81299827</p></div>
<div class="nr"><div class="typ">Honorarnote</div><div>${n.rechnung_nr}</div><div style="font-size:9pt;color:#64748b;margin-top:4px">Datum: ${fmtDate(heute())}</div><div style="font-size:9pt;color:#64748b">Fällig: ${fmtDate(n.faellig_am)}</div></div></div>
<div style="margin-bottom:8mm;font-size:10pt"><div style="font-size:8pt;color:#94a3b8;text-transform:uppercase;margin-bottom:3px">Empfängerin</div><strong>${n.betreuerin_name}</strong>${adr ? '<br>' + adr : ''}</div>
<table><thead><tr><th>Beschreibung</th><th style="text-align:center">Tage</th><th style="text-align:right">Tagessatz</th><th style="text-align:right">Gesamt</th></tr></thead>
<tbody><tr><td>24h-Personenbetreuung bei ${n.klient_name}<br><span style="font-size:9pt;color:#64748b">${fmtDate(n.von)} – ${fmtDate(n.bis)}</span></td><td style="text-align:center">${n.tage}</td><td style="text-align:right">${fmtEur(n.tagessatz)}</td><td style="text-align:right"><strong>${fmtEur(n.betrag_brutto)}</strong></td></tr></tbody></table>
<div class="ges">Gesamtbetrag: ${fmtEur(n.betrag_brutto)}</div>
<div class="badge">Kleinunternehmer gem. § 6 Abs. 1 Z 27 UStG — keine USt ausgewiesen</div>
<div class="bank"><h3>💳 Zahlungsverbindung</h3><table style="border:none;margin:0"><tr><td style="border:none;padding:2px 10px 2px 0;font-size:9pt;color:#64748b">Kontoinhaber</td><td style="border:none"><strong>${n.betreuerin_name}</strong></td></tr><tr><td style="border:none;padding:2px 10px 2px 0;font-size:9pt;color:#64748b">IBAN</td><td style="border:none"><strong>${n.betreuerin_iban || '⚠️ fehlt'}</strong></td></tr>${n.betreuerin_bic ? '<tr><td style="border:none;padding:2px 10px 2px 0;font-size:9pt;color:#64748b">BIC</td><td style="border:none">' + n.betreuerin_bic + '</td></tr>' : ''}<tr><td style="border:none;padding:2px 10px 2px 0;font-size:9pt;color:#64748b">Verwendungszweck</td><td style="border:none">${n.rechnung_nr}</td></tr></table></div>
<div class="fuss"><span>VBetreut GmbH · Krüzastraße 4 · 6912 Hörbranz · GF: Stefan Wagner, Margot Schön</span><span>Dornbirner Sparkasse · AT06 2060 2000 0064 8568</span></div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script></body></html>`)
    w.document.close()
  }

  function serienDruck(ids: string[]) {
    const liste = noten.filter(n => ids.includes(n.id))
    if (!liste.length) { alert('Zuerst Honorarnoten erstellen'); return }
    liste.forEach((n, i) => setTimeout(() => druckeNote(n), i * 900))
  }

  function georgeExport(ids: string[]) {
    const liste = noten.filter(n => ids.includes(n.id) && n.betreuerin_iban)
    if (!liste.length) { alert('Keine Honorarnoten mit IBAN ausgewählt'); return }
    const xml = generiereGeorgePain001({
      positionen: liste.map(n => ({ id: n.id, betreuerinName: n.betreuerin_name, iban: n.betreuerin_iban, bic: n.betreuerin_bic, betrag: n.betrag_brutto, verwendungszweck: n.rechnung_nr, rechnungNr: n.rechnung_nr })),
      ausfuehrungsDatum: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      absenderName: 'VBetreut GmbH', absenderIban: 'AT062060200000648568', absenderBic: 'DOSPAT2D',
    })
    downloadXml(xml, `VBetreut_Honorare_${heute()}.xml`)
  }

  async function alsBezahlt(id: string) {
    await fetch(`/api/honorarnoten?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'bezahlt', bezahlt_am: heute() }) })
    setNoten(prev => prev.map(n => n.id === id ? { ...n, status: 'bezahlt' } : n))
  }

  if (loading || laden) return <div className="flex min-h-screen"><Sidebar /><main className="flex-1 flex items-center justify-center text-slate-400">Laden...</main></div>
  if (!user) return null

  const offenBetrag = noten.filter(n => n.status !== 'bezahlt').reduce((s, n) => s + n.betrag_brutto, 0)
  const bereite = noten.filter(n => n.status === 'bereit' && n.betreuerin_iban)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">VBETREUT · ERP</div>
          <h1 className="text-3xl font-bold text-slate-900">💶 Auszahlungen</h1>
          <p className="text-slate-500 mt-1">Honorarnoten · Seriendruck · George XML Export</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-bold text-amber-500 uppercase mb-1">Vorschläge</div>
            <div className="text-2xl font-bold text-amber-700">{vorschlaege.length}</div>
            <div className="text-xs text-amber-600">bis {fmtDate(grenzdatum)}</div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-xs font-bold text-blue-500 uppercase mb-1">Offen</div>
            <div className="text-2xl font-bold text-blue-700">{fmtEur(offenBetrag)}</div>
            <div className="text-xs text-blue-600">{noten.filter(n => n.status !== 'bezahlt').length} Noten</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs font-bold text-emerald-500 uppercase mb-1">George-bereit</div>
            <div className="text-2xl font-bold text-emerald-700">{bereite.length}</div>
            <div className="text-xs text-emerald-600">{fmtEur(bereite.reduce((s, n) => s + n.betrag_brutto, 0))}</div>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <div className="text-xs font-bold text-rose-400 uppercase mb-1">Ohne IBAN</div>
            <div className="text-2xl font-bold text-rose-600">{betreuerinnen.filter(b => !b.iban).length}</div>
            <div className="text-xs text-rose-500">Betreuerinnen</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5">
          {([['vorschlaege', `💡 Vorschläge (${vorschlaege.length})`], ['noten', `📋 Honorarnoten (${noten.length})`], ['export', '🏦 George Export']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={clsx('text-sm px-5 py-2 rounded-full border cursor-pointer font-medium transition-all',
                tab === k ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>
              {l}
            </button>
          ))}
        </div>

        {/* VORSCHLÄGE */}
        {tab === 'vorschlaege' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Abreise bis:</span>
                <input type="date" value={filterBis || defaultBis} onChange={e => setFilterBis(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-teal-400" />
              </div>
              <div className="flex-1" />
              {vorschlaege.length > 0 && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input type="checkbox"
                      checked={ausgewaehlt.size === vorschlaege.length}
                      onChange={ev => setAusgewaehlt(ev.target.checked ? new Set(vorschlaege.map(v => v.id)) : new Set())}
                      className="accent-teal-600 w-4 h-4" />
                    <span className="font-semibold text-slate-600">Alle ({vorschlaege.length})</span>
                  </label>
                  {ausgewaehlt.size > 0 && (
                    <div className="flex gap-2">
                      <button onClick={async () => { for (const e of vorschlaege.filter(v => ausgewaehlt.has(v.id))) await erstelleNote(e); setAusgewaehlt(new Set()) }}
                        className="text-xs px-4 py-2 rounded-xl bg-teal-700 text-white cursor-pointer border-none font-bold hover:bg-teal-800">
                        📝 Alle erstellen ({ausgewaehlt.size})
                      </button>
                      <button onClick={() => serienDruck(noten.filter(n => ausgewaehlt.has(n.einsatz_id)).map(n => n.id))}
                        className="text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-600 cursor-pointer hover:bg-slate-50">
                        🖨️ Seriendruck
                      </button>
                      <button onClick={() => georgeExport(noten.filter(n => ausgewaehlt.has(n.einsatz_id)).map(n => n.id))}
                        className="text-xs px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 cursor-pointer hover:bg-emerald-100">
                        🏦 George Export
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {vorschlaege.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-16 text-center">
                <div className="text-5xl mb-4">✅</div>
                <div className="text-xl font-bold text-slate-600 mb-2">Keine Abreisen bis {fmtDate(grenzdatum)}</div>
                <div className="text-slate-400">Datum nach oben anpassen um mehr zu sehen</div>
              </div>
            ) : vorschlaege.map(e => {
              const tage = daysUntil(e.bis)
              const { tage: anzTage, betrag } = berechneHonorarbetrag(e.von, e.bis, e.tagessatz)
              const hatNote = noten.some(n => n.einsatz_id === e.id)
              return (
                <div key={e.id} className="rounded-2xl border border-amber-200 bg-white p-4 flex items-center gap-4">
                  <input type="checkbox" checked={ausgewaehlt.has(e.id)}
                    onChange={ev => { const s = new Set(ausgewaehlt); ev.target.checked ? s.add(e.id) : s.delete(e.id); setAusgewaehlt(s) }}
                    className="accent-teal-600 w-4 h-4 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold border bg-amber-100 text-amber-700 border-amber-200">
                        {tage === null ? '' : tage < 0 ? `${Math.abs(tage)}d überfällig` : tage === 0 ? 'Heute' : `Abreise in ${tage}d`}
                      </span>
                      {!betreuerinnen.find(b => b.id === e.betreuerinId)?.iban && <span className="text-xs text-rose-500">⚠️ IBAN fehlt</span>}
                      {hatNote && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">✓ Note erstellt</span>}
                    </div>
                    <div className="font-bold text-slate-900">{e.betreuerinName}</div>
                    <div className="text-sm text-slate-500">{e.klientName} · {fmtDate(e.von)} – {fmtDate(e.bis)}</div>
                    <div className="text-sm font-semibold text-teal-700 mt-1">{anzTage || e.turnusTage} Tage × {fmtEur(e.tagessatz)} = {fmtEur(betrag || e.turnusTage * e.tagessatz)}</div>
                  </div>
                  {!hatNote ? (
                    <button onClick={() => erstelleNote(e)} disabled={erstelleLoading === e.id}
                      className="rounded-xl bg-teal-700 text-white font-bold text-sm px-5 py-2.5 cursor-pointer border-none hover:bg-teal-800 disabled:opacity-50 flex-shrink-0">
                      {erstelleLoading === e.id ? '⏳' : '📝 Note erstellen'}
                    </button>
                  ) : (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => { const n = noten.find(x => x.einsatz_id === e.id); if (n) druckeNote(n) }}
                        className="rounded-xl border border-slate-200 text-sm px-3 py-2 cursor-pointer hover:bg-slate-50">🖨️</button>
                      <button onClick={() => { const n = noten.find(x => x.einsatz_id === e.id); if (n) georgeExport([n.id]) }}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-3 py-2 cursor-pointer hover:bg-emerald-100">🏦</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* HONORARNOTEN */}
        {tab === 'noten' && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {ausgewaehlt.size > 0 && (
              <div className="px-5 py-3 bg-teal-50 border-b border-teal-100 flex items-center gap-3">
                <span className="text-sm font-semibold text-teal-700">{ausgewaehlt.size} ausgewählt</span>
                <button onClick={() => serienDruck([...ausgewaehlt])}
                  className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 cursor-pointer hover:bg-white font-medium">
                  🖨️ Seriendruck
                </button>
                <button onClick={() => georgeExport([...ausgewaehlt])}
                  className="text-xs px-3 py-1.5 rounded-xl bg-emerald-700 text-white cursor-pointer border-none font-bold hover:bg-emerald-800">
                  🏦 George XML
                </button>
                <button onClick={() => setAusgewaehlt(new Set())} className="text-xs text-slate-400 cursor-pointer bg-transparent border-none ml-auto">✕</button>
              </div>
            )}
            {noten.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-5xl mb-3">📋</div>
                <div className="font-semibold text-slate-600 mb-1">Noch keine Honorarnoten</div>
                <div className="text-sm">Im Tab "Vorschläge" erstellen</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                <div className="px-5 py-3 flex items-center gap-3">
                  <input type="checkbox"
                    checked={ausgewaehlt.size === noten.length && noten.length > 0}
                    onChange={ev => setAusgewaehlt(ev.target.checked ? new Set(noten.map(n => n.id)) : new Set())}
                    className="accent-teal-600 w-4 h-4" />
                  <span className="text-xs text-slate-400">Alle auswählen</span>
                </div>
                {noten.map(n => (
                  <div key={n.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
                    <input type="checkbox" checked={ausgewaehlt.has(n.id)}
                      onChange={ev => { const s = new Set(ausgewaehlt); ev.target.checked ? s.add(n.id) : s.delete(n.id); setAusgewaehlt(s) }}
                      className="accent-teal-600 w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{n.rechnung_nr}</span>
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full border', NOTEN_STATUS[n.status]?.css || '')}>
                          {NOTEN_STATUS[n.status]?.label || n.status}
                        </span>
                        {!n.betreuerin_iban && <span className="text-xs text-rose-500">⚠️ IBAN fehlt</span>}
                      </div>
                      <div className="text-sm text-slate-500 mt-0.5">{n.betreuerin_name} · {n.klient_name} · {fmtDate(n.von)} – {fmtDate(n.bis)}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-slate-900">{fmtEur(n.betrag_brutto)}</div>
                      <div className="text-xs text-slate-400">{n.tage} Tage</div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => druckeNote(n)} className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 cursor-pointer hover:bg-slate-100">🖨️</button>
                      <button onClick={() => georgeExport([n.id])} className="text-xs px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 cursor-pointer hover:bg-emerald-100">🏦</button>
                      {n.status !== 'bezahlt' && <button onClick={() => alsBezahlt(n.id)} className="text-xs px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 cursor-pointer hover:bg-emerald-100">✓</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* GEORGE EXPORT */}
        {tab === 'export' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="font-bold text-emerald-900 text-lg mb-2">🏦 George Business — Sammelüberweisung</div>
              <div className="text-sm text-emerald-700 mb-4"><strong>pain.001.001.03 XML</strong> — direkter Import in George Business</div>
              <ol className="text-xs text-emerald-600 space-y-1 mb-4 list-decimal list-inside">
                <li>Honorarnoten im Tab auswählen → "🏦 George XML"</li>
                <li>George Business → Neuer Auftrag → Datenimport → XML hochladen</li>
                <li>Alle Überweisungen auf einmal freigeben</li>
              </ol>
              {bereite.length > 0 && (
                <button onClick={() => georgeExport(bereite.map(n => n.id))}
                  className="rounded-xl bg-emerald-700 text-white font-bold px-5 py-2.5 cursor-pointer border-none hover:bg-emerald-800">
                  🏦 Alle bereiten exportieren ({bereite.length} · {fmtEur(bereite.reduce((s, n) => s + n.betrag_brutto, 0))})
                </button>
              )}
            </div>
            {betreuerinnen.filter(b => !b.iban).length > 0 && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <div className="font-semibold text-rose-700 mb-2">⚠️ Betreuerinnen ohne IBAN — in Stammdaten ergänzen</div>
                {betreuerinnen.filter(b => !b.iban).map(b => (
                  <div key={b.id} className="text-sm text-rose-600">• {b.nachname} {b.vorname}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
