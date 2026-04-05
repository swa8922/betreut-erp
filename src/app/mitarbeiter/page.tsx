'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useMitarbeiter } from '@/hooks/useMitarbeiter'
import Sidebar from '@/components/Sidebar'
import { Badge, Btn, Field, SelField, TextArea, Modal } from '@/components/ui'
import {
  ROLLE_LABELS, ROLLE_COLORS, STATUS_LABELS, STATUS_COLORS,
  DOK_KAT_LABELS, DOK_KAT_ICONS, MODUL_LABELS,
  defaultRechte, generateTempPassword, getDokumentWarnungen, isAbgelaufen,
  type Mitarbeiter, type MitarbeiterRolle, type MitarbeiterStatus,
  type MitarbeiterDokument, type Bankverbindung, type ModulRecht, type DokumentKategorie,
} from '@/lib/mitarbeiter'
import clsx from 'clsx'

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('de-AT') : '–'
const fmt = (n: number) => n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })

// ── Profilbild ────────────────────────────────────────────────
function Avatar({ m, size = 40 }: { m: Mitarbeiter; size?: number }) {
  const colors: Record<MitarbeiterRolle, string> = {
    gf: 'bg-teal-700', koordination: 'bg-sky-600',
    buchhaltung: 'bg-violet-600', mitarbeiter: 'bg-slate-500', extern: 'bg-amber-600',
  }
  return (
    <div className={clsx('rounded-full flex items-center justify-center text-white font-bold flex-shrink-0', colors[m.rolle])}
      style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {m.profilBild || `${m.vorname[0]}${m.nachname[0]}`}
    </div>
  )
}

// ── Ablauf-Badge ──────────────────────────────────────────────
function AblaufBadge({ dok }: { dok: MitarbeiterDokument }) {
  if (!dok.ablaufdatum) return null
  const abgelaufen = isAbgelaufen(dok)
  const days = Math.ceil((new Date(dok.ablaufdatum).getTime() - Date.now()) / 86400000)
  if (abgelaufen) return <Badge label="⚠️ Abgelaufen" className="text-xs bg-rose-50 text-rose-700 border-rose-200" />
  if (days <= 90) return <Badge label={`⚠️ ${days} Tage`} className="text-xs bg-amber-50 text-amber-700 border-amber-200" />
  return <Badge label={`✓ bis ${fmtDate(dok.ablaufdatum)}`} className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200" />
}

// ══════════════════════════════════════════════════════════════
// FORMULAR (Neu / Bearbeiten)
// ══════════════════════════════════════════════════════════════

function emptyMitarbeiter(): Omit<Mitarbeiter, 'id' | 'erstelltAm' | 'aktualisiertAm'> {
  return {
    vorname: '', nachname: '', geburtsdatum: '', svnr: '',
    nationalitaet: 'Österreich', geschlecht: '',
    email: '', emailPrivat: '', telefon: '', telefonPrivat: '',
    strasse: '', plz: '', ort: '', land: 'Österreich',
    status: 'aktiv', rolle: 'mitarbeiter',
    abteilung: '', position: '',
    eintrittsdatum: new Date().toISOString().split('T')[0],
    austrittsdatum: '', wochenstunden: 38, urlaubstage: 25,
    gehalt: 0, gehaltsart: 'monatlich',
    rechte: defaultRechte('mitarbeiter'),
    bankverbindungen: [], dokumente: [],
    notfallName: '', notfallTelefon: '', notfallBeziehung: '',
    loginEmail: '', loginAktiv: true, letzterLogin: '', temporaeresPw: '',
    notizen: '', internNotizen: '', profilBild: '', erstelltVon: '',
  }
}

interface FormProps {
  initial?: Mitarbeiter
  onSave: (data: Omit<Mitarbeiter, 'id' | 'erstelltAm' | 'aktualisiertAm'>) => void
  onClose: () => void
  currentUser: string
}

function MitarbeiterForm({ initial, onSave, onClose, currentUser }: FormProps) {
  const isNew = !initial
  const [form, setForm] = useState<Omit<Mitarbeiter, 'id' | 'erstelltAm' | 'aktualisiertAm'>>(
    initial ? { ...initial } : { ...emptyMitarbeiter(), erstelltVon: currentUser }
  )
  const [activeTab, setActiveTab] = useState<'stamm' | 'beschaeftigung' | 'zugang' | 'notfall'>('stamm')

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleRolleChange(rolle: MitarbeiterRolle) {
    setForm(f => ({ ...f, rolle, rechte: defaultRechte(rolle) }))
  }

  const initials = form.vorname && form.nachname
    ? `${form.vorname[0]}${form.nachname[0]}`.toUpperCase()
    : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-teal-700 rounded-t-3xl px-8 py-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
                {initials || '?'}
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-white/60 mb-1">Mitarbeiter</div>
                <h2 className="text-2xl font-bold">
                  {isNew ? 'Neuen Mitarbeiter anlegen' : `${initial?.vorname} ${initial?.nachname}`}
                </h2>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl cursor-pointer bg-transparent border-none">✕</button>
          </div>
          {/* Tab Nav */}
          <div className="flex gap-1">
            {([['stamm', 'Stammdaten'], ['beschaeftigung', 'Beschäftigung'], ['zugang', 'Zugang'], ['notfall', 'Notfall']] as const).map(([t, l]) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={clsx('rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer border-none transition-all',
                  activeTab === t ? 'bg-white text-teal-700' : 'bg-white/15 text-white hover:bg-white/25')}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Formular-Inhalt */}
        <form id="mf" onSubmit={e => { e.preventDefault(); onSave(form) }}>
          <div className="px-8 py-6 max-h-[55vh] overflow-y-auto">

            {/* STAMMDATEN */}
            {activeTab === 'stamm' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3">Persönliche Daten</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Vorname *" value={form.vorname} onChange={v => set('vorname', v)} required />
                    <Field label="Nachname *" value={form.nachname} onChange={v => set('nachname', v)} required />
                    <Field label="Geburtsdatum" value={form.geburtsdatum} onChange={v => set('geburtsdatum', v)} type="date" />
                    <Field label="SVNR" value={form.svnr} onChange={v => set('svnr', v)} placeholder="1234 120578" />
                    <Field label="Nationalität" value={form.nationalitaet} onChange={v => set('nationalitaet', v)} />
                    <SelField label="Geschlecht" value={form.geschlecht} onChange={v => set('geschlecht', v as any)}
                      options={[{ value: '', label: '— keine Angabe —' }, { value: 'weiblich', label: 'Weiblich' }, { value: 'maennlich', label: 'Männlich' }, { value: 'divers', label: 'Divers' }]} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3">Kontakt</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="E-Mail (dienstlich) *" value={form.email} onChange={v => set('email', v)} type="email" required />
                    <Field label="E-Mail (privat)" value={form.emailPrivat} onChange={v => set('emailPrivat', v)} type="email" />
                    <Field label="Telefon (dienstlich)" value={form.telefon} onChange={v => set('telefon', v)} />
                    <Field label="Telefon (privat)" value={form.telefonPrivat} onChange={v => set('telefonPrivat', v)} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3">Adresse</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Straße / Hausnummer" value={form.strasse} onChange={v => set('strasse', v)} wide />
                    <Field label="PLZ" value={form.plz} onChange={v => set('plz', v)} />
                    <Field label="Ort" value={form.ort} onChange={v => set('ort', v)} />
                    <Field label="Land" value={form.land} onChange={v => set('land', v)} />
                  </div>
                </div>
              </div>
            )}

            {/* BESCHÄFTIGUNG */}
            {activeTab === 'beschaeftigung' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3">Stelle & Rolle</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <SelField label="Rolle / Zugriffsebene *" value={form.rolle}
                      onChange={v => handleRolleChange(v as MitarbeiterRolle)}
                      options={Object.entries(ROLLE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                    <SelField label="Status" value={form.status} onChange={v => set('status', v as MitarbeiterStatus)}
                      options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                    <Field label="Abteilung" value={form.abteilung} onChange={v => set('abteilung', v)} placeholder="Koordination, Buchhaltung ..." />
                    <Field label="Position / Berufsbezeichnung" value={form.position} onChange={v => set('position', v)} placeholder="Büromitarbeiterin, GF ..." />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3">Beschäftigung</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Eintrittsdatum" value={form.eintrittsdatum} onChange={v => set('eintrittsdatum', v)} type="date" />
                    <Field label="Austrittsdatum" value={form.austrittsdatum} onChange={v => set('austrittsdatum', v)} type="date" />
                    <div>
                      <div className="text-sm font-medium text-slate-600 mb-1.5">Wochenstunden</div>
                      <input type="number" value={form.wochenstunden} onChange={e => set('wochenstunden', +e.target.value)}
                        min={1} max={60} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-600 mb-1.5">Urlaubstage / Jahr</div>
                      <input type="number" value={form.urlaubstage} onChange={e => set('urlaubstage', +e.target.value)}
                        min={0} max={60} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-600 mb-1.5">Gehalt (€)</div>
                      <input type="number" value={form.gehalt} onChange={e => set('gehalt', +e.target.value)}
                        min={0} step={50} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <SelField label="Gehaltsart" value={form.gehaltsart} onChange={v => set('gehaltsart', v as any)}
                      options={[{ value: 'monatlich', label: 'Monatlich' }, { value: 'stuendlich', label: 'Stündlich' }, { value: 'pauschal', label: 'Pauschal' }]} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3">Notizen</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <TextArea label="Allgemeine Notizen" value={form.notizen} onChange={v => set('notizen', v)} placeholder="Sonderwünsche, Hinweise ..." />
                    <TextArea label="Interne Notizen (nur GF)" value={form.internNotizen} onChange={v => set('internNotizen', v)} placeholder="Nur für Geschäftsführung sichtbar ..." />
                  </div>
                </div>
              </div>
            )}

            {/* ZUGANG */}
            {activeTab === 'zugang' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3">Login & Zugangsdaten</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Login-E-Mail" value={form.loginEmail || form.email}
                      onChange={v => set('loginEmail', v)} placeholder="wie dienstliche E-Mail" wide />
                    <div className="col-span-2 flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => set('loginAktiv', !form.loginAktiv)}
                          className={clsx('w-12 h-7 rounded-full transition-colors cursor-pointer border-none relative flex-shrink-0', form.loginAktiv ? 'bg-teal-600' : 'bg-slate-300')}>
                          <span className={clsx('absolute top-1.5 w-4 h-4 rounded-full bg-white shadow transition-all', form.loginAktiv ? 'left-6' : 'left-1.5')} />
                        </button>
                        <span className="text-sm text-slate-700">Login {form.loginAktiv ? 'aktiv' : 'gesperrt'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
                    <div className="text-sm font-bold text-amber-800 mb-1">Temporäres Passwort</div>
                    <div className="text-xs text-amber-600 mb-3">Nach dem ersten Login muss der Mitarbeiter das Passwort ändern.</div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 font-mono text-sm bg-white rounded-xl border border-amber-200 px-4 py-2">
                        {form.temporaeresPw || '— noch keines generiert —'}
                      </div>
                      <button type="button"
                        onClick={() => set('temporaeresPw', generateTempPassword())}
                        className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-amber-700">
                        Generieren
                      </button>
                      {form.temporaeresPw && (
                        <button type="button" onClick={() => set('temporaeresPw', '')}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-500 cursor-pointer hover:bg-slate-50">✕</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* NOTFALL */}
            {activeTab === 'notfall' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3">Notfallkontakt</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Name" value={form.notfallName} onChange={v => set('notfallName', v)} placeholder="Vor- und Nachname" />
                    <Field label="Beziehung" value={form.notfallBeziehung} onChange={v => set('notfallBeziehung', v)} placeholder="Ehepartner, Elternteil ..." />
                    <Field label="Telefon" value={form.notfallTelefon} onChange={v => set('notfallTelefon', v)} wide />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-5 border-t border-slate-100 flex justify-between">
            <Btn onClick={onClose}>Abbrechen</Btn>
            <Btn teal type="submit">{isNew ? 'Mitarbeiter anlegen' : 'Änderungen speichern'}</Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// DETAIL-PANEL
// ══════════════════════════════════════════════════════════════

interface DetailProps {
  m: Mitarbeiter
  canGF: boolean
  onEdit: () => void
  onClose: () => void
  onAddDok: (dok: MitarbeiterDokument) => void
  onRemoveDok: (id: string) => void
  onAddBank: (bank: Bankverbindung) => void
  onRemoveBank: (iban: string) => void
  onUpdateRechte: (rechte: ModulRecht[]) => void
  onResetPw: () => void
  onToggleLogin: () => void
  onDelete: () => void
}

function MitarbeiterDetail(props: DetailProps) {
  const { m, canGF } = props
  const [detailTab, setDetailTab] = useState<'profil' | 'dokumente' | 'bank' | 'rechte' | 'sicherheit'>('profil')
  const [showDokForm, setShowDokForm] = useState(false)
  const [showBankForm, setShowBankForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [generatedPw, setGeneratedPw] = useState('')

  // Dok-Form State
  const [dokForm, setDokForm] = useState<Omit<MitarbeiterDokument, 'id'>>({
    kategorie: 'ausweis', bezeichnung: '', dateiName: '', hochgeladenAm: new Date().toISOString().split('T')[0],
    ablaufdatum: '', notizen: '', vertraulich: false,
  })

  // Bank-Form State
  const [bankForm, setBankForm] = useState<Bankverbindung>({
    inhaberName: `${m.vorname} ${m.nachname}`, iban: '', bic: '', bank: '', hauptkonto: false,
  })

  const warnungen = getDokumentWarnungen(m)

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end bg-slate-900/30" onClick={props.onClose}>
      <div className="h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto flex flex-col"
        style={{ borderRadius: '28px 0 0 28px' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-teal-700 px-8 py-7 text-white flex-shrink-0">
          <div className="flex items-start justify-between mb-5">
            <button onClick={props.onClose} className="text-white/70 hover:text-white text-2xl cursor-pointer bg-transparent border-none">✕</button>
            <div className="flex gap-2">
              {canGF && (
                <>
                  <button onClick={props.onEdit}
                    className="rounded-xl bg-white/15 px-4 py-2 text-sm font-bold text-white cursor-pointer border-none hover:bg-white/25">
                    ✏️ Bearbeiten
                  </button>
                  <button onClick={() => setDeleteConfirm(true)}
                    className="rounded-xl bg-rose-500/25 px-4 py-2 text-sm font-bold text-white cursor-pointer border-none hover:bg-rose-500/40">
                    Löschen
                  </button>
                </>
              )}
            </div>
          </div>

          {deleteConfirm && (
            <div className="mb-4 rounded-2xl bg-rose-900/40 border border-rose-400/40 p-4">
              <div className="text-sm font-bold mb-3">Mitarbeiter wirklich löschen?</div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(false)}
                  className="rounded-xl bg-white/20 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none">Abbrechen</button>
                <button onClick={props.onDelete}
                  className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-rose-600">Endgültig löschen</button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
              {m.profilBild || `${m.vorname[0]}${m.nachname[0]}`}
            </div>
            <div>
              <h2 className="text-3xl font-bold">{m.vorname} {m.nachname}</h2>
              <div className="text-white/70 mt-0.5">{m.position}{m.abteilung ? ` · ${m.abteilung}` : ''}</div>
              <div className="flex gap-2 mt-2">
                <Badge label={ROLLE_LABELS[m.rolle]} className="border-white/30 bg-white/15 text-white text-xs" />
                <Badge label={STATUS_LABELS[m.status]} className={clsx('text-xs', STATUS_COLORS[m.status])} />
                {warnungen.length > 0 && <Badge label={`⚠️ ${warnungen.length} Dokument${warnungen.length > 1 ? 'e' : ''} läuft ab`} className="text-xs bg-amber-100 text-amber-800 border-amber-300" />}
              </div>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="flex gap-1 mt-5 flex-wrap">
            {([
              ['profil', 'Profil'],
              ['dokumente', `Dokumente (${m.dokumente.length})`],
              ['bank', `Bankdaten (${m.bankverbindungen.length})`],
              ['rechte', 'Zugriffsrechte'],
              ['sicherheit', 'Sicherheit'],
            ] as const).map(([t, l]) => (
              <button key={t} onClick={() => setDetailTab(t)}
                className={clsx('rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer border-none transition-all',
                  detailTab === t ? 'bg-white text-teal-700' : 'bg-white/15 text-white hover:bg-white/25')}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-8 py-6 space-y-5 overflow-y-auto">

          {/* ── PROFIL ── */}
          {detailTab === 'profil' && (
            <div className="space-y-5">
              {/* Kontakt */}
              <section>
                <h3 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">Kontakt</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['E-Mail dienstlich', m.email],
                    ['E-Mail privat', m.emailPrivat],
                    ['Telefon dienstlich', m.telefon],
                    ['Telefon privat', m.telefonPrivat],
                  ].filter(([, v]) => v).map(([l, v]) => (
                    <div key={l} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs text-slate-400 mb-0.5">{l}</div>
                      <div className="font-semibold text-slate-900">{v}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Adresse */}
              <section>
                <h3 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">Adresse</h3>
                <div className="rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4 text-sm text-slate-700">
                  {m.strasse && <div>{m.strasse}</div>}
                  {m.plz && m.ort && <div>{m.plz} {m.ort}</div>}
                  {m.land && <div>{m.land}</div>}
                  {!m.strasse && !m.plz && <div className="text-slate-400">Keine Adresse hinterlegt</div>}
                </div>
              </section>

              {/* Persönliches */}
              <section>
                <h3 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">Persönliche Daten</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Geburtsdatum', fmtDate(m.geburtsdatum)],
                    ['SVNR', m.svnr],
                    ['Nationalität', m.nationalitaet],
                    ['Geschlecht', m.geschlecht === 'weiblich' ? 'Weiblich' : m.geschlecht === 'maennlich' ? 'Männlich' : m.geschlecht === 'divers' ? 'Divers' : '–'],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs text-slate-400 mb-0.5">{l}</div>
                      <div className="font-semibold text-slate-900">{v || '–'}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Beschäftigung */}
              <section>
                <h3 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">Beschäftigung</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Eintritt', fmtDate(m.eintrittsdatum)],
                    ['Austritt', m.austrittsdatum ? fmtDate(m.austrittsdatum) : 'aufrecht'],
                    ['Wochenstunden', `${m.wochenstunden} Std.`],
                    ['Urlaubstage', `${m.urlaubstage} Tage/Jahr`],
                    ...(canGF ? [['Gehalt', `${fmt(m.gehalt)} (${m.gehaltsart})`]] : []),
                  ].map(([l, v]) => (
                    <div key={String(l)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs text-slate-400 mb-0.5">{l}</div>
                      <div className="font-semibold text-slate-900">{v}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Notfallkontakt */}
              {m.notfallName && (
                <section>
                  <h3 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">Notfallkontakt</h3>
                  <div className="rounded-2xl bg-rose-50 border border-rose-200 px-5 py-4">
                    <div className="font-semibold text-slate-900">{m.notfallName}</div>
                    <div className="text-sm text-slate-600 mt-0.5">{m.notfallBeziehung}</div>
                    {m.notfallTelefon && <div className="text-sm font-mono text-rose-700 mt-1">{m.notfallTelefon}</div>}
                  </div>
                </section>
              )}

              {/* Notizen */}
              {(m.notizen || (canGF && m.internNotizen)) && (
                <section>
                  <h3 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">Notizen</h3>
                  {m.notizen && <div className="rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4 text-sm text-slate-700 whitespace-pre-wrap mb-3">{m.notizen}</div>}
                  {canGF && m.internNotizen && (
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4">
                      <div className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Intern (nur GF)</div>
                      <div className="text-sm text-amber-900 whitespace-pre-wrap">{m.internNotizen}</div>
                    </div>
                  )}
                </section>
              )}

              {/* Meta */}
              <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
                Angelegt am {fmtDate(m.erstelltAm)} von {m.erstelltVon} · Aktualisiert: {fmtDate(m.aktualisiertAm)}
              </div>
            </div>
          )}

          {/* ── DOKUMENTE ── */}
          {detailTab === 'dokumente' && (
            <div className="space-y-4">
              {warnungen.length > 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                  <div className="text-sm font-bold text-amber-800 mb-2">⚠️ Ablaufende Dokumente</div>
                  {warnungen.map(d => (
                    <div key={d.id} className="text-sm text-amber-700">
                      {DOK_KAT_ICONS[d.kategorie]} {d.bezeichnung} — läuft ab am {fmtDate(d.ablaufdatum)}
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
                      onChange={v => setDokForm(f => ({ ...f, kategorie: v as DokumentKategorie }))}
                      options={Object.entries(DOK_KAT_LABELS).map(([k, v]) => ({ value: k, label: `${DOK_KAT_ICONS[k as DokumentKategorie]} ${v}` }))} />
                    <Field label="Bezeichnung *" value={dokForm.bezeichnung}
                      onChange={v => setDokForm(f => ({ ...f, bezeichnung: v }))} placeholder="z.B. Reisepass" />
                    <Field label="Dateiname" value={dokForm.dateiName}
                      onChange={v => setDokForm(f => ({ ...f, dateiName: v }))} placeholder="dokument.pdf" />
                    <Field label="Ablaufdatum" value={dokForm.ablaufdatum}
                      onChange={v => setDokForm(f => ({ ...f, ablaufdatum: v }))} type="date" />
                    <div className="col-span-2 flex items-center gap-3">
                      <button type="button" onClick={() => setDokForm(f => ({ ...f, vertraulich: !f.vertraulich }))}
                        className={clsx('w-10 h-6 rounded-full border-none cursor-pointer relative', dokForm.vertraulich ? 'bg-teal-600' : 'bg-slate-300')}>
                        <span className={clsx('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all', dokForm.vertraulich ? 'left-5' : 'left-1')} />
                      </button>
                      <span className="text-sm text-slate-700">Vertraulich (nur GF)</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <Btn onClick={() => setShowDokForm(false)}>Abbrechen</Btn>
                    <Btn teal onClick={() => {
                      if (!dokForm.bezeichnung) return
                      props.onAddDok({ ...dokForm, id: Date.now().toString() })
                      setShowDokForm(false)
                      setDokForm({ kategorie: 'ausweis', bezeichnung: '', dateiName: '', hochgeladenAm: new Date().toISOString().split('T')[0], ablaufdatum: '', notizen: '', vertraulich: false })
                    }}>Speichern</Btn>
                  </div>
                </div>
              )}

              {m.dokumente.length === 0 && !showDokForm && (
                <div className="text-center py-10 text-slate-400">
                  <div className="text-4xl mb-2">📁</div>
                  <div>Noch keine Dokumente hinterlegt</div>
                </div>
              )}

              {/* Dokument-Karten nach Kategorie gruppiert */}
              {(['ausweis', 'fuehrerschein', 'vertrag', 'sozialversicherung', 'bankdaten', 'zeugnis', 'steuerdaten', 'sonstiges'] as DokumentKategorie[]).map(kat => {
                const doks = m.dokumente.filter(d => d.kategorie === kat && (canGF || !d.vertraulich))
                if (doks.length === 0) return null
                return (
                  <div key={kat}>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                      {DOK_KAT_ICONS[kat]} {DOK_KAT_LABELS[kat]}
                    </div>
                    <div className="space-y-2">
                      {doks.map(d => (
                        <div key={d.id} className={clsx('flex items-center gap-4 rounded-2xl border px-5 py-4', d.vertraulich ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50')}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{d.bezeichnung}</span>
                              {d.vertraulich && <Badge label="🔒 Vertraulich" className="text-xs bg-amber-100 text-amber-700 border-amber-300" />}
                            </div>
                            {d.dateiName && <div className="text-xs text-slate-400 mt-0.5 font-mono">{d.dateiName}</div>}
                            <div className="text-xs text-slate-400 mt-0.5">Hochgeladen: {fmtDate(d.hochgeladenAm)}</div>
                          </div>
                          <AblaufBadge dok={d} />
                          {canGF && (
                            <button onClick={() => props.onRemoveDok(d.id)}
                              className="rounded-xl border border-rose-200 px-2 py-1.5 text-xs text-rose-500 cursor-pointer hover:bg-rose-50">✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── BANKDATEN ── */}
          {detailTab === 'bank' && (
            <div className="space-y-4">
              {canGF && (
                <button onClick={() => setShowBankForm(true)}
                  className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 px-5 py-4 text-sm font-semibold text-teal-700 cursor-pointer hover:bg-teal-100 w-full justify-center">
                  + Bankverbindung hinzufügen
                </button>
              )}

              {showBankForm && (
                <div className="rounded-2xl border border-teal-200 bg-white p-5">
                  <div className="text-sm font-bold text-slate-800 mb-3">Neue Bankverbindung</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Kontoinhaber" value={bankForm.inhaberName} onChange={v => setBankForm(f => ({ ...f, inhaberName: v }))} wide />
                    <Field label="IBAN *" value={bankForm.iban} onChange={v => setBankForm(f => ({ ...f, iban: v }))} placeholder="AT12 3456 ..." />
                    <Field label="BIC" value={bankForm.bic} onChange={v => setBankForm(f => ({ ...f, bic: v }))} placeholder="BKAUATWW" />
                    <Field label="Bank" value={bankForm.bank} onChange={v => setBankForm(f => ({ ...f, bank: v }))} placeholder="Bank Austria ..." />
                    <div className="col-span-2 flex items-center gap-3">
                      <button type="button" onClick={() => setBankForm(f => ({ ...f, hauptkonto: !f.hauptkonto }))}
                        className={clsx('w-10 h-6 rounded-full border-none cursor-pointer relative', bankForm.hauptkonto ? 'bg-teal-600' : 'bg-slate-300')}>
                        <span className={clsx('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all', bankForm.hauptkonto ? 'left-5' : 'left-1')} />
                      </button>
                      <span className="text-sm text-slate-700">Hauptkonto für Gehaltsüberweisung</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <Btn onClick={() => setShowBankForm(false)}>Abbrechen</Btn>
                    <Btn teal onClick={() => {
                      if (!bankForm.iban) return
                      props.onAddBank(bankForm)
                      setShowBankForm(false)
                      setBankForm({ inhaberName: `${m.vorname} ${m.nachname}`, iban: '', bic: '', bank: '', hauptkonto: false })
                    }}>Speichern</Btn>
                  </div>
                </div>
              )}

              {m.bankverbindungen.length === 0 && !showBankForm && (
                <div className="text-center py-10 text-slate-400">
                  <div className="text-4xl mb-2">🏦</div>
                  <div>Keine Bankverbindung hinterlegt</div>
                </div>
              )}

              {m.bankverbindungen.map((b, i) => (
                <div key={i} className={clsx('rounded-2xl border px-6 py-5', b.hauptkonto ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-slate-50')}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🏦</span>
                        <span className="font-bold text-slate-900">{b.bank || 'Bankverbindung'}</span>
                        {b.hauptkonto && <Badge label="⭐ Hauptkonto" className="text-xs bg-teal-100 text-teal-700 border-teal-300" />}
                      </div>
                      <div className="text-sm text-slate-600 mb-1">Inhaber: {b.inhaberName}</div>
                      <div className="font-mono text-base font-bold text-slate-900">{b.iban}</div>
                      {b.bic && <div className="text-xs text-slate-400 mt-0.5">BIC: {b.bic}</div>}
                    </div>
                    {canGF && (
                      <button onClick={() => props.onRemoveBank(b.iban)}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-xs text-rose-500 cursor-pointer hover:bg-rose-50">Entfernen</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ZUGRIFFSRECHTE ── */}
          {detailTab === 'rechte' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-teal-50 border border-teal-200 p-4">
                <div className="text-sm font-bold text-teal-800 mb-1">Rolle: {ROLLE_LABELS[m.rolle]}</div>
                <div className="text-xs text-teal-600">Zugriffsrechte basieren auf der Rolle. Einzelne Rechte können hier manuell angepasst werden.</div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                {/* Header */}
                <div className="grid bg-slate-50 px-5 py-3 border-b text-xs font-bold uppercase tracking-wider text-slate-400"
                  style={{ gridTemplateColumns: '1fr 70px 80px 70px 70px 80px 100px' }}>
                  <div>Modul</div>
                  <div className="text-center">Lesen</div>
                  <div className="text-center">Bearbeiten</div>
                  <div className="text-center">Erstellen</div>
                  <div className="text-center">Löschen</div>
                  <div className="text-center">Export</div>
                  <div className="text-center">Admin</div>
                </div>

                {m.rechte.map((r, idx) => (
                  <div key={r.modul} className={clsx(
                    'grid items-center px-5 py-3 border-b border-slate-50 last:border-0',
                    idx % 2 === 1 && 'bg-slate-50/50'
                  )}
                    style={{ gridTemplateColumns: '1fr 70px 80px 70px 70px 80px 100px' }}>

                    <div className="font-semibold text-slate-900 text-sm">{MODUL_LABELS[r.modul] || r.modul}</div>

                    {(['lesen', 'bearbeiten', 'erstellen', 'loeschen', 'exportieren', 'adminFunktionen'] as const).map(key => (
                      <div key={key} className="flex justify-center">
                        <button type="button"
                          disabled={!canGF}
                          onClick={() => {
                            if (!canGF) return
                            const updated = m.rechte.map((rr, i) =>
                              i === idx ? { ...rr, [key]: !rr[key] } : rr
                            )
                            props.onUpdateRechte(updated)
                          }}
                          className={clsx(
                            'w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all',
                            canGF ? 'cursor-pointer' : 'cursor-default',
                            r[key]
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'bg-white border-slate-300 text-slate-300'
                          )}>
                          {r[key] ? '✓' : ''}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {canGF && (
                <div className="flex gap-3">
                  <button onClick={() => props.onUpdateRechte(defaultRechte(m.rolle))}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-50">
                    Auf Rollen-Standard zurücksetzen
                  </button>
                  <button onClick={() => props.onUpdateRechte(defaultRechte('gf'))}
                    className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-700 cursor-pointer hover:bg-teal-100">
                    Alle Rechte gewähren (GF-Level)
                  </button>
                  <button onClick={() => props.onUpdateRechte(defaultRechte('extern'))}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-600 cursor-pointer hover:bg-rose-100">
                    Alle Rechte entziehen
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── SICHERHEIT ── */}
          {detailTab === 'sicherheit' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-bold text-slate-900 mb-4">Login-Status</div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-3 h-3 rounded-full', m.loginAktiv ? 'bg-emerald-500' : 'bg-rose-500')} />
                    <span className="text-sm font-semibold text-slate-900">Login {m.loginAktiv ? 'aktiv' : 'gesperrt'}</span>
                  </div>
                  {canGF && (
                    <button onClick={props.onToggleLogin}
                      className={clsx('rounded-xl px-4 py-2 text-xs font-bold cursor-pointer border-none',
                        m.loginAktiv ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100')}>
                      {m.loginAktiv ? 'Login sperren' : 'Login freischalten'}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <div className="text-xs text-slate-400 mb-0.5">Login-E-Mail</div>
                    <div className="font-semibold text-slate-900">{m.loginEmail || m.email || '–'}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <div className="text-xs text-slate-400 mb-0.5">Letzter Login</div>
                    <div className="font-semibold text-slate-900">{m.letzterLogin ? fmtDate(m.letzterLogin) : 'noch nie'}</div>
                  </div>
                </div>
              </div>

              {canGF && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <div className="text-sm font-bold text-amber-900 mb-2">Passwort zurücksetzen</div>
                  <div className="text-xs text-amber-700 mb-3">
                    Ein neues temporäres Passwort wird generiert. Der Mitarbeiter muss es beim nächsten Login ändern.
                  </div>
                  {generatedPw ? (
                    <div className="rounded-xl bg-white border border-amber-300 px-4 py-3 mb-3">
                      <div className="text-xs text-amber-600 mb-1">Neues temporäres Passwort:</div>
                      <div className="font-mono text-base font-bold text-slate-900">{generatedPw}</div>
                      <div className="text-xs text-slate-400 mt-1">Bitte dem Mitarbeiter sicher mitteilen.</div>
                    </div>
                  ) : null}
                  <button onClick={() => {
                    const pw = generateTempPassword()
                    setGeneratedPw(pw)
                    props.onResetPw()
                  }}
                    className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-amber-700">
                    {generatedPw ? 'Neues Passwort generieren' : 'Passwort zurücksetzen'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// HAUPTSEITE
// ══════════════════════════════════════════════════════════════

export default function MitarbeiterPage() {
  const { user, loading } = useAuth()
  const ma = useMitarbeiter()

  const [search, setSearch] = useState('')
  const [rolleFilter, setRolleFilter] = useState<MitarbeiterRolle | 'alle'>('alle')
  const [statusFilter, setStatusFilter] = useState<MitarbeiterStatus | 'alle'>('alle')
  const [ansicht, setAnsicht] = useState<'karten' | 'tabelle'>('karten')

  const [showForm, setShowForm] = useState(false)
  const [editMitarbeiter, setEditMitarbeiter] = useState<Mitarbeiter | null>(null)
  const [detailMitarbeiter, setDetailMitarbeiter] = useState<Mitarbeiter | null>(null)

  const canGF = user?.role === 'gf'

  // Filtern
  const filtered = useMemo(() => {
    let list = ma.mitarbeiter
    if (rolleFilter !== 'alle') list = list.filter(m => m.rolle === rolleFilter)
    if (statusFilter !== 'alle') list = list.filter(m => m.status === statusFilter)
    const q = search.toLowerCase().trim()
    if (q) list = list.filter(m =>
      [m.vorname, m.nachname, m.email, m.position, m.abteilung].join(' ').toLowerCase().includes(q)
    )
    return list.sort((a, b) => a.nachname.localeCompare(b.nachname))
  }, [ma.mitarbeiter, rolleFilter, statusFilter, search])

  // Statistiken
  const stats = useMemo(() => ({
    gesamt: ma.mitarbeiter.length,
    aktiv: ma.mitarbeiter.filter(m => m.status === 'aktiv').length,
    mitDokWarnungen: ma.mitarbeiter.filter(m => getDokumentWarnungen(m).length > 0).length,
    loginGesperrt: ma.mitarbeiter.filter(m => !m.loginAktiv).length,
  }), [ma.mitarbeiter])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>
  if (!user) return null

  // Detail-Sync (nach Update frisch laden)
  const freshDetail = detailMitarbeiter
    ? ma.mitarbeiter.find(m => m.id === detailMitarbeiter.id) || null
    : null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">

        {/* Formular */}
        {showForm && (
          <MitarbeiterForm
            initial={editMitarbeiter || undefined}
            currentUser={user?.name}
            onSave={data => {
              if (editMitarbeiter) {
                ma.update(editMitarbeiter.id, data)
              } else {
                ma.create(data)
              }
              setShowForm(false)
              setEditMitarbeiter(null)
            }}
            onClose={() => { setShowForm(false); setEditMitarbeiter(null) }}
          />
        )}

        {/* Detail Panel */}
        {freshDetail && (
          <MitarbeiterDetail
            m={freshDetail}
            canGF={canGF}
            onEdit={() => { setEditMitarbeiter(freshDetail); setShowForm(true) }}
            onClose={() => setDetailMitarbeiter(null)}
            onAddDok={dok => ma.addDokument(freshDetail.id, dok)}
            onRemoveDok={id => ma.removeDokument(freshDetail.id, id)}
            onAddBank={bank => ma.addBank(freshDetail.id, bank)}
            onRemoveBank={iban => ma.removeBank(freshDetail.id, iban)}
            onUpdateRechte={rechte => ma.updateRechte(freshDetail.id, rechte)}
            onResetPw={() => ma.update(freshDetail.id, { temporaeresPw: generateTempPassword() })}
            onToggleLogin={() => ma.update(freshDetail.id, { loginAktiv: !freshDetail.loginAktiv })}
            onDelete={() => { ma.delete(freshDetail.id); setDetailMitarbeiter(null) }}
          />
        )}

        {/* ── PAGE HEADER ── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-2">VBetreut · ERP</div>
              <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-2">Mitarbeiterverwaltung</h1>
              <p className="text-base text-slate-500 max-w-2xl">
                Stammdaten, Zugriffsrechte, Dokumente, Bankverbindungen und Sicherheit aller Mitarbeiter.
              </p>
            </div>
            {canGF && (
              <Btn teal onClick={() => { setEditMitarbeiter(null); setShowForm(true) }}>+ Mitarbeiter anlegen</Btn>
            )}
          </div>

          {/* Suche + Filter */}
          <div className="mt-5 flex gap-3 flex-wrap">
            <div className="flex-1 min-w-64 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-slate-400 text-lg">🔎</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Name, E-Mail, Position suchen ..."
                className="flex-1 bg-transparent border-none text-sm text-slate-800 placeholder-slate-400 outline-none" />
              {search && <button onClick={() => setSearch('')} className="text-slate-400 cursor-pointer bg-transparent border-none">✕</button>}
            </div>
            <select value={rolleFilter} onChange={e => setRolleFilter(e.target.value as any)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <option value="alle">Alle Rollen</option>
              {Object.entries(ROLLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <option value="alle">Alle Status</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1">
              {(['karten', 'tabelle'] as const).map(v => (
                <button key={v} onClick={() => setAnsicht(v)}
                  className={clsx('rounded-xl px-4 py-2 text-sm font-medium cursor-pointer border-none transition-all',
                    ansicht === v ? 'bg-slate-900 text-white' : 'bg-transparent text-slate-500 hover:bg-slate-100')}>
                  {v === 'karten' ? '⊞ Karten' : '≡ Tabelle'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── KENNZAHLEN ── */}
        <div className="mt-5 grid grid-cols-4 gap-4">
          {[
            ['Mitarbeiter', stats.gesamt, 'gesamt', 'text-slate-900'],
            ['Aktiv', stats.aktiv, 'aktuell beschäftigt', 'text-emerald-700'],
            ['Dok. Warnungen', stats.mitDokWarnungen, 'Ablauf in 90 Tagen', stats.mitDokWarnungen > 0 ? 'text-amber-600' : 'text-slate-900'],
            ['Login gesperrt', stats.loginGesperrt, 'Zugang deaktiviert', stats.loginGesperrt > 0 ? 'text-rose-600' : 'text-slate-900'],
          ].map(([t, v, s, tc]) => (
            <div key={String(t)} className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
              <div className="text-sm text-slate-500 mb-2">{t}</div>
              <div className={clsx('text-5xl font-bold leading-none mb-1', tc)}>{v}</div>
              <div className="text-sm text-slate-400">{s}</div>
            </div>
          ))}
        </div>

        {/* ── KARTEN-ANSICHT ── */}
        {ansicht === 'karten' && (
          <div className="mt-5 grid grid-cols-3 gap-5">
            {filtered.length === 0 && (
              <div className="col-span-3 text-center py-16 text-slate-400">
                <div className="text-5xl mb-3">👥</div>
                <div className="text-lg font-medium">Keine Mitarbeiter gefunden</div>
              </div>
            )}
            {filtered.map(m => {
              const warnungen = getDokumentWarnungen(m)
              return (
                <div key={m.id}
                  className="rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-teal-300 transition-all cursor-pointer overflow-hidden"
                  onClick={() => setDetailMitarbeiter(m)}>
                  {/* Karte Header */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 px-6 pt-6 pb-4">
                    <div className="flex items-start justify-between mb-4">
                      <Avatar m={m} size={56} />
                      <div className="flex flex-col gap-1.5 items-end">
                        <Badge label={STATUS_LABELS[m.status]} className={clsx('text-xs', STATUS_COLORS[m.status])} />
                        {warnungen.length > 0 && <Badge label="⚠️ Dok. läuft ab" className="text-xs bg-amber-50 text-amber-700 border-amber-200" />}
                        {!m.loginAktiv && <Badge label="🔒 Gesperrt" className="text-xs bg-rose-50 text-rose-600 border-rose-200" />}
                      </div>
                    </div>
                    <div className="font-bold text-slate-900 text-xl leading-tight">{m.nachname} {m.vorname}</div>
                    <div className="text-sm text-slate-500 mt-0.5">{m.position || '—'}</div>
                    {m.abteilung && <div className="text-xs text-slate-400 mt-0.5">{m.abteilung}</div>}
                  </div>

                  {/* Karte Body */}
                  <div className="px-6 py-4 space-y-3">
                    <Badge label={ROLLE_LABELS[m.rolle]} className={clsx('text-xs', ROLLE_COLORS[m.rolle])} />

                    {m.email && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 truncate">
                        <span className="text-slate-400">✉</span>
                        <span className="truncate">{m.email}</span>
                      </div>
                    )}
                    {m.telefon && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="text-slate-400">☎</span>
                        {m.telefon}
                      </div>
                    )}

                    {/* Mini-Statistiken */}
                    <div className="flex gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
                      <span>📁 {m.dokumente.length} Dokumente</span>
                      <span>🏦 {m.bankverbindungen.length} Konten</span>
                    </div>

                    <div className="text-xs text-slate-400">
                      Seit {fmtDate(m.eintrittsdatum)} · {m.wochenstunden}h/Woche
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── TABELLEN-ANSICHT ── */}
        {ansicht === 'tabelle' && (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="px-7 py-5 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Mitarbeiter <span className="font-normal text-slate-400">({filtered.length})</span></h2>
            </div>
            <div className="grid bg-slate-50 px-7 py-3 border-b text-xs font-bold uppercase tracking-wider text-slate-400"
              style={{ gridTemplateColumns: '200px 1fr 130px 120px 80px 80px 80px' }}>
              <div>Name</div>
              <div>E-Mail / Telefon</div>
              <div>Rolle</div>
              <div>Abteilung</div>
              <div>Std./W</div>
              <div>Status</div>
              <div></div>
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <div className="text-4xl mb-2">👥</div>
                <div>Keine Mitarbeiter gefunden</div>
              </div>
            )}

            {filtered.map(m => {
              const warnungen = getDokumentWarnungen(m)
              return (
                <div key={m.id}
                  className="grid items-center border-b border-slate-50 px-7 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ gridTemplateColumns: '200px 1fr 130px 120px 80px 80px 80px' }}
                  onClick={() => setDetailMitarbeiter(m)}>
                  <div className="flex items-center gap-3">
                    <Avatar m={m} size={36} />
                    <div>
                      <div className="font-semibold text-slate-900">{m.nachname} {m.vorname}</div>
                      <div className="text-xs text-slate-400">{m.position || '–'}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-700">{m.email}</div>
                    {m.telefon && <div className="text-xs text-slate-400">{m.telefon}</div>}
                  </div>
                  <div><Badge label={ROLLE_LABELS[m.rolle]} className={clsx('text-xs', ROLLE_COLORS[m.rolle])} /></div>
                  <div className="text-sm text-slate-600">{m.abteilung || '–'}</div>
                  <div className="text-sm text-slate-600">{m.wochenstunden}h</div>
                  <div className="flex flex-col gap-1">
                    <Badge label={STATUS_LABELS[m.status]} className={clsx('text-xs', STATUS_COLORS[m.status])} />
                    {warnungen.length > 0 && <Badge label="⚠️" className="text-xs bg-amber-50 text-amber-700 border-amber-200" />}
                  </div>
                  <div onClick={e => e.stopPropagation()} className="flex gap-1">
                    {canGF && (
                      <button onClick={() => { setEditMitarbeiter(m); setShowForm(true) }}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 cursor-pointer hover:bg-slate-100">✏️</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── ZUGRIFFSRECHTE-ÜBERSICHT (GF) ── */}
        {canGF && (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-5">Zugriffsrechte-Übersicht</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-4 text-slate-500 font-semibold w-48">Mitarbeiter</th>
                    {['klienten', 'betreuerinnen', 'einsatzplanung', 'finanzen', 'dokumente', 'mitarbeiter', 'berichte'].map(m => (
                      <th key={m} className="text-center py-2 px-2 text-slate-500 font-semibold text-xs">
                        {MODUL_LABELS[m]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ma.mitarbeiter.filter(m => m.status === 'aktiv').map(m => (
                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                      onClick={() => setDetailMitarbeiter(m)}>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Avatar m={m} size={28} />
                          <div>
                            <div className="font-semibold text-slate-900">{m.vorname} {m.nachname}</div>
                            <div className="text-xs text-slate-400">{ROLLE_LABELS[m.rolle]}</div>
                          </div>
                        </div>
                      </td>
                      {['klienten', 'betreuerinnen', 'einsatzplanung', 'finanzen', 'dokumente', 'mitarbeiter', 'berichte'].map(modul => {
                        const r = m.rechte.find(r => r.modul === modul)
                        const level = !r ? 0 : r.adminFunktionen ? 4 : r.loeschen ? 3 : r.bearbeiten ? 2 : r.lesen ? 1 : 0
                        const labels = ['—', 'Lesen', 'Bearbeiten', 'Vollzugriff', 'Admin']
                        const colors = ['text-slate-300', 'text-slate-500 bg-slate-100', 'text-sky-700 bg-sky-50', 'text-teal-700 bg-teal-50', 'text-teal-800 bg-teal-100 font-bold']
                        return (
                          <td key={modul} className="text-center py-3 px-2">
                            <span className={clsx('rounded-full px-2 py-0.5 text-xs', colors[level])}>
                              {labels[level]}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
