'use client'
import { useState } from 'react'
import { Btn, Field, SelField, TextArea, CheckField, Modal } from '@/components/ui'
import type { Klient } from '@/lib/klienten'

const EMPTY: Omit<Klient, 'id' | 'erstelltAm' | 'aktualisiertAm'> = {
  vorname: '', nachname: '', geburtsdatum: '', svnr: '',
  status: 'aktiv', pflegestufe: '0', foerderung: 'keine',
  telefon: '', email: '', strasse: '', plz: '', ort: '', stockwerk: '',
  kontakte: [],
  hausarzt: '', besonderheiten: '', raucher: false, haustiere: false,
  zustaendig: '', notizen: '',
}

interface Props {
  initial?: Klient
  onSave: (data: Omit<Klient, 'id' | 'erstelltAm' | 'aktualisiertAm'>) => void
  onClose: () => void
}

export default function KlientForm({ initial, onSave, onClose }: Props) {
  const [form, setForm] = useState<Omit<Klient, 'id' | 'erstelltAm' | 'aktualisiertAm'>>(
    initial ? { ...initial } : { ...EMPTY }
  )

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function addKontakt() {
    set('kontakte', [...form.kontakte, { name: '', beziehung: '', telefon: '', email: '' }])
  }
  function setKontakt(i: number, field: string, val: string) {
    const k = [...form.kontakte]
    k[i] = { ...k[i], [field]: val }
    set('kontakte', k)
  }
  function removeKontakt(i: number) {
    set('kontakte', form.kontakte.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(form)
  }

  return (
    <Modal title={initial ? `${initial.vorname} ${initial.nachname} bearbeiten` : 'Neue Klient:in anlegen'} onClose={onClose}>
      <form onSubmit={handleSubmit}>

        {/* Stammdaten */}
        <div className="mb-5">
          <h3 className="text-base font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">Stammdaten</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Vorname" value={form.vorname} onChange={v => set('vorname', v)} placeholder="z. B. Irene" required />
            <Field label="Nachname" value={form.nachname} onChange={v => set('nachname', v)} placeholder="z. B. Baumgartl" required />
            <div>
            <Field label="Geburtsdatum" value={form.geburtsdatum} onChange={v => set('geburtsdatum', v)} type="date" />
            <div className="text-xs text-slate-400 mt-0.5">Format: TT.MM.JJJJ — direkte Eingabe möglich</div>
          </div>
            <div>
            <Field label="SVNR (10 Stellen)" value={form.svnr} onChange={v => {
              const clean = v.replace(/[^0-9 ]/g, '')
              set('svnr', clean)
            }} placeholder="1234 010160" />
            {form.svnr && form.svnr.replace(/\s/g, '').length !== 10 && form.svnr.replace(/\s/g, '').length > 0 && (
              <div className="text-xs text-amber-600 mt-1">⚠️ SVNR muss genau 10 Ziffern haben (aktuell: {form.svnr.replace(/\s/g, '').length})</div>
            )}
          </div>
            <SelField label="Status" value={form.status} onChange={v => set('status', v as any)}
              options={[{value:'aktiv',label:'✅ Aktiv'},{value:'interessent',label:'🔍 Interessent'},{value:'pausiert',label:'⏸ Pausiert'},{value:'beendet',label:'🔚 Beendet'},{value:'verstorben',label:'✝️ Verstorben'}]} />
            <SelField label="Pflegestufe" value={form.pflegestufe} onChange={v => set('pflegestufe', v as any)}
              options={[{value:'0',label:'–'},{value:'1',label:'Stufe 1'},{value:'2',label:'Stufe 2'},{value:'3',label:'Stufe 3'},{value:'4',label:'Stufe 4'},{value:'5',label:'Stufe 5'},{value:'6',label:'Stufe 6'},{value:'7',label:'Stufe 7'}]} />
            <SelField label="Förderung" value={form.foerderung} onChange={v => set('foerderung', v as any)}
              options={[{value:'aktiv',label:'Förderung aktiv'},{value:'beantragt',label:'In Beantragung'},{value:'keine',label:'Keine Förderung'}]} />
          {form.status === 'verstorben' && (
            <div>
              <Field label="Verstorben am" value={(form as any).verstorbenAm || ''} onChange={v => set('verstorbenAm' as any, v)} type="date" />
            </div>
          )}
            <Field label="Zuständig" value={form.zustaendig} onChange={v => set('zustaendig', v)} placeholder="z. B. Stefan Wagner" />
          </div>
        </div>

        {/* Kontakt & Adresse */}
        <div className="mb-5">
          <h3 className="text-base font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">Kontakt & Adresse</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Telefon" value={form.telefon} onChange={v => set('telefon', v)} placeholder="+43 664 ..." placeholder="+43 ..." />
            <Field label="E-Mail" value={form.email} onChange={v => set('email', v)} type="email" placeholder="optional" />
            <Field label="Straße & Hausnummer" value={form.strasse} onChange={v => set('strasse', v)} placeholder="Lipburgerstraße 5" wide />
            <Field label="PLZ" value={form.plz} onChange={v => set('plz', v)} placeholder="6900" />
            <Field label="Ort" value={form.ort} onChange={v => set('ort', v)} placeholder="Bregenz" />
            <Field label="Stockwerk / Hinweis" value={form.stockwerk} onChange={v => set('stockwerk', v)} placeholder="1. Stock, Lift vorhanden" />
          </div>
        </div>

        {/* Angehörige */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-700">Angehörige & Kontakte</h3>
            <button type="button" onClick={addKontakt}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 cursor-pointer bg-transparent border-none">
              + Kontakt hinzufügen
            </button>
          </div>
          {form.kontakte.length === 0 && (
            <p className="text-sm text-slate-400 italic">Noch keine Kontakte erfasst.</p>
          )}
          {form.kontakte.map((k, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-3 relative">
              <button type="button" onClick={() => removeKontakt(i)}
                className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 text-sm cursor-pointer bg-transparent border-none">✕</button>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" value={k.name} onChange={v => setKontakt(i, 'name', v)} placeholder="z. B. Peter Baumgartl" />
                <Field label="Beziehung" value={k.beziehung} onChange={v => setKontakt(i, 'beziehung', v)} placeholder="Sohn, Tochter ..." />
                <Field label="Telefon" value={k.telefon} onChange={v => setKontakt(i, 'telefon', v)} placeholder="+43 ..." />
                <Field label="E-Mail" value={k.email} onChange={v => setKontakt(i, 'email', v)} placeholder="optional" />
              </div>
            </div>
          ))}
        </div>

        {/* Betreuungsinfos */}
        <div className="mb-5">
          <h3 className="text-base font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">Betreuungsinfos</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Hausarzt" value={form.hausarzt} onChange={v => set('hausarzt', v)} placeholder="Dr. Muxel, Bregenz" wide />
            <TextArea label="Besonderheiten" value={form.besonderheiten} onChange={v => set('besonderheiten', v)} placeholder="Hinweise zur Betreuung, Erreichbarkeit ..." wide />
            <div className="col-span-2 flex gap-6">
              <CheckField label="Raucher:in im Haushalt" checked={form.raucher} onChange={v => set('raucher', v)} />
              <CheckField label="Haustiere vorhanden" checked={form.haustiere} onChange={v => set('haustiere', v)} />
            </div>
          </div>
        </div>

        {/* Notizen */}
        <div className="mb-6">
          <h3 className="text-base font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">Interne Notiz</h3>
          <TextArea label="Notiz" value={form.notizen} onChange={v => set('notizen', v)} placeholder="Interne Hinweise, offene Punkte ..." wide />
        </div>

        {/* Ausweisdaten */}
        <div className="mb-6">
          <h3 className="text-base font-bold text-amber-700 mb-3 pb-2 border-b border-amber-200">🪪 Ausweisdaten (für Meldezettel)</h3>
          <div className="grid grid-cols-2 gap-4">
            <SelField label="Ausweis-Typ" value={(form as any).ausweisTyp || ''} onChange={v => set('ausweisTyp', v)}
              options={[{value:'',label:'–'},{value:'Reisepass',label:'Reisepass'},{value:'Personalausweis',label:'Personalausweis'},{value:'Führerschein',label:'Führerschein'}]} />
            <Field label="Ausweis-Nr." value={(form as any).ausweisNr || ''} onChange={v => set('ausweisNr', v)} placeholder="z. B. P1234567" />
            <Field label="Ausgestellt am" value={(form as any).ausweisAusgestelltAm || ''} onChange={v => set('ausweisAusgestelltAm', v)} type="date" />
            <Field label="Gültig bis" value={(form as any).ausweisGueltigBis || ''} onChange={v => set('ausweisGueltigBis', v)} type="date" />
            <Field label="Ausstellende Behörde" value={(form as any).ausweisBehoerde || ''} onChange={v => set('ausweisBehoerde', v)} placeholder="z. B. BH Bregenz" wide />
            <Field label="Staatsbürgerschaft" value={(form as any).staatsbuergerschaft || 'Österreich'} onChange={v => set('staatsbuergerschaft', v)} placeholder="Österreich" />
            <Field label="Geburtsort" value={(form as any).geburtsort || ''} onChange={v => set('geburtsort', v)} placeholder="z. B. Bregenz" />
          </div>
        </div>

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
