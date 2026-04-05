'use client'
import { useState } from 'react'
import { Btn, Field, SelField, TextArea, Modal } from '@/components/ui'
import { type Artikel } from '@/lib/finanzen'
import clsx from 'clsx'

const KATEGORIEN = [
  { value: 'betreuung', label: 'Betreuungsleistung' },
  { value: 'taxi',      label: 'Taxi / Transport' },
  { value: 'agentur',   label: 'Agenturpauschale' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

const STEUERSAETZE = [
  { value: '0',  label: '0% (steuerbefreit)' },
  { value: '10', label: '10% MwSt.' },
  { value: '20', label: '20% MwSt.' },
]

const fmt = (n: number) => n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })

interface Props {
  artikel: Artikel[]
  canEdit: boolean
  onSave: (list: Artikel[]) => void
}

export default function ArtikelVerwaltung({ artikel, canEdit, onSave }: Props) {
  const [editArtikel, setEditArtikel] = useState<Artikel | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('alle')

  const filtered = filter === 'alle' ? artikel : artikel.filter(a => a.kategorie === filter)

  function handleSave(form: Artikel) {
    const updated = isNew
      ? [...artikel, { ...form, id: Date.now().toString(), erstelltAm: new Date().toISOString().split('T')[0] }]
      : artikel.map(a => a.id === form.id ? form : a)
    onSave(updated)
    setEditArtikel(null)
    setIsNew(false)
  }

  function handleDelete(id: string) {
    onSave(artikel.filter(a => a.id !== id))
    setDeleteConfirm(null)
  }

  function handleToggleAktiv(id: string) {
    onSave(artikel.map(a => a.id === id ? { ...a, aktiv: !a.aktiv } : a))
  }

  function newArtikel() {
    setIsNew(true)
    setEditArtikel({
      id: '', code: '', bezeichnung: '', beschreibung: '',
      einheit: 'Pauschale', preis: 0, steuersatz: 0,
      kategorie: 'betreuung', aktiv: true, erstelltAm: '',
    })
  }

  return (
    <div>
      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="bg-white rounded-3xl p-8 shadow-2xl w-96">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Artikel löschen?</h2>
            <p className="text-slate-500 text-sm mb-6">Der Artikel wird aus dem Katalog entfernt. Bestehende Rechnungen bleiben unverändert.</p>
            <div className="flex gap-3 justify-end">
              <Btn onClick={() => setDeleteConfirm(null)}>Abbrechen</Btn>
              <Btn danger onClick={() => handleDelete(deleteConfirm)}>Löschen</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editArtikel && (
        <ArtikelForm
          initial={editArtikel}
          isNew={isNew}
          onSave={handleSave}
          onClose={() => { setEditArtikel(null); setIsNew(false) }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Leistungskatalog</h2>
          <p className="text-sm text-slate-500 mt-1">
            Artikel werden bei der Rechnungserstellung verwendet. Preise und Steuersätze werden automatisch übernommen.
          </p>
        </div>
        {canEdit && (
          <Btn teal onClick={newArtikel}>+ Neuer Artikel</Btn>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[['alle', 'Alle'], ...KATEGORIEN.map(k => [k.value, k.label])].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={clsx(
              'rounded-full px-4 py-2 text-sm font-medium border cursor-pointer transition-all',
              filter === val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}>
            {label}
          </button>
        ))}
      </div>

      {/* Artikel-Tabelle */}
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="grid bg-slate-50 px-6 py-3 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400"
          style={{ gridTemplateColumns: '80px 1fr 1.5fr 80px 60px 100px 80px 100px' }}>
          <div>Code</div>
          <div>Bezeichnung</div>
          <div>Beschreibung</div>
          <div className="text-right">Preis</div>
          <div className="text-center">MwSt.</div>
          <div>Kategorie</div>
          <div className="text-center">Aktiv</div>
          <div></div>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">📦</div>
            <div className="font-medium">Keine Artikel in dieser Kategorie</div>
          </div>
        )}

        {filtered.map(a => (
          <div key={a.id}
            className={clsx(
              'grid items-center border-b border-slate-50 px-6 py-4 transition-colors',
              !a.aktiv && 'opacity-50',
            )}
            style={{ gridTemplateColumns: '80px 1fr 1.5fr 80px 60px 100px 80px 100px' }}>

            <div className="font-mono text-xs font-bold text-teal-700 bg-teal-50 rounded-lg px-2 py-1 w-fit">
              {a.code}
            </div>

            <div>
              <div className="font-semibold text-slate-900">{a.bezeichnung}</div>
              <div className="text-xs text-slate-400 mt-0.5">{a.einheit}</div>
            </div>

            <div className="text-sm text-slate-500 truncate pr-2">{a.beschreibung}</div>

            <div className="text-right font-bold text-slate-900">{fmt(a.preis)}</div>

            <div className="text-center">
              <span className={clsx(
                'text-xs font-semibold rounded-full px-2 py-1',
                a.steuersatz === 0 ? 'bg-slate-100 text-slate-500' :
                a.steuersatz === 10 ? 'bg-amber-50 text-amber-700' :
                'bg-rose-50 text-rose-700'
              )}>
                {a.steuersatz}%
              </span>
            </div>

            <div>
              <span className={clsx(
                'text-xs rounded-full px-2 py-1',
                a.kategorie === 'betreuung' ? 'bg-teal-50 text-teal-700' :
                a.kategorie === 'taxi' ? 'bg-orange-50 text-orange-700' :
                a.kategorie === 'agentur' ? 'bg-violet-50 text-violet-700' :
                'bg-slate-100 text-slate-600'
              )}>
                {KATEGORIEN.find(k => k.value === a.kategorie)?.label || a.kategorie}
              </span>
            </div>

            <div className="flex justify-center">
              <button onClick={() => handleToggleAktiv(a.id)}
                className={clsx(
                  'w-10 h-6 rounded-full transition-colors cursor-pointer border-none relative',
                  a.aktiv ? 'bg-teal-600' : 'bg-slate-300'
                )}>
                <span className={clsx(
                  'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all',
                  a.aktiv ? 'left-5' : 'left-1'
                )} />
              </button>
            </div>

            <div className="flex gap-2 justify-end">
              {canEdit && (
                <>
                  <button onClick={() => { setEditArtikel(a); setIsNew(false) }}
                    className="rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white cursor-pointer border-none hover:bg-teal-800">
                    Bearbeiten
                  </button>
                  <button onClick={() => setDeleteConfirm(a.id)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-rose-500 cursor-pointer hover:bg-rose-50">
                    ✕
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Artikel-Formular ──────────────────────────────────────────────────────────

function ArtikelForm({ initial, isNew, onSave, onClose }: {
  initial: Artikel
  isNew: boolean
  onSave: (a: Artikel) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Artikel>({ ...initial })
  function set<K extends keyof Artikel>(k: K, v: Artikel[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  return (
    <Modal title={isNew ? 'Neuen Artikel anlegen' : `Artikel bearbeiten: ${initial.bezeichnung}`} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Artikelcode *" value={form.code} onChange={v => set('code', v)}
            placeholder="z. B. BEW-28, TAXI-HIN, AGT-PSC" required />
          <Field label="Bezeichnung *" value={form.bezeichnung} onChange={v => set('bezeichnung', v)}
            placeholder="z. B. 24h-Betreuung 28 Tage" required />

          <SelField label="Kategorie" value={form.kategorie} onChange={v => set('kategorie', v as any)}
            options={KATEGORIEN} />
          <Field label="Einheit" value={form.einheit} onChange={v => set('einheit', v)}
            placeholder="Tag, Pauschale, Fahrt, km ..." />

          <div>
            <div className="mb-1.5 text-sm font-medium text-slate-600">Standardpreis (€) *</div>
            <input
              type="number" value={form.preis} onChange={e => set('preis', parseFloat(e.target.value) || 0)}
              step="0.01" min="0" required
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800"
            />
          </div>

          <SelField label="Steuersatz" value={String(form.steuersatz)} onChange={v => set('steuersatz', parseInt(v) as any)}
            options={STEUERSAETZE} />

          <TextArea label="Beschreibung" value={form.beschreibung} onChange={v => set('beschreibung', v)}
            placeholder="Längere Beschreibung für Rechnung / Angebot" wide />

          <div className="col-span-2 flex items-center gap-3 pt-1">
            <button type="button" onClick={() => set('aktiv', !form.aktiv)}
              className={clsx(
                'w-12 h-7 rounded-full transition-colors cursor-pointer border-none relative flex-shrink-0',
                form.aktiv ? 'bg-teal-600' : 'bg-slate-300'
              )}>
              <span className={clsx(
                'absolute top-1.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                form.aktiv ? 'left-6' : 'left-1.5'
              )} />
            </button>
            <span className="text-sm text-slate-700">Artikel ist {form.aktiv ? 'aktiv (erscheint in Rechnungen)' : 'inaktiv (ausgeblendet)'}</span>
          </div>

          {/* Vorschau */}
          {form.preis > 0 && (
            <div className="col-span-2 rounded-2xl bg-teal-50 border border-teal-200 p-4">
              <div className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-2">Preisvorschau</div>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-slate-600">Netto: <strong>{(form.preis).toFixed(2)} €</strong></span>
                <span className="text-slate-400">+</span>
                <span className="text-slate-600">MwSt. {form.steuersatz}%: <strong>{(form.preis * form.steuersatz / 100).toFixed(2)} €</strong></span>
                <span className="text-slate-400">=</span>
                <span className="font-bold text-teal-700 text-base">Brutto: {(form.preis * (1 + form.steuersatz / 100)).toFixed(2)} €</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Btn onClick={onClose}>Abbrechen</Btn>
          <Btn teal type="submit">{isNew ? 'Artikel anlegen' : 'Änderungen speichern'}</Btn>
        </div>
      </form>
    </Modal>
  )
}
