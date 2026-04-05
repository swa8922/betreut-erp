'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Btn, Field, SelField, TextArea } from '@/components/ui'
import {
  updateKlient, getKlienten, isDokAbgelaufen, isDokBaldAbgelaufen,
  STATUS_LABELS, STATUS_COLORS, FOERDERUNG_LABELS, FOERDERUNG_COLORS,
  TURNUS_LABELS, MOBILITAET_LABELS, DOK_KAT_LABELS, DOK_KAT_ICONS,
  FOERDER_TYP_LABELS, FOERDER_TYP_ICONS, FOERDER_STATUS_LABELS, FOERDER_STATUS_COLORS,
  getFoerderungWarnungen,
  type Klient, type KlientDokument, type Kontakt, type BetreuungsEinsatz, type KlientDokKat,
  type FoerderEintrag, type FoerderTyp, type FoerderStatus,
} from '@/lib/klienten'
import { getAuswahlOptionen } from '@/lib/admin'
import { apiGetAll, apiUpdate, apiInsert } from '@/lib/api-client'
import { bereiteKiInhaltVor as bereiteKiInhaltVorK } from '@/lib/ki-dokument'
import DokumentationsNotiz, { type Notizeintrag } from '@/components/DokumentationsNotiz'
import {
  getEinsaetze, getEffectiveStatus as getEinsatzStatus, daysRemaining as einsatzDaysRemaining,
  STATUS_LABELS as EINSATZ_STATUS_LABELS, STATUS_COLORS as EINSATZ_STATUS_COLORS,
  type Einsatz as EinsatzRecord
} from '@/lib/einsaetze'
import clsx from 'clsx'



const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('de-AT') : '–'
const fmt = (n: number) => n ? n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' }) : '–'
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]
const age = (dob: string) => dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000)) : null

function Sterne({ wert }: { wert: number }) {
  return <span className="text-amber-400">{'★'.repeat(wert)}{'☆'.repeat(5 - wert)}</span>
}

function AblaufBadge({ dok }: { dok: KlientDokument }) {
  if (!dok.ablaufdatum) return null
  if (isDokAbgelaufen(dok)) return <Badge label="⚠️ Abgelaufen" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200" />
  if (isDokBaldAbgelaufen(dok)) {
    const days = Math.ceil((new Date(dok.ablaufdatum).getTime() - Date.now()) / 86400000)
    return <Badge label={`⚠️ ${days}T`} className="text-[10px] bg-amber-50 text-amber-700 border-amber-200" />
  }
  return <Badge label={`✓ ${fmtDate(dok.ablaufdatum)}`} className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200" />
}

// ══════════════════════════════════════════════════════════════
// PFLEGEGELD BETRÄGE ÖSTERREICH (aktuell 2024/2025)
// ══════════════════════════════════════════════════════════════
const PFLEGEGELD: Record<string, number> = {
  '1': 192.00, '2': 354.00, '3': 551.90,
  '4': 827.10, '5': 1123.50, '6': 1568.90, '7': 2061.80,
}

// ══════════════════════════════════════════════════════════════
// LESELOTTE — KI-AGENTIN FÜR KLIENTEN
// ══════════════════════════════════════════════════════════════

interface LeseNachricht {
  id: string; von: 'leselotte' | 'user'; text: string; zeitstempel: string
  typ?: 'info' | 'erfolg' | 'warnung' | 'aktion'
}

// ══════════════════════════════════════════════════════════════
// FÖRDERUNGEN TAB
// ══════════════════════════════════════════════════════════════

const FOERDER_TYP_REIHENFOLGE: FoerderTyp[] = ['bundesfoerderung', 'landesfoerderung', 'haertefall', 'gemeinde', 'sonstiges']

function emptyFoerderEintrag(typ: FoerderTyp): Omit<FoerderEintrag, 'id'> {
  return {
    typ, bezeichnung: '', status: 'geplant',
    beantragungGeplantAm: '', beantragungEingereichtAm: '', beantragungBei: '', antragNummer: '',
    genehmigungAm: '', bescheidNummer: '',
    betragMonatlich: 0, gueltigAb: '', gueltigBis: '',
    jaehrlichErneuerung: typ === 'landesfoerderung',
    naechsteErneuerungAm: '', erinnerungTageVorher: 60, erinnerungAn: '',
    erinnerungVersendetAm: '', ausLeselottes: false, dokDateiName: '', notizen: '',
  }
}

function FoerderungenTab({ k, canGF, onSave }: { k: Klient; canGF: boolean; onSave: (d: Partial<Klient>) => void }) {
  const foerderungen = k.foerderungen || []
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<FoerderEintrag, 'id'>>(emptyFoerderEintrag('bundesfoerderung'))
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const warnungen = getFoerderungWarnungen(k)

  function setF<K extends keyof typeof form>(key: K, val: any) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function handleSave() {
    if (!form.bezeichnung) return
    if (editId) {
      onSave({ foerderungen: foerderungen.map(f => f.id === editId ? { ...form, id: editId } : f) })
    } else {
      onSave({ foerderungen: [...foerderungen, { ...form, id: uid() }] })
    }
    setShowForm(false); setEditId(null); setForm(emptyFoerderEintrag('bundesfoerderung'))
  }

  function startEdit(f: FoerderEintrag) {
    setEditId(f.id); setForm({ ...f }); setShowForm(true)
  }

  function deleteF(id: string) {
    onSave({ foerderungen: foerderungen.filter(f => f.id !== id) })
  }

  // Gesamtbetrag genehmigter Förderungen
  const gesamtMonatlich = foerderungen
    .filter(f => f.status === 'genehmigt')
    .reduce((s, f) => s + (f.betragMonatlich || 0), 0)

  return (
    <div className="space-y-5">

      {/* Warnungen */}
      {warnungen.length > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="font-bold text-orange-900 text-sm mb-3">⚠️ Handlungsbedarf ({warnungen.length})</div>
          {warnungen.map(({ foerderung: f, tage, typ }) => (
            <div key={f.id} className="flex items-start gap-3 mb-2 last:mb-0">
              <span className="text-lg flex-shrink-0">{FOERDER_TYP_ICONS[f.typ]}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-orange-900">{f.bezeichnung}</div>
                <div className="text-xs text-orange-700">
                  {typ === 'erneuerung'
                    ? tage <= 0
                      ? `⚠️ Erneuerung ÜBERFÄLLIG — war fällig am ${fmtDate(f.naechsteErneuerungAm)}`
                      : `📅 Erneuerung in ${tage} Tagen fällig (${fmtDate(f.naechsteErneuerungAm)}) — Zuständig: ${f.erinnerungAn || k.zustaendig || '–'}`
                    : tage <= 0
                      ? `❌ ABGELAUFEN seit ${fmtDate(f.gueltigBis)}`
                      : `⏰ Läuft ab in ${tage} Tagen (${fmtDate(f.gueltigBis)})`
                  }
                </div>
              </div>
              <button onClick={() => { startEdit(f) }}
                className="rounded-xl border border-orange-300 text-orange-700 text-xs px-3 py-1.5 cursor-pointer hover:bg-orange-100 flex-shrink-0">
                Bearbeiten
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Übersicht Gesamt */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
          <div className="text-xs text-emerald-600 mb-1">✅ Genehmigt</div>
          <div className="text-2xl font-bold text-emerald-800">{foerderungen.filter(f => f.status === 'genehmigt').length}</div>
          {gesamtMonatlich > 0 && <div className="text-xs text-emerald-600 mt-0.5">{fmt(gesamtMonatlich)}/Monat</div>}
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center">
          <div className="text-xs text-amber-600 mb-1">📤 Beantragt</div>
          <div className="text-2xl font-bold text-amber-800">{foerderungen.filter(f => f.status === 'beantragt').length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-center">
          <div className="text-xs text-slate-500 mb-1">📋 Zu beantragen</div>
          <div className="text-2xl font-bold text-slate-700">{foerderungen.filter(f => f.status === 'geplant').length}</div>
        </div>
      </div>

      {/* Neue Förderung */}
      {canGF && !showForm && (
        <div className="flex gap-3">
          {FOERDER_TYP_REIHENFOLGE.map(typ => (
            <button key={typ} onClick={() => { setForm(emptyFoerderEintrag(typ)); setEditId(null); setShowForm(true) }}
              className="flex-1 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-3 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 transition-all text-center">
              {FOERDER_TYP_ICONS[typ]}<br />{FOERDER_TYP_LABELS[typ].split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Formular */}
      {showForm && (
        <div className="rounded-3xl border-2 border-teal-300 bg-white overflow-hidden">
          <div className="bg-teal-700 px-6 py-4 flex items-center justify-between">
            <div className="text-white font-bold">{editId ? 'Förderung bearbeiten' : `Neue ${FOERDER_TYP_LABELS[form.typ]}`}</div>
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              className="text-white/70 hover:text-white cursor-pointer bg-transparent border-none text-xl">✕</button>
          </div>
          <div className="p-6 space-y-5">

            {/* Grunddaten */}
            <div className="grid grid-cols-2 gap-4">
              <SelField label="Typ" value={form.typ} onChange={v => setF('typ', v as FoerderTyp)}
                options={FOERDER_TYP_REIHENFOLGE.map(t => ({ value: t, label: `${FOERDER_TYP_ICONS[t]} ${FOERDER_TYP_LABELS[t]}` }))} />
              <Field label="Bezeichnung *" value={form.bezeichnung} onChange={v => setF('bezeichnung', v)}
                placeholder="z.B. Pflegegeld Stufe 6, Vbg. Betreuungsgeld ..." />
              <SelField label="Status" value={form.status} onChange={v => setF('status', v as FoerderStatus)}
                options={Object.entries(FOERDER_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
              <div>
                <div className="text-sm font-medium text-slate-600 mb-1.5">Betrag monatlich (€)</div>
                <input type="number" value={form.betragMonatlich || ''} min={0} step={10}
                  onChange={e => setF('betragMonatlich', +e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </div>
            </div>

            {/* Beantragung */}
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Beantragung</div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Geplant einzureichen am" value={form.beantragungGeplantAm}
                  onChange={v => setF('beantragungGeplantAm', v)} type="date" />
                <Field label="Tatsächlich eingereicht am" value={form.beantragungEingereichtAm}
                  onChange={v => setF('beantragungEingereichtAm', v)} type="date" />
                <Field label="Eingereicht bei (Behörde)" value={form.beantragungBei}
                  onChange={v => setF('beantragungBei', v)} placeholder="z.B. Land Vorarlberg – BLDS" />
                <Field label="Antragsnummer" value={form.antragNummer}
                  onChange={v => setF('antragNummer', v)} placeholder="z.B. VBG-LFI-2025-001" />
              </div>
            </div>

            {/* Bescheid / Genehmigung */}
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Bescheid / Genehmigung</div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Genehmigt am" value={form.genehmigungAm}
                  onChange={v => setF('genehmigungAm', v)} type="date" />
                <Field label="Bescheid-Nummer" value={form.bescheidNummer}
                  onChange={v => setF('bescheidNummer', v)} />
                <Field label="Gültig ab" value={form.gueltigAb}
                  onChange={v => setF('gueltigAb', v)} type="date" />
                <Field label="Gültig bis (leer = unbefristet)" value={form.gueltigBis}
                  onChange={v => setF('gueltigBis', v)} type="date" />
              </div>
            </div>

            {/* Erneuerung */}
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Erneuerung & Erinnerung</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex items-center gap-3">
                  <button type="button" onClick={() => setF('jaehrlichErneuerung', !form.jaehrlichErneuerung)}
                    className={clsx('w-12 h-7 rounded-full border-none cursor-pointer relative flex-shrink-0', form.jaehrlichErneuerung ? 'bg-teal-600' : 'bg-slate-300')}>
                    <span className={clsx('absolute top-1.5 w-4 h-4 rounded-full bg-white shadow transition-all', form.jaehrlichErneuerung ? 'left-6' : 'left-1.5')} />
                  </button>
                  <span className="text-sm text-slate-700 font-medium">Jährliche Erneuerung erforderlich</span>
                  {form.typ === 'landesfoerderung' && (
                    <Badge label="⚠️ Pflicht bei Landesförderung" className="text-xs bg-orange-50 text-orange-700 border-orange-200" />
                  )}
                </div>
                {form.jaehrlichErneuerung && (
                  <>
                    <Field label="Nächste Erneuerung fällig am" value={form.naechsteErneuerungAm}
                      onChange={v => setF('naechsteErneuerungAm', v)} type="date" />
                    <div>
                      <div className="text-sm font-medium text-slate-600 mb-1.5">Erinnerung (Tage vorher)</div>
                      <input type="number" value={form.erinnerungTageVorher} min={7} max={180} step={7}
                        onChange={e => setF('erinnerungTageVorher', +e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <Field label="Erinnerung an (Sachbearbeiter)" value={form.erinnerungAn}
                      onChange={v => setF('erinnerungAn', v)}
                      placeholder={k.zustaendig || 'z.B. Stefan Wagner'} wide />
                  </>
                )}
              </div>
            </div>

            <TextArea label="Notizen" value={form.notizen} onChange={v => setF('notizen', v)}
              placeholder="Besonderheiten, Rückfragen der Behörde, Fristen ..." />

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <Btn onClick={() => { setShowForm(false); setEditId(null) }}>Abbrechen</Btn>
              <Btn teal onClick={handleSave}>{editId ? 'Speichern' : 'Förderung anlegen'}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Förderungs-Liste nach Typ gruppiert */}
      {foerderungen.length === 0 && !showForm && (
        <div className="text-center py-12 text-slate-400">
          <div className="text-5xl mb-3">💶</div>
          <div className="font-medium">Noch keine Förderungen hinterlegt</div>
          <div className="text-sm mt-1">Oben auf einen Typ klicken um eine neue Förderung anzulegen</div>
        </div>
      )}

      {FOERDER_TYP_REIHENFOLGE.map(typ => {
        const gruppe = foerderungen.filter(f => f.typ === typ)
        if (gruppe.length === 0) return null
        return (
          <div key={typ}>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              {FOERDER_TYP_ICONS[typ]} {FOERDER_TYP_LABELS[typ]}
            </div>
            {gruppe.map(f => {
              const hatWarnung = warnungen.some(w => w.foerderung.id === f.id)
              const expanded = expandedId === f.id
              return (
                <div key={f.id} className={clsx('rounded-2xl border mb-3 overflow-hidden',
                  hatWarnung ? 'border-orange-300 bg-orange-50' :
                  f.status === 'genehmigt' ? 'border-emerald-200 bg-white' :
                  f.status === 'beantragt' ? 'border-amber-200 bg-white' :
                  f.status === 'abgelehnt' ? 'border-rose-200 bg-rose-50' :
                  'border-slate-200 bg-slate-50')}>

                  {/* Karten-Header */}
                  <div className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                    onClick={() => setExpandedId(expanded ? null : f.id)}>
                    <span className="text-2xl flex-shrink-0">{FOERDER_TYP_ICONS[f.typ]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900">{f.bezeichnung}</div>
                      <div className="flex gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                        {f.beantragungBei && <span>bei {f.beantragungBei}</span>}
                        {f.betragMonatlich > 0 && <span className="font-semibold text-emerald-700">{fmt(f.betragMonatlich)}/Monat</span>}
                        {f.gueltigBis && <span>bis {fmtDate(f.gueltigBis)}</span>}
                        {f.jaehrlichErneuerung && f.naechsteErneuerungAm && (
                          <span className={clsx(hatWarnung ? 'text-orange-700 font-semibold' : 'text-slate-500')}>
                            🔄 Erneuerung {fmtDate(f.naechsteErneuerungAm)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge label={FOERDER_STATUS_LABELS[f.status]} className={clsx('text-xs', FOERDER_STATUS_COLORS[f.status])} />
                      {hatWarnung && <span className="text-lg">⚠️</span>}
                      <span className="text-slate-400 text-sm">{expanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Detail-Aufklapp */}
                  {expanded && (
                    <div className="border-t border-slate-100 px-5 py-4 bg-white">
                      <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                        {[
                          ['Antragsnummer', f.antragNummer],
                          ['Eingereicht am', fmtDate(f.beantragungEingereichtAm)],
                          ['Geplant für', fmtDate(f.beantragungGeplantAm)],
                          ['Genehmigt am', fmtDate(f.genehmigungAm)],
                          ['Bescheid-Nr.', f.bescheidNummer],
                          ['Gültig ab', fmtDate(f.gueltigAb)],
                          ['Gültig bis', f.gueltigBis ? fmtDate(f.gueltigBis) : 'Unbefristet'],
                          ['Erinnerung', f.erinnerungAn ? `${f.erinnerungTageVorher}T vor → ${f.erinnerungAn}` : '–'],
                          ['Betrag/Monat', f.betragMonatlich > 0 ? fmt(f.betragMonatlich) : '–'],
                        ].map(([l, v]) => (
                          <div key={String(l)} className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                            <div className="text-xs text-slate-400">{l}</div>
                            <div className="font-semibold text-slate-900 mt-0.5 text-xs">{v || '–'}</div>
                          </div>
                        ))}
                      </div>
                      {f.notizen && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 mb-4">
                          📌 {f.notizen}
                        </div>
                      )}
                      {/* Status-Workflow Buttons */}
                      <div className="flex gap-2 flex-wrap">
                        {canGF && (
                          <>
                            {f.status === 'geplant' && (
                              <button onClick={() => onSave({ foerderungen: foerderungen.map(x => x.id === f.id ? { ...x, status: 'beantragt', beantragungEingereichtAm: today() } : x) })}
                                className="rounded-xl bg-amber-600 text-white text-xs px-4 py-2 cursor-pointer border-none hover:bg-amber-700 font-semibold">
                                📤 Als beantragt markieren
                              </button>
                            )}
                            {f.status === 'beantragt' && (
                              <>
                                <button onClick={() => onSave({ foerderungen: foerderungen.map(x => x.id === f.id ? { ...x, status: 'genehmigt', genehmigungAm: today() } : x) })}
                                  className="rounded-xl bg-emerald-600 text-white text-xs px-4 py-2 cursor-pointer border-none hover:bg-emerald-700 font-semibold">
                                  ✅ Genehmigt
                                </button>
                                <button onClick={() => onSave({ foerderungen: foerderungen.map(x => x.id === f.id ? { ...x, status: 'abgelehnt' } : x) })}
                                  className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs px-4 py-2 cursor-pointer hover:bg-rose-100">
                                  ❌ Abgelehnt
                                </button>
                              </>
                            )}
                            {f.status === 'genehmigt' && f.jaehrlichErneuerung && (
                              <button onClick={() => {
                                const naechstes = new Date()
                                naechstes.setFullYear(naechstes.getFullYear() + 1)
                                naechstes.setMonth(naechstes.getMonth() - 2)
                                onSave({ foerderungen: foerderungen.map(x => x.id === f.id ? { ...x, status: 'erneuert', naechsteErneuerungAm: naechstes.toISOString().split('T')[0] } : x) })
                              }} className="rounded-xl bg-teal-600 text-white text-xs px-4 py-2 cursor-pointer border-none hover:bg-teal-700 font-semibold">
                                🔄 Erneuerung eingereicht
                              </button>
                            )}
                            <button onClick={() => startEdit(f)}
                              className="rounded-xl border border-slate-200 text-slate-600 text-xs px-4 py-2 cursor-pointer hover:bg-slate-50">
                              ✏️ Bearbeiten
                            </button>
                            <button onClick={() => { if (confirm('Förderung löschen?')) deleteF(f.id) }}
                              className="rounded-xl border border-rose-200 text-rose-500 text-xs px-3 py-2 cursor-pointer hover:bg-rose-50">
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Gesamt-Übersicht */}
      {foerderungen.filter(f => f.status === 'genehmigt' && f.betragMonatlich > 0).length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-3">Gesamte monatliche Förderungen</div>
          {foerderungen.filter(f => f.status === 'genehmigt' && f.betragMonatlich > 0).map(f => (
            <div key={f.id} className="flex justify-between text-sm py-1 border-b border-emerald-100 last:border-0">
              <span className="text-emerald-800">{FOERDER_TYP_ICONS[f.typ]} {f.bezeichnung}</span>
              <span className="font-bold text-emerald-900">{fmt(f.betragMonatlich)}</span>
            </div>
          ))}
          <div className="flex justify-between text-base font-bold text-emerald-900 pt-3 mt-2 border-t-2 border-emerald-200">
            <span>Gesamt monatlich</span>
            <span>{fmt(gesamtMonatlich)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function Leselotte({ k, onUpdate, canGF }: { k: Klient; onUpdate: (d: Partial<Klient>) => void; canGF: boolean }) {
  const [msgs, setMsgs] = useState<LeseNachricht[]>(() => {
    try { return JSON.parse(localStorage.getItem(`vb_leselotte_${k.id}`) || '[]') } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [blink, setBlink] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { const t = setInterval(() => setBlink(b => !b), 2000); return () => clearInterval(t) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, typing])

  function saveMsgs(updated: LeseNachricht[]) {
    setMsgs(updated)
    localStorage.setItem(`vb_leselotte_${k.id}`, JSON.stringify(updated.slice(-50)))
  }

  function antwort(text: string, typ: LeseNachricht['typ'] = 'info') {
    const msg: LeseNachricht = { id: uid(), von: 'leselotte', text, zeitstempel: new Date().toISOString(), typ }
    setMsgs(prev => { const u = [...prev, msg]; localStorage.setItem(`vb_leselotte_${k.id}`, JSON.stringify(u.slice(-50))); return u })
  }

  function handleSend(text: string) {
    if (!text.trim()) return
    const userMsg: LeseNachricht = { id: uid(), von: 'user', text, zeitstempel: new Date().toISOString() }
    saveMsgs([...msgs, userMsg])
    setTyping(true)

    setTimeout(async () => {
      setTyping(false)
      const low = text.toLowerCase()

      // DOKUMENT AUSLESEN — echte Vision API
      if (low.includes('auslesen') || low.includes('lesen') || low.includes('dokument') || low.includes('scan')) {
        antwort(
          `📄 Dokument auslesen:\n\n1️⃣ Tab "Dokumente" öffnen\n2️⃣ "+ Dokument hinzufügen"\n3️⃣ Foto / Scan hochladen (JPG, PNG)\n4️⃣ "📖 Leselotte auslesen" klicken\n\nIch erkenne dann automatisch alle Felder und ergänze was noch nicht eingetragen ist:\n• Personalien, Geburtsdaten\n• Pflegestufe aus Förderbescheid\n• Pflegegeld-Betrag\n• Krankenkasse\n• Diagnosen aus Arztbriefen\n\nNur leere Felder werden befüllt — bestehende Daten bleiben unverändert.`,
          'aktion'
        )
        return
      }

      // PFLEGEGELD BERECHNEN / NACHSCHLAGEN
      if (low.includes('pflegegeld') || low.includes('pflegestufe') || low.includes('betrag') || low.includes('förder')) {
        const stufe = k.pflegestufe
        const betrag = PFLEGEGELD[stufe]
        const foerderungen = k.foerderungen || []
        const genehmigt = foerderungen.filter(f => f.status === 'genehmigt')
        const gesamt = genehmigt.reduce((s, f) => s + f.betragMonatlich, 0)
        const warnungen = getFoerderungWarnungen(k)

        let text = `💶 Förderungs-Übersicht für ${k.vorname} ${k.nachname}:\n\n`
        text += `• Pflegestufe: ${stufe !== '0' ? stufe : 'nicht bewertet'}\n`
        if (stufe && stufe !== '0' && betrag) {
          text += `• Bundespflegegeld: € ${betrag.toFixed(2)}/Monat\n`
        }
        if (genehmigt.length > 0) {
          text += `\n✅ Genehmigte Förderungen (${genehmigt.length}):\n`
          genehmigt.forEach(f => { text += `  • ${f.bezeichnung}: € ${f.betragMonatlich.toFixed(2)}/Monat\n` })
          text += `\n💰 Gesamt: € ${gesamt.toFixed(2)}/Monat\n`
        }
        if (foerderungen.filter(f => f.status === 'beantragt').length > 0) {
          text += `\n📤 In Beantragung: ${foerderungen.filter(f => f.status === 'beantragt').map(f => f.bezeichnung).join(', ')}\n`
        }
        if (foerderungen.filter(f => f.status === 'geplant').length > 0) {
          text += `\n📋 Noch zu beantragen: ${foerderungen.filter(f => f.status === 'geplant').map(f => f.bezeichnung).join(', ')}\n`
        }
        if (warnungen.length > 0) {
          text += `\n⚠️ Handlungsbedarf:\n`
          warnungen.forEach(w => {
            text += `  • ${w.foerderung.bezeichnung}: ${w.typ === 'erneuerung' ? `Erneuerung in ${w.tage}T fällig` : `läuft ab in ${w.tage}T`}\n`
          })
        }
        antwort(text, genehmigt.length > 0 ? 'erfolg' : 'info')

        if (stufe && stufe !== '0' && betrag && k.foerderungBetrag === 0) {
          onUpdate({ foerderungBetrag: betrag })
          antwort(`✅ Pflegeldbetrag automatisch auf € ${betrag.toFixed(2)} gesetzt.`, 'erfolg')
        }
        return
      }

      // FEHLENDE FELDER PRÜFEN
      if (low.includes('fehlend') || low.includes('lücken') || low.includes('vollständig') || low.includes('prüf')) {
        const fehlend: string[] = []
        if (!k.geburtsdatum) fehlend.push('Geburtsdatum')
        if (!k.svnr) fehlend.push('Sozialversicherungsnummer')
        if (!k.telefon) fehlend.push('Telefonnummer')
        if (!k.strasse) fehlend.push('Adresse')
        if (k.pflegestufe === '0') fehlend.push('Pflegestufe')
        if (!k.krankenkasse) fehlend.push('Krankenkasse')
        if (!k.hausarzt) fehlend.push('Hausarzt')
        if (k.kontakte.length === 0) fehlend.push('Angehörige / Notfallkontakt')
        if (k.foerderung !== 'keine' && k.foerderungBetrag === 0) fehlend.push('Förderbetrag')
        if (k.dokumente.length === 0) fehlend.push('Dokumente (Förderbescheid, Ausweis...)')
        if (!k.hausarztTelefon) fehlend.push('Hausarzt-Telefon')
        if (k.diagnosen.length === 0) fehlend.push('Diagnosen')
        if (!k.mobilitaet) fehlend.push('Mobilität')

        if (fehlend.length === 0) {
          antwort(`✅ ${k.vorname} ${k.nachname} ist vollständig erfasst! Alle wichtigen Felder sind ausgefüllt.`, 'erfolg')
        } else {
          antwort(`📋 Fehlende Felder bei ${k.vorname} ${k.nachname}:\n\n${fehlend.map(f => `• ${f}`).join('\n')}\n\n💡 Ich kann Daten aus Dokumenten automatisch auslesen — einfach ein Foto hochladen!`, 'warnung')
        }
        return
      }

      // ONLINE NACHSCHLAGEN (Websuche via Claude)
      if (low.includes('online') || low.includes('internet') || low.includes('aktuell') || low.includes('2025') || low.includes('2026')) {
        antwort(`🌐 Ich suche im Internet nach aktuellen Informationen ...`, 'info')
        setTyping(true)
        try {
          const response = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1000,
              tools: [{ type: 'web_search_20250305', name: 'web_search' }],
              messages: [{ role: 'user', content: `${text}\n\nKontext: Klient ${k.vorname} ${k.nachname}, Pflegestufe ${k.pflegestufe}, Österreich. Antworte auf Deutsch, präzise und mit konkreten Zahlen/Daten.` }]
            })
          })
          const data = await response.json()
          setTyping(false)
          const resultText = data.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') || 'Keine Antwort erhalten.'
          antwort(`🌐 Online-Recherche:\n\n${resultText}`, 'erfolg')
        } catch (err: any) {
          setTyping(false)
          antwort(`⚠️ Online-Suche Fehler: ${err?.message || 'Verbindungsproblem'}`, 'warnung')
        }
        return
      }

      // ALLGEMEINE CLAUDE ANFRAGE
      if (low.includes('was') || low.includes('wie') || low.includes('wann') || low.includes('welche') || low.includes('?') || low.length > 20) {
        setTyping(true)
        try {
          const response = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1200,
              system: `Du bist Leselotte, die KI-Assistentin für Klienten bei VBetreut GmbH Österreich.

DEIN WISSEN:
• Österreichisches Pflegegeld (Stufen 1-7, Beträge 2024/2025)
• Pflegestufe 1: €154/Mt, 2: €284/Mt, 3: €442/Mt, 4: €664/Mt, 5: €902/Mt, 6: €1.260/Mt, 7: €1.688/Mt
• 24h-Betreuungsförderung: €550/Mt Bundeszuschuss (Voraussetzung: Gewerbeschein Betreuerin, Pflegestufe 3+)
• Hausbetreuungsgesetz (HBeG) — Rechte und Pflichten
• Vorarlberger Pflegeleistungen und Landesförderungen
• Demenz, Sturz, Ernährung, Medikamente im Alter
• Angehörigenberatung und -entlastung
• Sozialministeriumsservice Österreich
• DGKP-Leistungen vs. Personenbetreuung (was darf wer?)
• Österreichisches Erbrecht, Vorsorgevollmacht, Sachwalterschaft

VERHALTEN:
- Immer auf Deutsch, freundlich, konkret mit Zahlen
- Klienten-Kontext beachten (Pflegestufe, Diagnosen, Ort)
- Empfehlungen auf Österreich zugeschnitten
- Bei Rechtsfragen: Hinweis auf Fachberatung`,
              messages: [{
                role: 'user',
                content: `Frage: ${text}\n\nKlient-Kontext:\n- Name: ${k.vorname} ${k.nachname}, ${age(k.geburtsdatum) || '?'} Jahre\n- Pflegestufe: ${k.pflegestufe}\n- Diagnosen: ${k.diagnosen.map(d => d.bezeichnung).join(', ') || 'keine'}\n- Ort: ${k.ort || 'unbekannt'}`
              }]
            })
          })
          const data = await response.json()
          setTyping(false)
          const resultText = data.content?.[0]?.text || 'Keine Antwort.'
          antwort(resultText, 'info')
        } catch (err: any) {
          setTyping(false)
          antwort(`Fehler: ${err?.message || 'KI nicht erreichbar'}. Bitte erneut versuchen.`, 'warnung')
        }
        return
      }

      antwort(`Tippe "?" um zu sehen was ich kann, oder stelle mir direkt eine Frage!`, 'info')
    }, 600)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Leselotte Header */}
      <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
        {/* Avatar */}
        <svg width="44" height="44" viewBox="0 0 64 64" fill="none" className="flex-shrink-0">
          <circle cx="32" cy="32" r="30" fill="#7c3aed" />
          <circle cx="32" cy="32" r="28" fill="#4c1d95" />
          {/* Haare */}
          <path d="M 10 28 Q 10 8 32 8 Q 54 8 54 28" fill="#f59e0b" />
          <path d="M 10 28 Q 8 20 12 16" stroke="#d97706" strokeWidth="3" fill="none" />
          <path d="M 54 28 Q 56 20 52 16" stroke="#d97706" strokeWidth="3" fill="none" />
          {/* Gesicht */}
          <ellipse cx="22" cy="30" rx="4.5" ry={blink ? 0.8 : 4.5} fill="white" style={{ transition: 'ry 0.12s' }} />
          <ellipse cx="42" cy="30" rx="4.5" ry={blink ? 0.8 : 4.5} fill="white" style={{ transition: 'ry 0.12s' }} />
          <circle cx="23" cy="30" r="2.5" fill="#1e1b4b" />
          <circle cx="43" cy="30" r="2.5" fill="#1e1b4b" />
          <circle cx="24" cy="29" r="1" fill="white" />
          <circle cx="44" cy="29" r="1" fill="white" />
          {/* Mund */}
          <path d="M 24 42 Q 32 49 40 42" stroke="#f9a8d4" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Brille */}
          <rect x="16" y="25" width="13" height="10" rx="4" fill="none" stroke="#f9a8d4" strokeWidth="1.5" />
          <rect x="35" y="25" width="13" height="10" rx="4" fill="none" stroke="#f9a8d4" strokeWidth="1.5" />
          <line x1="29" y1="30" x2="35" y2="30" stroke="#f9a8d4" strokeWidth="1.5" />
          {/* Schleife */}
          <path d="M 26 10 L 32 14 L 38 10 L 32 7 Z" fill="#ec4899" />
          <circle cx="32" cy="10" r="2.5" fill="#f9a8d4" />
        </svg>
        <div className="flex-1">
          <div className="font-bold text-white text-sm">Leselotte</div>
          <div className="text-xs text-white/70">KI-Assistentin · liest Dokumente, kennt Pflegegeld, lernt mit</div>
        </div>
        <button onClick={() => { if (confirm('Chatverlauf leeren?')) { saveMsgs([]); } }}
          className="text-white/50 hover:text-white text-xs cursor-pointer bg-transparent border-none">Leeren</button>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {msgs.length === 0 && (
          <div className="text-center py-6">
            <div className="font-bold text-slate-700 text-sm mb-1">Hallo! Ich bin Leselotte 👓</div>
            <div className="text-xs text-slate-500 mb-3 max-w-xs mx-auto">Ich lese Dokumente aus, kenne österreichische Pflegegeldbeträge und helfe bei allen Fragen rund um {k.vorname}.</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Fehlende Felder prüfen', 'Pflegegeld berechnen', 'Dokument auslesen', 'Aktuelle Pflegegeldsätze'].map(s => (
                <button key={s} onClick={() => handleSend(s)}
                  className="rounded-full bg-pink-100 text-pink-700 text-xs px-3 py-1.5 cursor-pointer border border-pink-200 hover:bg-pink-200">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map(m => (
          <div key={m.id} className={clsx('flex gap-2', m.von === 'leselotte' ? '' : 'flex-row-reverse')}>
            {m.von === 'leselotte' && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>L</div>
            )}
            <div className={clsx('rounded-2xl px-3 py-2.5 text-xs leading-relaxed max-w-xs',
              m.von === 'leselotte'
                ? m.typ === 'warnung' ? 'bg-amber-50 border border-amber-200 text-slate-800'
                  : m.typ === 'erfolg' ? 'bg-emerald-50 border border-emerald-200 text-slate-800'
                    : m.typ === 'aktion' ? 'bg-sky-50 border border-sky-200 text-slate-800'
                      : 'bg-white border border-pink-100 text-slate-800'
                : 'bg-violet-700 text-white')}>
              <div className="whitespace-pre-wrap">{m.text}</div>
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>L</div>
            <div className="rounded-2xl bg-white border border-pink-100 px-3 py-2.5 text-xs text-slate-400 italic">Leselotte denkt ...</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 p-3 flex gap-2 bg-white flex-shrink-0">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input.trim()) { handleSend(input.trim()); setInput('') } }}
          placeholder="Leselotte fragen ..."
          className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none" />
        <button onClick={() => { if (input.trim()) { handleSend(input.trim()); setInput('') } }}
          className="rounded-2xl text-white px-3 py-2 text-xs font-bold cursor-pointer border-none hover:opacity-90" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>→</button>
      </div>
    </div>
  )
}

interface Props {
  klient: Klient
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  canGF: boolean
}

// Normalisiert Supabase-Daten: JSON-Strings → echte Arrays
function normalizeK(raw: Klient): Klient {
  const arr = (v: any) => { if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] } } return [] }
  const str = (v: any) => (v == null ? '' : String(v))
  const num = (v: any) => (v == null || isNaN(Number(v)) ? 0 : Number(v))
  const bool = (v: any) => !!v
  return {
    ...raw,
    id: str(raw.id),
    vorname: str(raw.vorname),
    nachname: str(raw.nachname),
    geburtsdatum: str(raw.geburtsdatum),
    geschlecht: str((raw as any).geschlecht),
    geburtsort: str((raw as any).geburtsort),
    staatsbuergerschaft: str((raw as any).staatsbuergerschaft) || 'Österreich',
    nationalitaet: str((raw as any).nationalitaet),
    familienstand: str((raw as any).familienstand),
    svnr: str((raw as any).svnr),
    // Ausweisdaten
    ausweisTyp: str((raw as any).ausweisTyp || (raw as any).ausweis_typ),
    ausweisNr: str((raw as any).ausweisNr || (raw as any).ausweis_nr),
    ausweisAusgestelltAm: str((raw as any).ausweisAusgestelltAm || (raw as any).ausweis_ausgestellt_am),
    ausweisBehoerde: str((raw as any).ausweisBehoerde || (raw as any).ausweis_behoerde),
    ausweisGueltigBis: str((raw as any).ausweisGueltigBis || (raw as any).ausweis_gueltig_bis),
    // Adresse
    strasse: str((raw as any).strasse || raw.adresse),
    adresse: str(raw.adresse),
    plz: str(raw.plz),
    ort: str(raw.ort),
    land: str((raw as any).land) || 'Österreich',
    bundesland: str(raw.bundesland),
    stockwerk: str((raw as any).stockwerk),
    türcode: str((raw as any).türcode),
    wohnungsschluessel: str((raw as any).wohnungsschluessel),
    internetWlan: str((raw as any).internetWlan),
    raucher: bool((raw as any).raucher),
    haustiere: bool((raw as any).haustiere),
    haustierArt: str((raw as any).haustierArt),
    // Kontakt
    telefon: str(raw.telefon),
    telefonWhatsapp: bool((raw as any).telefonWhatsapp),
    telefonAlternativ: str((raw as any).telefonAlternativ),
    email: str(raw.email),
    // Pflege
    pflegestufe: str(raw.pflegestufe) || '0',
    pflegegeld: num(raw.pflegegeld),
    mobilitaet: str((raw as any).mobilitaet),
    hausarzt: str(raw.hausarzt),
    hausarztTelefon: str((raw as any).hausarztTelefon || (raw as any).hausarzt_telefon),
    krankenhaus: str(raw.krankenhaus),
    krankenkasse: str(raw.krankenkasse),
    krankenkasseNr: str((raw as any).krankenkasseNr || (raw as any).krankenkasse_nr),
    allergien: str(raw.allergien),
    medikamente: str(raw.medikamente),
    besonderheiten: str(raw.besonderheiten),
    // Finanzen
    tagessatzStandard: num((raw as any).tagessatzStandard || (raw as any).tagessatz_standard) || 80,
    zahlungsart: str((raw as any).zahlungsart),
    angebotNummer: str((raw as any).angebotNummer),
    angebotDatum: str((raw as any).angebotDatum),
    angebotStatus: str((raw as any).angebotStatus),
    // Betreuung
    aktuellerTurnus: str((raw as any).aktuellerTurnus || (raw as any).aktueller_turnus) || '28',
    aktuelleBetreuerin: str((raw as any).aktuelleBetreuerin || (raw as any).aktuelle_betreuerin),
    aktuellerEinsatzBis: str((raw as any).aktuellerEinsatzBis || (raw as any).aktueller_einsatz_bis),
    naechsterWechsel: str((raw as any).naechsterWechsel || (raw as any).naechster_wechsel),
    foerderung: str((raw as any).foerderung) || 'keine',
    // Intern
    status: str(raw.status) || 'aktiv',
    zustaendig: str((raw as any).zustaendig),
    wiedervorlage: str((raw as any).wiedervorlage),
    notizen: str(raw.notizen),
    internNotizen: str((raw as any).internNotizen),
    erstelltVon: str((raw as any).erstelltVon || (raw as any).erstellt_von),
    erstelltAm: str((raw as any).erstelltAm || (raw as any).erstellt_am),
    aktualisiertAm: str((raw as any).aktualisiertAm || (raw as any).aktualisiert_am),
    // Arrays
    kontakte: arr(raw.kontakte),
    dokumente: arr(raw.dokumente),
    diagnosen: arr((raw as any).diagnosen),
    foerderungen: arr((raw as any).foerderungen),
    pflegemassnahmen: arr((raw as any).pflegemassnahmen),
    beobachtungen: arr((raw as any).beobachtungen),
    geraete: arr((raw as any).geraete),
  } as Klient
}

export default function KlientDetail({ klient: initialK, onClose, onEdit, onDelete, canGF }: Props) {
  const router = useRouter()
  const [k, setK] = useState<Klient>(() => normalizeK(initialK))
  const [activeTab, setActiveTab] = useState<'stammdaten' | 'medizin' | 'kontakte' | 'einsaetze' | 'chronologie' | 'dokumente' | 'finanzen' | 'foerderungen' | 'leselotte' | 'notizen' | 'uebersicht'>('uebersicht')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [showDokForm, setShowDokForm] = useState(false)
  const [showKontaktForm, setShowKontaktForm] = useState(false)

  const [dokForm, setDokForm] = useState<Omit<KlientDokument, 'id'>>({
    kategorie: 'foerderbescheid', bezeichnung: '', dateiName: '', hochgeladenAm: today(),
    ablaufdatum: '', ausgestellt: '', ausstellendeBehörde: '', dokumentNummer: '', notizen: '', vertraulich: false,
  })
  const [kontaktForm, setKontaktForm] = useState<Omit<Kontakt, 'id'>>({
    name: '', beziehung: '', telefon: '', email: '', adresse: '', hauptkontakt: false, notizen: '',
  })

  useEffect(() => { setK(normalizeK(initialK)) }, [initialK.aktualisiertAm])

  // Live-Einsätze aus Supabase
  const [liveEinsaetze, setLiveEinsaetze] = useState<EinsatzRecord[]>([])
  const [showEinsatzForm, setShowEinsatzForm] = useState(false)
  const [editEinsatz, setEditEinsatz] = useState<EinsatzRecord | null>(null)
  useEffect(() => {
    apiGetAll<any>('einsaetze').then(alle => {
      const normalised = alle.map((e: any) => ({
        ...e,
        klientId: e.klient_id || e.klientId || e.data?.klientId || e.data?.klient_id || '',
        betreuerinId: e.betreuerin_id || e.betreuerinId || e.data?.betreuerinId || '',
        betreuerinName: e.betreuerin_name || e.betreuerinName || e.data?.betreuerinName || '',
        von: e.von || e.data?.von || '',
        bis: e.bis || e.data?.bis || '',
        status: e.status || e.data?.status || 'geplant',
        tagessatz: Number(e.tagessatz || e.data?.tagessatz || 0),
        notiz: e.notiz || e.data?.notiz || '',
        bewertung: Number(e.bewertung || e.data?.bewertung || 0),
        turnusTage: Number(e.turnus_tage || e.turnusTage || e.data?.turnusTage || 28),
      }))
      setLiveEinsaetze(normalised.filter((e: any) => e.klientId === k.id))
    })
  }, [k.id, k.aktualisiertAm])

  // Einsatz anlegen/bearbeiten direkt im Klienten
  async function saveEinsatz(data: Omit<Einsatz, 'id' | 'erstelltAm' | 'aktualisiertAm'>) {
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
    const now = new Date().toISOString()
    if (editEinsatz) {
      await apiUpdate('einsaetze', editEinsatz.id, { ...data, aktualisiertAm: now })
      setLiveEinsaetze(prev => prev.map(e => e.id === editEinsatz.id ? { ...e, ...data } as EinsatzRecord : e))
    } else {
      const id = uid()
      const neu = {
        id, ...data,
        klientId: k.id,
        klientName: `${k.vorname} ${k.nachname}`,
        klientOrt: k.ort || '',
        erstelltAm: now, aktualisiertAm: now,
      }
      await apiInsert('einsaetze', neu)
      setLiveEinsaetze(prev => [neu as EinsatzRecord, ...prev])
    }
    setShowEinsatzForm(false)
    setEditEinsatz(null)
  }

  function save(data: Partial<Klient>) {
    const updated = { ...k, ...data, aktualisiertAm: today() }
    setK(updated)
    apiUpdate('klienten', k.id, data)
  }

  const warnDoks = k.dokumente.filter(d => isDokAbgelaufen(d) || isDokBaldAbgelaufen(d))
  // Aktiver Einsatz aus Turnusverwaltung (live)
  const aktEinsatz = liveEinsaetze.find(e => ['aktiv', 'wechsel_offen'].includes(getEinsatzStatus(e)))
  const naechsterEinsatz = liveEinsaetze.find(e => getEinsatzStatus(e) === 'geplant')

  const tabs = [
    { key: 'uebersicht', label: '⚡ Schnellinfo' },
    { key: 'stammdaten', label: 'Stammdaten' },
    { key: 'medizin', label: 'Medizin & Pflege' },
    { key: 'kontakte', label: `Kontakte (${k.kontakte.length})` },
    { key: 'einsaetze', label: `Betreuung (${liveEinsaetze.length})` },
    { key: 'chronologie', label: '📋 Chronologie' },
    { key: 'dokumente', label: `Dokumente (${k.dokumente.length})` },
    { key: 'finanzen', label: 'Finanzen' },
    { key: 'foerderungen', label: `💶 Förderungen (${(k.foerderungen || []).length})` },
    { key: 'leselotte', label: '👓 Leselotte' },
    { key: 'notizen', label: 'Notizen' },
  ] as const

  const foerderWarnungen = getFoerderungWarnungen(k)

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end bg-slate-900/30" onClick={onClose}>
      <div className="h-full w-full max-w-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
        style={{ borderRadius: '28px 0 0 28px' }}
        onClick={e => e.stopPropagation()}>

        {/* ── HEADER ── */}
        <div className="bg-teal-700 px-8 py-6 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl cursor-pointer bg-transparent border-none">✕</button>
            <div className="flex gap-2">
              {canGF && <>
                <button onClick={onEdit} className="rounded-xl bg-white/15 px-4 py-2 text-sm font-bold text-white cursor-pointer border-none hover:bg-white/25">✏️ Bearbeiten</button>
                <button onClick={() => setActiveTab('einsaetze')}
                  className="rounded-xl bg-emerald-500/80 px-4 py-2 text-sm font-bold text-white cursor-pointer border-none hover:bg-emerald-500">
                  📋 Geschäftsfall {liveEinsaetze.length > 0 ? `(${liveEinsaetze.length})` : ''}
                </button>
                <button onClick={() => setDeleteConfirm(true)} className="rounded-xl bg-rose-500/25 px-4 py-2 text-sm font-bold text-white cursor-pointer border-none hover:bg-rose-500/40">Löschen</button>
              </>}
            </div>
          </div>

          {deleteConfirm && (
            <div className="mb-4 rounded-2xl bg-rose-900/40 border border-rose-400/40 p-4">
              <div className="text-sm font-bold text-white mb-2">Wirklich löschen?</div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(false)} className="rounded-xl bg-white/20 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none">Abbrechen</button>
                <button onClick={onDelete} className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-rose-600">Endgültig löschen</button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-5 mb-4">
            <label className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-bold text-white flex-shrink-0 cursor-pointer hover:bg-white/30 transition-all relative overflow-hidden group" title="Foto hochladen">
              {(k as any).fotoUrl ? (
                <img src={(k as any).fotoUrl} alt={k.vorname} className="w-full h-full object-cover" />
              ) : (
                <span>{k.vorname[0]}{k.nachname[0]}</span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-sm">📷</div>
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => save({ fotoUrl: ev.target?.result as string } as any)
                reader.readAsDataURL(file)
              }} />
            </label>
            <div className="flex-1">
              <div className="text-xs text-white/60 uppercase tracking-widest mb-1">{k.klientNr || 'Klient:in'}</div>
              <h2 className="text-3xl font-bold text-white mb-1">{k.vorname} {k.nachname}</h2>
              <div className="text-white/70 text-sm">
                {age(k.geburtsdatum) ? `${age(k.geburtsdatum)} Jahre` : ''}
                {k.geburtsort ? ` · geb. in ${k.geburtsort}` : ''}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge label={STATUS_LABELS[k.status] || k.status} className={clsx('text-xs border', STATUS_COLORS[k.status] || 'bg-slate-100 text-slate-600 border-slate-200')} />
                {k.status === 'verstorben' && (k as any).verstorbenAm && (
                  <span className="text-xs text-slate-500">✝️ {fmtDate((k as any).verstorbenAm)}</span>
                )}
                {k.pflegestufe !== '0' && <Badge label={`Pflegestufe ${k.pflegestufe}`} className="text-xs border bg-violet-100 text-violet-700 border-violet-300" />}
                <Badge label={FOERDERUNG_LABELS[k.foerderung] || k.foerderung || '–'} className={clsx('text-xs border', FOERDERUNG_COLORS[k.foerderung] || 'bg-slate-100 text-slate-500 border-slate-200')} />
                {warnDoks.length > 0 && <Badge label={`⚠️ ${warnDoks.length} Dok.`} className="text-xs bg-amber-100 text-amber-800 border-amber-300" />}
                {foerderWarnungen.length > 0 && <Badge label={`⚠️ ${foerderWarnungen.length} Förderung`} className="text-xs bg-orange-100 text-orange-800 border-orange-300" />}
              </div>
            </div>
          </div>

          {/* Status-Kacheln: live aus Turnusverwaltung */}
          <div className="grid grid-cols-3 gap-2">
            <div className={clsx('rounded-2xl px-4 py-3 border',
              aktEinsatz ? 'bg-sky-500/20 border-sky-300/30' : 'bg-white/10 border-white/20')}>
              <div className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">Turnus</div>
              <div className="text-sm font-bold text-white">
                {aktEinsatz ? `${aktEinsatz.turnusTage} Tage` : TURNUS_LABELS[k.aktuellerTurnus] || '– kein Einsatz –'}
              </div>
              {aktEinsatz && <div className="text-[10px] text-white/60 mt-0.5">{fmtDate(aktEinsatz.von)} – {fmtDate(aktEinsatz.bis)}</div>}
            </div>
            <div className={clsx('rounded-2xl px-4 py-3 border',
              aktEinsatz ? 'bg-sky-500/20 border-sky-300/30' : 'bg-white/10 border-white/20')}>
              <div className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">Aktuelle Betreuerin</div>
              <div className="text-sm font-bold text-white truncate">
                {aktEinsatz?.betreuerinName || k.aktuelleBetreuerin || '– keine –'}
              </div>
              {aktEinsatz && <div className="text-[10px] text-white/60 mt-0.5">bis {fmtDate(aktEinsatz.bis)}</div>}
            </div>
            <div className={clsx('rounded-2xl px-4 py-3 border',
              naechsterEinsatz ? 'bg-sky-400/20 border-sky-300/30' : 'bg-white/10 border-white/20')}>
              <div className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">
                {naechsterEinsatz ? 'Geplante Nachfolge' : 'Nächster Wechsel'}
              </div>
              <div className="text-sm font-bold text-white">
                {naechsterEinsatz ? naechsterEinsatz.betreuerinName : aktEinsatz ? fmtDate(aktEinsatz.bis) : '– geplant –'}
              </div>
              {naechsterEinsatz && <div className="text-[10px] text-white/60 mt-0.5">ab {fmtDate(naechsterEinsatz.von)}</div>}
              {!naechsterEinsatz && aktEinsatz && einsatzDaysRemaining(aktEinsatz.bis) <= 14 && einsatzDaysRemaining(aktEinsatz.bis) >= 0 && (
                <div className="text-[10px] text-amber-300 mt-0.5">⚠️ {einsatzDaysRemaining(aktEinsatz.bis)}T — kein Nachfolger!</div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 flex-wrap">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={clsx('rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer border-none transition-all',
                  activeTab === t.key ? 'bg-white text-teal-700' : 'bg-white/15 text-white hover:bg-white/25')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── BODY ── */}
        <div className={clsx('flex-1 overflow-hidden', activeTab === 'leselotte' ? 'flex flex-col' : 'overflow-y-auto p-7')}>

          {/* ═══ STAMMDATEN ═══ */}
          {activeTab === 'stammdaten' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Persönliche Daten</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Geburtsdatum', fmtDate(k.geburtsdatum)],
                    ['Geburtsort', k.geburtsort],
                    ['SVNR', k.svnr],
                    ['Geschlecht', k.geschlecht === 'weiblich' ? 'Weiblich' : k.geschlecht === 'maennlich' ? 'Männlich' : '–'],
                    ['Nationalität', k.nationalitaet],
                    ['Familienstand', k.familienstand],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs text-slate-400">{l}</div>
                      <div className="font-semibold text-slate-900 mt-0.5">{v || '–'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Kontakt & Adresse</h3>
                <div className="space-y-2 text-sm mb-3">
                  {k.telefon && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">☎</span>
                      <a href={`tel:${k.telefon}`} className="text-teal-700 hover:underline">{k.telefon}</a>
                      {k.telefonWhatsapp && <Badge label="WhatsApp" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200" />}
                    </div>
                  )}
                  {k.telefonAlternativ && <div className="flex items-center gap-2"><span className="text-slate-400">☎</span>{k.telefonAlternativ}</div>}
                  {k.email && <div className="flex items-center gap-2"><span className="text-slate-400">✉</span><a href={`mailto:${k.email}`} className="text-teal-700 hover:underline">{k.email}</a></div>}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm">
                  <div className="text-slate-700">{k.strasse}</div>
                  <div className="text-slate-700">{k.plz} {k.ort}, {k.land}</div>
                  {k.stockwerk && <div className="text-slate-500 text-xs mt-1">{k.stockwerk}</div>}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Haushalt</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['🔑 Türcode', k.türcode],
                    ['🔑 Schlüssel', k.wohnungsschluessel],
                    ['📶 WLAN', k.internetWlan],
                    ['🚬 Raucher', k.raucher ? 'Ja' : 'Nein'],
                    ['🐾 Haustiere', k.haustiere ? (k.haustierArt || 'Ja') : 'Nein'],
                  ].map(([l, v]) => v && (
                    <div key={String(l)} className={clsx('rounded-xl border px-4 py-3 text-sm', String(l).includes('🔑') || String(l).includes('📶') ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50')}>
                      <div className="text-xs text-slate-400">{l}</div>
                      <div className="font-semibold text-slate-900 mt-0.5">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Zuständigkeit</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Zuständig', k.zustaendig],
                    ['Wiedervorlage', fmtDate(k.wiedervorlage)],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs text-slate-400">{l}</div>
                      <div className="font-semibold text-slate-900 mt-0.5">{v || '–'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ausweisdaten — wichtig für Meldezettel */}
              <div>
                <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3">🪪 Ausweisdaten (für Meldezettel)</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Ausweis-Typ', (k as any).ausweisTyp],
                    ['Ausweis-Nr.', (k as any).ausweisNr],
                    ['Ausgestellt am', fmtDate((k as any).ausweisAusgestelltAm)],
                    ['Ausstellende Behörde', (k as any).ausweisBehoerde],
                    ['Gültig bis', fmtDate((k as any).ausweisGueltigBis)],
                    ['Staatsbürgerschaft', (k as any).staatsbuergerschaft],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <div className="text-xs text-amber-600">{l}</div>
                      <div className="font-semibold text-slate-900 mt-0.5">{v || '–'}</div>
                    </div>
                  ))}
                </div>
                {canGF && (
                  <button onClick={() => setActiveTab('stammdaten')}
                    className="mt-3 text-xs text-teal-700 hover:underline cursor-pointer bg-transparent border-none">
                    ✏️ Im Bearbeiten-Modus ergänzen
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ═══ MEDIZIN & PFLEGE ═══ */}
          {activeTab === 'medizin' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Pflegestufe', k.pflegestufe !== '0' ? `Stufe ${k.pflegestufe}` : 'Keine / nicht bewertet'],
                  ['Mobilität', MOBILITAET_LABELS[k.mobilitaet] || '–'],
                  ['Krankenkasse', k.krankenkasse],
                  ['KK-Nummer', k.krankenkasseNr],
                ].map(([l, v]) => (
                  <div key={String(l)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <div className="text-xs text-slate-400">{l}</div>
                    <div className="font-semibold text-slate-900 mt-0.5">{v || '–'}</div>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Ärzte & Krankenhaus</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                    <div className="text-xs text-slate-400 mb-1">Hausarzt</div>
                    <div className="font-bold text-slate-900">{k.hausarzt || '–'}</div>
                    {k.hausarztTelefon && <div className="text-sm text-teal-700 mt-1"><a href={`tel:${k.hausarztTelefon}`}>{k.hausarztTelefon}</a></div>}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                    <div className="text-xs text-slate-400 mb-1">Krankenhaus</div>
                    <div className="font-bold text-slate-900">{k.krankenhaus || '–'}</div>
                  </div>
                </div>
              </div>

              {k.diagnosen.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Diagnosen</h3>
                  {k.diagnosen.map((d, i) => (
                    <div key={i} className={clsx('rounded-xl border px-4 py-3 mb-2',
                      d.schweregrad === 'schwer' ? 'border-rose-200 bg-rose-50' :
                      d.schweregrad === 'mittel' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50')}>
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900 text-sm">{d.bezeichnung}</div>
                        <div className="flex gap-2">
                          {d.schweregrad && <Badge label={d.schweregrad} className={clsx('text-[10px]', d.schweregrad === 'schwer' ? 'bg-rose-100 text-rose-700 border-rose-300' : d.schweregrad === 'mittel' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-slate-100 text-slate-600 border-slate-200')} />}
                          {d.seit && <span className="text-xs text-slate-400">seit {fmtDate(d.seit)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {k.medikamente && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">💊 Medikamente</h3>
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm text-slate-800 whitespace-pre-wrap font-mono leading-6">{k.medikamente}</div>
                </div>
              )}

              {k.allergien && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
                  <div className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">⚠️ Allergien</div>
                  <div className="text-sm text-rose-900">{k.allergien}</div>
                </div>
              )}

              {k.ernaehrung && (
                <div className="rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4">
                  <div className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-1">🍽️ Ernährung</div>
                  <div className="text-sm text-teal-900">{k.ernaehrung}</div>
                </div>
              )}

              {k.besonderheiten && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                  <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">📌 Besonderheiten</div>
                  <div className="text-sm text-amber-900">{k.besonderheiten}</div>
                </div>
              )}
            </div>
          )}

          {/* ═══ KONTAKTE ═══ */}
          {activeTab === 'kontakte' && (
            <div className="space-y-4">
              {canGF && (
                <button onClick={() => setShowKontaktForm(true)}
                  className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 px-5 py-4 text-sm font-semibold text-teal-700 cursor-pointer hover:bg-teal-100 w-full justify-center">
                  + Kontakt / Angehörigen hinzufügen
                </button>
              )}

              {showKontaktForm && (
                <div className="rounded-2xl border border-teal-200 bg-white p-5">
                  <div className="text-sm font-bold text-slate-800 mb-3">Neuer Kontakt</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Name *" value={kontaktForm.name} onChange={v => setKontaktForm(f => ({ ...f, name: v }))} />
                    <Field label="Beziehung" value={kontaktForm.beziehung} onChange={v => setKontaktForm(f => ({ ...f, beziehung: v }))} placeholder="Sohn, Tochter, Hausarzt ..." />
                    <Field label="Telefon" value={kontaktForm.telefon} onChange={v => setKontaktForm(f => ({ ...f, telefon: v }))} />
                    <Field label="E-Mail" value={kontaktForm.email} onChange={v => setKontaktForm(f => ({ ...f, email: v }))} />
                    <Field label="Adresse" value={kontaktForm.adresse} onChange={v => setKontaktForm(f => ({ ...f, adresse: v }))} wide />
                    <div className="col-span-2 flex items-center gap-3">
                      <input type="checkbox" checked={kontaktForm.hauptkontakt} onChange={e => setKontaktForm(f => ({ ...f, hauptkontakt: e.target.checked }))} className="accent-teal-700 w-4 h-4" />
                      <span className="text-sm text-slate-700">Hauptkontakt / Bevollmächtigter</span>
                    </div>
                    <div className="col-span-2">
                      <TextArea label="Notizen" value={kontaktForm.notizen} onChange={v => setKontaktForm(f => ({ ...f, notizen: v }))} />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <Btn onClick={() => setShowKontaktForm(false)}>Abbrechen</Btn>
                    <Btn teal onClick={() => {
                      if (!kontaktForm.name) return
                      save({ kontakte: [...k.kontakte, { ...kontaktForm, id: uid() }] })
                      setShowKontaktForm(false)
                      setKontaktForm({ name: '', beziehung: '', telefon: '', email: '', adresse: '', hauptkontakt: false, notizen: '' })
                    }}>Speichern</Btn>
                  </div>
                </div>
              )}

              {k.kontakte.length === 0 && !showKontaktForm && (
                <div className="text-center py-12 text-slate-400"><div className="text-4xl mb-2">👥</div><div>Noch keine Kontakte hinterlegt</div></div>
              )}

              {k.kontakte.map(c => (
                <div key={c.id} className={clsx('rounded-2xl border px-5 py-5', c.hauptkontakt ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white')}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm flex-shrink-0">
                        {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{c.name}</div>
                        <div className="text-sm text-slate-500">{c.beziehung}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {c.hauptkontakt && <Badge label="⭐ Hauptkontakt" className="text-xs bg-teal-100 text-teal-700 border-teal-300" />}
                      {canGF && (
                        <button onClick={() => save({ kontakte: k.kontakte.filter(x => x.id !== c.id) })}
                          className="rounded-xl border border-rose-200 text-rose-500 text-xs px-2 py-1.5 cursor-pointer hover:bg-rose-50">✕</button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    {c.telefon && <div><a href={`tel:${c.telefon}`} className="text-teal-700 hover:underline">☎ {c.telefon}</a></div>}
                    {c.email && <div><a href={`mailto:${c.email}`} className="text-teal-700 hover:underline">✉ {c.email}</a></div>}
                    {c.adresse && <div className="text-xs text-slate-400">📍 {c.adresse}</div>}
                    {c.notizen && <div className="text-xs text-slate-500 italic mt-1">{c.notizen}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ BETREUUNGS-EINSÄTZE ═══ */}
          {activeTab === 'einsaetze' && (
            <div className="space-y-4">
              {/* ══ GESCHÄFTSFALL ══ */}
              {/* Geschäftsfall Formular — inline, kein Modal */}
              {showEinsatzForm && (
                <GeschaeftsfallFormular
                  klientId={k.id}
                  klientName={`${k.vorname} ${k.nachname}`}
                  klientOrt={k.ort || ''}
                  initial={editEinsatz}
                  onSave={saveEinsatz}
                  onClose={() => { setShowEinsatzForm(false); setEditEinsatz(null) }}
                />
              )}

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                {/* Kopf */}
                <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-100">
                  <div>
                    <div className="font-bold text-slate-900">📋 Geschäftsfall</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {liveEinsaetze.length === 0
                        ? 'Noch kein Einsatz — ersten Betreuungseinsatz anlegen'
                        : `${liveEinsaetze.filter(e => e.status === 'aktiv').length} aktiv · ${liveEinsaetze.filter(e => e.status === 'geplant').length} geplant · ${liveEinsaetze.length} gesamt`}
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditEinsatz(null); setShowEinsatzForm(true) }}
                    className="rounded-xl bg-teal-700 text-white text-xs font-bold px-4 py-2 cursor-pointer border-none hover:bg-teal-800">
                    {liveEinsaetze.length === 0 ? '+ Ersten Einsatz anlegen' : '+ Neuer Einsatz'}
                  </button>
                </div>

                {/* Betreuungszeitraum */}
                <div className="grid grid-cols-2 gap-0 border-b border-slate-100">
                  <div className="px-5 py-3 border-r border-slate-100">
                    <div className="text-xs font-semibold text-slate-400 mb-1">Betreuungsbeginn</div>
                    <input type="date" value={(k as any).betreuungBeginn || ''}
                      onChange={e => save({ betreuungBeginn: e.target.value } as any)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-teal-400" />
                    {(k as any).betreuungBeginn && <div className="text-xs text-teal-600 mt-0.5">{fmtDate((k as any).betreuungBeginn)}</div>}
                  </div>
                  <div className="px-5 py-3">
                    <div className="text-xs font-semibold text-slate-400 mb-1">Betreuungsende</div>
                    <input type="date" value={(k as any).betreuungEnde || ''}
                      onChange={e => save({ betreuungEnde: e.target.value } as any)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-teal-400" />
                    {(k as any).betreuungEnde && <div className="text-xs text-slate-400 mt-0.5">{fmtDate((k as any).betreuungEnde)}</div>}
                  </div>
                </div>

                {/* Turnusse */}
                {liveEinsaetze.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <div className="text-3xl mb-2">📅</div>
                    <div className="text-sm font-medium">Noch keine Turnusse</div>
                    <button onClick={() => { setEditEinsatz(null); setShowEinsatzForm(true) }}
                      className="mt-3 text-xs text-teal-600 underline cursor-pointer bg-transparent border-none">
                      Jetzt ersten Einsatz anlegen →
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {[...liveEinsaetze].sort((a, b) => (b.von || '').localeCompare(a.von || '')).map(e => (
                      <div key={e.id}
                        className={clsx('flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-all',
                          e.status === 'aktiv' ? 'bg-sky-50/30' :
                          e.status === 'geplant' ? 'bg-amber-50/20' : ''
                        )}>
                        <div className="flex items-center gap-3">
                          <div className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0',
                            e.status === 'aktiv' ? 'bg-sky-500' :
                            e.status === 'geplant' ? 'bg-amber-400' : 'bg-slate-300'
                          )} />
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{e.betreuerinName || '— keine Betreuerin —'}</div>
                            <div className="text-xs text-slate-400">
                              {fmtDate(e.von)} — {e.bis ? fmtDate(e.bis) : 'laufend'}
                              {e.turnusTage ? ` · ${e.turnusTage} Tage` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge label={e.status === 'aktiv' ? '📍 Aktiv' : e.status === 'geplant' ? '🗓 Geplant' : '✅ Beendet'}
                            className={clsx('text-xs',
                              e.status === 'aktiv' ? 'bg-sky-100 text-sky-700 border-sky-300' :
                              e.status === 'geplant' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                            )} />
                          <button onClick={() => { setEditEinsatz(e); setShowEinsatzForm(true) }}
                            className="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 cursor-pointer hover:bg-slate-100">
                            ✏️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ═══ CHRONOLOGIE ═══ */}
          {activeTab === 'chronologie' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Betreuungschronologie</div>
              {liveEinsaetze.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="text-4xl mb-2">📋</div>
                  <div>Noch keine Einsätze erfasst</div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-teal-100" />
                  {[...liveEinsaetze].sort((a, b) => (b.von || '').localeCompare(a.von || '')).map((e, i) => {
                    const status = getEinsatzStatus(e)
                    const istAktiv = status === 'aktiv' || status === 'wechsel_offen'
                    return (
                      <div key={e.id} className="relative flex gap-4 pb-6">
                        <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm ${istAktiv ? 'bg-teal-700 text-white' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                          {istAktiv ? '✓' : (i + 1)}
                        </div>
                        <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-bold text-slate-900">{e.betreuerinName || '–'}</div>
                              <div className="text-sm text-slate-500 mt-0.5">
                                {fmtDate(e.von)} — {e.bis ? fmtDate(e.bis) : 'laufend'}
                              </div>
                              {e.turnusTage && <div className="text-xs text-slate-400 mt-0.5">{e.turnusTage} Tage Turnus</div>}
                            </div>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${EINSATZ_STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
                              {EINSATZ_STATUS_LABELS[status] || status}
                            </span>
                          </div>
                          {e.uebergabeNotiz && (
                            <div className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2 italic">
                              💬 {e.uebergabeNotiz}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ DOKUMENTE ═══ */}
          {activeTab === 'dokumente' && (
            <div className="space-y-4">
              {warnDoks.length > 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                  <div className="font-bold text-amber-900 text-sm mb-2">⚠️ Ablaufende Dokumente</div>
                  {warnDoks.map(d => (
                    <div key={d.id} className="text-xs text-amber-800">
                      {DOK_KAT_ICONS[d.kategorie]} {d.bezeichnung} — {isDokAbgelaufen(d) ? 'ABGELAUFEN' : `läuft ab ${fmtDate(d.ablaufdatum)}`}
                    </div>
                  ))}
                </div>
              )}

              {canGF && (
                <button onClick={() => setShowDokForm(true)}
                  className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 px-5 py-4 text-sm font-semibold text-teal-700 cursor-pointer hover:bg-teal-100 w-full justify-center">
                  + Dokument hinzufügen
                </button>
              )}

              {showDokForm && (
                <div className="rounded-2xl border border-teal-200 bg-white p-5">
                  <div className="text-sm font-bold text-slate-800 mb-3">Neues Dokument</div>
                  <div className="grid grid-cols-2 gap-3">
                    <SelField label="Kategorie" value={dokForm.kategorie}
                      onChange={v => setDokForm(f => ({ ...f, kategorie: v as KlientDokKat }))}
                      options={Object.entries(DOK_KAT_LABELS).map(([k, v]) => ({ value: k, label: `${DOK_KAT_ICONS[k as KlientDokKat]} ${v}` }))} />
                    <Field label="Bezeichnung *" value={dokForm.bezeichnung} onChange={v => setDokForm(f => ({ ...f, bezeichnung: v }))} />
                    <Field label="Dokumentnummer" value={dokForm.dokumentNummer} onChange={v => setDokForm(f => ({ ...f, dokumentNummer: v }))} />
                    <Field label="Ausgestellt am" value={dokForm.ausgestellt} onChange={v => setDokForm(f => ({ ...f, ausgestellt: v }))} type="date" />
                    <Field label="Ablaufdatum" value={dokForm.ablaufdatum} onChange={v => setDokForm(f => ({ ...f, ablaufdatum: v }))} type="date" />
                    <Field label="Ausstellende Behörde" value={dokForm.ausstellendeBehörde} onChange={v => setDokForm(f => ({ ...f, ausstellendeBehörde: v }))} />
                    <div className="col-span-2">
                      <div className="text-sm font-medium text-slate-600 mb-1.5">Datei / Scan hochladen</div>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif,.webp,.tiff,.bmp"
                        className="w-full text-xs text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-teal-50 file:text-teal-700 file:font-semibold file:px-3 file:py-2 file:cursor-pointer"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setDokForm(f => ({ ...f, dateiName: file.name }))
                          // Alle Dateitypen als Base64 laden
                          const reader = new FileReader()
                          reader.onload = ev => setDokForm(f => ({ ...f, dateiBase64: ev.target?.result as string }))
                          reader.readAsDataURL(file)
                        }} />
                    </div>
                    <div className="col-span-2">
                      <TextArea label="Notizen" value={dokForm.notizen} onChange={v => setDokForm(f => ({ ...f, notizen: v }))} />
                    </div>
                    <div className="col-span-2 flex items-center gap-3">
                      <input type="checkbox" checked={dokForm.vertraulich} onChange={e => setDokForm(f => ({ ...f, vertraulich: e.target.checked }))} className="accent-teal-700" />
                      <span className="text-sm text-slate-700">Vertraulich (nur GF)</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <Btn onClick={() => setShowDokForm(false)}>Abbrechen</Btn>
                    <Btn teal onClick={() => {
                      if (!dokForm.bezeichnung) return
                      save({ dokumente: [...k.dokumente, { ...dokForm, id: uid() }] })
                      setShowDokForm(false)
                      setDokForm({ kategorie: 'foerderbescheid', bezeichnung: '', dateiName: '', hochgeladenAm: today(), ablaufdatum: '', ausgestellt: '', ausstellendeBehörde: '', dokumentNummer: '', notizen: '', vertraulich: false })
                    }}>Speichern</Btn>
                    {/* Leselotte: Bild via Vision API auslesen */}
                    {dokForm.dateiBase64 && (
                      <button onClick={async () => {
                        const parts = dokForm.dateiBase64!.split(',')
                        const mediaType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
                        const b64 = parts[1]
                        setShowDokForm(false)
                        try {
                          const res = await fetch('/api/ai', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              model: 'claude-sonnet-4-20250514', max_tokens: 1000,
                              system: 'Du bist ein Dokumentenerkennungs-Assistent für österreichische Pflegedokumente. Extrahiere alle relevanten Felder. Antworte NUR mit JSON, kein anderer Text.',
                              messages: [{ role: 'user', content: [
                                ...(await bereiteKiInhaltVorK({name: dokForm.dateiName||'dok', type: mediaType}, `data:${mediaType};base64,${b64}`)).content.filter((x:any)=>x.type!=='text'),
                                { type: 'text', text: 'Lies alle Felder aus diesem Dokument. JSON-Felder (nur wenn erkennbar): {"vorname":"","nachname":"","geburtsdatum":"YYYY-MM-DD","svnr":"","pflegestufe":"1-7","foerderungBetrag":0,"foerderungBis":"YYYY-MM-DD","krankenkasse":"","krankenkasseNr":"","diagnosen":[""],"hausarzt":"","strasse":"","plz":"","ort":"","dokumentTyp":""}' }
                              ]}]
                            })
                          })
                          const data = await res.json()
                          const raw = data.content?.[0]?.text || '{}'
                          const felder = JSON.parse(raw.replace(/```json|```/g, '').trim())
                          // Nur leere Felder befüllen
                          const updates: Partial<Klient> = {}
                          if (felder.vorname && !k.vorname) updates.vorname = felder.vorname
                          if (felder.nachname && !k.nachname) updates.nachname = felder.nachname
                          if (felder.geburtsdatum && !k.geburtsdatum) updates.geburtsdatum = felder.geburtsdatum
                          if (felder.svnr && !k.svnr) updates.svnr = felder.svnr
                          if (felder.pflegestufe && (k.pflegestufe === '0' || !k.pflegestufe)) updates.pflegestufe = felder.pflegestufe as any
                          if (felder.foerderungBetrag && !k.foerderungBetrag) updates.foerderungBetrag = felder.foerderungBetrag
                          if (felder.foerderungBis && !k.foerderungBis) updates.foerderungBis = felder.foerderungBis
                          if (felder.krankenkasse && !k.krankenkasse) updates.krankenkasse = felder.krankenkasse
                          if (felder.krankenkasseNr && !k.krankenkasseNr) updates.krankenkasseNr = felder.krankenkasseNr
                          if (felder.hausarzt && !k.hausarzt) updates.hausarzt = felder.hausarzt
                          if (felder.strasse && !k.strasse) updates.strasse = felder.strasse
                          if (felder.plz && !k.plz) updates.plz = felder.plz
                          if (felder.ort && !k.ort) updates.ort = felder.ort
                          if (felder.diagnosen?.length && k.diagnosen.length === 0) {
                            updates.diagnosen = felder.diagnosen.map((d: string) => ({ bezeichnung: d, seit: '', schweregrad: '' as const }))
                          }
                          // Pflegegeld automatisch wenn Stufe erkannt
                          if (felder.pflegestufe && !felder.foerderungBetrag) {
                            const betrag = PFLEGEGELD[felder.pflegestufe]
                            if (betrag && !k.foerderungBetrag) updates.foerderungBetrag = betrag
                          }
                          // Förderungs-Eintrag aus Bescheid erstellen
                          if (felder.pflegestufe || felder.foerderungBetrag || felder.bescheidNummer) {
                            const betrag = felder.foerderungBetrag || (felder.pflegestufe ? PFLEGEGELD[felder.pflegestufe] : 0) || 0
                            const neuerEintrag: FoerderEintrag = {
                              id: uid(),
                              typ: felder.foerderungTyp === 'land' ? 'landesfoerderung' : 'bundesfoerderung',
                              bezeichnung: felder.pflegestufe ? `Pflegegeld Stufe ${felder.pflegestufe}` : 'Förderung aus Bescheid',
                              status: 'genehmigt',
                              beantragungGeplantAm: '', beantragungEingereichtAm: '',
                              beantragungBei: felder.behoerde || '',
                              antragNummer: '', genehmigungAm: felder.bescheidDatum || today(),
                              bescheidNummer: felder.bescheidNummer || '',
                              betragMonatlich: betrag,
                              gueltigAb: felder.gueltigAb || today(),
                              gueltigBis: felder.foerderungBis || '',
                              jaehrlichErneuerung: false,
                              naechsteErneuerungAm: '', erinnerungTageVorher: 60,
                              erinnerungAn: k.zustaendig || '',
                              erinnerungVersendetAm: '', ausLeselottes: true,
                              dokDateiName: dokForm.dateiName, notizen: 'Von Leselotte automatisch aus Bescheid ausgelesen',
                            }
                            // Nur hinzufügen wenn noch kein ähnlicher Eintrag
                            const bereitsVorhanden = (k.foerderungen || []).some(f =>
                              f.bescheidNummer && f.bescheidNummer === neuerEintrag.bescheidNummer
                            )
                            if (!bereitsVorhanden && betrag > 0) {
                              updates.foerderungen = [...(k.foerderungen || []), neuerEintrag]
                            }
                          }
                          // Dokument auch speichern
                          save({ ...updates, dokumente: [...k.dokumente, { ...dokForm, id: uid() }] })
                          const anzahl = Object.keys(updates).length
                          alert(`✅ Leselotte hat ${anzahl} Felder erkannt und eingetragen!\n\n${Object.keys(updates).map(f => `• ${f}`).join('\n')}`)
                        } catch {
                          save({ dokumente: [...k.dokumente, { ...dokForm, id: uid() }] })
                          alert('Dokument gespeichert. Leselotte konnte das Bild nicht auslesen.')
                        }
                      }} className="rounded-2xl border border-pink-200 bg-pink-50 text-pink-700 text-xs font-semibold px-4 py-2.5 cursor-pointer hover:bg-pink-100">
                        📖 Leselotte auslesen
                      </button>
                    )}
                  </div>
                </div>
              )}

              {k.dokumente.length === 0 && !showDokForm && (
                <div className="text-center py-12 text-slate-400"><div className="text-4xl mb-2">📁</div><div>Noch keine Dokumente</div></div>
              )}

              {(['foerderbescheid', 'pflegegutachten', 'arztbrief', 'vollmacht', 'vertrag', 'ausweis', 'meldebestaetigung', 'versicherung', 'rezept', 'sonstiges'] as KlientDokKat[]).map(kat => {
                const doks = k.dokumente.filter(d => d.kategorie === kat && (canGF || !d.vertraulich))
                if (doks.length === 0) return null
                return (
                  <div key={kat}>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{DOK_KAT_ICONS[kat]} {DOK_KAT_LABELS[kat]}</div>
                    {doks.map(d => (
                      <div key={d.id} className={clsx('rounded-2xl border px-5 py-4 mb-2',
                        isDokAbgelaufen(d) ? 'border-rose-200 bg-rose-50' :
                        isDokBaldAbgelaufen(d) ? 'border-amber-200 bg-amber-50' :
                        d.vertraulich ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white')}>
                        <div className="flex items-center gap-4">
                          {d.dateiBase64 && d.dateiBase64.startsWith('data:image') && (
                            <img src={d.dateiBase64} alt={d.bezeichnung} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-slate-200" />
                          )}
                          {d.dateiBase64 && d.dateiBase64.startsWith('data:application/pdf') && (
                            <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-2xl flex-shrink-0">📄</div>
                          )}
                          {!d.dateiBase64 && (
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">{DOK_KAT_ICONS[d.kategorie] || '📎'}</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900">{d.bezeichnung}</span>
                              {d.vertraulich && <Badge label="🔒" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300" />}
                              {isDokAbgelaufen(d) && <Badge label="ABGELAUFEN" className="text-[10px] bg-rose-100 text-rose-700 border-rose-300" />}
                            </div>
                            {d.dokumentNummer && <div className="text-xs font-mono text-slate-500 mt-0.5">Nr. {d.dokumentNummer}</div>}
                            {d.ausstellendeBehörde && <div className="text-xs text-slate-400">{d.ausstellendeBehörde}</div>}
                            {d.dateiName && <div className="text-xs text-slate-300 mt-0.5">📎 {d.dateiName}</div>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <AblaufBadge dok={d} />
                            <div className="text-xs text-slate-400 mt-1">hochgeladen {fmtDate(d.hochgeladenAm)}</div>
                          </div>
                        </div>
                        {/* Aktionsleiste */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                          {d.dateiBase64 && (
                            <>
                              {/* Download */}
                              <a href={d.dateiBase64}
                                download={d.dateiName || `${d.bezeichnung.replace(/\s+/g, '_')}.${d.dateiBase64.includes('pdf') ? 'pdf' : 'jpg'}`}
                                className="rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-xs font-semibold px-3 py-1.5 hover:bg-teal-100 flex items-center gap-1">
                                ⬇️ Herunterladen
                              </a>
                              {/* Drucken */}
                              <button onClick={() => {
                                const w = window.open('', '_blank')
                                if (!w) return
                                if (d.dateiBase64!.startsWith('data:image')) {
                                  w.document.write(`<html><body style="margin:0"><img src="${d.dateiBase64}" style="max-width:100%;print-color-adjust:exact" onload="window.print()"/></body></html>`)
                                } else {
                                  w.document.write(`<html><body style="margin:0"><embed src="${d.dateiBase64}" type="application/pdf" width="100%" height="100%" /><script>setTimeout(()=>window.print(),500)</script></body></html>`)
                                }
                                w.document.close()
                              }} className="rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold px-3 py-1.5 hover:bg-slate-50 cursor-pointer flex items-center gap-1">
                                🖨️ Drucken
                              </button>
                              {/* Per E-Mail versenden */}
                              {k.email && (
                                <a href={`mailto:${k.email}?subject=${encodeURIComponent(`Dokument: ${d.bezeichnung}`)}&body=${encodeURIComponent(`Sehr geehrte Damen und Herren,\n\nim Anhang finden Sie das Dokument: ${d.bezeichnung}.\n\nMit freundlichen Grüßen\nVBetreut GmbH`)}`}
                                  className="rounded-xl border border-sky-200 bg-sky-50 text-sky-700 text-xs font-semibold px-3 py-1.5 hover:bg-sky-100 flex items-center gap-1">
                                  📧 Per E-Mail
                                </a>
                              )}
                              {/* In neuem Tab öffnen */}
                              <a href={d.dateiBase64} target="_blank" rel="noopener noreferrer"
                                className="rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold px-3 py-1.5 hover:bg-violet-100 flex items-center gap-1">
                                🔍 Öffnen
                              </a>
                            </>
                          )}
                          {!d.dateiBase64 && (
                            <span className="text-xs text-slate-400 italic">Kein Datei-Upload — nur Metadaten gespeichert</span>
                          )}
                          {canGF && (
                            <button onClick={() => save({ dokumente: k.dokumente.filter(x => x.id !== d.id) })}
                              className="rounded-xl border border-rose-200 text-rose-500 text-xs px-3 py-1.5 cursor-pointer hover:bg-rose-50 ml-auto">
                              🗑 Löschen
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {/* ═══ FINANZEN ═══ */}
          {activeTab === 'finanzen' && (
            <div className="space-y-4">

              {/* Tagessätze */}
              <div className="rounded-2xl border border-teal-200 bg-white overflow-hidden">
                <div className="bg-teal-50 px-5 py-3 border-b border-teal-100 flex items-center justify-between">
                  <div className="font-bold text-teal-900 text-sm">💶 Tarife & Tagessätze</div>
                  <div className="text-xs text-teal-600">Gilt für alle Einsätze dieses Klienten</div>
                </div>
                <div className="p-4 grid grid-cols-3 gap-3">
                  {([
                    ['tagessatzStandard', 'Tagessatz', '€/Tag'],
                    ['taxiHin', 'Taxi Anreise', '€'],
                    ['taxiRueck', 'Taxi Abreise', '€'],
                    ['agenturpauschale', 'Agenturpauschale', '€/Monat'],
                    ['monatlicheBeitrag', 'Beitrag Klient', '€/Monat'],
                    ['zahlungsziel', 'Zahlungsziel', 'Tage'],
                  ] as const).map(([field, label, unit]) => (
                    <div key={field}>
                      <div className="text-xs text-slate-400 mb-1">{label}</div>
                      {canGF ? (
                        <div className="flex items-center gap-1">
                          <input type="number" value={(k as any)[field] || 0}
                            onChange={e => save({ [field]: +e.target.value } as any)}
                            min={0}
                            className="w-full text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-teal-400" />
                          <span className="text-xs text-slate-400 whitespace-nowrap">{unit}</span>
                        </div>
                      ) : (
                        <div className="text-sm font-bold text-teal-800">
                          {(k as any)[field] > 0 ? fmt((k as any)[field]) : '–'} <span className="text-xs text-slate-400">{unit}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {(k.tagessatzStandard || 0) > 0 && (
                  <div className="border-t border-teal-100 px-4 py-3 bg-teal-50/50">
                    <div className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-2">Kalkulation</div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      {[
                        ['14 Tage', 14 * (k.tagessatzStandard || 0) + (k.taxiHin || 0) + (k.taxiRueck || 0)],
                        ['28 Tage', 28 * (k.tagessatzStandard || 0) + (k.taxiHin || 0) + (k.taxiRueck || 0)],
                        ['28d + Pauschale', 28 * (k.tagessatzStandard || 0) + (k.taxiHin || 0) + (k.taxiRueck || 0) + (k.agenturpauschale || 0)],
                      ].map(([l, v]) => (
                        <div key={String(l)} className="rounded-xl bg-white border border-teal-200 px-3 py-2 text-center">
                          <div className="text-xs text-slate-400">{l}</div>
                          <div className="font-bold text-teal-800">{fmt(+v)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bankverbindung Klient */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
                  <div className="font-bold text-slate-900 text-sm">🏦 Bankverbindung & Zahlung</div>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  {([
                    ['iban', 'IBAN Klient', 'text'],
                    ['bic', 'BIC', 'text'],
                    ['zahlungsart', 'Zahlungsart', 'select'],
                  ] as const).map(([field, label, type]) => (
                    <div key={field}>
                      <div className="text-xs text-slate-400 mb-1">{label}</div>
                      {canGF && type === 'select' ? (
                        <select value={(k as any)[field] || ''} onChange={e => save({ [field]: e.target.value } as any)}
                          className="w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none">
                          <option value="">– wählen –</option>
                          {getAuswahlOptionen('zahlungsart_klient').map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : canGF ? (
                        <input type="text" value={(k as any)[field] || ''}
                          onChange={e => save({ [field]: e.target.value } as any)}
                          className="w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-teal-400" />
                      ) : (
                        <div className="text-sm font-semibold text-slate-900">{(k as any)[field] || '–'}</div>
                      )}
                    </div>
                  ))}
                  <div className="col-span-2">
                    <div className="text-xs text-slate-400 mb-1">Zahlungshinweis</div>
                    {canGF ? (
                      <textarea value={k.zahlungshinweis || ''} onChange={e => save({ zahlungshinweis: e.target.value })} rows={2}
                        className="w-full text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none resize-none focus:border-teal-400" />
                    ) : (
                      <div className="text-sm text-slate-900">{k.zahlungshinweis || '–'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Angebot */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="font-bold text-slate-900 text-sm">📋 Angebot</div>
                  <Badge
                    label={k.angebotStatus === 'angenommen' ? '✅ Angenommen' : k.angebotStatus === 'gesendet' ? '📤 Gesendet' : k.angebotStatus === 'entwurf' ? '✏️ Entwurf' : k.angebotStatus === 'abgelehnt' ? '❌ Abgelehnt' : '–'}
                    className={clsx('text-xs', k.angebotStatus === 'angenommen' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : k.angebotStatus === 'gesendet' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-600 border-slate-200')}
                  />
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Angebotsnummer</div>
                    {canGF ? <input value={k.angebotNummer || ''} onChange={e => save({ angebotNummer: e.target.value })}
                      className="w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none" />
                    : <div className="text-sm font-semibold">{k.angebotNummer || '–'}</div>}
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Status</div>
                    {canGF ? (
                      <select value={k.angebotStatus || ''} onChange={e => save({ angebotStatus: e.target.value as any })}
                        className="w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none">
                        <option value="">–</option>
                        <option value="entwurf">✏️ Entwurf</option>
                        <option value="gesendet">📤 Gesendet</option>
                        <option value="angenommen">✅ Angenommen</option>
                        <option value="abgelehnt">❌ Abgelehnt</option>
                      </select>
                    ) : <div className="text-sm font-semibold">{k.angebotStatus || '–'}</div>}
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Angebotsdatum</div>
                    {canGF ? <input type="date" value={k.angebotDatum || ''} onChange={e => save({ angebotDatum: e.target.value })}
                      className="w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none" />
                    : <div className="text-sm font-semibold">{fmtDate(k.angebotDatum)}</div>}
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Angenommen am</div>
                    {canGF ? <input type="date" value={k.angebotAngenommenAm || ''} onChange={e => save({ angebotAngenommenAm: e.target.value })}
                      className="w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none" />
                    : <div className="text-sm font-semibold">{fmtDate(k.angebotAngenommenAm)}</div>}
                  </div>
                </div>
              </div>

              {/* Förderung */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="font-bold text-slate-900 text-sm">🏥 Pflegegeld & Förderung</div>
                  <Badge label={FOERDERUNG_LABELS[k.foerderung] || k.foerderung || '–'} className={clsx('text-xs', FOERDERUNG_COLORS[k.foerderung] || 'bg-slate-100 text-slate-500 border-slate-200')} />
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Pflegestufe', k.pflegestufe !== '0' ? `Stufe ${k.pflegestufe}` : '–'],
                    ['Förderbetrag', k.foerderungBetrag > 0 ? fmt(k.foerderungBetrag) : '–'],
                    ['Krankenkasse', k.krankenkasse || '–'],
                    ['Förderung bis', fmtDate(k.foerderungBis)],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-xs text-slate-400">{l}</div>
                      <div className="font-semibold text-slate-900 mt-0.5">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
          {activeTab === 'foerderungen' && (
            <FoerderungenTab k={k} canGF={canGF} onSave={data => save(data)} />
          )}

          {/* ═══ LESELOTTE ═══ */}
          {activeTab === 'leselotte' && (
            <div className="flex-1 h-full">
              <Leselotte k={k} onUpdate={data => save(data)} canGF={canGF} />
            </div>
          )}

          {activeTab === 'notizen' && (
            <div className="space-y-4">
            <DokumentationsNotiz
              eintraege={Array.isArray(k.notizEintraege) ? k.notizEintraege : []}
              onChange={eintraege => save({ notizEintraege: eintraege })}
              canGF={canGF}
              userName={''}
              notiz={k.notizen}
              onNotizChange={v => save({ notizen: v })}
              internNotiz={k.internNotizen}
              onInternNotizChange={canGF ? v => save({ internNotizen: v }) : undefined}
            />
              <Field label="Wiedervorlage" value={k.wiedervorlage} onChange={v => save({ wiedervorlage: v })} type="date" />
              <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
                Angelegt: {fmtDate(k.erstelltAm)} von {k.erstelltVon} · Aktualisiert: {fmtDate(k.aktualisiertAm)}
              </div>
            </div>
          )}

          {/* ═══ ÜBERSICHT ═══ */}
          {activeTab === 'uebersicht' && (
            <div className="space-y-5">
              {/* Direkt editierbare Schnell-Felder */}
              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="font-bold text-slate-900 text-sm">Schnell-Übersicht</div>
                  {canGF && <div className="text-xs text-teal-600">✏️ Direkt editierbar</div>}
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">

                  {/* Status */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-400 mb-1">🔵 Status</div>
                    {canGF
                      ? <select value={k.status} onChange={e => save({ status: e.target.value as any })}
                          className="w-full text-sm font-semibold text-slate-900 bg-transparent border-none outline-none cursor-pointer">
                          <option value="aktiv">Aktiv</option>
                          <option value="interessent">Interessent</option>
                          <option value="pausiert">Pausiert</option>
                          <option value="beendet">Beendet</option>
                        </select>
                      : <div className="text-sm font-semibold">{STATUS_LABELS[k.status] || k.status || '–'}</div>
                    }
                  </div>

                  {/* Pflegestufe */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-400 mb-1">🏥 Pflegestufe</div>
                    {canGF
                      ? <select value={k.pflegestufe} onChange={e => save({ pflegestufe: e.target.value as any })}
                          className="w-full text-sm font-semibold text-slate-900 bg-transparent border-none outline-none cursor-pointer">
                          {['0','1','2','3','4','5','6','7'].map(s => <option key={s} value={s}>{s === '0' ? 'Keine' : `Stufe ${s}`}</option>)}
                        </select>
                      : <div className="text-sm font-semibold">{k.pflegestufe !== '0' ? `Stufe ${k.pflegestufe}` : '–'}</div>
                    }
                  </div>

                  {/* Förderung */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-400 mb-1">💶 Förderung</div>
                    {canGF
                      ? <select value={k.foerderung} onChange={e => save({ foerderung: e.target.value as any })}
                          className="w-full text-sm font-semibold text-slate-900 bg-transparent border-none outline-none cursor-pointer">
                          <option value="aktiv">Aktiv</option>
                          <option value="beantragt">Beantragt</option>
                          <option value="keine">Keine</option>
                        </select>
                      : <div className="text-sm font-semibold">{FOERDERUNG_LABELS[k.foerderung] || k.foerderung || '–'}</div>
                    }
                  </div>

                  {/* Mobilität */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-400 mb-1">🚶 Mobilität</div>
                    {canGF
                      ? <select value={k.mobilitaet || ''} onChange={e => save({ mobilitaet: e.target.value as any })}
                          className="w-full text-sm font-semibold text-slate-900 bg-transparent border-none outline-none cursor-pointer">
                          <option value="">– nicht angegeben –</option>
                          <option value="selbstständig">Selbstständig</option>
                          <option value="mit_hilfe">Mit Hilfe</option>
                          <option value="rollstuhl">Rollstuhl</option>
                          <option value="bettlaegerig">Bettlägerig</option>
                        </select>
                      : <div className="text-sm font-semibold">{MOBILITAET_LABELS[k.mobilitaet] || '–'}</div>
                    }
                  </div>

                  {/* Turnus */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-400 mb-1">📅 Turnus</div>
                    {canGF
                      ? <select value={k.aktuellerTurnus || ''} onChange={e => save({ aktuellerTurnus: e.target.value as any })}
                          className="w-full text-sm font-semibold text-slate-900 bg-transparent border-none outline-none cursor-pointer">
                          <option value="">– kein Einsatz –</option>
                          <option value="14">14 Tage</option>
                          <option value="28">28 Tage</option>
                          <option value="flexibel">Flexibel</option>
                          <option value="dauerhaft">Dauerhaft</option>
                        </select>
                      : <div className="text-sm font-semibold">{TURNUS_LABELS[k.aktuellerTurnus] || '–'}</div>
                    }
                  </div>

                  {/* Aktuelle Betreuerin */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-400 mb-1">👩 Akt. Betreuerin</div>
                    {canGF
                      ? <input value={k.aktuelleBetreuerin || ''} onChange={e => save({ aktuelleBetreuerin: e.target.value })}
                          placeholder="Name der Betreuerin"
                          className="w-full text-sm font-semibold text-slate-900 bg-transparent border-none outline-none" />
                      : <div className="text-sm font-semibold">{k.aktuelleBetreuerin || '– keine –'}</div>
                    }
                  </div>

                  {/* Nächster Wechsel */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-400 mb-1">🔄 Nächster Wechsel</div>
                    {canGF
                      ? <input type="date" value={k.naechsterWechsel || ''} onChange={e => save({ naechsterWechsel: e.target.value })}
                          className="w-full text-sm font-semibold text-slate-900 bg-transparent border-none outline-none cursor-pointer" />
                      : <div className="text-sm font-semibold">{fmtDate(k.naechsterWechsel)}</div>
                    }
                  </div>

                  {/* Zuständig */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-400 mb-1">👤 Zuständig</div>
                    {canGF
                      ? <input value={k.zustaendig || ''} onChange={e => save({ zustaendig: e.target.value })}
                          placeholder="Mitarbeiter"
                          className="w-full text-sm font-semibold text-slate-900 bg-transparent border-none outline-none" />
                      : <div className="text-sm font-semibold">{k.zustaendig || '–'}</div>
                    }
                  </div>

                  {/* Tagessatz — Schnellzugriff */}
                  <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 col-span-2">
                    <div className="text-xs text-teal-600 mb-2 font-bold">💶 Tagessätze (Standard alle Betreuerinnen)</div>
                    <div className="grid grid-cols-4 gap-2">
                      {(['tagessatzStandard', 'agenturpauschale', 'taxiHin', 'taxiRueck'] as const).map((field, i) => (
                        <div key={field}>
                          <div className="text-[10px] text-teal-600 mb-1">{['Standard', 'Pauschale', 'Taxi Hin', 'Taxi Rück'][i]}</div>
                          {canGF
                            ? <input type="number" value={(k as any)[field] || 0} min={0} step={5}
                                onChange={e => save({ [field]: +e.target.value } as any)}
                                className="w-full text-sm font-bold text-teal-800 bg-white border border-teal-200 rounded-lg px-2 py-1.5 outline-none" />
                            : <div className="text-sm font-bold text-teal-800">{(k as any)[field] > 0 ? fmt((k as any)[field]) : '–'}</div>
                          }
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {k.besonderheiten && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">📌 Besonderheiten</div>
                  <div className="text-sm text-amber-900">{k.besonderheiten}</div>
                </div>
              )}

              {k.allergien && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">⚠️ Allergien</div>
                  <div className="text-sm text-rose-900">{k.allergien}</div>
                </div>
              )}

              {k.medikamente && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <div className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-1">💊 Medikamente</div>
                  <div className="text-sm text-violet-900 font-mono whitespace-pre-wrap">{k.medikamente}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Geschäftsfall Formular (inline, kein Modal-Overlay) ─────────────────────
function GeschaeftsfallFormular({ klientId, klientName, klientOrt, initial, onSave, onClose }: {
  klientId: string
  klientName: string
  klientOrt: string
  initial: any
  onSave: (data: any) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({
    klientId, klientName, klientOrt,
    betreuerinId: initial?.betreuerinId || '',
    betreuerinName: initial?.betreuerinName || '',
    von: initial?.von || '',
    bis: initial?.bis || '',
    turnusTage: initial?.turnusTage || 28,
    status: initial?.status || 'geplant',
    wechselTyp: initial?.wechselTyp || 'erstanreise',
    tagessatz: initial?.tagessatz || 80,
    taxiHin: initial?.taxiHin || '',
    taxiRueck: initial?.taxiRueck || '',
    notizen: initial?.notizen || '',
    id: initial?.id || '',
    erstelltAm: initial?.erstelltAm || '',
    aktualisiertAm: '',
    gesamtbetrag: 0,
    abrechnungsStatus: 'offen',
    rechnungsId: '',
    taxiKosten: 0,
    uebergabeNotiz: '',
    nachfolgerBetreuerinId: '',
    nachfolgerBetreuerinName: '',
    wechselGeplantAm: '',
    zustaendig: '',
  })
  const [betreuerinnen, setBetreuerinnen] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/db/betreuerinnen').then(r => r.ok ? r.json() : []).then((list: any[]) =>
      setBetreuerinnen(list.map((b: any) => ({
        id: b.id,
        name: `${b.nachname || b.data?.nachname || ''} ${b.vorname || b.data?.vorname || ''}`.trim(),
      })))
    ).catch(() => {})
  }, [])

  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function speichern() {
    if (!form.von) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50 overflow-hidden mb-3">
      <div className="flex items-center justify-between px-5 py-3 bg-teal-700">
        <div className="font-bold text-white text-sm">
          {initial ? '✏️ Einsatz bearbeiten' : '+ Neuen Einsatz anlegen'}
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white text-lg bg-transparent border-none cursor-pointer">✕</button>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Betreuerin *</div>
            <select value={form.betreuerinId}
              onChange={e => {
                const b = betreuerinnen.find(x => x.id === e.target.value)
                set('betreuerinId', e.target.value)
                set('betreuerinName', b?.name || '')
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white focus:border-teal-400">
              <option value="">– Betreuerin wählen –</option>
              {betreuerinnen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Status</div>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white focus:border-teal-400">
              <option value="geplant">🗓 Geplant</option>
              <option value="aktiv">📍 Aktiv</option>
              <option value="beendet">✅ Beendet</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Von *</div>
            <input type="date" value={form.von} onChange={e => set('von', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Bis</div>
            <input type="date" value={form.bis} onChange={e => set('bis', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Turnus (Tage)</div>
            <input type="number" value={form.turnusTage} onChange={e => set('turnusTage', parseInt(e.target.value) || 28)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Tagessatz (€)</div>
            <input type="number" value={form.tagessatz} onChange={e => set('tagessatz', parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1">Notizen</div>
          <textarea value={form.notizen} onChange={e => set('notizen', e.target.value)}
            rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none resize-none focus:border-teal-400" />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="rounded-xl border border-slate-200 text-slate-600 text-sm px-4 py-2 cursor-pointer hover:bg-slate-50">
            Abbrechen
          </button>
          <button onClick={speichern} disabled={saving || !form.von}
            className="flex-1 rounded-xl bg-teal-700 text-white text-sm font-bold py-2 cursor-pointer border-none hover:bg-teal-800 disabled:opacity-50">
            {saving ? '⏳ Speichern...' : initial ? '💾 Speichern' : '✓ Einsatz anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}
