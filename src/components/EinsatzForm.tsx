'use client'
import { useState, useEffect } from 'react'
import { Btn, Field, SelField, TextArea, Modal } from '@/components/ui'
import { berechneGesamtbetrag, type Einsatz } from '@/lib/einsaetze'
import { apiGetAll } from '@/lib/api-client'

const EMPTY: Omit<Einsatz, 'id' | 'erstelltAm' | 'aktualisiertAm'> = {
  klientId: '', klientName: '', klientOrt: '',
  betreuerinId: '', betreuerinName: '',
  von: '', bis: '',
  turnusTage: 28,
  status: 'geplant', wechselTyp: 'erstanreise',
  tagessatz: 80, gesamtbetrag: 0,
  abrechnungsStatus: 'offen', rechnungsId: '',
  taxiHin: '', taxiRueck: '', taxiKosten: 0,
  uebergabeNotiz: '',
  nachfolgerBetreuerinId: '', nachfolgerBetreuerinName: '',
  wechselGeplantAm: '',
  zustaendig: '', notizen: '',
}

interface Props {
  initial?: Einsatz
  onSave: (data: Omit<Einsatz, 'id' | 'erstelltAm' | 'aktualisiertAm'>) => void
  onClose: () => void
}

export default function EinsatzForm({ initial, onSave, onClose }: Props) {
  const [form, setForm] = useState(initial ? { ...initial } : { ...EMPTY })
  const [klienten, setKlienten] = useState<{ id: string; name: string; ort: string }[]>([])
  const [bgs, setBgs] = useState<{ id: string; name: string; status: string }[]>([])

  useEffect(() => {
    apiGetAll<any>('klienten').then(list =>
      setKlienten(list.map((k: any) => ({ id: k.id, name: `${k.nachname} ${k.vorname}`, ort: k.ort || '' })))
    )
    apiGetAll<any>('betreuerinnen').then(list =>
      setBgs(list.map((b: any) => ({ id: b.id, name: `${b.nachname} ${b.vorname}`, status: b.status || 'verfuegbar' })))
    )
  }, [])

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => {
      const updated = { ...f, [k]: v }
      // Auto-berechne Gesamtbetrag wenn Felder sich ändern
      if (k === 'tagessatz' || k === 'von' || k === 'bis') {
        updated.gesamtbetrag = berechneGesamtbetrag(
          k === 'tagessatz' ? (v as number) : updated.tagessatz,
          k === 'von' ? (v as string) : updated.von,
          k === 'bis' ? (v as string) : updated.bis
        )
      }
      // Turnus-Tage automatisch berechnen
      if ((k === 'von' || k === 'bis') && updated.von && updated.bis) {
        const diff = new Date(updated.bis).getTime() - new Date(updated.von).getTime()
        updated.turnusTage = Math.round(diff / 86400000)
      }
      return updated
    })
  }

  function handleKlientChange(id: string) {
    const k = klienten.find(k => k.id === id)
    setForm(f => ({ ...f, klientId: id, klientName: k?.name || '', klientOrt: k?.ort || '' }))
  }

  function handleBGChange(id: string) {
    const b = bgs.find(b => b.id === id)
    setForm(f => ({ ...f, betreuerinId: id, betreuerinName: b?.name || '' }))
  }

  function handleNachfolgerChange(id: string) {
    const b = bgs.find(b => b.id === id)
    setForm(f => ({ ...f, nachfolgerBetreuerinId: id, nachfolgerBetreuerinName: b?.name || '' }))
  }

  const sectionHead = (title: string) => (
    <h3 className="text-base font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100 mt-6 first:mt-0">{title}</h3>
  )

  return (
    <Modal title={initial ? 'Einsatz bearbeiten' : 'Neuen Einsatz planen'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); onSave(form) }}>

        {/* ── Verknüpfungen ── */}
        {sectionHead('Klient:in & Betreuerin')}
        <div className="grid grid-cols-2 gap-4">
          <SelField label="Klient:in *" value={form.klientId} onChange={handleKlientChange}
            options={[
              { value: '', label: '— bitte wählen —' },
              ...klienten.map(k => ({ value: k.id, label: `${k.name} (${k.ort})` }))
            ]} />
          <SelField label="Betreuerin" value={form.betreuerinId} onChange={handleBGChange}
            options={[
              { value: '', label: '— noch nicht zugewiesen —' },
              ...bgs.map(b => ({ value: b.id, label: `${b.name} [${b.status}]` }))
            ]} />
          {form.klientOrt && (
            <Field label="Einsatzort" value={form.klientOrt} readOnly />
          )}
          <SelField label="Typ" value={form.wechselTyp} onChange={v => set('wechselTyp', v as any)}
            options={[
              { value: 'erstanreise', label: 'Erstanreise' },
              { value: 'wechsel', label: 'Wechsel' },
              { value: 'verlaengerung', label: 'Verlängerung' },
              { value: 'neustart', label: 'Neustart' },
            ]} />
        </div>

        {/* ── Zeitraum ── */}
        {sectionHead('Zeitraum & Turnus')}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Beginn *" value={form.von} onChange={v => set('von', v)} type="date" required />
          <Field label="Ende *" value={form.bis} onChange={v => set('bis', v)} type="date" required />
          <div className="col-span-2 rounded-2xl bg-slate-50 border border-slate-200 px-5 py-3 flex items-center gap-6 text-sm">
            <span className="text-slate-500">Dauer:</span>
            <span className="font-bold text-slate-900 text-lg">{form.turnusTage} Tage</span>
            {form.von && form.bis && (
              <span className="text-slate-400">
                {new Date(form.von).toLocaleDateString('de-AT')} – {new Date(form.bis).toLocaleDateString('de-AT')}
              </span>
            )}
          </div>
          <SelField label="Status" value={form.status} onChange={v => set('status', v as any)}
            options={[
              { value: 'geplant', label: 'Geplant' },
              { value: 'aktiv', label: 'Aktiv' },
              { value: 'wechsel_offen', label: 'Wechsel offen' },
              { value: 'beendet', label: 'Beendet' },
              { value: 'abgebrochen', label: 'Abgebrochen' },
            ]} />
          <Field label="Zuständig" value={form.zustaendig} onChange={v => set('zustaendig', v)} placeholder="z. B. Stefan Wagner" />
        </div>

        {/* ── Abrechnung ── */}
        {sectionHead('Abrechnung')}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 rounded-2xl bg-teal-50 border border-teal-200 px-5 py-4">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-1">Tagessatz</div>
                <div className="flex items-center gap-2">
                  <input type="number" value={form.tagessatz} onChange={e => set('tagessatz', Number(e.target.value))}
                    className="w-24 rounded-xl border border-teal-200 bg-white px-3 py-2 text-base font-bold text-slate-900 text-center"
                    min={0} step={5} />
                  <span className="text-teal-700 font-medium">€ / Tag</span>
                </div>
              </div>
              <div className="text-2xl text-teal-400">×</div>
              <div>
                <div className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-1">Tage</div>
                <div className="text-3xl font-bold text-slate-900">{form.turnusTage}</div>
              </div>
              <div className="text-2xl text-teal-400">=</div>
              <div>
                <div className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-1">Gesamtbetrag</div>
                <div className="text-3xl font-bold text-teal-700">
                  {form.gesamtbetrag.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>
            </div>
          </div>
          <SelField label="Abrechnungsstatus" value={form.abrechnungsStatus} onChange={v => set('abrechnungsStatus', v as any)}
            options={[
              { value: 'offen', label: 'Offen' },
              { value: 'erstellt', label: 'Erstellt' },
              { value: 'versendet', label: 'Versendet' },
              { value: 'bezahlt', label: 'Bezahlt' },
              { value: 'storniert', label: 'Storniert' },
            ]} />
          <Field label="Rechnungs-Nr." value={form.rechnungsId} onChange={v => set('rechnungsId', v)} placeholder="RE-2026-001 (vom Rechnungsmodul)" />
        </div>

        {/* ── Transport / Wechsellogistik ── */}
        {sectionHead('Transport & Wechsellogistik')}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Taxi Anreise" value={form.taxiHin} onChange={v => set('taxiHin', v)} placeholder="z. B. Taxi Bregenz +43 5574 12345" wide />
          <Field label="Taxi Abreise" value={form.taxiRueck} onChange={v => set('taxiRueck', v)} placeholder="z. B. Taxi Bregenz +43 5574 12345" wide />
          <div>
            <div className="mb-1.5 text-sm font-medium text-slate-600">Taxikosten (€)</div>
            <input type="number" value={form.taxiKosten} onChange={e => set('taxiKosten', Number(e.target.value))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800" min={0} step={5} />
          </div>
          <Field label="Wechsel geplant am" value={form.wechselGeplantAm} onChange={v => set('wechselGeplantAm', v)} type="date" />
          <TextArea label="Übergabenotiz (für Nachfolgerin)" value={form.uebergabeNotiz}
            onChange={v => set('uebergabeNotiz', v)}
            placeholder="Was die neue Betreuerin wissen muss: Medikamente, Arzttermine, Besonderheiten ..." wide />
        </div>

        {/* ── Nachfolgeplanung ── */}
        {sectionHead('Nachfolgeplanung (Wechselliste)')}
        <div className="grid grid-cols-2 gap-4">
          <SelField label="Nachfolgerin" value={form.nachfolgerBetreuerinId} onChange={handleNachfolgerChange}
            options={[
              { value: '', label: '— noch nicht geplant —' },
              ...bgs.filter(b => b.id !== form.betreuerinId).map(b => ({ value: b.id, label: `${b.name} [${b.status}]` }))
            ]} wide />
          <Field label="Notizen" value={form.notizen} onChange={v => set('notizen', v)} placeholder="Interne Hinweise zum Einsatz" wide />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Btn onClick={onClose}>Abbrechen</Btn>
          <Btn teal type="submit">Speichern</Btn>
        </div>
      </form>
    </Modal>
  )
}
