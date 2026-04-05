'use client'
import { useState, Suspense, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useKlienten } from '@/hooks/useKlienten'
import { Btn, Badge, SectionCard } from '@/components/ui'
import KlientForm from '@/components/KlientForm'
import KlientDetail from '@/components/KlientDetail'
import Sidebar from '@/components/Sidebar'
import { STATUS_COLORS, STATUS_LABELS, FOERDERUNG_LABELS, FOERDERUNG_COLORS, type Klient, type Status } from '@/lib/klienten'
import { exportPDF, exportExcel } from '@/lib/export'
import clsx from 'clsx'

function age(dob: string) {
  if (!dob) return ''
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + ' J.'
}

function initials(k: Klient) {
  return (k.vorname[0] || '') + (k.nachname[0] || '')
}

const RING_COLORS = [
  'border-emerald-300 text-emerald-700 bg-emerald-50',
  'border-sky-300 text-sky-700 bg-sky-50',
  'border-violet-300 text-violet-700 bg-violet-50',
  'border-amber-300 text-amber-700 bg-amber-50',
  'border-rose-300 text-rose-700 bg-rose-50',
  'border-teal-300 text-teal-700 bg-teal-50',
]

function KlientenPageInner() {
  const { user, loading } = useAuth()
  const { klienten, add, update, remove } = useKlienten()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('alle')
  const [showForm, setShowForm] = useState(false)
  const [editKlient, setEditKlient] = useState<Klient | null>(null)
  const [detailKlient, setDetailKlient] = useState<Klient | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState('')
  const [viewMode, setViewMode] = useState<'kacheln' | 'liste'>('kacheln')

  // Open form if ?neu=1
  useEffect(() => {
    if (searchParams.get('neu') === '1') {
      setShowForm(true)
      router.replace('/klienten')
    }
  }, [searchParams, router])

  const filtered = useMemo(() => {
    let list = klienten
    if (statusFilter !== 'alle') list = list.filter(k => k.status === statusFilter)
    const q = search.toLowerCase().trim()
    if (q) list = list.filter(k =>
      [k.vorname, k.nachname, k.ort, k.plz, k.telefon, k.zustaendig,
       k.pflegestufe, k.status, k.besonderheiten, ...k.kontakte.map(c => c.name)
      ].join(' ').toLowerCase().includes(q)
    )
    return list
  }, [klienten, search, statusFilter])

  const counts = useMemo(() => ({
    alle: klienten.length,
    aktiv: klienten.filter(k => k.status === 'aktiv').length,
    interessent: klienten.filter(k => k.status === 'interessent').length,
    pausiert: klienten.filter(k => k.status === 'pausiert').length,
    beendet: klienten.filter(k => k.status === 'beendet').length,
  }), [klienten])

  async function handleExportPDF() {
    setExportLoading('pdf')
    await exportPDF(filtered, `Klient:innen (${statusFilter === 'alle' ? 'Alle' : STATUS_LABELS[statusFilter as Status]})`)
    setExportLoading('')
  }
  async function handleExportExcel() {
    setExportLoading('xlsx')
    await exportExcel(filtered)
    setExportLoading('')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>
  if (!user) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 overflow-auto p-8">

        {/* Detailansicht */}
        {detailKlient && (
          <KlientDetail
            klient={detailKlient}
            canGF={user?.role === 'gf'}
            onEdit={() => { setEditKlient(detailKlient); setDetailKlient(null); }}
            onClose={() => setDetailKlient(null)}
            onDelete={() => { setDeleteConfirm(detailKlient.id); setDetailKlient(null); }}
          />
        )}

        {/* Form modal */}
        {(showForm || editKlient) && (
          <KlientForm
            initial={editKlient ?? undefined}
            onSave={data => {
              if (editKlient) update(editKlient.id, data)
              else add(data)
              setShowForm(false)
              setEditKlient(null)
            }}
            onClose={() => { setShowForm(false); setEditKlient(null); }}
          />
        )}

        {/* Delete confirm */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
            <div className="bg-white rounded-3xl p-8 shadow-2xl w-96">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Klient:in löschen?</h2>
              <p className="text-slate-500 text-sm mb-6">Dieser Eintrag wird unwiderruflich gelöscht.</p>
              <div className="flex gap-3 justify-end">
                <Btn onClick={() => setDeleteConfirm(null)}>Abbrechen</Btn>
                <Btn danger onClick={() => { remove(deleteConfirm); setDeleteConfirm(null); }}>Löschen</Btn>
              </div>
            </div>
          </div>
        )}

        {/* Page header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-2">VBetreut · ERP</div>
              <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-3">Klient:innen</h1>
              <p className="text-base text-slate-500 max-w-xl">Stammdaten, Pflegestufen, Kontakte und Betreuungsinfos — vollständig erfasst und jederzeit abrufbar.</p>
            </div>
            <div className="flex gap-3 flex-shrink-0 pt-1">
              {user?.role !== 'mitarbeiter' && (
                <>
                  <Btn onClick={handleExportExcel} disabled={exportLoading === 'xlsx'}>
                    {exportLoading === 'xlsx' ? 'Exportiert ...' : 'Excel'}
                  </Btn>
                  <Btn onClick={handleExportPDF} disabled={exportLoading === 'pdf'}>
                    {exportLoading === 'pdf' ? 'Exportiert ...' : 'PDF'}
                  </Btn>
                </>
              )}
              <Btn teal onClick={() => setShowForm(true)}>+ Neue Klient:in</Btn>
            </div>
          </div>

          {/* Search */}
          <div className="mt-6 flex gap-3">
            <div className="flex-1 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-slate-400 text-lg">🔎</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Suche nach Name, Ort, Telefon, Zuständig, Besonderheiten ..."
                className="flex-1 bg-transparent border-none text-sm text-slate-800 placeholder-slate-400 outline-none" />
              {search && <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer bg-transparent border-none">✕</button>}
            </div>
          </div>

          {/* Status filter tabs */}
          <div className="mt-4 flex gap-2 flex-wrap">
            {[
              ['alle', `Alle (${counts.alle})`],
              ['aktiv', `Aktiv (${counts.aktiv})`],
              ['interessent', `Interessenten (${counts.interessent})`],
              ['pausiert', `Pausiert (${counts.pausiert})`],
              ['beendet', `Beendet (${counts.beendet})`],
            ].map(([val, label]) => (
              <button key={val} onClick={() => setStatusFilter(val)}
                className={clsx(
                  'rounded-full px-4 py-2 text-sm font-medium border cursor-pointer transition-all',
                  statusFilter === val
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-4">
          {[
            ['Aktive Klient:innen', counts.aktiv, 'Aktive Betreuung'],
            ['Interessenten', counts.interessent, 'In Erstabklärung'],
            ['Gefilterte Einträge', filtered.length, `von ${counts.alle} gesamt`],
            ['Mit Förderung', klienten.filter(k=>k.foerderung==='aktiv').length, 'Förderung aktiv'],
          ].map(([t, v, s]) => (
            <div key={String(t)} className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
              <div className="text-sm text-slate-500 mb-2">{t}</div>
              <div className="text-5xl font-bold text-slate-900 leading-none mb-1">{v}</div>
              <div className="text-sm text-slate-400">{s}</div>
            </div>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex justify-end mb-2">
          <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button onClick={() => setViewMode('kacheln')} title="Kacheln"
              className={`px-3 py-1.5 text-sm cursor-pointer border-none transition-colors ${viewMode==='kacheln'?'bg-teal-700 text-white':'text-slate-500 hover:bg-slate-50'}`}>⊞</button>
            <button onClick={() => setViewMode('liste')} title="Liste"
              className={`px-3 py-1.5 text-sm cursor-pointer border-none transition-colors ${viewMode==='liste'?'bg-teal-700 text-white':'text-slate-500 hover:bg-slate-50'}`}>☰</button>
          </div>
        </div>

        {/* List */}
        <SectionCard title="Klient:innen" sub={`${filtered.length} Einträge`}>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-3">🔍</div>
              <div className="text-lg font-medium">Keine Einträge gefunden</div>
              <div className="text-sm mt-1">Suche oder Filter anpassen</div>
            </div>
          )}
          {viewMode === 'liste' ? (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="grid px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400"
                style={{gridTemplateColumns:'1fr 1fr 120px 100px 80px'}}>
                <div>Name</div><div>Ort</div><div>Status</div><div>Pflegestufe</div><div></div>
              </div>
              {filtered.map(k => (
                <div key={k.id}
                  className="grid items-center px-5 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  style={{gridTemplateColumns:'1fr 1fr 120px 100px 80px'}}
                  onClick={() => setDetailKlient(k)}>
                  <div className="font-semibold text-slate-900">{k.nachname} {k.vorname}</div>
                  <div className="text-sm text-slate-500">{k.ort || '–'}</div>
                  <div>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full border',
                      k.status === 'aktiv' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      k.status === 'verstorben' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                      'bg-amber-50 text-amber-700 border-amber-200')}>
                      {k.status || '–'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500">{k.pflegestufe !== '0' ? `Stufe ${k.pflegestufe}` : '–'}</div>
                  <button className="text-xs text-teal-600 hover:text-teal-800 cursor-pointer bg-transparent border-none">öffnen →</button>
                </div>
              ))}
            </div>
          ) : (
          <div className="grid grid-cols-3 gap-5">
            {filtered.map((k, idx) => {
              const ring = RING_COLORS[idx % RING_COLORS.length]
              return (
                <div key={k.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-6 cursor-pointer transition-all hover:border-teal-300 hover:bg-white hover:shadow-sm"
                  onClick={() => setDetailKlient(k)}>
                  {/* Avatar + name */}
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="flex items-start gap-4">
                      <div className={clsx('flex items-center justify-center rounded-full border font-bold text-lg flex-shrink-0', ring)}
                        style={{ width: 52, height: 52 }}>
                        {initials(k)}
                      </div>
                      <div>
                        <div className="text-xl font-bold text-slate-900 leading-tight">{k.nachname} {k.vorname}</div>
                        <div className="text-sm text-slate-500 mt-0.5">
                          {k.geburtsdatum ? `${new Date(k.geburtsdatum).toLocaleDateString('de-AT')} · ${age(k.geburtsdatum)}` : '–'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-400 bg-white border border-slate-200 rounded-xl px-3 py-1.5 flex-shrink-0">Öffnen →</span>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge label={STATUS_LABELS[k.status]} className={STATUS_COLORS[k.status]} />
                    {k.pflegestufe !== '0' && <Badge label={`Pflegestufe ${k.pflegestufe}`} className="border-violet-200 bg-violet-50 text-violet-700" />}
                    <Badge label={FOERDERUNG_LABELS[k.foerderung]} className={FOERDERUNG_COLORS[k.foerderung]} />
                  </div>

                  {/* Info */}
                  <div className="space-y-1.5 text-sm text-slate-600">
                    {k.telefon && <div>📞 {k.telefon}</div>}
                    {k.ort && <div>📍 {k.plz} {k.ort}</div>}
                    {k.kontakte[0] && <div>👤 {k.kontakte[0].name} · {k.kontakte[0].beziehung}</div>}
                    {k.zustaendig && <div className="text-slate-400">Zuständig: {k.zustaendig}</div>}
                  </div>

                  {/* Actions */}
                  {user?.role !== 'mitarbeiter' && (
                    <div className="flex gap-2 mt-5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditKlient(k)}
                        className="flex-1 rounded-xl bg-teal-700 py-2.5 text-xs font-bold text-white cursor-pointer border-none hover:bg-teal-800 transition-colors">
                        Bearbeiten
                      </button>
                      <button onClick={() => setDeleteConfirm(k.id)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-rose-500 cursor-pointer hover:bg-rose-50 transition-colors">
                        Löschen
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          )}
        </SectionCard>
      </main>
    </div>
  )
}

export default function KlientenPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>}><KlientenPageInner /></Suspense>
}
