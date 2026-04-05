'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import Sidebar from '@/components/Sidebar'
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

const STATUS: Record<string, { label: string; css: string }> = {
  entwurf:    { label: 'Entwurf',    css: 'bg-slate-100 text-slate-600 border-slate-200' },
  erstellt:   { label: 'Erstellt',   css: 'bg-blue-50 text-blue-700 border-blue-200' },
  versendet:  { label: 'Versendet',  css: 'bg-violet-50 text-violet-700 border-violet-200' },
  bezahlt:    { label: '✓ Bezahlt',  css: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  mahnung:    { label: 'Mahnung',    css: 'bg-orange-50 text-orange-700 border-orange-200' },
  storniert:  { label: 'Storniert',  css: 'bg-rose-50 text-rose-600 border-rose-200' },
}

interface Rechnung {
  id: string
  dokument_nr: string
  klient_id: string
  klient_name: string
  betreuerin_name: string
  einsatz_id: string
  rechnungs_datum: string
  zahlungsziel: string
  summe_brutto: number
  offener_betrag: number
  status: string
  typ: string
  erstellt_am: string
  data: any
}

interface Einsatz {
  id: string
  klientId: string
  klientName: string
  betreuerinName: string
  von: string
  bis: string
  tagessatz: number
  gesamtbetrag: number
  turnusTage: number
  kunden_abgerechnet: boolean
  rechnungsId: string
}

export default function RechnungenPage() {
  const { user, loading } = useAuth()
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([])
  const [einsaetze, setEinsaetze] = useState<Einsatz[]>([])
  const [laden, setLaden] = useState(true)
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set())
  const [erstelleLoading, setErstelleLoading] = useState('')
  const [statusFilter, setStatusFilter] = useState('alle')
  const [suche, setSuche] = useState('')
  const [filterVon, setFilterVon] = useState('')
  const [filterBis, setFilterBis] = useState('')
  const [filterKlient, setFilterKlient] = useState('')
  const [sevdeskExporting, setSevdeskExporting] = useState(false)
  const [sevdeskStatus, setSevdeskStatus] = useState<string>('')

  useEffect(() => {
    if (!user) return
    Promise.all([
      fetch('/api/db/finanzen_dokumente').then(r => r.json()).catch(() => []),
      fetch('/api/db/einsaetze').then(r => r.json()).catch(() => []),
    ]).then(([docs, einz]) => {
      const rechnDocs = (Array.isArray(docs) ? docs : [])
        .filter((d: any) => ['rechnung', 'storno', 'gutschrift'].includes(d.typ || d.data?.typ))
      setRechnungen(rechnDocs.map(normalisiereRechnung))
      setEinsaetze((Array.isArray(einz) ? einz : []).map(normalisiereEinsatz))
      setLaden(false)
    })
  }, [user])

  function normalisiereRechnung(d: any): Rechnung {
    const dd = d.data || {}
    return {
      id: d.id || '',
      dokument_nr: d.dokument_nr || dd.dokumentNr || '',
      klient_id: d.klient_id || dd.klientId || '',
      klient_name: d.klient_name || dd.klientName || '',
      betreuerin_name: d.betreuerin_name || dd.betreuerinName || '',
      einsatz_id: d.einsatz_id || dd.einsatzId || '',
      rechnungs_datum: d.rechnungs_datum || dd.rechnungsDatum || '',
      zahlungsziel: d.zahlungsziel || dd.zahlungsziel || '',
      summe_brutto: Number(d.summe_brutto || dd.summeBrutto || 0),
      offener_betrag: Number(d.offener_betrag || dd.offenerBetrag || d.summe_brutto || 0),
      status: d.status || dd.status || 'entwurf',
      typ: d.typ || dd.typ || 'rechnung',
      erstellt_am: d.erstellt_am || dd.erstelltAm || '',
    }
  }

  function normalisiereEinsatz(e: any): Einsatz {
    const d = e.data || {}
    return {
      id: e.id || '',
      klientId: e.klientId || e.klient_id || d.klientId || '',
      klientName: e.klientName || e.klient_name || d.klientName || '',
      betreuerinName: e.betreuerinName || e.betreuerin_name || d.betreuerinName || '',
      von: e.von || d.von || '',
      bis: e.bis || d.bis || '',
      tagessatz: Number(e.tagessatz || d.tagessatz || 80),
      gesamtbetrag: Number(e.gesamtbetrag || d.gesamtbetrag || 0),
      turnusTage: Number(e.turnusTage || e.turnus_tage || d.turnusTage || 28),
      kunden_abgerechnet: e.kunden_abgerechnet === true,
      rechnungsId: e.rechnungsId || e.rechnungs_id || d.rechnungsId || '',
    }
  }

  // Vorschläge: Einsätze die begonnen haben, noch nicht verrechnet
  const vorschlaege = useMemo(() => {
    const heuteStr = heute()
    return einsaetze.filter(e => {
      if (!e.id || !e.von) return false
      if (e.von > heuteStr) return false
      if (e.kunden_abgerechnet) return false
      if (e.rechnungsId) return false
      if (rechnungen.find(r => r.einsatz_id === e.id)) return false
      if (!e.klientName) return false
      return true
    }).sort((a, b) => (a.von || '').localeCompare(b.von || ''))
  }, [einsaetze, rechnungen])

  // Gefilterte Rechnungen
  const gefiltertRechnungen = useMemo(() => {
    let list = [...rechnungen]
    if (statusFilter !== 'alle') list = list.filter(r => r.status === statusFilter)
    if (suche) {
      const q = suche.toLowerCase()
      list = list.filter(r => [r.dokument_nr, r.klient_name, r.betreuerin_name].join(' ').toLowerCase().includes(q))
    }
    if (filterKlient) list = list.filter(r => r.klient_name?.toLowerCase().includes(filterKlient.toLowerCase()))
    if (filterVon) list = list.filter(r => (r.rechnungs_datum || '') >= filterVon)
    if (filterBis) list = list.filter(r => (r.rechnungs_datum || '') <= filterBis)
    return list.sort((a, b) => (b.erstellt_am || '').localeCompare(a.erstellt_am || ''))
  }, [rechnungen, statusFilter, suche, filterKlient, filterVon, filterBis])

  const aktivFilter = statusFilter !== 'alle' || suche || filterKlient || filterVon || filterBis

  async function erstelleRechnung(e: Einsatz) {
    setErstelleLoading(e.id)
    const tage = (e.von && e.bis)
      ? Math.max(1, Math.round((new Date(e.bis + 'T12:00:00').getTime() - new Date(e.von + 'T12:00:00').getTime()) / 86400000) + 1)
      : e.turnusTage
    const betrag = tage * e.tagessatz

    // Rechnungsnummer
    const jahr = new Date().getFullYear()
    const laufNr = rechnungen.filter(r => r.dokument_nr.includes(`${jahr}`)).length + 1
    const nr = `RE-${jahr}-${String(laufNr).padStart(3, '0')}`
    const faellig = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]

    const dok = {
      id: uid(),
      dokument_nr: nr,
      typ: 'rechnung',
      status: 'erstellt',
      klient_id: e.klientId,
      klient_name: e.klientName,
      betreuerin_name: e.betreuerinName,
      einsatz_id: e.id,
      rechnungs_datum: heute(),
      zahlungsziel: faellig,
      summe_netto: betrag,
      summe_brutto: betrag,
      offener_betrag: betrag,
      erstellt_von: user?.name || 'System',
      erstellt_am: new Date().toISOString(),
      data: {
        positionen: [{
          bezeichnung: `24h-Personenbetreuung ${e.klientName}`,
          detail: `${fmtDate(e.von)} – ${fmtDate(e.bis)}`,
          menge: tage,
          einheit: 'Tage',
          einzelpreis: e.tagessatz,
          nettoBetrag: betrag,
          bruttoBetrag: betrag,
        }]
      }
    }

    await fetch('/api/db/finanzen_dokumente', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dok),
    })

    // Einsatz als abgerechnet markieren
    await fetch(`/api/db/einsaetze?id=${e.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kunden_abgerechnet: true, rechnungs_id: dok.id, abrechnung_status: 'abgerechnet' }),
    }).catch(() => {})

    setRechnungen(prev => [normalisiereRechnung(dok), ...prev])
    setEinsaetze(prev => prev.map(x => x.id === e.id ? { ...x, kunden_abgerechnet: true, rechnungsId: dok.id } : x))
    setErstelleLoading('')
  }

  async function sevdeskExport(ids: string[]) {
    setSevdeskExporting(true)
    setSevdeskStatus('Exportiere zu sevDesk...')
    try {
      const body = ids.length > 0 ? { rechnung_ids: ids } : { alle_offen: true }
      const res = await fetch('/api/sevdesk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) {
        if (data.exportiert > 0) {
          setSevdeskStatus(`✅ ${data.exportiert} Rechnung(en) zu sevDesk exportiert`)
        } else {
          // Zeige ersten Fehler aus Ergebnissen
          const ersterFehler = data.ergebnisse?.find((e: any) => !e.ok)?.fehler
          setSevdeskStatus(`❌ Export fehlgeschlagen: ${ersterFehler || data.fehler || 'Unbekannter Fehler'}`)
        }
      } else {
        setSevdeskStatus(`❌ ${data.fehler || 'Export fehlgeschlagen'}`)
      }
    } catch {
      setSevdeskStatus('❌ Verbindungsfehler')
    }
    setSevdeskExporting(false)
    setTimeout(() => setSevdeskStatus(''), 5000)
  }

  async function alleErstellen() {
    for (const e of vorschlaege) {
      await erstelleRechnung(e)
    }
  }

  async function statusSetzen(id: string, status: string) {
    await fetch(`/api/db/finanzen_dokumente?id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setRechnungen(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  function druckeRechnung(r: Rechnung) {
    const w = window.open('', '_blank')
    if (!w) return
    const positionen = r.data?.positionen || [{ bezeichnung: `Betreuung ${r.klient_name}`, menge: 28, einzelpreis: r.summe_brutto / 28, bruttoBetrag: r.summe_brutto }]
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${r.dokument_nr}</title>
<style>
@page{size:A4;margin:15mm 20mm}
body{font-family:Arial,sans-serif;font-size:11pt;color:#1e293b;margin:0}
.header{display:flex;justify-content:space-between;margin-bottom:10mm}
.firma h1{font-size:20pt;color:#0f766e;margin:0 0 3px}
.firma p{font-size:9pt;color:#64748b;margin:2px 0}
.nr-box{text-align:right}
.nr-box .typ{font-size:16pt;font-weight:bold;color:#0f766e}
.nr-box .nr{font-size:11pt;color:#475569}
.empf{margin-bottom:8mm;font-size:10pt;line-height:1.6}
.empf .lbl{font-size:8pt;color:#94a3b8;text-transform:uppercase;margin-bottom:3px}
table{width:100%;border-collapse:collapse;margin:6mm 0}
thead tr{background:#0f766e;color:#fff}
th{padding:7px 10px;text-align:left;font-size:10pt}
td{padding:7px 10px;font-size:10pt;border-bottom:1px solid #f1f5f9}
.gesamt{text-align:right;margin-top:4mm;font-size:13pt;font-weight:bold;color:#0f766e;border-top:2px solid #0f766e;padding-top:4px}
.bank{margin-top:8mm;padding:4mm;background:#f8fafc;border:1px solid #e2e8f0;font-size:10pt}
.bank h3{font-size:11pt;color:#0f766e;margin:0 0 3mm}
.fuss{margin-top:15mm;padding-top:4mm;border-top:1px solid #e2e8f0;font-size:8pt;color:#94a3b8;display:flex;justify-content:space-between}
.badge{display:inline-block;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;padding:2px 8px;border-radius:20px;font-size:9pt;margin-top:4mm}
</style></head><body>
<div class="header">
  <div class="firma">
    <h1>VBetreut GmbH</h1>
    <p>Krüzastraße 4 · 6912 Hörbranz</p>
    <p>Tel: +43 670 205 1951 · info@vbetreut.at</p>
    <p>USt-ID: ATU81299827 · Steuer-Nr.: 98399/4740</p>
  </div>
  <div class="nr-box">
    <div class="typ">Rechnung</div>
    <div class="nr">${r.dokument_nr}</div>
    <div style="font-size:9pt;color:#64748b;margin-top:4px">Datum: ${fmtDate(heute())}</div>
    <div style="font-size:9pt;color:#64748b">Fällig: ${fmtDate(r.zahlungsziel)}</div>
  </div>
</div>
<div class="empf">
  <div class="lbl">Rechnungsempfänger</div>
  <strong>${r.klient_name}</strong>
</div>
<table>
  <thead><tr><th>Beschreibung</th><th style="text-align:center">Menge</th><th style="text-align:right">Einzelpreis</th><th style="text-align:right">Gesamt</th></tr></thead>
  <tbody>
    ${positionen.map((p: any) => `<tr>
      <td>${p.bezeichnung || ''}${p.detail ? `<br><span style="font-size:9pt;color:#64748b">${p.detail}</span>` : ''}</td>
      <td style="text-align:center">${p.menge || ''} ${p.einheit || ''}</td>
      <td style="text-align:right">${p.einzelpreis ? (p.einzelpreis).toLocaleString('de-AT', {minimumFractionDigits:2}) + ' €' : ''}</td>
      <td style="text-align:right"><strong>${(p.bruttoBetrag || p.nettoBetrag || 0).toLocaleString('de-AT', {minimumFractionDigits:2})} €</strong></td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="gesamt">Gesamtbetrag: ${fmtEur(r.summe_brutto)}</div>
<div class="badge">Kleinunternehmer gem. § 6 Abs. 1 Z 27 UStG — keine USt ausgewiesen</div>
<div class="bank">
  <h3>💳 Zahlungsinformationen</h3>
  <table style="border:none;margin:0;width:auto">
    <tr><td style="border:none;padding:2px 12px 2px 0;font-size:9pt;color:#64748b">Kontoinhaber</td><td style="border:none;padding:2px 0"><strong>VBetreut GmbH</strong></td></tr>
    <tr><td style="border:none;padding:2px 12px 2px 0;font-size:9pt;color:#64748b">IBAN</td><td style="border:none;padding:2px 0"><strong>AT06 2060 2000 0064 8568</strong></td></tr>
    <tr><td style="border:none;padding:2px 12px 2px 0;font-size:9pt;color:#64748b">BIC</td><td style="border:none;padding:2px 0">DOSPAT2D</td></tr>
    <tr><td style="border:none;padding:2px 12px 2px 0;font-size:9pt;color:#64748b">Verwendungszweck</td><td style="border:none;padding:2px 0">${r.dokument_nr}</td></tr>
  </table>
</div>
<div class="fuss">
  <span>VBetreut GmbH · Krüzastraße 4 · 6912 Hörbranz · GF: Stefan Wagner, Margot Schön</span>
  <span>Dornbirner Sparkasse · AT06 2060 2000 0064 8568</span>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`)
    w.document.close()
    statusSetzen(r.id, 'versendet')
  }

  function alleAusgewaehltesDrucken() {
    const liste = gefiltertRechnungen.filter(r => ausgewaehlt.has(r.id))
    liste.forEach((r, i) => setTimeout(() => druckeRechnung(r), i * 800))
  }

  if (loading || laden) return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center text-slate-400">Laden...</main>
    </div>
  )
  if (!user) return null

  const offenBetrag = rechnungen.filter(r => !['bezahlt','storniert'].includes(r.status)).reduce((s, r) => s + r.offener_betrag, 0)
  const bezahltBetrag = rechnungen.filter(r => r.status === 'bezahlt').reduce((s, r) => s + r.summe_brutto, 0)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">

        {/* Header */}
        <div className="mb-6">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">VBETREUT · ERP</div>
          <h1 className="text-3xl font-bold text-slate-900">Kundenrechnungen</h1>
          <p className="text-slate-500 mt-1">Automatische Vorschläge nach Anreise · Druck · Versand</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-bold text-amber-500 uppercase mb-1">Vorschläge</div>
            <div className="text-2xl font-bold text-amber-700">{vorschlaege.length}</div>
            <div className="text-xs text-amber-600">noch nicht verrechnet</div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-xs font-bold text-blue-500 uppercase mb-1">Offen</div>
            <div className="text-2xl font-bold text-blue-700">{fmtEur(offenBetrag)}</div>
            <div className="text-xs text-blue-600">{rechnungen.filter(r => !['bezahlt','storniert'].includes(r.status)).length} Rechnungen</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs font-bold text-emerald-500 uppercase mb-1">Bezahlt</div>
            <div className="text-2xl font-bold text-emerald-700">{fmtEur(bezahltBetrag)}</div>
            <div className="text-xs text-emerald-600">{rechnungen.filter(r => r.status === 'bezahlt').length} Rechnungen</div>
          </div>
        </div>

        {/* Vorschläge Banner */}
        {vorschlaege.length > 0 && (
          <div className="rounded-2xl border-2 border-teal-400 bg-teal-50 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-bold text-teal-800 text-lg">💡 {vorschlaege.length} Einsatz{vorschlaege.length > 1 ? 'e' : ''} bereit zur Abrechnung</div>
                <div className="text-sm text-teal-600">Anreise erfolgt — Rechnung noch nicht erstellt · Doppelverrechnung automatisch verhindert</div>
              </div>
              <button onClick={alleErstellen}
                className="rounded-xl bg-teal-700 text-white font-bold text-sm px-5 py-2.5 cursor-pointer border-none hover:bg-teal-800">
                Alle erstellen →
              </button>
            </div>
            <div className="space-y-2">
              {vorschlaege.map(e => (
                <div key={e.id} className="flex items-center justify-between rounded-xl bg-white border border-teal-200 px-4 py-3">
                  <div>
                    <span className="font-semibold text-slate-900">{e.klientName}</span>
                    <span className="text-sm text-slate-500 ml-2">· {e.betreuerinName}</span>
                    <span className="text-sm text-slate-400 ml-2">· {fmtDate(e.von)} – {e.bis ? fmtDate(e.bis) : 'laufend'}</span>
                    <span className="text-sm font-semibold text-teal-700 ml-2">· {fmtEur(e.gesamtbetrag || e.turnusTage * e.tagessatz)}</span>
                  </div>
                  <button onClick={() => erstelleRechnung(e)} disabled={erstelleLoading === e.id}
                    className="rounded-xl bg-teal-700 text-white text-xs font-bold px-4 py-2 cursor-pointer border-none hover:bg-teal-800 disabled:opacity-50">
                    {erstelleLoading === e.id ? '⏳...' : '📄 Rechnung →'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rechnungsliste */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
            <input value={suche} onChange={e => setSuche(e.target.value)}
              placeholder="Suche Nr., Klient, Betreuerin..."
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-teal-400 flex-1 min-w-48" />
            <input value={filterKlient} onChange={e => setFilterKlient(e.target.value)}
              placeholder="Klient filtern..."
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400 w-40" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white">
              <option value="alle">Alle Status</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <input type="date" value={filterVon} onChange={e => setFilterVon(e.target.value)}
                className="rounded-xl border border-slate-200 px-2 py-2 text-xs outline-none focus:border-teal-400" title="Von Datum" />
              <span className="text-slate-400 text-xs">–</span>
              <input type="date" value={filterBis} onChange={e => setFilterBis(e.target.value)}
                className="rounded-xl border border-slate-200 px-2 py-2 text-xs outline-none focus:border-teal-400" title="Bis Datum" />
            </div>
            {aktivFilter && (
              <button onClick={() => { setSuche(''); setStatusFilter('alle'); setFilterKlient(''); setFilterVon(''); setFilterBis('') }}
                className="rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs px-3 py-2 cursor-pointer hover:bg-rose-100">
                ✕ Filter
              </button>
            )}
            {sevdeskStatus && (
              <div className={`text-sm px-3 py-1.5 rounded-xl ${sevdeskStatus.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : sevdeskStatus.startsWith('❌') ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                {sevdeskStatus}
              </div>
            )}
            {ausgewaehlt.size > 0 && (
              <>
                <button onClick={() => sevdeskExport([...ausgewaehlt])} disabled={sevdeskExporting}
                  className="rounded-xl border border-violet-200 bg-violet-50 text-violet-700 px-4 py-2 text-sm font-semibold cursor-pointer hover:bg-violet-100 disabled:opacity-50">
                  📤 sevDesk ({ausgewaehlt.size})
                </button>
                <button onClick={alleAusgewaehltesDrucken}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">
                  🖨️ Seriendruck ({ausgewaehlt.size})
                </button>
                <button onClick={() => setAusgewaehlt(new Set())}
                  className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 bg-transparent border-none">✕</button>
              </>
            )}
          </div>

          {/* Spaltenheader */}
          <div className="grid px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400"
            style={{ gridTemplateColumns: '40px 130px 1fr 1fr 100px 100px 120px 110px' }}>
            <div></div>
            <div>Nr.</div>
            <div>Klient</div>
            <div>Betreuerin</div>
            <div>Betrag</div>
            <div>Datum</div>
            <div>Status</div>
            <div>Aktionen</div>
          </div>

          {gefiltertRechnungen.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">🧾</div>
              <div className="text-lg font-medium text-slate-600 mb-1">Keine Rechnungen</div>
              <div className="text-sm">{vorschlaege.length > 0 ? 'Erstellen Sie Rechnungen aus den Vorschlägen oben' : 'Alle Einsätze sind abgerechnet'}</div>
            </div>
          ) : gefiltertRechnungen.map(r => {
            const ueberfaellig = r.zahlungsziel && !['bezahlt', 'storniert'].includes(r.status) && r.zahlungsziel < heute()
            return (
              <div key={r.id} className={clsx('grid items-center px-5 py-4 border-b border-slate-50 hover:bg-slate-50/80 transition-colors',
                ueberfaellig && 'bg-rose-50/30')}
                style={{ gridTemplateColumns: '40px 130px 1fr 1fr 100px 100px 120px 110px' }}>
                <input type="checkbox" checked={ausgewaehlt.has(r.id)}
                  onChange={ev => {
                    const s = new Set(ausgewaehlt)
                    ev.target.checked ? s.add(r.id) : s.delete(r.id)
                    setAusgewaehlt(s)
                  }}
                  className="accent-teal-600 w-4 h-4" />
                <div>
                  <div className="font-bold text-teal-700 text-sm">{r.dokument_nr}</div>
                  <div className="text-xs text-slate-400">{r.typ}</div>
                </div>
                <div className="font-semibold text-slate-900 text-sm truncate">{r.klient_name || '–'}</div>
                <div className="text-sm text-slate-500 truncate">{r.betreuerin_name || '–'}</div>
                <div className="font-bold text-slate-900 text-sm">{fmtEur(r.summe_brutto)}</div>
                <div>
                  <div className="text-sm text-slate-700">{fmtDate(r.rechnungs_datum)}</div>
                  {r.zahlungsziel && <div className={clsx('text-xs', ueberfaellig ? 'text-rose-600 font-semibold' : 'text-slate-400')}>
                    fällig: {fmtDate(r.zahlungsziel)}
                  </div>}
                </div>
                <div>
                  <span className={clsx('text-xs px-2 py-1 rounded-full border font-medium', STATUS[r.status]?.css || STATUS.entwurf.css)}>
                    {STATUS[r.status]?.label || r.status}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => druckeRechnung(r)} title="Drucken"
                    className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 cursor-pointer hover:bg-slate-100">
                    🖨️
                  </button>
                  {r.status !== 'bezahlt' && r.status !== 'storniert' && (
                    <button onClick={() => statusSetzen(r.id, 'bezahlt')} title="Als bezahlt markieren"
                      className="text-xs px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 cursor-pointer hover:bg-emerald-100">
                      ✓
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
