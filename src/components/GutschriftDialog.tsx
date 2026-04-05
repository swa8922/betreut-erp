'use client'
import { useState } from 'react'
import { Btn } from '@/components/ui'
import { type Dokument, type Position, berechnePositionSummen, berechneDokumentSummen } from '@/lib/finanzen'

const fmt = (n: number) => n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })

interface Props {
  original: Dokument
  onConfirm: (positionen: Position[]) => void
  onClose: () => void
}

export default function GutschriftDialog({ original, onConfirm, onClose }: Props) {
  // Jede Position: ausgewählt ja/nein + anpassbarer Betrag
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(original.positionen.map(p => [p.id, true]))
  )
  const [mengen, setMengen] = useState<Record<string, number>>(
    Object.fromEntries(original.positionen.map(p => [p.id, p.menge]))
  )
  const [gutschriftArt, setGutschriftArt] = useState<'voll' | 'teilweise'>('voll')

  function handleMengeChange(id: string, menge: number) {
    setMengen(m => ({ ...m, [id]: menge }))
  }

  function handleSelectAll(val: boolean) {
    setSelected(Object.fromEntries(original.positionen.map(p => [p.id, val])))
  }

  // Berechnete Gutschrift-Positionen
  const gutschriftPositionen: Position[] = original.positionen
    .filter(p => selected[p.id])
    .map(p => {
      const menge = gutschriftArt === 'voll' ? p.menge : (mengen[p.id] ?? p.menge)
      return berechnePositionSummen({ ...p, id: `gs_${p.id}`, menge, manuellGeaendert: gutschriftArt === 'teilweise' })
    })

  const summen = berechneDokumentSummen(gutschriftPositionen)
  const allSelected = original.positionen.every(p => selected[p.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-emerald-700 rounded-t-3xl px-8 py-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/60 mb-1">Gutschrift erstellen</div>
              <h2 className="text-2xl font-bold">Gutschrift zu {original.dokumentNr}</h2>
              <div className="text-white/70 mt-1">{original.klientName} · Originalrechnung: {fmt(original.summeBrutto)}</div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl bg-transparent border-none cursor-pointer">✕</button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          {/* Art der Gutschrift */}
          <div>
            <div className="text-sm font-bold text-slate-700 mb-3">Art der Gutschrift</div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button"
                onClick={() => { setGutschriftArt('voll'); handleSelectAll(true) }}
                className={`rounded-2xl border-2 p-4 text-left cursor-pointer transition-all ${gutschriftArt === 'voll' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <div className="font-bold text-slate-900">Volle Gutschrift</div>
                <div className="text-sm text-slate-500 mt-1">Alle Positionen werden vollständig gutgeschrieben</div>
                <div className="text-lg font-bold text-emerald-700 mt-2">–{fmt(original.summeBrutto)}</div>
              </button>
              <button type="button"
                onClick={() => setGutschriftArt('teilweise')}
                className={`rounded-2xl border-2 p-4 text-left cursor-pointer transition-all ${gutschriftArt === 'teilweise' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <div className="font-bold text-slate-900">Teilgutschrift</div>
                <div className="text-sm text-slate-500 mt-1">Einzelne Positionen oder Mengen auswählen</div>
                <div className="text-lg font-bold text-emerald-700 mt-2">Individuell</div>
              </button>
            </div>
          </div>

          {/* Positionen */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-slate-700">Positionen</div>
              {gutschriftArt === 'teilweise' && (
                <button type="button" onClick={() => handleSelectAll(!allSelected)}
                  className="text-xs text-teal-600 underline cursor-pointer bg-transparent border-none">
                  {allSelected ? 'Alle abwählen' : 'Alle auswählen'}
                </button>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              {original.positionen.map(p => (
                <div key={p.id} className={`flex items-center gap-4 px-5 py-4 border-b border-slate-50 last:border-0 transition-colors ${!selected[p.id] && gutschriftArt === 'teilweise' ? 'opacity-40' : ''}`}>
                  {gutschriftArt === 'teilweise' && (
                    <input type="checkbox" checked={selected[p.id] ?? true}
                      onChange={e => setSelected(s => ({ ...s, [p.id]: e.target.checked }))}
                      className="w-4 h-4 accent-emerald-700 flex-shrink-0 cursor-pointer" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 text-sm">{p.bezeichnung}</div>
                    {p.beschreibung && <div className="text-xs text-slate-400 mt-0.5">{p.beschreibung}</div>}
                    <div className="text-xs text-slate-500 mt-0.5">
                      {p.menge} {p.einheit} × {fmt(p.einzelpreis)} · MwSt. {p.steuersatz}%
                    </div>
                  </div>
                  {gutschriftArt === 'teilweise' && selected[p.id] && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <label className="text-xs text-slate-500">Menge:</label>
                      <input type="number"
                        value={mengen[p.id] ?? p.menge}
                        onChange={e => handleMengeChange(p.id, parseFloat(e.target.value) || 0)}
                        min="0.01" max={p.menge} step="0.01"
                        className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-right"
                      />
                      <span className="text-xs text-slate-400">/ {p.menge}</span>
                    </div>
                  )}
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-slate-900 text-sm">{fmt(p.bruttoBetrag)}</div>
                    {gutschriftArt === 'teilweise' && selected[p.id] && mengen[p.id] !== p.menge && (
                      <div className="text-xs text-emerald-600">
                        –{fmt(berechnePositionSummen({ ...p, menge: mengen[p.id] ?? p.menge }).bruttoBetrag)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gutschrift-Vorschau */}
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5">
            <div className="text-sm font-bold text-emerald-800 mb-3">Gutschrift-Vorschau</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm text-emerald-700">
                <span>Summe Netto</span>
                <span>–{fmt(summen.summeNetto)}</span>
              </div>
              {Object.entries(summen.summeSteuern).filter(([, v]) => v !== 0).map(([satz, betrag]) => (
                <div key={satz} className="flex justify-between text-sm text-emerald-600">
                  <span>MwSt. {satz}%</span>
                  <span>–{fmt(betrag)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-emerald-800 pt-2 border-t border-emerald-300 text-base">
                <span>Gutschrift Gesamt</span>
                <span className="text-xl">–{fmt(summen.summeBrutto)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 flex justify-between">
          <Btn onClick={onClose}>Abbrechen</Btn>
          <button
            onClick={() => gutschriftPositionen.length > 0 && onConfirm(gutschriftPositionen)}
            disabled={gutschriftPositionen.length === 0}
            className="rounded-2xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white cursor-pointer border-none hover:bg-emerald-800 disabled:opacity-40">
            Gutschrift {gutschriftArt === 'voll' ? 'vollständig' : 'teilweise'} erstellen (–{fmt(summen.summeBrutto)})
          </button>
        </div>
      </div>
    </div>
  )
}
