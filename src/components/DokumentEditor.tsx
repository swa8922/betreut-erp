'use client'
import { useState, useEffect, useMemo } from 'react'
import { Modal, Btn, Field, SelField, TextArea } from '@/components/ui'
import {
  type Dokument, type DokumentTyp, type Position, type Artikel,
  type Versandart, type Zahlungsart, type Steuersatz,
  berechneTurnusTage, berechnePositionSummen, berechneDokumentSummen,
  TYP_LABELS, VERSANDART_LABELS, ZAHLUNGSART_LABELS,
} from '@/lib/finanzen'
import { getKlienten } from '@/lib/klienten'
import { getBetreuerinnen } from '@/lib/betreuerinnen'
import { apiGetAll } from '@/lib/api-client'
import clsx from 'clsx'

const fmt = (n: number) => n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })

function emptyPosition(id: string): Position {
  return {
    id, artikelId: '', bezeichnung: '', beschreibung: '',
    menge: 1, einheit: 'Pauschale', einzelpreis: 0, steuersatz: 0,
    nettoBetrag: 0, steuerBetrag: 0, bruttoBetrag: 0, manuellGeaendert: true,
  }
}

function emptyDokument(typ: DokumentTyp): Omit<Dokument, 'id' | 'dokumentNr' | 'erstelltAm' | 'aktualisiertAm' | 'auditLog'> {
  const today = new Date().toISOString().split('T')[0]
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  return {
    typ, status: 'entwurf',
    einsatzId: '', klientId: '', klientName: '', klientAdresse: '',
    klientEmail: '', klientEmail2: '',
    betreuerinId: '', betreuerinName: '', betreuerinIban: '',
    bezugDokumentId: '', bezugDokumentNr: '', stornoDokumentId: '', gutschriftIds: [],
    zeitraumVon: '', zeitraumBis: '',
    berechneteTageLaut: 0, berechneteTageManuell: 0,
    positionen: [],
    summeNetto: 0, summeSteuern: {}, summeBrutto: 0,
    zahlungsart: 'ueberweisung', zahlungsziel: in14,
    zahlungseingangAm: '', gezahltBetrag: 0, offenerBetrag: 0,
    zahlungsabgleichStatus: 'offen', bankrReferenz: '',
    versandart: 'email', versendetAm: '', versendetAn: [],
    angebotGueltigBis: typ === 'angebot' ? in30 : '',
    angebotAngenommenAm: '',
    bgAbrechnungszeitraum: '', bgGrundlohnBetrag: 0, bgZuschlaege: 0, bgAbzuege: 0,
    taxiUnternehmen: '', taxiFahrten: [],
    notizen: '', internNotizen: '', anhangDateien: [],
    versandart2: 'intern', rechnungsDatum: today,
    erstelltVon: '', archiviert: false,
  }
}

interface Props {
  typ: DokumentTyp
  initial?: Dokument           // wenn vorhanden = bearbeiten, sonst neu
  artikel: Artikel[]
  bezugDokument?: Dokument     // für Gutschrift: die Originalrechnung
  erstelltVon: string
  onSave: (data: Omit<Dokument, 'id' | 'dokumentNr' | 'erstelltAm' | 'aktualisiertAm' | 'auditLog'>) => void
  onClose: () => void
}

export default function DokumentEditor({ typ, initial, artikel, bezugDokument, erstelltVon, onSave, onClose }: Props) {
  const isNew = !initial
  const [form, setForm] = useState<Omit<Dokument, 'id' | 'dokumentNr' | 'erstelltAm' | 'aktualisiertAm' | 'auditLog'>>(
    initial ?? emptyDokument(typ)
  )
  const [klienten, setKlienten] = useState<{ id: string; name: string; adresse: string; email: string }[]>([])
  const [bgs, setBgs] = useState<{ id: string; name: string; iban: string }[]>([])
  const [activeTab, setActiveTab] = useState<'stamm' | 'positionen' | 'versand' | 'notizen'>('stamm')

  useEffect(() => {
    apiGetAll<any>('klienten').then(list => {
      setKlienten(list.map((k: any) => ({
        id: k.id,
        name: `${k.nachname} ${k.vorname}`,
        adresse: `${k.strasse || ''}, ${k.plz || ''} ${k.ort || ''}`.trim(),
        email: k.email || '',
      })))
    })
    apiGetAll<any>('betreuerinnen').then(list => {
      setBgs(list.map((b: any) => ({
        id: b.id,
        name: `${b.nachname} ${b.vorname}`,
        iban: b.iban || b.telefon || '',
      })))
    })

    // Bei Gutschrift: Positionen aus Originalrechnung übernehmen
    if (typ === 'gutschrift' && bezugDokument && isNew) {
      setForm(f => ({
        ...f,
        klientId: bezugDokument.klientId,
        klientName: bezugDokument.klientName,
        klientAdresse: bezugDokument.klientAdresse,
        klientEmail: bezugDokument.klientEmail,
        betreuerinId: bezugDokument.betreuerinId,
        betreuerinName: bezugDokument.betreuerinName,
        bezugDokumentId: bezugDokument.id,
        bezugDokumentNr: bezugDokument.dokumentNr,
        zeitraumVon: bezugDokument.zeitraumVon,
        zeitraumBis: bezugDokument.zeitraumBis,
        positionen: (bezugDokument.positionen || []).map(p => ({
          ...p, id: `gs_${p.id}`,
          manuellGeaendert: false,
        })),
        notizen: `Gutschrift zu ${bezugDokument.dokumentNr}`,
      }))
    }
  }, [])

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  // Klient auswählen → Felder befüllen
  function handleKlientChange(id: string) {
    const k = klienten.find(k => k.id === id)
    setForm(f => ({
      ...f,
      klientId: id,
      klientName: k?.name || '',
      klientAdresse: k?.adresse || '',
      klientEmail: k?.email || '',
    }))
  }

  // Betreuerin auswählen
  function handleBGChange(id: string) {
    const b = bgs.find(b => b.id === id)
    setForm(f => ({ ...f, betreuerinId: id, betreuerinName: b?.name || '' }))
  }

  // Zeitraum → Turnus berechnen → Position aktualisieren
  function handleZeitraumChange(von: string, bis: string) {
    const turnus = von && bis ? berechneTurnusTage(von, bis) : null
    setForm(f => {
      const updated = { ...f, zeitraumVon: von, zeitraumBis: bis }
      if (turnus) {
        updated.berechneteTageLaut = turnus.tage
        // Automatisch die Betreuungs-Position aktualisieren wenn vorhanden
        updated.positionen = f.positionen.map(p => {
          if (p.artikelId === 'A1' || p.artikelId === 'A2' || !p.manuellGeaendert) {
            const neu = berechnePositionSummen({ ...p, menge: turnus.tage })
            return neu
          }
          return p
        })
      }
      const summen = berechneDokumentSummen(updated.positionen)
      return { ...updated, ...summen, offenerBetrag: summen.summeBrutto }
    })
  }

  // Artikel aus Katalog hinzufügen
  function addArtikelFromKatalog(a: Artikel) {
    const pos = berechnePositionSummen({
      id: `p_${Date.now()}`,
      artikelId: a.id,
      bezeichnung: a.bezeichnung,
      beschreibung: a.beschreibung,
      menge: a.einheit === 'Tag' ? (form.berechneteTageLaut || 1) : 1,
      einheit: a.einheit,
      einzelpreis: a.preis,
      steuersatz: a.steuersatz as Steuersatz,
      manuellGeaendert: false,
    })
    const positionen = [...form.positionen, pos]
    const summen = berechneDokumentSummen(positionen)
    setForm(f => ({ ...f, positionen, ...summen, offenerBetrag: summen.summeBrutto }))
  }

  // Leere Position manuell hinzufügen
  function addLeerePosition() {
    const pos = emptyPosition(`p_${Date.now()}`)
    setForm(f => ({ ...f, positionen: [...f.positionen, pos] }))
  }

  // Position aktualisieren
  function updatePosition(id: string, field: keyof Position, value: string | number) {
    setForm(f => {
      const positionen = f.positionen.map(p => {
        if (p.id !== id) return p
        const updated = { ...p, [field]: value, manuellGeaendert: true }
        return berechnePositionSummen(updated)
      })
      const summen = berechneDokumentSummen(positionen)
      return { ...f, positionen, ...summen, offenerBetrag: summen.summeBrutto }
    })
  }

  // Position löschen
  function deletePosition(id: string) {
    setForm(f => {
      const positionen = f.positionen.filter(p => p.id !== id)
      const summen = berechneDokumentSummen(positionen)
      return { ...f, positionen, ...summen, offenerBetrag: summen.summeBrutto }
    })
  }

  // Position verschieben
  function movePosition(id: string, dir: 'up' | 'down') {
    setForm(f => {
      const pos = [...f.positionen]
      const idx = pos.findIndex(p => p.id === id)
      if (dir === 'up' && idx > 0) [pos[idx - 1], pos[idx]] = [pos[idx], pos[idx - 1]]
      if (dir === 'down' && idx < pos.length - 1) [pos[idx + 1], pos[idx]] = [pos[idx], pos[idx + 1]]
      return { ...f, positionen: pos }
    })
  }

  const turnusInfo = useMemo(() =>
    form.zeitraumVon && form.zeitraumBis
      ? berechneTurnusTage(form.zeitraumVon, form.zeitraumBis)
      : null,
    [form.zeitraumVon, form.zeitraumBis]
  )

  const STEUERSUMMEN = Object.entries(form.summeSteuern || {}).filter(([, v]) => v !== 0)

  const typLabel = TYP_LABELS[typ]
  const title = isNew ? `Neues ${typLabel} erstellen` : `${typLabel} ${initial?.dokumentNr} bearbeiten`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-4" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-teal-700 rounded-t-3xl px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/60 mb-1">{typLabel}</div>
              <h2 className="text-2xl font-bold">{title}</h2>
              {initial && <div className="text-white/70 text-sm mt-1">{initial.dokumentNr} · {initial.klientName}</div>}
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl bg-transparent border-none cursor-pointer">✕</button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-5">
            {([
              ['stamm', 'Stammdaten'],
              ['positionen', `Positionen (${form.positionen.length})`],
              ['versand', 'Versand & Zahlung'],
              ['notizen', 'Notizen'],
            ] as const).map(([t, l]) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={clsx(
                  'rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer border-none transition-all',
                  activeTab === t ? 'bg-white text-teal-700' : 'bg-white/15 text-white hover:bg-white/25'
                )}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6 max-h-[60vh] overflow-y-auto">
          <form id="dok-form" onSubmit={e => { e.preventDefault(); onSave(form) }}>

            {/* ── TAB: STAMMDATEN ── */}
            {activeTab === 'stamm' && (
              <div className="space-y-6">
                {/* Klient + Betreuerin */}
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">Klient:in & Betreuerin</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <SelField label="Klient:in *"
                      value={form.klientId}
                      onChange={handleKlientChange}
                      options={[
                        { value: '', label: '— bitte wählen —' },
                        ...klienten.map(k => ({ value: k.id, label: k.name }))
                      ]} />
                    <Field label="Adresse" value={form.klientAdresse} onChange={v => set('klientAdresse', v)} placeholder="Wird automatisch befüllt" />
                    <Field label="E-Mail 1" value={form.klientEmail} onChange={v => set('klientEmail', v)} placeholder="rechnungen@example.at" />
                    <Field label="E-Mail 2 (optional)" value={form.klientEmail2} onChange={v => set('klientEmail2', v)} placeholder="zweite@example.at" />
                    <SelField label="Betreuerin"
                      value={form.betreuerinId}
                      onChange={handleBGChange}
                      options={[
                        { value: '', label: '— keine Betreuerin —' },
                        ...bgs.map(b => ({ value: b.id, label: b.name }))
                      ]} />
                    <Field label="Rechnungsdatum" value={form.rechnungsDatum} onChange={v => set('rechnungsDatum', v)} type="date" />
                  </div>
                </div>

                {/* Zeitraum */}
                {['rechnung', 'gutschrift', 'bg_abrechnung'].includes(typ) && (
                  <div>
                    <h3 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">Betreuungszeitraum & Turnusberechnung</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Anreise (Von) *"
                        value={form.zeitraumVon}
                        onChange={v => handleZeitraumChange(v, form.zeitraumBis)}
                        type="date" required />
                      <Field label="Abreise (Bis) *"
                        value={form.zeitraumBis}
                        onChange={v => handleZeitraumChange(form.zeitraumVon, v)}
                        type="date" required />
                    </div>
                    {turnusInfo && (
                      <div className="mt-3 rounded-2xl bg-teal-50 border border-teal-200 p-4">
                        <div className="text-sm font-bold text-teal-800 mb-1">
                          Berechnete Tage: <span className="text-2xl">{turnusInfo.tage}</span>
                        </div>
                        <div className="text-xs text-teal-600">{turnusInfo.detail}</div>
                        <div className="text-xs text-teal-500 mt-1">Regel: Anreisetag = 0,5 · Abreisetag = 0,5 · volle Tage dazwischen = je 1,0</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Angebot-Gültigkeit */}
                {typ === 'angebot' && (
                  <div>
                    <h3 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">Angebot</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Gültig bis *" value={form.angebotGueltigBis} onChange={v => set('angebotGueltigBis', v)} type="date" required />
                      <div className="text-sm text-slate-500 flex items-end pb-1">
                        Nach Ablauf wird das Angebot automatisch als "Abgelaufen" markiert.
                      </div>
                    </div>
                  </div>
                )}

                {/* Gutschrift-Bezug */}
                {typ === 'gutschrift' && bezugDokument && (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                    <div className="text-sm font-bold text-amber-800">Gutschrift bezieht sich auf:</div>
                    <div className="text-base font-bold text-slate-900 mt-1">{bezugDokument.dokumentNr} — {bezugDokument.klientName}</div>
                    <div className="text-sm text-slate-600">{fmt(bezugDokument.summeBrutto)} · {bezugDokument.rechnungsDatum}</div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: POSITIONEN ── */}
            {activeTab === 'positionen' && (
              <div className="space-y-5">
                {/* Aus Artikelkatalog hinzufügen */}
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-3">Aus Artikelkatalog hinzufügen</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {artikel.filter(a => a.aktiv).map(a => (
                      <button key={a.id} type="button" onClick={() => addArtikelFromKatalog(a)}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-teal-300 hover:bg-teal-50 cursor-pointer transition-all">
                        <div className="font-mono text-xs text-teal-700 mb-1">{a.code}</div>
                        <div className="text-sm font-semibold text-slate-900 leading-tight">{a.bezeichnung}</div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-slate-500">{fmt(a.preis)} / {a.einheit}</span>
                          <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">{a.steuersatz}% MwSt.</span>
                        </div>
                      </button>
                    ))}
                    <button type="button" onClick={addLeerePosition}
                      className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-3 text-slate-400 hover:border-teal-400 hover:text-teal-600 cursor-pointer transition-all flex items-center justify-center gap-2">
                      <span className="text-lg">+</span>
                      <span className="text-sm font-medium">Manuelle Position</span>
                    </button>
                  </div>
                </div>

                {/* Positions-Editor */}
                {form.positionen.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 rounded-2xl border-2 border-dashed border-slate-200">
                    <div className="text-3xl mb-2">📋</div>
                    <div className="text-sm">Noch keine Positionen. Artikel aus dem Katalog wählen oder manuelle Position hinzufügen.</div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="grid bg-slate-50 px-4 py-2 border-b border-slate-100 text-xs font-bold uppercase text-slate-400"
                      style={{ gridTemplateColumns: '1.5fr 70px 60px 90px 60px 80px 80px 60px' }}>
                      <div>Bezeichnung / Beschreibung</div>
                      <div className="text-right">Menge</div>
                      <div>Einheit</div>
                      <div className="text-right">Einzelpreis</div>
                      <div className="text-center">MwSt.</div>
                      <div className="text-right">Netto</div>
                      <div className="text-right">Brutto</div>
                      <div></div>
                    </div>

                    {form.positionen.map((p, idx) => (
                      <div key={p.id} className="grid items-start border-b border-slate-50 last:border-0 px-4 py-3 gap-2"
                        style={{ gridTemplateColumns: '1.5fr 70px 60px 90px 60px 80px 80px 60px' }}>

                        <div className="space-y-1">
                          <input
                            value={p.bezeichnung}
                            onChange={e => updatePosition(p.id, 'bezeichnung', e.target.value)}
                            placeholder="Bezeichnung *"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400"
                          />
                          <input
                            value={p.beschreibung}
                            onChange={e => updatePosition(p.id, 'beschreibung', e.target.value)}
                            placeholder="Beschreibung (optional)"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 placeholder-slate-400"
                          />
                          {p.artikelId && (
                            <div className="text-xs text-teal-600 font-mono">{artikel.find(a => a.id === p.artikelId)?.code || ''}</div>
                          )}
                        </div>

                        <input
                          type="number" value={p.menge} min="0.01" step="0.01"
                          onChange={e => updatePosition(p.id, 'menge', parseFloat(e.target.value) || 0)}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-right text-slate-900 w-full"
                        />

                        <input
                          value={p.einheit}
                          onChange={e => updatePosition(p.id, 'einheit', e.target.value)}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 w-full"
                        />

                        <input
                          type="number" value={p.einzelpreis} min="0" step="0.01"
                          onChange={e => updatePosition(p.id, 'einzelpreis', parseFloat(e.target.value) || 0)}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-right text-slate-900 w-full"
                        />

                        <select value={p.steuersatz}
                          onChange={e => updatePosition(p.id, 'steuersatz', parseInt(e.target.value) as Steuersatz)}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-1 py-1.5 text-xs text-slate-700 w-full">
                          <option value={0}>0%</option>
                          <option value={10}>10%</option>
                          <option value={20}>20%</option>
                        </select>

                        <div className="text-right text-sm text-slate-600 py-1.5">{fmt(p.nettoBetrag)}</div>
                        <div className="text-right text-sm font-semibold text-slate-900 py-1.5">{fmt(p.bruttoBetrag)}</div>

                        <div className="flex flex-col gap-1 items-center">
                          <button type="button" onClick={() => movePosition(p.id, 'up')} disabled={idx === 0}
                            className="w-6 h-6 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100 cursor-pointer text-xs disabled:opacity-30">
                            ↑
                          </button>
                          <button type="button" onClick={() => movePosition(p.id, 'down')} disabled={idx === form.positionen.length - 1}
                            className="w-6 h-6 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100 cursor-pointer text-xs disabled:opacity-30">
                            ↓
                          </button>
                          <button type="button" onClick={() => deletePosition(p.id)}
                            className="w-6 h-6 rounded-lg border border-rose-200 text-rose-400 hover:bg-rose-50 cursor-pointer text-xs">
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Summen */}
                    <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 space-y-1.5">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Summe Netto</span>
                        <span className="font-semibold">{fmt(form.summeNetto)}</span>
                      </div>
                      {STEUERSUMMEN.map(([satz, betrag]) => (
                        <div key={satz} className="flex justify-between text-sm text-slate-500">
                          <span>MwSt. {satz}%</span>
                          <span>{fmt(betrag)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-base font-bold text-teal-700 pt-2 border-t border-teal-200">
                        <span>Gesamtbetrag (Brutto)</span>
                        <span className="text-xl">{fmt(form.summeBrutto)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: VERSAND & ZAHLUNG ── */}
            {activeTab === 'versand' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">Versand</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <SelField label="Versandart"
                      value={form.versandart}
                      onChange={v => set('versandart', v as Versandart)}
                      options={Object.entries(VERSANDART_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                    <Field label="Versanddatum" value={form.versendetAm} onChange={v => set('versendetAm', v)} type="date" />

                    {(form.versandart === 'email' || form.versandart === 'email_post') && (
                      <>
                        <Field label="E-Mail 1" value={form.klientEmail} onChange={v => set('klientEmail', v)} placeholder="rechnungen@example.at" />
                        <Field label="E-Mail 2 (optional)" value={form.klientEmail2} onChange={v => set('klientEmail2', v)} placeholder="zweite@example.at" />
                      </>
                    )}
                    {form.versandart === 'post' && (
                      <Field label="Postadresse" value={form.klientAdresse} onChange={v => set('klientAdresse', v)} placeholder="Straße, PLZ Ort" wide />
                    )}
                  </div>
                </div>

                {typ !== 'angebot' && (
                  <div>
                    <h3 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">Zahlung & Fälligkeit</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <SelField label="Zahlungsart"
                        value={form.zahlungsart}
                        onChange={v => set('zahlungsart', v as Zahlungsart)}
                        options={Object.entries(ZAHLUNGSART_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                      <Field label="Zahlungsziel" value={form.zahlungsziel} onChange={v => set('zahlungsziel', v)} type="date" />
                      <Field label="Zahlung eingegangen am" value={form.zahlungseingangAm} onChange={v => set('zahlungseingangAm', v)} type="date" />
                      <div>
                        <div className="mb-1.5 text-sm font-medium text-slate-600">Bereits gezahlt (€)</div>
                        <input type="number" value={form.gezahltBetrag}
                          onChange={e => {
                            const gezahlt = parseFloat(e.target.value) || 0
                            set('gezahltBetrag', gezahlt)
                            set('offenerBetrag', Math.max(0, form.summeBrutto - gezahlt))
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" min="0" step="0.01"
                        />
                      </div>
                      {form.summeBrutto > 0 && (
                        <div className="col-span-2 rounded-2xl bg-slate-50 border border-slate-200 p-4 flex items-center gap-8">
                          <div><div className="text-xs text-slate-400">Gesamtbetrag</div><div className="text-lg font-bold text-slate-900">{fmt(form.summeBrutto)}</div></div>
                          <div><div className="text-xs text-slate-400">Gezahlt</div><div className="text-lg font-bold text-emerald-600">{fmt(form.gezahltBetrag)}</div></div>
                          <div><div className="text-xs text-slate-400">Offen</div><div className="text-lg font-bold text-amber-600">{fmt(form.offenerBetrag)}</div></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {typ === 'angebot' && (
                  <div>
                    <h3 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">Angebot-Status</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Gültig bis" value={form.angebotGueltigBis} onChange={v => set('angebotGueltigBis', v)} type="date" />
                      <Field label="Angenommen am" value={form.angebotAngenommenAm} onChange={v => set('angebotAngenommenAm', v)} type="date" />
                    </div>
                    {form.angebotAngenommenAm && (
                      <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
                        ✓ Angebot wurde angenommen. Sie können das Angebot jetzt in eine Rechnung umwandeln.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: NOTIZEN ── */}
            {activeTab === 'notizen' && (
              <div className="space-y-4">
                <TextArea label="Kundennotiz (erscheint auf Dokument)"
                  value={form.notizen}
                  onChange={v => set('notizen', v)}
                  placeholder="Hinweise, Sonderwünsche, ergänzende Informationen für den Kunden ..." wide />
                <TextArea label="Interne Notiz (nur für Mitarbeiter)"
                  value={form.internNotizen}
                  onChange={v => set('internNotizen', v)}
                  placeholder="Interne Hinweise, Rückfragen, Bearbeitungshinweise — erscheint NICHT auf dem Dokument" wide />
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {form.positionen.length > 0 && (
              <span className="font-semibold text-slate-700">{form.positionen.length} Positionen · Gesamt: {fmt(form.summeBrutto)}</span>
            )}
          </div>
          <div className="flex gap-3">
            <Btn onClick={onClose}>Abbrechen</Btn>
            {/* Als Entwurf speichern */}
            <button type="button"
              onClick={() => { set('status', 'entwurf'); setTimeout(() => onSave({ ...form, status: 'entwurf' }), 10) }}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">
              Als Entwurf speichern
            </button>
            {/* Fertigstellen */}
            <button type="submit" form="dok-form"
              className="rounded-2xl bg-teal-700 px-6 py-3 text-sm font-bold text-white cursor-pointer border-none hover:bg-teal-800">
              {isNew ? `${typLabel} erstellen` : 'Änderungen speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
