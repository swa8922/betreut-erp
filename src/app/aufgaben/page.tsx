'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import Sidebar from '@/components/Sidebar'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]
function fmtDate(d: string) {
  if (!d) return ''
  try { return new Date(d + 'T12:00:00').toLocaleDateString('de-AT') } catch { return d }
}
function daysUntil(d: string) {
  if (!d) return null
  return Math.ceil((new Date(d + 'T12:00:00').getTime() - Date.now()) / 86400000)
}

const PRIO_FARBE: Record<string, string> = {
  hoch: 'bg-rose-50 text-rose-700 border-rose-200',
  normal: 'bg-amber-50 text-amber-700 border-amber-200',
  niedrig: 'bg-slate-100 text-slate-500 border-slate-200',
}
const PRIO_ICON: Record<string, string> = { hoch: '🔴', normal: '🟡', niedrig: '⚪' }
const STATUS_FARBE: Record<string, string> = {
  offen: 'bg-amber-50 text-amber-700 border-amber-200',
  in_arbeit: 'bg-blue-50 text-blue-700 border-blue-200',
  erledigt: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  abgebrochen: 'bg-slate-100 text-slate-400 border-slate-200',
}

interface Aufgabe {
  id: string
  titel: string
  beschreibung: string
  zugewiesen_an_id: string
  zugewiesen_an_name: string
  erstellt_von: string
  erstellt_am: string
  faellig_am: string
  prioritaet: string
  status: string
  erledigt_am: string
  kategorie: string
  klient_name: string
  notizen: string
}

interface Mitarbeiter { id: string; vorname: string; nachname: string; rolle?: string }

export default function AufgabenPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [aufgaben, setAufgaben] = useState<Aufgabe[]>([])
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([])
  const [laden, setLaden] = useState(true)
  const [filterStatus, setFilterStatus] = useState('alle')
  const [filterPerson, setFilterPerson] = useState('alle')
  const [showNeu, setShowNeu] = useState(false)
  const [editAufgabe, setEditAufgabe] = useState<Aufgabe | null>(null)

  const canGF = user?.role === 'gf' || user?.role === 'admin'

  useEffect(() => {
    if (!user) return
    Promise.all([
      fetch('/api/db/aufgaben').then(r => r.json()).catch(() => []),
      fetch('/api/db/mitarbeiter').then(r => r.json()).catch(() => []),
    ]).then(([a, m]) => {
      setAufgaben(Array.isArray(a) ? a.map(mapAufgabe) : [])
      setMitarbeiter(Array.isArray(m) ? m.map((x: any) => ({
        id: x.id, vorname: x.vorname || x.data?.vorname || '', nachname: x.nachname || x.data?.nachname || '',
        rolle: x.rolle || x.data?.rolle || '',
      })) : [])
      setLaden(false)
    })
  }, [user])

  function mapAufgabe(x: any): Aufgabe {
    const d = x.data || {}
    return {
      id: x.id || d.id || '',
      titel: x.titel || d.titel || '',
      beschreibung: x.beschreibung || d.beschreibung || '',
      zugewiesen_an_id: x.zugewiesen_an_id || d.zugewiesen_an_id || '',
      zugewiesen_an_name: x.zugewiesen_an_name || d.zugewiesen_an_name || '',
      erstellt_von: x.erstellt_von || d.erstellt_von || '',
      erstellt_am: x.erstellt_am || d.erstellt_am || '',
      faellig_am: x.faellig_am || d.faellig_am || '',
      prioritaet: x.prioritaet || d.prioritaet || 'normal',
      status: x.status || d.status || 'offen',
      erledigt_am: x.erledigt_am || d.erledigt_am || '',
      kategorie: x.kategorie || d.kategorie || 'allgemein',
      klient_name: x.klient_name || d.klient_name || '',
      notizen: x.notizen || d.notizen || '',
    }
  }

  const gefiltert = useMemo(() => {
    let list = aufgaben
    if (filterStatus !== 'alle') list = list.filter(a => a.status === filterStatus)
    if (filterPerson !== 'alle') {
      if (filterPerson === 'meine') list = list.filter(a => a.zugewiesen_an_name === (user?.name || ''))
      else list = list.filter(a => a.zugewiesen_an_id === filterPerson)
    }
    return list.sort((a, b) => {
      if (a.status === 'erledigt' && b.status !== 'erledigt') return 1
      if (a.status !== 'erledigt' && b.status === 'erledigt') return -1
      const pa = a.prioritaet === 'hoch' ? 0 : a.prioritaet === 'normal' ? 1 : 2
      const pb = b.prioritaet === 'hoch' ? 0 : b.prioritaet === 'normal' ? 1 : 2
      if (pa !== pb) return pa - pb
      return (a.faellig_am || '9999').localeCompare(b.faellig_am || '9999')
    })
  }, [aufgaben, filterStatus, filterPerson, user])

  async function speichern(form: Partial<Aufgabe>, isNeu: boolean) {
    const id = form.id || uid()
    const body = { ...form, id, erstellt_am: form.erstellt_am || new Date().toISOString(), erstellt_von: form.erstellt_von || user?.name || '' }
    await fetch(isNeu ? '/api/db/aufgaben' : `/api/db/aufgaben?id=${id}`, {
      method: isNeu ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (isNeu) setAufgaben(prev => [mapAufgabe(body), ...prev])
    else setAufgaben(prev => prev.map(a => a.id === id ? mapAufgabe({ ...a, ...body }) : a))
    setShowNeu(false)
    setEditAufgabe(null)
  }

  async function statusAendern(id: string, status: string) {
    const erledigt_am = status === 'erledigt' ? new Date().toISOString() : ''
    await fetch(`/api/db/aufgaben?id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, erledigt_am }),
    })
    setAufgaben(prev => prev.map(a => a.id === id ? { ...a, status, erledigt_am } : a))
  }

  async function loeschen(id: string) {
    if (!confirm('Aufgabe löschen?')) return
    await fetch(`/api/db/aufgaben?id=${id}`, { method: 'DELETE' })
    setAufgaben(prev => prev.filter(a => a.id !== id))
  }

  if (loading || laden) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden...</div>
  if (!user) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">✅ Aufgaben</h1>
            <p className="text-slate-500 mt-1">Aufgaben zuweisen, verfolgen und abhaken</p>
          </div>
          {canGF && (
            <button onClick={() => setShowNeu(true)}
              className="rounded-2xl bg-teal-700 text-white font-bold px-5 py-2.5 cursor-pointer border-none hover:bg-teal-800">
              + Neue Aufgabe
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Offen', count: aufgaben.filter(a => a.status === 'offen').length, color: 'bg-amber-50 border-amber-200 text-amber-700' },
            { label: 'In Arbeit', count: aufgaben.filter(a => a.status === 'in_arbeit').length, color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { label: 'Überfällig', count: aufgaben.filter(a => a.status !== 'erledigt' && a.faellig_am && daysUntil(a.faellig_am)! < 0).length, color: 'bg-rose-50 border-rose-200 text-rose-700' },
            { label: 'Erledigt', count: aufgaben.filter(a => a.status === 'erledigt').length, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <div className="text-2xl font-bold">{s.count}</div>
              <div className="text-sm font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="flex gap-1">
            {['alle', 'offen', 'in_arbeit', 'erledigt'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={clsx('text-xs px-3 py-1.5 rounded-full border cursor-pointer font-medium',
                  filterStatus === s ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>
                {s === 'alle' ? 'Alle' : s === 'offen' ? '📋 Offen' : s === 'in_arbeit' ? '🔄 In Arbeit' : '✅ Erledigt'}
              </button>
            ))}
          </div>
          <select value={filterPerson} onChange={e => setFilterPerson(e.target.value)}
            className="text-xs rounded-2xl border border-slate-200 px-3 py-1.5 outline-none bg-white">
            <option value="alle">👥 Alle Mitarbeiter</option>
            <option value="meine">👤 Meine Aufgaben</option>
            {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
          </select>
        </div>

        {/* Aufgaben-Liste */}
        {gefiltert.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-16 text-center">
            <div className="text-5xl mb-4">✅</div>
            <div className="text-xl font-semibold text-slate-600 mb-2">Keine Aufgaben</div>
            <div className="text-slate-400">{canGF ? 'Klicken Sie auf "+ Neue Aufgabe" um eine Aufgabe anzulegen' : 'Ihnen sind aktuell keine Aufgaben zugewiesen'}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {gefiltert.map(aufgabe => {
              const tage = aufgabe.faellig_am ? daysUntil(aufgabe.faellig_am) : null
              const ueberfaellig = tage !== null && tage < 0 && aufgabe.status !== 'erledigt'
              const baldFaellig = tage !== null && tage >= 0 && tage <= 3 && aufgabe.status !== 'erledigt'
              return (
                <div key={aufgabe.id} className={clsx(
                  'rounded-3xl border bg-white p-5 shadow-sm transition-all hover:shadow-md',
                  ueberfaellig ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'
                )}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Checkbox */}
                      <button
                        onClick={() => statusAendern(aufgabe.id, aufgabe.status === 'erledigt' ? 'offen' : 'erledigt')}
                        className={clsx('flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all mt-0.5',
                          aufgabe.status === 'erledigt' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-teal-500 bg-white'
                        )}>
                        {aufgabe.status === 'erledigt' && <span className="text-xs">✓</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={clsx('font-semibold text-slate-900', aufgabe.status === 'erledigt' && 'line-through text-slate-400')}>
                          {aufgabe.titel}
                        </div>
                        {aufgabe.beschreibung && (
                          <div className="text-sm text-slate-500 mt-0.5 line-clamp-2">{aufgabe.beschreibung}</div>
                        )}
                        <div className="flex gap-3 mt-2 flex-wrap text-xs text-slate-400">
                          {aufgabe.zugewiesen_an_name && (
                            <span className="flex items-center gap-1">
                              <span>👤</span> {aufgabe.zugewiesen_an_name}
                            </span>
                          )}
                          {aufgabe.faellig_am && (
                            <span className={clsx('flex items-center gap-1', ueberfaellig ? 'text-rose-600 font-bold' : baldFaellig ? 'text-amber-600 font-semibold' : '')}>
                              📅 {fmtDate(aufgabe.faellig_am)}
                              {tage !== null && aufgabe.status !== 'erledigt' && (
                                <span>({tage === 0 ? 'heute' : tage < 0 ? `${Math.abs(tage)}d überfällig` : `in ${tage}d`})</span>
                              )}
                            </span>
                          )}
                          {aufgabe.klient_name && <span>👤 {aufgabe.klient_name}</span>}
                          {aufgabe.kategorie && aufgabe.kategorie !== 'allgemein' && <span>🏷️ {aufgabe.kategorie}</span>}
                          {aufgabe.erstellt_von && <span>von {aufgabe.erstellt_von}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-semibold', PRIO_FARBE[aufgabe.prioritaet])}>
                        {PRIO_ICON[aufgabe.prioritaet]} {aufgabe.prioritaet}
                      </span>
                      {aufgabe.status !== 'erledigt' && (
                        <select value={aufgabe.status} onChange={e => statusAendern(aufgabe.id, e.target.value)}
                          className="text-xs rounded-xl border border-slate-200 px-2 py-1 outline-none bg-white cursor-pointer">
                          <option value="offen">Offen</option>
                          <option value="in_arbeit">In Arbeit</option>
                          <option value="erledigt">Erledigt</option>
                          <option value="abgebrochen">Abgebrochen</option>
                        </select>
                      )}
                      {canGF && (
                        <>
                          <button onClick={() => setEditAufgabe(aufgabe)}
                            className="text-xs px-2 py-1 rounded-xl border border-slate-200 text-slate-500 cursor-pointer hover:bg-slate-50">✏️</button>
                          <button onClick={() => loeschen(aufgabe.id)}
                            className="text-xs px-2 py-1 rounded-xl border border-rose-200 bg-rose-50 text-rose-500 cursor-pointer hover:bg-rose-100">🗑️</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Neue / Edit Aufgabe Modal */}
        {(showNeu || editAufgabe) && (
          <AufgabeFormular
            initial={editAufgabe}
            mitarbeiter={mitarbeiter}
            erstelltVon={user?.name || ''}
            onSave={(form) => speichern(form, !editAufgabe)}
            onClose={() => { setShowNeu(false); setEditAufgabe(null) }}
          />
        )}
      </main>
    </div>
  )
}

function AufgabeFormular({ initial, mitarbeiter, erstelltVon, onSave, onClose }: {
  initial: Aufgabe | null
  mitarbeiter: Mitarbeiter[]
  erstelltVon: string
  onSave: (form: Partial<Aufgabe>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Aufgabe>>(initial || {
    titel: '', beschreibung: '', zugewiesen_an_id: '', zugewiesen_an_name: '',
    faellig_am: '', prioritaet: 'normal', status: 'offen', kategorie: 'allgemein',
    klient_name: '', notizen: '', erstellt_von: erstelltVon,
  })
  function set<K extends keyof Aufgabe>(k: K, v: any) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="bg-teal-700 px-6 py-5 flex items-center justify-between">
          <div className="text-xl font-bold text-white">{initial ? '✏️ Aufgabe bearbeiten' : '+ Neue Aufgabe'}</div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl bg-transparent border-none cursor-pointer">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1">Titel *</label>
            <input value={form.titel || ''} onChange={e => set('titel', e.target.value)}
              placeholder="Was muss erledigt werden?"
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-400" />
          </div>
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1">Beschreibung</label>
            <textarea value={form.beschreibung || ''} onChange={e => set('beschreibung', e.target.value)}
              rows={3} placeholder="Details zur Aufgabe..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none resize-none focus:border-teal-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-1">Zugewiesen an</label>
              <select value={form.zugewiesen_an_id || ''} onChange={e => {
                const m = mitarbeiter.find(x => x.id === e.target.value)
                set('zugewiesen_an_id', e.target.value)
                set('zugewiesen_an_name', m ? `${m.vorname} ${m.nachname}` : '')
              }} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none">
                <option value="">– Alle –</option>
                {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-1">Fällig am</label>
              <input type="date" value={form.faellig_am || ''} onChange={e => set('faellig_am', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-1">Priorität</label>
              <select value={form.prioritaet || 'normal'} onChange={e => set('prioritaet', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none">
                <option value="hoch">🔴 Hoch</option>
                <option value="normal">🟡 Normal</option>
                <option value="niedrig">⚪ Niedrig</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-1">Kategorie</label>
              <select value={form.kategorie || 'allgemein'} onChange={e => set('kategorie', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none">
                <option value="allgemein">Allgemein</option>
                <option value="klient">Klient</option>
                <option value="betreuerin">Betreuerin</option>
                <option value="buero">Büro</option>
                <option value="dokumente">Dokumente</option>
                <option value="foerderung">Förderung</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1">Bezogener Klient (optional)</label>
            <input value={form.klient_name || ''} onChange={e => set('klient_name', e.target.value)}
              placeholder="Name des Klienten..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
          </div>
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1">Notizen</label>
            <textarea value={form.notizen || ''} onChange={e => set('notizen', e.target.value)}
              rows={2} placeholder="Zusätzliche Hinweise..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-200 text-slate-600 text-sm py-3 cursor-pointer hover:bg-slate-50">
              Abbrechen
            </button>
            <button onClick={() => { if (form.titel?.trim()) onSave(form) }}
              disabled={!form.titel?.trim()}
              className="flex-1 rounded-2xl bg-teal-700 text-white font-bold text-sm py-3 cursor-pointer border-none hover:bg-teal-800 disabled:opacity-50">
              {initial ? '💾 Speichern' : '+ Erstellen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
