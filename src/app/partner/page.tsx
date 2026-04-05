'use client'
import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/hooks/useAuth'
import { TYP_LABELS, type Partner, type PartnerTyp } from '@/lib/partner'
import { apiGetAll, apiInsert, apiUpdate, apiDelete } from '@/lib/api-client'
import clsx from 'clsx'

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]

const emptyPartner = (): Omit<Partner, 'id' | 'erstelltAm' | 'aktualisiertAm'> => ({
  typ: 'taxi', name: '', kurzname: '', telefon: '', telefonAlternativ: '',
  email: '', adresse: '', ort: '', plz: '', region: '', kontaktperson: '',
  wechsellisteZugang: false, wechsellistePIN: '',
  preisHin: 0, preisRueck: 0, aktiv: true, notizen: '',
})

export default function PartnerPage() {
  const { user, loading } = useAuth()
  const [partner, setPartner] = useState<Partner[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyPartner())
  const [copied, setCopied] = useState<string | null>(null)

  const reloadPartner = useCallback(async () => {
    const data = await apiGetAll<Partner>('partner')
    setPartner(data)
  }, [])

  useEffect(() => { reloadPartner() }, [reloadPartner])

  function setF<K extends keyof typeof form>(key: K, val: any) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    if (!form.name) return
    if (editId) {
      await apiUpdate('partner', editId, { ...form, aktualisiertAm: today() })
    } else {
      const neu: Partner = { ...form as Partner, id: uid(), erstelltAm: today(), aktualisiertAm: today() }
      await apiInsert('partner', neu)
    }
    await reloadPartner()
    setShowForm(false); setEditId(null); setForm(emptyPartner())
  }

  function startEdit(p: Partner) {
    setEditId(p.id)
    setForm({ typ: p.typ, name: p.name, kurzname: p.kurzname, telefon: p.telefon, telefonAlternativ: p.telefonAlternativ, email: p.email, adresse: p.adresse, ort: p.ort, plz: p.plz, region: p.region, kontaktperson: p.kontaktperson, wechsellisteZugang: p.wechsellisteZugang, wechsellistePIN: p.wechsellistePIN, preisHin: p.preisHin, preisRueck: p.preisRueck, aktiv: p.aktiv, notizen: p.notizen })
    setShowForm(true)
  }

  function genPIN() {
    const pin = Math.floor(1000 + Math.random() * 9000).toString()
    setF('wechsellistePIN', pin)
    setF('wechsellisteZugang', true)
  }

  function copyLink(p: Partner) {
    const url = `${window.location.origin}/wechselliste?pin=${p.wechsellistePIN}`
    navigator.clipboard.writeText(url)
    setCopied(p.id)
    setTimeout(() => setCopied(null), 2500)
  }

  const taxis = partner.filter(p => p.typ === 'taxi')
  const andere = partner.filter(p => p.typ !== 'taxi')

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>
  if (!user) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 overflow-y-auto pt-8 pb-8" onClick={() => { setShowForm(false); setEditId(null) }}>
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-teal-700 px-7 py-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{editId ? 'Partner bearbeiten' : 'Neuer Partner'}</h2>
                <button onClick={() => { setShowForm(false); setEditId(null) }} className="text-white/70 hover:text-white text-2xl cursor-pointer bg-transparent border-none">✕</button>
              </div>
              <div className="p-6 space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Typ</div>
                    <select value={form.typ} onChange={e => setF('typ', e.target.value as PartnerTyp)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none">
                      {Object.entries(TYP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Kurzname (für Wechselliste)</div>
                    <input value={form.kurzname} onChange={e => setF('kurzname', e.target.value)}
                      placeholder="z.B. Taxi Bregenz"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-1">Vollständiger Name *</div>
                  <input value={form.name} onChange={e => setF('name', e.target.value)}
                    placeholder="z.B. Taxi Auinger Bregenz GmbH"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Telefon</div>
                    <input value={form.telefon} onChange={e => setF('telefon', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Kontaktperson</div>
                    <input value={form.kontaktperson} onChange={e => setF('kontaktperson', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Region</div>
                    <input value={form.region} onChange={e => setF('region', e.target.value)}
                      placeholder="z.B. Vorarlberg"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Ort</div>
                    <input value={form.ort} onChange={e => setF('ort', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
                  </div>
                </div>

                {form.typ === 'taxi' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Preis Anreise (€)</div>
                      <input type="number" value={form.preisHin} min={0} onChange={e => setF('preisHin', +e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Preis Abreise (€)</div>
                      <input type="number" value={form.preisRueck} min={0} onChange={e => setF('preisRueck', +e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
                    </div>
                  </div>
                )}

                {/* Wechselliste Zugang */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setF('wechsellisteZugang', !form.wechsellisteZugang)}
                      className={clsx('w-11 h-6 rounded-full border-none cursor-pointer relative flex-shrink-0', form.wechsellisteZugang ? 'bg-teal-600' : 'bg-slate-300')}>
                      <span className={clsx('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all', form.wechsellisteZugang ? 'left-6' : 'left-1')} />
                    </button>
                    <span className="text-sm font-medium text-slate-700">Leserecht Wechselliste</span>
                  </div>
                  {form.wechsellisteZugang && (
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <div className="text-xs text-slate-500 mb-1">PIN (4-stellig)</div>
                        <input value={form.wechsellistePIN} onChange={e => setF('wechsellistePIN', e.target.value)}
                          maxLength={4} placeholder="1234"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono outline-none" />
                      </div>
                      <button onClick={genPIN} className="mt-5 rounded-xl border border-slate-200 text-slate-600 text-xs px-3 py-2 cursor-pointer hover:bg-slate-100">
                        🎲 Generieren
                      </button>
                    </div>
                  )}
                  {form.wechsellisteZugang && (
                    <div className="text-xs text-slate-400">Der Partner erhält Leserecht nur für Wechsel mit seinem Taxi.</div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-1">Notizen</div>
                  <textarea value={form.notizen} onChange={e => setF('notizen', e.target.value)} rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm resize-none outline-none" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowForm(false); setEditId(null) }}
                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">Abbrechen</button>
                  <button onClick={handleSave}
                    className="flex-1 rounded-xl bg-teal-700 text-white px-5 py-2.5 text-sm font-bold cursor-pointer border-none hover:bg-teal-800">
                    {editId ? 'Speichern' : 'Partner anlegen'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">Partner & Taxis</h1>
              <p className="text-slate-500">Taxi-Partner verwalten · Leserecht für Wechselliste vergeben</p>
            </div>
            <button onClick={() => { setForm(emptyPartner()); setEditId(null); setShowForm(true) }}
              className="rounded-2xl bg-teal-700 text-white px-6 py-3 text-sm font-bold cursor-pointer border-none hover:bg-teal-800">
              + Neuer Partner
            </button>
          </div>
        </div>

        {/* Taxis */}
        {taxis.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-700 mb-3">🚕 Taxi-Partner ({taxis.length})</h2>
            <div className="space-y-3">
              {taxis.map(p => (
                <div key={p.id} className={clsx('rounded-3xl border bg-white px-6 py-5 shadow-sm', !p.aktiv && 'opacity-50')}>
                  <div className="flex items-start gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0">🚕</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900 text-lg">{p.name}</span>
                        {!p.aktiv && <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">Inaktiv</span>}
                      </div>
                      <div className="text-sm text-slate-500">
                        {p.ort} · {p.region} {p.kontaktperson && `· ${p.kontaktperson}`}
                      </div>
                      <div className="flex gap-4 mt-2 text-sm text-slate-600 flex-wrap">
                        {p.telefon && <a href={`tel:${p.telefon}`} className="text-teal-700 hover:underline">☎ {p.telefon}</a>}
                        {p.preisHin > 0 && <span>Hin: €{p.preisHin} · Rück: €{p.preisRueck}</span>}
                        <span className="text-xs font-mono bg-slate-100 rounded px-2 py-0.5">{p.kurzname}</span>
                      </div>
                    </div>

                    {/* Wechselliste-Zugang */}
                    <div className="flex-shrink-0 text-right">
                      {p.wechsellisteZugang && p.wechsellistePIN ? (
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                          <div className="text-xs text-sky-600 mb-1 font-semibold">🔗 Wechselliste-Zugang</div>
                          <div className="font-mono font-bold text-sky-900 text-lg">PIN: {p.wechsellistePIN}</div>
                          <button onClick={() => copyLink(p)}
                            className="mt-2 rounded-xl bg-sky-600 text-white text-xs px-3 py-1.5 cursor-pointer border-none hover:bg-sky-700 w-full">
                            {copied === p.id ? '✓ Kopiert!' : '📋 Link kopieren'}
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 mt-1">Kein Zugang</div>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => startEdit(p)}
                        className="rounded-xl border border-slate-200 text-slate-500 text-xs px-3 py-2 cursor-pointer hover:bg-slate-50">✏️</button>
                      <button onClick={() => { if (confirm('Partner löschen?')) { apiDelete('partner', p.id).then(reloadPartner) } }}
                        className="rounded-xl border border-rose-200 text-rose-500 text-xs px-3 py-2 cursor-pointer hover:bg-rose-50">✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Andere Partner */}
        {andere.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-slate-700 mb-3">Weitere Partner ({andere.length})</h2>
            <div className="space-y-3">
              {andere.map(p => (
                <div key={p.id} className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm flex items-center gap-4">
                  <div className="text-2xl">{TYP_LABELS[p.typ].split(' ')[0]}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-sm text-slate-500">{p.ort} {p.telefon && `· ${p.telefon}`}</div>
                  </div>
                  <button onClick={() => startEdit(p)} className="rounded-xl border border-slate-200 text-slate-500 text-xs px-3 py-2 cursor-pointer hover:bg-slate-50">✏️</button>
                  <button onClick={() => { if (confirm('Löschen?')) { apiDelete('partner', p.id).then(reloadPartner) } }}
                    className="rounded-xl border border-rose-200 text-rose-500 text-xs px-3 py-2 cursor-pointer hover:bg-rose-50">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {partner.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-16 text-center text-slate-400">
            <div className="text-5xl mb-3">🚕</div>
            <div className="text-lg font-medium">Noch keine Partner</div>
            <div className="text-sm mt-1">Taxi-Partner anlegen um sie in der Turnusplanung verwenden zu können</div>
          </div>
        )}

        {/* Hinweis Leserecht */}
        <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200 p-5">
          <div className="text-sm font-bold text-slate-700 mb-2">💡 So funktioniert das Leserecht</div>
          <div className="text-sm text-slate-500 space-y-1">
            <div>1. Taxi-Partner PIN vergeben → "Link kopieren" klicken</div>
            <div>2. Link an den Partner schicken (z.B. per WhatsApp)</div>
            <div>3. Der Partner öffnet den Link und sieht nur die Wechsel bei denen sein Taxi eingetragen ist</div>
            <div>4. Kein Login nötig — nur über den PIN-Link zugänglich</div>
          </div>
        </div>

      </main>
    </div>
  )
}
