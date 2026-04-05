'use client'
import { useState, Suspense, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { Badge } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import {
  getEinsaetze, addEinsatz, updateEinsatz, deleteEinsatz,
  getEffectiveStatus, daysRemaining,
  STATUS_LABELS, STATUS_COLORS, WECHSEL_LABELS,
  type Einsatz, type EinsatzStatus, type WechselTyp,
} from '@/lib/einsaetze'
import { getKlienten, updateKlient, type Klient } from '@/lib/klienten'
import { getBetreuerinnen, updateBetreuerin, type Betreuerin } from '@/lib/betreuerinnen'
import { getTaxiPartner, getTaxiByRegion, type Partner } from '@/lib/partner'
import { apiGetAll, apiInsert, apiUpdate, apiDelete } from '@/lib/api-client'
import clsx from 'clsx'

// ── Utils ──────────────────────────────────────────────────────────
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('de-AT') : '–'
const fmt = (n: number) => n ? n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' }) : '–'
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]
const addDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 86400000).toISOString().split('T')[0]
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)

function hatUeberschneidung(alle: Einsatz[], betreuerinId: string, von: string, bis: string, ignoreId?: string): Einsatz | null {
  return alle.find(e => e.id !== ignoreId && e.betreuerinId === betreuerinId &&
    e.status !== 'beendet' && e.status !== 'abgebrochen' && e.von < bis && e.bis > von) || null
}

// ── Turnus-Zeile (wie im Screenshot) ──────────────────────────────
function TurnusZeile({ e, betreuerin, alleTurnus, onEdit, onDelete, onStatusChange, taxiPartner }: {
  e: Einsatz; betreuerin?: Betreuerin; alleTurnus: Einsatz[]
  onEdit: () => void; onDelete: () => void
  onStatusChange: (status: EinsatzStatus) => void
  taxiPartner: Partner[]
}) {
  const [showMenu, setShowMenu] = useState(false)
  const status = getEffectiveStatus(e)
  const rem = daysRemaining(e.bis)
  const konflikt = e.betreuerinId ? hatUeberschneidung(alleTurnus, e.betreuerinId, e.von, e.bis, e.id) : null
  const isAktiv = status === 'aktiv'
  const isWechselOffen = status === 'wechsel_offen'
  const isGeplant = status === 'geplant'

  const taxiHinPartner = taxiPartner.find(t => e.taxiHin?.includes(t.kurzname) || e.taxiHin?.includes(t.id))
  const taxiRueckPartner = taxiPartner.find(t => e.taxiRueck?.includes(t.kurzname) || e.taxiRueck?.includes(t.id))

  return (
    <div className={clsx('grid items-center gap-0 border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/80',
      'grid-cols-[32px_48px_1fr_200px_60px_200px_160px_160px_40px]'
    )}>
      {/* Status-Indikator */}
      <div className="flex items-center justify-center pl-3">
        <div className={clsx('w-2.5 h-2.5 rounded-full',
          isAktiv ? 'bg-emerald-500' :
          isWechselOffen ? 'bg-amber-400 animate-pulse' :
          isGeplant ? 'bg-sky-400' :
          status === 'beendet' ? 'bg-slate-300' : 'bg-rose-400'
        )} />
      </div>

      {/* Konflikt / Warn Icon */}
      <div className="flex items-center justify-center gap-1">
        {konflikt && <span title={`⚡ Überschneidung mit ${konflikt.klientName}`} className="text-rose-500 text-sm cursor-help">⚡</span>}
        {isWechselOffen && !e.nachfolgerBetreuerinId && <span title="Kein Nachfolger geplant" className="text-amber-500 text-sm">!</span>}
        {/* Foto-Placeholder */}
        <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white',
          betreuerin ? 'bg-teal-500' : 'bg-slate-300')}>
          {betreuerin ? `${betreuerin.vorname[0]}${betreuerin.nachname[0]}` : '?'}
        </div>
      </div>

      {/* Betreuerin Name */}
      <div className="px-3 py-3.5">
        <div className="font-semibold text-slate-900 text-sm">
          {e.betreuerinName || <span className="text-rose-500">Keine Betreuerin</span>}
        </div>
        {betreuerin && (
          <div className="text-xs text-slate-400 mt-0.5">{betreuerin.nationalitaet} · {betreuerin.deutschkenntnisse}</div>
        )}
      </div>

      {/* Einsatzbeginn */}
      <div className="px-3 py-3.5">
        <div className="text-[10px] text-slate-400 mb-0.5">Einsatzbeginn</div>
        <div className="font-semibold text-slate-800 text-sm">{fmtDate(e.von)}</div>
      </div>

      {/* Tage */}
      <div className="px-2 py-3.5 text-center">
        <div className="font-bold text-slate-900 text-sm">{e.turnusTage}</div>
        <div className="text-[10px] text-slate-400">Tage</div>
      </div>

      {/* Einsatzende */}
      <div className="px-3 py-3.5">
        <div className="text-[10px] text-slate-400 mb-0.5">Einsatzende</div>
        <div className="font-semibold text-slate-800 text-sm">{fmtDate(e.bis)}</div>
        {rem >= 0 && rem <= 14 && status !== 'beendet' && (
          <div className={clsx('text-[10px] font-semibold', rem <= 7 ? 'text-amber-600' : 'text-sky-600')}>
            {rem === 0 ? 'Heute' : `${rem}T verbleibend`}
          </div>
        )}
      </div>

      {/* Taxi Hin */}
      <div className="px-3 py-3.5">
        <div className="text-[10px] text-slate-400 mb-0.5">🚕 Anreise</div>
        <div className="text-xs text-slate-700 truncate">{e.taxiHin || '–'}</div>
      </div>

      {/* Betreuungsart + Kommentar */}
      <div className="px-3 py-3.5">
        <div className="text-xs font-medium text-slate-600">{WECHSEL_LABELS[e.wechselTyp]}</div>
        {e.uebergabeNotiz && (
          <div className="text-[10px] text-slate-400 truncate mt-0.5">{e.uebergabeNotiz}</div>
        )}
        {e.nachfolgerBetreuerinName && (
          <div className="text-[10px] text-sky-600 mt-0.5">→ {e.nachfolgerBetreuerinName}</div>
        )}
      </div>

      {/* Aktionen ··· */}
      <div className="relative flex items-center justify-center pr-3">
        <button onClick={ev => { ev.stopPropagation(); setShowMenu(!showMenu) }}
          className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer bg-transparent border-none text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          ···
        </button>
        {showMenu && (
          <div className="absolute right-8 top-1 z-20 bg-white border border-slate-200 rounded-2xl shadow-xl py-1 min-w-40"
            onClick={ev => ev.stopPropagation()}>
            <button onClick={() => { onEdit(); setShowMenu(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">✏️ Bearbeiten</button>
            {status !== 'aktiv' && <button onClick={() => { onStatusChange('aktiv'); setShowMenu(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50 cursor-pointer">▶ Aktiv setzen</button>}
            {status !== 'beendet' && <button onClick={() => { onStatusChange('beendet'); setShowMenu(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 cursor-pointer">✓ Beenden</button>}
            <div className="border-t border-slate-100 my-1" />
            <button onClick={() => { if (confirm('Turnus löschen?')) { onDelete(); setShowMenu(false) } }}
              className="w-full text-left px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-50 cursor-pointer">✕ Löschen</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Turnus-Formular ────────────────────────────────────────────────
function TurnusForm({ klient, initial, betreuerinnen, alleTurnus, taxiPartner, onSave, onClose }: {
  klient: Klient; initial?: Einsatz; betreuerinnen: Betreuerin[]
  alleTurnus: Einsatz[]; taxiPartner: Partner[]
  onSave: (e: Einsatz) => void; onClose: () => void
}) {
  const isEdit = !!initial
  // Standard-Taxi aus Klienten-Ort
  const lokaleTaxis = getTaxiByRegion(klient.ort)
  const defaultTaxi = lokaleTaxis[0]

  const [form, setForm] = useState({
    betreuerinId: initial?.betreuerinId || '',
    betreuerinName: initial?.betreuerinName || '',
    von: initial?.von || today(),
    bis: initial?.bis || addDays(today(), 28),
    turnusTage: initial?.turnusTage || 28,
    wechselTyp: (initial?.wechselTyp || 'wechsel') as WechselTyp,
    taxiHin: initial?.taxiHin || defaultTaxi?.kurzname || '',
    taxiRueck: initial?.taxiRueck || defaultTaxi?.kurzname || '',
    taxiKosten: initial?.taxiKosten || ((defaultTaxi?.preisHin || 0) + (defaultTaxi?.preisRueck || 0)),
    uebergabeNotiz: initial?.uebergabeNotiz || '',
    nachfolgerBetreuerinId: initial?.nachfolgerBetreuerinId || '',
    nachfolgerBetreuerinName: initial?.nachfolgerBetreuerinName || '',
    wechselGeplantAm: initial?.wechselGeplantAm || '',
    notizen: initial?.notizen || '',
  })
  const [konflikt, setKonflikt] = useState<Einsatz | null>(null)

  function handleTurnus(tage: number) {
    const bis = addDays(form.von, tage)
    const k = form.betreuerinId ? hatUeberschneidung(alleTurnus, form.betreuerinId, form.von, bis, initial?.id) : null
    setKonflikt(k); setForm(f => ({ ...f, turnusTage: tage, bis, wechselGeplantAm: bis }))
  }

  function handleBetreuerin(id: string) {
    const b = betreuerinnen.find(b => b.id === id)
    if (!b) return
    const k = hatUeberschneidung(alleTurnus, id, form.von, form.bis, initial?.id)
    setKonflikt(k)
    setForm(f => ({ ...f, betreuerinId: id, betreuerinName: `${b.nachname} ${b.vorname}` }))
  }

  function handleVonBis(von: string, bis: string) {
    const tage = daysBetween(von, bis)
    const k = form.betreuerinId ? hatUeberschneidung(alleTurnus, form.betreuerinId, von, bis, initial?.id) : null
    setKonflikt(k); setForm(f => ({ ...f, von, bis, turnusTage: tage }))
  }

  function handleTaxiSelect(partnerId: string, richtung: 'hin' | 'rueck') {
    const p = taxiPartner.find(t => t.id === partnerId)
    if (!p) return
    setForm(f => ({
      ...f,
      [richtung === 'hin' ? 'taxiHin' : 'taxiRueck']: p.kurzname,
      taxiKosten: richtung === 'hin' ? (p.preisHin + (f.taxiKosten - (taxiPartner.find(t => f.taxiHin.includes(t.kurzname))?.preisHin || 0)))
        : (f.taxiKosten - (taxiPartner.find(t => f.taxiRueck.includes(t.kurzname))?.preisRueck || 0) + p.preisRueck),
    }))
  }

  function handleSave() {
    if (!form.betreuerinId) return alert('Bitte Betreuerin wählen')
    if (konflikt && !confirm('⚠️ Überschneidung! Trotzdem speichern?')) return
    const now = today()
    // Tagessatz + Gesamtbetrag aus Klientenprofil
    const ts = klient.tagessatzStandard || 80
    const gb = ts * form.turnusTage + form.taxiKosten
    if (isEdit && initial) {
      onSave({ ...initial, ...form, tagessatz: ts, gesamtbetrag: gb, aktualisiertAm: now })
    } else {
      onSave({
        id: uid(), ...form,
        klientId: klient.id, klientName: `${klient.nachname} ${klient.vorname}`,
        klientOrt: klient.ort, tagessatz: ts, gesamtbetrag: gb,
        status: 'geplant', abrechnungsStatus: 'offen', rechnungsId: '',
        zustaendig: klient.zustaendig || '',
        erstelltAm: now, aktualisiertAm: now,
      } as Einsatz)
    }
  }

  const verfuegbar = betreuerinnen.filter(b => !hatUeberschneidung(alleTurnus, b.id, form.von, form.bis, initial?.id))
  const belegt = betreuerinnen.filter(b => hatUeberschneidung(alleTurnus, b.id, form.von, form.bis, initial?.id))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 overflow-y-auto pt-8 pb-8" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-teal-700 px-7 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-white/60 uppercase tracking-widest mb-1">Geschäftsfall</div>
              <h2 className="text-xl font-bold text-white">{klient.nachname} {klient.vorname} · {klient.ort}</h2>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl cursor-pointer bg-transparent border-none">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {konflikt && (
            <div className="rounded-2xl bg-rose-50 border border-rose-300 px-4 py-3">
              <div className="font-bold text-rose-800 text-sm">⚡ Überschneidung!</div>
              <div className="text-sm text-rose-700 mt-0.5">{form.betreuerinName} ist bereits bei <strong>{konflikt.klientName}</strong> ({fmtDate(konflikt.von)} – {fmtDate(konflikt.bis)}) eingeplant.</div>
            </div>
          )}

          {/* Plausibilitätsprüfung Turnus-Dauer */}
          {form.von && form.bis && (() => {
            const tage = Math.round((new Date(form.bis).getTime() - new Date(form.von).getTime()) / 86400000)
            const erwartet = form.turnusTage || 28
            const abweichung = Math.abs(tage - erwartet)
            if (abweichung > 3 && tage > 0) {
              return (
                <div className="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3">
                  <div className="font-bold text-amber-800 text-sm">⚠️ Ungewöhnliche Turnus-Dauer</div>
                  <div className="text-sm text-amber-700 mt-0.5">
                    Gewählt: <strong>{tage} Tage</strong> — Erwartet für {erwartet}-Tage-Turnus: {erwartet} Tage.
                    Bitte Datum prüfen ({fmtDate(form.von)} bis {fmtDate(form.bis)}).
                  </div>
                </div>
              )
            }
            return null
          })()}

          {/* Zeitraum */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Zeitraum</div>
            <div className="flex gap-2 mb-3">
              {[14, 28].map(t => (
                <button key={t} type="button" onClick={() => handleTurnus(t)}
                  className={clsx('rounded-xl px-4 py-2 text-sm font-bold cursor-pointer border-2 transition-all',
                    form.turnusTage === t ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-teal-700 border-teal-200 hover:border-teal-400')}>
                  {t} Tage
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">Von {form.von && <span className="text-teal-600 font-semibold ml-1">{fmtDate(form.von)}</span>}</div>
                <input type="date" value={form.von} onChange={e => handleVonBis(e.target.value, form.bis)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  lang="de-AT" />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Bis {form.bis && <span className="text-teal-600 font-semibold ml-1">{fmtDate(form.bis)}</span>}</div>
                <input type="date" value={form.bis} onChange={e => handleVonBis(form.von, e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  lang="de-AT" />
              </div>
            </div>
          </div>

          {/* Betreuerin */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Betreuerin</div>
            <select value={form.betreuerinId} onChange={e => handleBetreuerin(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none font-semibold">
              <option value="">– Betreuerin wählen –</option>
              {verfuegbar.length > 0 && (
                <optgroup label="✅ Verfügbar">
                  {verfuegbar.map(b => <option key={b.id} value={b.id}>{b.nachname} {b.vorname} · {b.nationalitaet}</option>)}
                </optgroup>
              )}
              {belegt.length > 0 && (
                <optgroup label="⚡ Bereits eingeplant">
                  {belegt.map(b => <option key={b.id} value={b.id}>⚡ {b.nachname} {b.vorname}</option>)}
                </optgroup>
              )}
            </select>
          </div>

          {/* Taxi */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Taxi (aus Profil, änderbar)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">Anreise 🚕</div>
                <select value={taxiPartner.find(t => form.taxiHin.includes(t.kurzname))?.id || ''}
                  onChange={e => handleTaxiSelect(e.target.value, 'hin')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none">
                  <option value="">– Taxi wählen –</option>
                  {taxiPartner.map(t => <option key={t.id} value={t.id}>{t.kurzname} (€{t.preisHin})</option>)}
                </select>
                <input value={form.taxiHin} onChange={e => setForm(f => ({ ...f, taxiHin: e.target.value }))}
                  placeholder="oder Freitext"
                  className="w-full mt-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none" />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Abreise 🚕</div>
                <select value={taxiPartner.find(t => form.taxiRueck.includes(t.kurzname))?.id || ''}
                  onChange={e => handleTaxiSelect(e.target.value, 'rueck')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none">
                  <option value="">– Taxi wählen –</option>
                  {taxiPartner.map(t => <option key={t.id} value={t.id}>{t.kurzname} (€{t.preisRueck})</option>)}
                </select>
                <input value={form.taxiRueck} onChange={e => setForm(f => ({ ...f, taxiRueck: e.target.value }))}
                  placeholder="oder Freitext"
                  className="w-full mt-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none" />
              </div>
            </div>
          </div>

          {/* Wechseltyp + Nachfolger */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Wechseltyp</div>
              <select value={form.wechselTyp} onChange={e => setForm(f => ({ ...f, wechselTyp: e.target.value as WechselTyp }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none">
                <option value="erstanreise">Erstanreise</option>
                <option value="wechsel">Wechsel</option>
                <option value="verlaengerung">Verlängerung</option>
                <option value="neustart">Neustart</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Nachfolge geplant</div>
              <select value={form.nachfolgerBetreuerinId}
                onChange={e => {
                  const b = betreuerinnen.find(b => b.id === e.target.value)
                  setForm(f => ({ ...f, nachfolgerBetreuerinId: e.target.value, nachfolgerBetreuerinName: b ? `${b.nachname} ${b.vorname}` : '' }))
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none">
                <option value="">– optional –</option>
                {betreuerinnen.map(b => <option key={b.id} value={b.id}>{b.nachname} {b.vorname}</option>)}
              </select>
            </div>
          </div>

          {/* Übergabe */}
          <textarea value={form.uebergabeNotiz} onChange={e => setForm(f => ({ ...f, uebergabeNotiz: e.target.value }))}
            placeholder="Übergabe-Notizen: Medikamente, Arzttermine, Besonderheiten ..."
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm resize-none outline-none" />

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">Abbrechen</button>
            <button onClick={handleSave}
              className={clsx('flex-1 rounded-xl px-5 py-2.5 text-sm font-bold text-white cursor-pointer border-none',
                konflikt ? 'bg-amber-600 hover:bg-amber-700' : 'bg-teal-700 hover:bg-teal-800')}>
              {konflikt ? '⚠️ Trotzdem speichern' : isEdit ? 'Speichern' : '+ Turnus anlegen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Geschäftsfall (Klient-Detail mit allen Turnussen) ──────────────
function Geschaeftsfall({ klient, einsaetze, betreuerinnen, taxiPartner, onClose, onNeuTurnus, onEditTurnus, onDeleteTurnus, onStatusChange }: {
  klient: Klient; einsaetze: Einsatz[]; betreuerinnen: Betreuerin[]
  taxiPartner: Partner[]; onClose: () => void
  onNeuTurnus: () => void; onEditTurnus: (e: Einsatz) => void
  onDeleteTurnus: (id: string) => void; onStatusChange: (id: string, s: EinsatzStatus) => void
}) {
  const klientTurnus = einsaetze
    .filter(e => e.klientId === klient.id)
    .sort((a, b) => b.von.localeCompare(a.von))

  const aktiv = klientTurnus.find(e => getEffectiveStatus(e) === 'aktiv' || getEffectiveStatus(e) === 'wechsel_offen')
  const geplant = klientTurnus.filter(e => getEffectiveStatus(e) === 'geplant')
  const beendet = klientTurnus.filter(e => getEffectiveStatus(e) === 'beendet' || getEffectiveStatus(e) === 'abgebrochen')

  const [rangeVon, setRangeVon] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0] })
  const [rangeBis, setRangeBis] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d.toISOString().split('T')[0] })

  const sichtbareTurnus = klientTurnus.filter(e => e.von <= rangeBis && e.bis >= rangeVon)

  const gesamtkosten = klientTurnus
    .filter(e => getEffectiveStatus(e) !== 'abgebrochen')
    .reduce((s, e) => s + e.gesamtbetrag + e.taxiKosten, 0)

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end bg-slate-900/30" onClick={onClose}>
      <div className="h-full w-full max-w-5xl bg-white shadow-2xl overflow-hidden flex flex-col"
        style={{ borderRadius: '28px 0 0 28px' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-8 py-7 flex-shrink-0">
          <div className="flex items-start justify-between mb-5">
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl cursor-pointer bg-transparent border-none">✕</button>
            <button onClick={onNeuTurnus}
              className="rounded-2xl bg-white text-teal-700 px-5 py-2.5 text-sm font-bold cursor-pointer border-none hover:bg-teal-50 shadow">
              + Neuer Turnus
            </button>
          </div>

          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-bold text-white flex-shrink-0">
              {klient.vorname[0]}{klient.nachname[0]}
            </div>
            <div className="flex-1">
              <div className="text-xs text-white/60 uppercase tracking-widest mb-1">Geschäftsfall</div>
              <h2 className="text-3xl font-bold text-white">{klient.nachname}, {klient.vorname}</h2>
              <div className="text-white/70 mt-1">📍 {klient.ort} · {klient.plz}</div>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge label={`Pflegestufe ${klient.pflegestufe}`} className="text-xs border bg-white/15 text-white border-white/30" />
                {klient.aktuellerTurnus && <Badge label={`${klient.aktuellerTurnus} Tage Turnus`} className="text-xs border bg-white/15 text-white border-white/30" />}
              </div>
            </div>
          </div>

          {/* Status-Kacheln */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className={clsx('rounded-2xl px-4 py-3 border',
              aktiv ? 'bg-emerald-500/20 border-emerald-300/30' : 'bg-white/10 border-white/20')}>
              <div className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">Aktuelle Betreuerin</div>
              <div className="text-sm font-bold text-white truncate">{aktiv?.betreuerinName || '– keine –'}</div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 px-4 py-3">
              <div className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">Aktueller Turnus</div>
              <div className="text-sm font-bold text-white">{aktiv ? `${fmtDate(aktiv.von)} – ${fmtDate(aktiv.bis)}` : '–'}</div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 px-4 py-3">
              <div className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">Nächster Wechsel</div>
              <div className="text-sm font-bold text-white">{aktiv ? fmtDate(aktiv.bis) : '–'}</div>
              {aktiv && daysRemaining(aktiv.bis) <= 14 && daysRemaining(aktiv.bis) >= 0 && (
                <div className="text-[10px] text-amber-300 mt-0.5">⚠️ {daysRemaining(aktiv.bis)}T</div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Zeitraum Filter */}
          <div className="px-7 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
            <span className="text-sm text-slate-500 font-medium">Einsätze anzeigen im Zeitraum:</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">von</span>
              <input type="date" value={rangeVon} onChange={e => setRangeVon(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">bis</span>
              <input type="date" value={rangeBis} onChange={e => setRangeBis(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none" />
            </div>
            <span className="text-xs text-slate-400">{sichtbareTurnus.length} Einträge</span>
          </div>

          {/* Tabellen-Header */}
          <div className="grid items-center border-b border-slate-200 bg-slate-50/80 sticky top-0 z-10 text-xs font-bold text-slate-400 uppercase tracking-wider
            grid-cols-[32px_48px_1fr_200px_60px_200px_160px_160px_40px]">
            <div />
            <div />
            <div className="px-3 py-3">Betreuer:in</div>
            <div className="px-3 py-3">Einsatzbeginn</div>
            <div className="px-2 py-3 text-center">Tage</div>
            <div className="px-3 py-3">Einsatzende</div>
            <div className="px-3 py-3">Taxi Anreise</div>
            <div className="px-3 py-3">Betreuungsart</div>
            <div />
          </div>

          {/* Aktiv / Wechsel offen */}
          {sichtbareTurnus.filter(e => ['aktiv', 'wechsel_offen'].includes(getEffectiveStatus(e))).length > 0 && (
            <div>
              {sichtbareTurnus.filter(e => ['aktiv', 'wechsel_offen'].includes(getEffectiveStatus(e))).map(e => (
                <TurnusZeile key={e.id} e={e}
                  betreuerin={betreuerinnen.find(b => b.id === e.betreuerinId)}
                  alleTurnus={einsaetze} taxiPartner={taxiPartner}
                  onEdit={() => onEditTurnus(e)}
                  onDelete={() => onDeleteTurnus(e.id)}
                  onStatusChange={s => onStatusChange(e.id, s)} />
              ))}
            </div>
          )}

          {/* Geplant */}
          {sichtbareTurnus.filter(e => getEffectiveStatus(e) === 'geplant').length > 0 && (
            <div className="border-t border-dashed border-slate-200">
              <div className="px-5 py-2 text-[11px] font-bold text-sky-600 uppercase tracking-widest bg-sky-50/50">
                Geplant ({sichtbareTurnus.filter(e => getEffectiveStatus(e) === 'geplant').length})
              </div>
              {sichtbareTurnus.filter(e => getEffectiveStatus(e) === 'geplant').map(e => (
                <TurnusZeile key={e.id} e={e}
                  betreuerin={betreuerinnen.find(b => b.id === e.betreuerinId)}
                  alleTurnus={einsaetze} taxiPartner={taxiPartner}
                  onEdit={() => onEditTurnus(e)}
                  onDelete={() => onDeleteTurnus(e.id)}
                  onStatusChange={s => onStatusChange(e.id, s)} />
              ))}
            </div>
          )}

          {/* Beendet */}
          {sichtbareTurnus.filter(e => ['beendet', 'abgebrochen'].includes(getEffectiveStatus(e))).length > 0 && (
            <div className="border-t border-dashed border-slate-200">
              <div className="px-5 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                Abgeschlossen ({sichtbareTurnus.filter(e => ['beendet', 'abgebrochen'].includes(getEffectiveStatus(e))).length})
              </div>
              {sichtbareTurnus.filter(e => ['beendet', 'abgebrochen'].includes(getEffectiveStatus(e))).map(e => (
                <TurnusZeile key={e.id} e={e}
                  betreuerin={betreuerinnen.find(b => b.id === e.betreuerinId)}
                  alleTurnus={einsaetze} taxiPartner={taxiPartner}
                  onEdit={() => onEditTurnus(e)}
                  onDelete={() => onDeleteTurnus(e.id)}
                  onStatusChange={s => onStatusChange(e.id, s)} />
              ))}
            </div>
          )}

          {sichtbareTurnus.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-2">📋</div>
              <div>Keine Einsätze im gewählten Zeitraum</div>
              <button onClick={onNeuTurnus} className="mt-4 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 text-teal-700 px-6 py-3 text-sm font-semibold cursor-pointer hover:bg-teal-100">
                + Ersten Turnus anlegen
              </button>
            </div>
          )}

          {/* Klient-Info Footer */}
          <div className="border-t border-slate-100 px-7 py-5 bg-slate-50 mt-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Klient-Details (aus Stammdaten)</div>
            <div className="grid grid-cols-4 gap-3 text-sm">
              {[
                ['Hausarzt', klient.hausarzt],
                ['Krankenkasse', klient.krankenkasse],
                ['Mobilität', klient.mobilitaet],
                ['Zahlungsart', klient.zahlungsart],
              ].map(([l, v]) => v && (
                <div key={String(l)} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="text-xs text-slate-400">{l}</div>
                  <div className="font-semibold text-slate-700 mt-0.5 text-xs">{v}</div>
                </div>
              ))}
            </div>
            {klient.besonderheiten && (
              <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
                📌 {klient.besonderheiten}
              </div>
            )}
            {klient.allergien && (
              <div className="mt-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-900">
                ⚠️ Allergie: {klient.allergien}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// HAUPTSEITE
// ══════════════════════════════════════════════════════════════════
function TurnusverwaltungPageInner() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [einsaetze, setEinsaetze] = useState<Einsatz[]>([])
  const [klienten, setKlienten] = useState<Klient[]>([])
  const [betreuerinnen, setBetreuerinnen] = useState<Betreuerin[]>([])
  const [taxiPartner, setTaxiPartner] = useState<Partner[]>([])
  const [selectedKlient, setSelectedKlient] = useState<Klient | null>(null)
  const [showTurnusForm, setShowTurnusForm] = useState(false)
  const [editTurnus, setEditTurnus] = useState<Einsatz | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('aktiv')

  function reload() {
    apiGetAll<Einsatz>('einsaetze').then(setEinsaetze)
    apiGetAll<Klient>('klienten').then(setKlienten)
    apiGetAll<Betreuerin>('betreuerinnen').then(setBetreuerinnen)
    apiGetAll<Partner>('partner').then(list => setTaxiPartner(list.filter((p: any) => p.typ === 'taxi' && p.aktiv !== false)))
  }
  useEffect(() => { reload() }, [])
  useEffect(() => {
    if (searchParams.get('neu') === '1') { setShowTurnusForm(true); router.replace('/turnus') }
    const kid = searchParams.get('klient') || searchParams.get('klientId')
    if (kid) {
      apiGetAll<Klient>('klienten').then(list => {
        const k = list.find(k => k.id === kid)
        if (k) {
          setSelectedKlient(k)
          // Wenn klientId direkt übergeben → sofort Turnusformular öffnen
          if (searchParams.get('klientId')) setShowTurnusForm(true)
        }
      })
      router.replace('/turnus')
    }
  }, [searchParams])

  // Bidirektionale Synchronisation
  async function handleSaveTurnus(e: Einsatz) {
    const isNew = !einsaetze.find(x => x.id === e.id)
    if (isNew) await apiInsert('einsaetze', e)
    else await apiUpdate('einsaetze', e.id, e)
    // Klient aktualisieren
    const status = getEffectiveStatus(e)
    if (status !== 'beendet' && status !== 'abgebrochen') {
      await apiUpdate('klienten', e.klientId, {
        aktuelleBetreuerin: e.betreuerinName,
        aktuellerEinsatzBis: e.bis,
        naechsterWechsel: e.nachfolgerBetreuerinId ? e.bis : '',
        aktuellerTurnus: (e.turnusTage === 28 ? '28' : e.turnusTage === 14 ? '14' : 'flexibel'),
      })
    }
    // Betreuerin aktualisieren
    if (e.betreuerinId) {
      await apiUpdate('betreuerinnen', e.betreuerinId, {
        status: status === 'aktiv' ? 'im_einsatz' : 'verfuegbar',
        aktuellerEinsatzKlient: e.klientName,
        aktuellerEinsatzOrt: e.klientOrt,
        aktuellerEinsatzBis: e.bis,
        verfuegbarAb: e.bis,
      })
    }
    setShowTurnusForm(false); setEditTurnus(null)
    reload()
    // selectedKlient refreshen
    if (selectedKlient) {
      const fresh = klienten.find(k => k.id === selectedKlient.id)
      if (fresh) setSelectedKlient({ ...fresh, ...{ aktuelleBetreuerin: e.betreuerinName } })
    }
  }

  async function handleDeleteTurnus(id: string) {
    await apiDelete('einsaetze', id); reload()
  }

  async function handleStatusChange(id: string, status: EinsatzStatus) {
    await apiUpdate('einsaetze', id, { status })
    const e = einsaetze.find(x => x.id === id)
    if (e && (status === 'beendet' || status === 'abgebrochen')) {
      await apiUpdate('betreuerinnen', e.betreuerinId, { status: 'verfuegbar', aktuellerEinsatzKlient: '', aktuellerEinsatzOrt: '', aktuellerEinsatzBis: '' })
    }
    reload()
  }

  // Klienten mit ihren aktuellen Einsatz-Infos
  const klientenMitStatus = useMemo(() => {
    return klienten
      .filter(k => k.status !== 'beendet')
      .map(k => {
        const turnus = einsaetze.filter(e => e.klientId === k.id)
        const aktiv = turnus.find(e => ['aktiv', 'wechsel_offen'].includes(getEffectiveStatus(e)))
        const geplant = turnus.find(e => getEffectiveStatus(e) === 'geplant')
        const wechselOffen = turnus.some(e => getEffectiveStatus(e) === 'wechsel_offen')
        const konflikt = turnus.some(e => e.betreuerinId && hatUeberschneidung(einsaetze, e.betreuerinId, e.von, e.bis, e.id))
        return { klient: k, aktiv, geplant, wechselOffen, konflikt, turnusCount: turnus.length }
      })
      .filter(x => {
        if (filterStatus === 'aktiv') return x.aktiv || x.geplant
        if (filterStatus === 'wechsel') return x.wechselOffen
        if (filterStatus === 'ohne') return !x.aktiv && !x.geplant
        return true
      })
      .filter(x => {
        if (!search) return true
        const q = search.toLowerCase()
        return [x.klient.vorname, x.klient.nachname, x.klient.ort, x.aktiv?.betreuerinName].join(' ').toLowerCase().includes(q)
      })
  }, [klienten, einsaetze, filterStatus, search])

  const metrics = useMemo(() => ({
    aktiv: einsaetze.filter(e => getEffectiveStatus(e) === 'aktiv').length,
    wechselOffen: einsaetze.filter(e => getEffectiveStatus(e) === 'wechsel_offen').length,
    ohneBetreuerin: klienten.filter(k => k.status === 'aktiv' && !k.aktuelleBetreuerin).length,
    konflikte: einsaetze.filter(e => e.betreuerinId && hatUeberschneidung(einsaetze, e.betreuerinId, e.von, e.bis, e.id)).length,
  }), [einsaetze, klienten])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>
  if (!user) return null

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 lg:p-8">

        {/* Modals */}
        {(showTurnusForm || editTurnus) && selectedKlient && (
          <TurnusForm
            klient={selectedKlient}
            initial={editTurnus || undefined}
            betreuerinnen={betreuerinnen}
            alleTurnus={einsaetze}
            taxiPartner={taxiPartner}
            onSave={handleSaveTurnus}
            onClose={() => { setShowTurnusForm(false); setEditTurnus(null) }}
          />
        )}

        {selectedKlient && !showTurnusForm && !editTurnus && (
          <Geschaeftsfall
            klient={selectedKlient}
            einsaetze={einsaetze}
            betreuerinnen={betreuerinnen}
            taxiPartner={taxiPartner}
            onClose={() => setSelectedKlient(null)}
            onNeuTurnus={() => setShowTurnusForm(true)}
            onEditTurnus={e => { setEditTurnus(e); setShowTurnusForm(false) }}
            onDeleteTurnus={handleDeleteTurnus}
            onStatusChange={handleStatusChange}
          />
        )}

        {/* Header */}
        <div className="rounded-[32px] border border-slate-200 bg-white px-8 py-7 shadow-sm mb-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex gap-2 mb-3 flex-wrap text-sm">
                <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">Laufend</span>
                <span className="rounded-full bg-violet-100 px-3 py-1 font-medium text-violet-700">24h Pflege</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">Turnus aktiv</span>
                {metrics.konflikte > 0 && <span className="rounded-full bg-rose-100 px-3 py-1 font-medium text-rose-700">⚡ {metrics.konflikte} Konflikt{metrics.konflikte > 1 ? 'e' : ''}</span>}
              </div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">Turnusverwaltung</h1>
              <p className="text-slate-500">Jede Betreuung ist ein Geschäftsfall · Klient anklicken zum Öffnen</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 flex-shrink-0">
              {[
                ['Aktiv', metrics.aktiv, 'text-emerald-700 bg-emerald-50 border-emerald-200'],
                ['Wechsel offen', metrics.wechselOffen, metrics.wechselOffen > 0 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-400 bg-white border-slate-200'],
                ['Ohne Betreuerin', metrics.ohneBetreuerin, metrics.ohneBetreuerin > 0 ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-slate-300 bg-white border-slate-100'],
                ['Konflikte', metrics.konflikte, metrics.konflikte > 0 ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-slate-300 bg-white border-slate-100'],
              ].map(([l, v, c]) => (
                <div key={String(l)} className={clsx('min-w-[120px] rounded-3xl border px-4 py-4 shadow-sm', c)}>
                  <div className="text-xs uppercase tracking-wide text-slate-500">{l}</div>
                  <div className="mt-2 text-3xl font-bold">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-3 mb-5 flex-wrap items-center">
          <div className="flex-1 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <span className="text-slate-400">🔎</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Klient, Betreuerin, Ort ..."
              className="flex-1 bg-transparent border-none text-sm text-slate-800 placeholder-slate-400 outline-none" />
            {search && <button onClick={() => setSearch('')} className="text-slate-400 cursor-pointer bg-transparent border-none">✕</button>}
          </div>
          {[
            ['aktiv', 'Laufend & Geplant'],
            ['wechsel', 'Wechsel offen'],
            ['ohne', 'Ohne Betreuerin'],
            ['alle', 'Alle Klienten'],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={clsx('rounded-2xl px-4 py-2.5 text-sm font-semibold cursor-pointer border transition-all shadow-sm',
                filterStatus === v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
              {l}
            </button>
          ))}
        </div>

        {/* Klienten-Liste */}
        <div className="space-y-3">
          {klientenMitStatus.length === 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center text-slate-400 shadow-sm">
              <div className="text-5xl mb-3">📋</div>
              <div className="text-lg font-medium">Keine Einträge gefunden</div>
            </div>
          )}

          {klientenMitStatus.map(({ klient: k, aktiv, geplant, wechselOffen, konflikt }) => (
            <div key={k.id}
              onClick={() => setSelectedKlient(k)}
              className={clsx('rounded-[28px] border bg-white px-6 py-5 shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.002]',
                wechselOffen ? 'border-amber-300' : konflikt ? 'border-rose-300' : 'border-slate-200'
              )}>
              <div className="flex items-center gap-5">
                {/* Status-Dot */}
                <div className={clsx('w-3 h-3 rounded-full flex-shrink-0',
                  wechselOffen ? 'bg-amber-400 animate-pulse' :
                  aktiv ? 'bg-emerald-500' :
                  geplant ? 'bg-sky-400' : 'bg-slate-300'
                )} />

                {/* Avatar */}
                <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xl flex-shrink-0">
                  {k.vorname[0]}{k.nachname[0]}
                </div>

                {/* Klient-Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900 text-xl">{k.nachname}, {k.vorname}</span>
                    {wechselOffen && <Badge label="⚠️ Wechsel offen" className="text-xs bg-amber-100 text-amber-700 border-amber-300" />}
                    {konflikt && <Badge label="⚡ Konflikt" className="text-xs bg-rose-100 text-rose-700 border-rose-300" />}
                    {!aktiv && !geplant && <Badge label="Kein aktiver Einsatz" className="text-xs bg-slate-100 text-slate-500 border-slate-200" />}
                  </div>
                  <div className="text-sm text-slate-500">📍 {k.ort} · Pflegestufe {k.pflegestufe}</div>
                </div>

                {/* Slot 1: Aktuelle Betreuerin */}
                <div className="min-w-[200px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Aktuell</div>
                  <div className="font-semibold text-slate-900 text-sm truncate">
                    {aktiv?.betreuerinName || <span className="text-slate-400 font-normal">– keine –</span>}
                  </div>
                  {aktiv && <div className="text-xs text-slate-400 mt-0.5">{aktiv.turnusTage} Tage</div>}
                </div>

                {/* Slot 2: Nächster Wechsel */}
                <div className="min-w-[160px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Nächster Wechsel</div>
                  <div className={clsx('font-semibold text-sm',
                    aktiv && daysRemaining(aktiv.bis) <= 7 ? 'text-amber-600' : 'text-slate-900')}>
                    {aktiv ? fmtDate(aktiv.bis) : '–'}
                  </div>
                  {aktiv && daysRemaining(aktiv.bis) >= 0 && (
                    <div className={clsx('text-xs mt-0.5', daysRemaining(aktiv.bis) <= 7 ? 'text-amber-500 font-semibold' : 'text-slate-400')}>
                      {daysRemaining(aktiv.bis) === 0 ? 'Heute' : `${daysRemaining(aktiv.bis)} Tage`}
                    </div>
                  )}
                </div>

                {/* Slot 3: Geplant */}
                <div className="min-w-[160px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Geplant</div>
                  <div className="font-semibold text-sm text-slate-900 truncate">
                    {geplant?.betreuerinName || <span className="text-slate-400 font-normal">– offen –</span>}
                  </div>
                  {geplant && <div className="text-xs text-slate-400 mt-0.5">ab {fmtDate(geplant.von)}</div>}
                </div>

                {/* Pfeil */}
                <div className="text-slate-300 text-2xl flex-shrink-0">›</div>
              </div>
            </div>
          ))}
        </div>

        {/* Warnungs-Bereich */}
        {metrics.wechselOffen > 0 && (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-amber-200 bg-amber-100/60 flex items-center justify-between">
              <h3 className="font-bold text-amber-900">⚠️ Offene Wechsel</h3>
              <span className="text-amber-700 text-sm">{metrics.wechselOffen} Betreuung{metrics.wechselOffen > 1 ? 'en' : ''} brauchen einen Nachfolger</span>
            </div>
            {einsaetze.filter(e => getEffectiveStatus(e) === 'wechsel_offen').map(e => (
              <div key={e.id}
                onClick={() => { const k = klienten.find(k => k.id === e.klientId); if (k) setSelectedKlient(k) }}
                className="px-6 py-4 border-b border-amber-100 last:border-0 flex items-center gap-4 cursor-pointer hover:bg-amber-100/30">
                <div className="flex-1">
                  <div className="font-semibold text-amber-900">{e.klientName} · {e.klientOrt}</div>
                  <div className="text-sm text-amber-700">{e.betreuerinName} · endet {fmtDate(e.bis)}</div>
                  {!e.nachfolgerBetreuerinId && <div className="text-xs text-rose-700 mt-0.5 font-semibold">Kein Nachfolger geplant!</div>}
                </div>
                <div className="text-2xl font-bold text-amber-800">{daysRemaining(e.bis)}T</div>
                <div className="rounded-2xl border border-amber-300 text-amber-700 text-xs px-4 py-2 font-semibold">
                  Öffnen →
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default function TurnusverwaltungPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>}><TurnusverwaltungPageInner /></Suspense>
}
