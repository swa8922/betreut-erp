'use client'
import { useState } from 'react'
import { Btn, Field, SelField, TextArea, CheckField, Modal } from '@/components/ui'
import type { Betreuerin, Qualifikation } from '@/lib/betreuerinnen'

const EMPTY: Omit<Betreuerin, 'id' | 'erstelltAm' | 'aktualisiertAm'> = {
  vorname: '', nachname: '', geburtsdatum: '', geburtsort: '',
  svnr: '', nationalitaet: '', familienstand: '', religion: '',
  status: 'verfuegbar', rolle: 'betreuerin', turnus: '28', verfuegbarAb: '',
  telefon: '', telefonWhatsapp: false, email: '',
  hauptwohnsitzStrasse: '', hauptwohnsitzPlz: '', hauptwohnsitzOrt: '', hauptwohnsitzLand: '',
  nebenwohnsitzStrasse: '', nebenwohnsitzPlz: '', nebenwohnsitzOrt: '',
  deutschkenntnisse: 'B1', weitereSprachenDE: '',
  qualifikationen: [],
  fuehrerschein: false, fuehrerscheinKlasse: '',
  raucher: false, haustierErfahrung: false, demenzErfahrung: false,
  bewerbungsdatum: '', bewertung: '3',
  region: '', zustaendig: '', notizen: '',
  einsaetze: [],
}

interface Props {
  initial?: Betreuerin
  onSave: (data: Omit<Betreuerin, 'id' | 'erstelltAm' | 'aktualisiertAm'>) => void
  onClose: () => void
}

export default function BetreuerinForm({ initial, onSave, onClose }: Props) {
  const [form, setForm] = useState(
    initial ? { ...initial } : { ...EMPTY }
  )

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  // Qualifikationen
  function addQual() {
    set('qualifikationen', [...form.qualifikationen, { bezeichnung: '', ausstellungsdatum: '', ablaufdatum: '' }])
  }
  function setQual(i: number, field: keyof Qualifikation, val: string) {
    const q = [...form.qualifikationen]
    q[i] = { ...q[i], [field]: val }
    set('qualifikationen', q)
  }
  function removeQual(i: number) {
    set('qualifikationen', form.qualifikationen.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(form)
  }

  const sectionHead = (title: string) => (
    <h3 className="text-base font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100 mt-6 first:mt-0">{title}</h3>
  )

  return (
    <Modal
      title={initial ? `${initial.vorname} ${initial.nachname} bearbeiten` : 'Neue Betreuerin anlegen'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>

        {/* Fortschrittsanzeige */}
        <div className="flex items-center gap-0 mb-6 rounded-2xl overflow-hidden border border-slate-200">
          {[
            { label: '1. Stammdaten', fields: [form.vorname, form.nachname, form.geburtsdatum] },
            { label: '2. Status & Kontakt', fields: [form.status, form.telefon] },
            { label: '3. Adressen', fields: [form.heimatadresse || form.hauptwohnsitzStrasse] },
            { label: '4. Qualifikationen', fields: [] },
          ].map((step, i) => {
            const filled = step.fields.filter(Boolean).length
            const complete = step.fields.length > 0 && filled === step.fields.length
            return (
              <div key={i} className={`flex-1 px-3 py-2 text-center text-xs font-semibold border-r border-slate-200 last:border-r-0 transition-all ${
                complete ? 'bg-teal-50 text-teal-700' : 'bg-slate-50 text-slate-400'
              }`}>
                {complete ? '✓ ' : ''}{step.label}
              </div>
            )
          })}
        </div>

        {/* ── Stammdaten ── */}
        {sectionHead('Stammdaten')}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Vorname" value={form.vorname} onChange={v => set('vorname', v)} placeholder="z. B. Mirjana" required />
          <Field label="Nachname" value={form.nachname} onChange={v => set('nachname', v)} placeholder="z. B. Licina" required />
          <div>
            <Field label="Geburtsdatum" value={form.geburtsdatum} onChange={v => set('geburtsdatum', v)} type="date" />
            <div className="text-xs text-slate-400 mt-0.5">Format: TT.MM.JJJJ — direkte Eingabe möglich</div>
          </div>
          <Field label="Geburtsort" value={form.geburtsort} onChange={v => set('geburtsort', v)} placeholder="z. B. Apatin" />
          <div>
            <Field label="SVNR (10 Stellen)" value={form.svnr} onChange={v => {
              const clean = v.replace(/[^0-9 ]/g, '')
              set('svnr', clean)
            }} placeholder="1234 010160" />
            {form.svnr && form.svnr.replace(/\s/g, '').length !== 10 && form.svnr.replace(/\s/g, '').length > 0 && (
              <div className="text-xs text-amber-600 mt-1">⚠️ SVNR muss genau 10 Ziffern haben (aktuell: {form.svnr.replace(/\s/g, '').length})</div>
            )}
          </div>
          <Field label="Nationalität" value={form.nationalitaet} onChange={v => set('nationalitaet', v)} placeholder="z. B. Serbien" />
          <Field label="Familienstand" value={form.familienstand} onChange={v => set('familienstand', v)} placeholder="verheiratet, ledig ..." />
          <Field label="Religion" value={form.religion} onChange={v => set('religion', v)} placeholder="optional" />
        </div>

        {/* ── Status & Einsatz ── */}
        {sectionHead('Status & Einsatz')}
        <div className="grid grid-cols-2 gap-4">
          <SelField label="Status" value={form.status} onChange={v => set('status', v as any)}
            options={[
              { value: 'verfuegbar', label: 'Verfügbar' },
              { value: 'im_einsatz', label: 'Im Einsatz' },
              { value: 'aktiv', label: 'Aktiv' },
              { value: 'pause', label: 'Pause' },
              { value: 'inaktiv', label: 'Inaktiv' },
            ]} />
          <SelField label="Rolle" value={form.rolle} onChange={v => set('rolle', v as any)}
            options={[
              { value: 'betreuerin', label: 'Betreuerin' },
              { value: 'springerin', label: 'Springerin' },
              { value: 'teamleitung', label: 'Teamleitung' },
            ]} />
          <SelField label="Turnus" value={form.turnus} onChange={v => set('turnus', v as any)}
            options={[
              { value: '14', label: '14 Tage' },
              { value: '28', label: '28 Tage' },
              { value: 'flexibel', label: 'Flexibel' },
              { value: 'dauerhaft', label: 'Dauerhaft' },
            ]} />
          <Field label="Verfügbar ab" value={form.verfuegbarAb} onChange={v => set('verfuegbarAb', v)} type="date" />
          <Field label="Region / Einsatzgebiet" value={form.region} onChange={v => set('region', v)} placeholder="z. B. Vorarlberg" />
          <Field label="Zuständig (intern)" value={form.zustaendig} onChange={v => set('zustaendig', v)} placeholder="z. B. Stefan Wagner" />
          <SelField label="Bewertung" value={form.bewertung} onChange={v => set('bewertung', v)}
            options={[
              { value: '5', label: '★★★★★ 5 – Ausgezeichnet' },
              { value: '4', label: '★★★★☆ 4 – Sehr gut' },
              { value: '3', label: '★★★☆☆ 3 – Gut' },
              { value: '2', label: '★★☆☆☆ 2 – Befriedigend' },
              { value: '1', label: '★☆☆☆☆ 1 – Mangelhaft' },
            ]} />
          <Field label="Bewerbungsdatum" value={form.bewerbungsdatum} onChange={v => set('bewerbungsdatum', v)} type="date" />
        </div>

        {/* ── Kontakt ── */}
        {sectionHead('Kontakt')}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Telefon" value={form.telefon} onChange={v => set('telefon', v)} placeholder="+43 664 ..." placeholder="+43 / +381 ..." />
          <div className="flex items-end pb-1">
            <CheckField label="WhatsApp verfügbar" checked={form.telefonWhatsapp} onChange={v => set('telefonWhatsapp', v)} />
          </div>
          <Field label="E-Mail" value={form.email} onChange={v => set('email', v)} type="email" placeholder="optional" wide />
          <div className="grid grid-cols-2 gap-4">
            <Field label="IBAN (für Honorarzahlungen)" value={(form as any).iban || ''} onChange={v => set('iban' as any, v)} placeholder="AT06 2060 2000 0064 8568" wide />
            <Field label="BIC" value={(form as any).bic || ''} onChange={v => set('bic' as any, v)} placeholder="DOSPAT2D" />
          </div>
        </div>

        {/* ── Adressen ── */}
        {sectionHead('Hauptwohnsitz (Heimatland)')}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Straße & Hausnummer" value={form.hauptwohnsitzStrasse} onChange={v => set('hauptwohnsitzStrasse', v)} placeholder="Slavise Vajnera Cice 21" wide />
          <Field label="PLZ" value={form.hauptwohnsitzPlz} onChange={v => set('hauptwohnsitzPlz', v)} placeholder="25101" />
          <Field label="Ort" value={form.hauptwohnsitzOrt} onChange={v => set('hauptwohnsitzOrt', v)} placeholder="Sombor" />
          <Field label="Land" value={form.hauptwohnsitzLand} onChange={v => set('hauptwohnsitzLand', v)} placeholder="Serbien" />
        </div>

        {sectionHead('Nebenwohnsitz (Österreich)')}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Straße & Hausnummer" value={form.nebenwohnsitzStrasse} onChange={v => set('nebenwohnsitzStrasse', v)} placeholder="optional" wide />
          <Field label="PLZ" value={form.nebenwohnsitzPlz} onChange={v => set('nebenwohnsitzPlz', v)} placeholder="6900" />
          <Field label="Ort" value={form.nebenwohnsitzOrt} onChange={v => set('nebenwohnsitzOrt', v)} placeholder="Bregenz" />
        </div>

        {/* ── Qualifikationen & Skills ── */}
        {sectionHead('Qualifikationen & Sprachkenntnisse')}
        <div className="grid grid-cols-2 gap-4">
          <SelField label="Deutschkenntnisse" value={form.deutschkenntnisse} onChange={v => set('deutschkenntnisse', v as any)}
            options={[
              { value: 'keine', label: 'Keine' },
              { value: 'A1', label: 'A1 – Anfänger' },
              { value: 'A2', label: 'A2 – Grundlagen' },
              { value: 'B1', label: 'B1 – Mittelstufe' },
              { value: 'B2', label: 'B2 – Gute Kenntnisse' },
              { value: 'C1', label: 'C1 – Sehr gut' },
              { value: 'Muttersprache', label: 'Muttersprache' },
            ]} />
          <Field label="Weitere Sprachen" value={form.weitereSprachenDE} onChange={v => set('weitereSprachenDE', v)} placeholder="Serbisch (Muttersprache), ..." />
          <Field label="Führerschein Klasse" value={form.fuehrerscheinKlasse} onChange={v => set('fuehrerscheinKlasse', v)} placeholder="B, BE ..." />
          <div className="flex flex-col gap-3 pt-2">
            <CheckField label="Führerschein vorhanden" checked={form.fuehrerschein} onChange={v => set('fuehrerschein', v)} />
            <CheckField label="Raucher:in" checked={form.raucher} onChange={v => set('raucher', v)} />
            <CheckField label="Haustier-Erfahrung" checked={form.haustierErfahrung} onChange={v => set('haustierErfahrung', v)} />
            <CheckField label="Demenz-Erfahrung" checked={form.demenzErfahrung} onChange={v => set('demenzErfahrung', v)} />
          </div>
        </div>

        {/* Qualifikationen Liste */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-600">Zertifikate & Ausbildungen</span>
            <button type="button" onClick={addQual}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 cursor-pointer bg-transparent border-none">
              + Hinzufügen
            </button>
          </div>
          {form.qualifikationen.length === 0 && (
            <p className="text-sm text-slate-400 italic">Noch keine Qualifikationen erfasst.</p>
          )}
          {form.qualifikationen.map((q, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-3 relative">
              <button type="button" onClick={() => removeQual(i)}
                className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 text-sm cursor-pointer bg-transparent border-none">✕</button>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Bezeichnung" value={q.bezeichnung} onChange={v => setQual(i, 'bezeichnung', v)} placeholder="z. B. Pflegehilfe" wide />
                <Field label="Ausgestellt am" value={q.ausstellungsdatum} onChange={v => setQual(i, 'ausstellungsdatum', v)} type="date" />
                <Field label="Ablaufdatum" value={q.ablaufdatum} onChange={v => setQual(i, 'ablaufdatum', v)} type="date" />
              </div>
            </div>
          ))}
        </div>

        {/* ── Notizen ── */}
        {sectionHead('Interne Notizen')}
        <TextArea label="Notiz" value={form.notizen} onChange={v => set('notizen', v)} placeholder="Besonderheiten, Präferenzen, offene Punkte ..." wide />

        <div className="sticky bottom-0 bg-white pt-4 pb-2 border-t border-slate-100 flex justify-between items-center gap-3 mt-4">
          <span className="text-xs text-slate-400">* Pflichtfelder</span>
          <div className="flex gap-3">
            <Btn onClick={onClose}>Abbrechen</Btn>
            <Btn teal type="submit">✓ Speichern</Btn>
          </div>
        </div>
      </form>
    </Modal>
  )
}
