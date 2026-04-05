'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { Badge } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useAbrechnung } from '@/hooks/useAbrechnung'
import { apiUpdate } from '@/lib/api-client'
import {
  STATUS_LABELS, STATUS_COLORS, STATUS_NEXT, ZAHLUNGSART_LABELS,
  type Rechnung, type RechnungsStatus
} from '@/lib/abrechnung'
import { exportRechnungPDF, exportRechnungenExcel } from '@/lib/exportRechnung'
import clsx from 'clsx'

const fmt = (n: number) => n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('de-AT') : '–'
const today = () => new Date().toISOString().split('T')[0]

export default function AbrechnungPage() {
  const { user, loading } = useAuth()
  const { rechnungen, reload } = useAbrechnung()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('alle')
  const [detail, setDetail] = useState<Rechnung | null>(null)

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>
  if (!user) return null

  const filtered = rechnungen.filter(r => {
    if (statusFilter !== 'alle' && r.status !== statusFilter) return false
    const q = search.toLowerCase()
    return !q || [r.rechnungsNr, r.klientName, r.betreuerinName].join(' ').toLowerCase().includes(q)
  })

  async function handleStatusChange(r: Rechnung, next: RechnungsStatus) {
    const updates: any = {
      status: next,
      ...(next === 'bezahlt' ? { zahlungseingangAm: today() } : {}),
    }
    await apiUpdate('finanzen_dokumente', r.id, updates)
    // Einsatz mitaktualisieren
    if (r.einsatzId) {
      if (next === 'erstellt') await apiUpdate('einsaetze', r.einsatzId, { abrechnungsStatus: 'erstellt', rechnungsId: r.rechnungsNr })
      if (next === 'bezahlt') await apiUpdate('einsaetze', r.einsatzId, { abrechnungsStatus: 'bezahlt' })
    }
    reload()
    if (detail?.id === r.id) setDetail(prev => prev ? { ...prev, ...updates } : null)
  }

  const kpis = {
    gesamt: rechnungen.reduce((s, r) => s + (r.gesamtBetrag ?? 0), 0),
    bezahlt: rechnungen.filter(r => r.status === 'bezahlt').reduce((s, r) => s + (r.gesamtBetrag ?? 0), 0),
    offen: rechnungen.filter(r => ['erstellt', 'versendet', 'mahnung'].includes(r.status)).reduce((s, r) => s + (r.gesamtBetrag ?? 0), 0),
    anzahl: rechnungen.length,
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-2">VBetreut · ERP</div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">Abrechnung</h1>
              <p className="text-slate-500">Rechnungen verwalten und Zahlungsstatus verfolgen</p>
            </div>
            <button onClick={() => exportRechnungenExcel(filtered)}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold cursor-pointer hover:bg-slate-50">
              📊 Excel Export
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            ['Gesamtumsatz', fmt(kpis.gesamt), 'text-slate-900'],
            ['Bezahlt', fmt(kpis.bezahlt), 'text-emerald-600'],
            ['Offene Forderungen', fmt(kpis.offen), 'text-amber-600'],
            ['Rechnungen', kpis.anzahl, 'text-teal-700'],
          ].map(([l, v, c]) => (
            <div key={String(l)} className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
              <div className="text-sm text-slate-500 mb-2">{l}</div>
              <div className={clsx('text-3xl font-bold', c)}>{v}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm mb-5 flex gap-3 flex-wrap">
          <div className="flex-1 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="text-slate-400">🔎</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suche ..."
              className="flex-1 bg-transparent border-none text-sm outline-none" />
          </div>
          {(['alle', 'entwurf', 'erstellt', 'versendet', 'bezahlt', 'mahnung', 'storniert'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={clsx('rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer border transition-all',
                statusFilter === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
              {s === 'alle' ? 'Alle' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="grid bg-slate-50 px-7 py-3 border-b text-xs font-bold uppercase tracking-wider text-slate-400"
            style={{ gridTemplateColumns: '130px 1fr 1fr 110px 120px 130px 100px' }}>
            <div>Nr.</div><div>Klient:in</div><div>Betreuerin</div><div>Betrag</div><div>Fällig</div><div>Status</div><div>Aktion</div>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400"><div className="text-5xl mb-3">🧾</div><div>Keine Rechnungen</div></div>
          )}
          {filtered.map(r => {
            const ue = r.zahlungsziel && !['bezahlt', 'storniert'].includes(r.status) && new Date(r.zahlungsziel) < new Date()
            const next = STATUS_NEXT[r.status]
            return (
              <div key={r.id} className={clsx('grid items-center border-b border-slate-50 px-7 py-4 cursor-pointer hover:bg-slate-50/80', ue && 'bg-rose-50/30')}
                style={{ gridTemplateColumns: '130px 1fr 1fr 110px 120px 130px 100px' }}
                onClick={() => setDetail(r)}>
                <div className="font-mono text-sm font-bold text-teal-700">{r.rechnungsNr}</div>
                <div className="font-semibold text-slate-900">{r.klientName}</div>
                <div className="text-sm text-slate-600">{r.betreuerinName || '–'}</div>
                <div className="font-bold text-slate-900">{fmt(r.gesamtBetrag)}</div>
                <div className={clsx('text-sm', ue ? 'text-rose-600 font-bold' : 'text-slate-500')}>{fmtDate(r.zahlungsziel)}</div>
                <Badge label={STATUS_LABELS[r.status]} className={clsx('text-xs', STATUS_COLORS[r.status])} />
                <div onClick={e => e.stopPropagation()} className="flex gap-1">
                  <button onClick={() => exportRechnungPDF(r)}
                    className="rounded-lg bg-teal-700 px-2 py-1.5 text-xs font-bold text-white cursor-pointer border-none hover:bg-teal-800">📄</button>
                  {next && <button onClick={() => handleStatusChange(r, next)}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs cursor-pointer hover:bg-slate-50">→</button>}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
