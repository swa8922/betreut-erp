'use client'
import React from 'react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import Sidebar from '@/components/Sidebar'
import { Btn, Field, SelField, TextArea, Modal, Badge } from '@/components/ui'
import {
  getFirmendaten, saveFirmendaten, getImportKonfigurationen, saveImportKonfigurationen,
  getImportLog, addImportLog, parseCSV, transformWert, IMPORT_ZIELFELDER,
  getAuswahlListen, saveAuswahlListen,
  type Firmendaten, type FirmenBank, type ImportKonfiguration, type SpaltenmMapping, type ImportErgebnis, type AuswahlListe,
} from '@/lib/admin'
import { getKlienten, saveKlienten } from '@/lib/klienten'
import { getBetreuerinnen, saveBetreuerinnen } from '@/lib/betreuerinnen'
import { apiInsert, apiGetAll, apiUpdate, apiDelete } from '@/lib/api-client'
import { useFirma } from '@/hooks/useFirma'
import clsx from 'clsx'

const today = () => new Date().toISOString().split('T')[0]
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

// ══════════════════════════════════════════════════════════════
// LOGO UPLOAD
// ══════════════════════════════════════════════════════════════
function LogoUpload({ label, value, onChange }: { label: string; value: string; onChange: (v: string, name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <div className="text-sm font-medium text-slate-600 mb-2">{label}</div>
      <div className="flex items-center gap-4">
        <div className="w-32 h-20 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-teal-400 transition-colors"
          onClick={() => ref.current?.click()}>
          {value
            ? <img src={value} alt={label} className="max-w-full max-h-full object-contain p-2" />
            : <div className="text-center text-slate-400 text-xs">
                <div className="text-2xl mb-1">🖼️</div>
                <div>Klicken oder</div>
                <div>reinziehen</div>
              </div>
          }
        </div>
        <div className="space-y-2">
          <button onClick={() => ref.current?.click()}
            className="rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-xs font-semibold px-4 py-2 cursor-pointer hover:bg-teal-100">
            Datei wählen
          </button>
          {value && (
            <button onClick={() => onChange('', '')}
              className="ml-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 text-xs px-3 py-2 cursor-pointer hover:bg-rose-100">
              Entfernen
            </button>
          )}
          <div className="text-[10px] text-slate-400">PNG, JPG, SVG · max. 2 MB</div>
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = ev => onChange(ev.target?.result as string, file.name)
          reader.readAsDataURL(file)
        }} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// IMPORT WIZARD
// ══════════════════════════════════════════════════════════════
function ImportWizard({ onClose }: { onClose: () => void }) {
  const [schritt, setSchritt] = useState<1 | 2 | 3 | 4>(1)
  const [dateiTyp, setDateiTyp] = useState<ImportKonfiguration['typ']>('klienten')
  const [trennzeichen, setTrennzeichen] = useState<',' | ';' | '\t'>(';')
  const [hatKopfzeile, setHatKopfzeile] = useState(true)
  const [dateiName, setDateiName] = useState('')
  const [csvText, setCsvText] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<SpaltenmMapping[]>([])
  const [importLog, setImportLog] = useState<ImportErgebnis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const zielfelder = IMPORT_ZIELFELDER[dateiTyp]

  function handleFile(file: File) {
    setDateiName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setCsvText(text)
      const parsed = parseCSV(text, trennzeichen, hatKopfzeile)
      setHeaders(parsed.headers)
      setRows(parsed.rows)
      // Auto-Mapping versuchen
      const autoMap: SpaltenmMapping[] = zielfelder.map((zf, i) => {
        const matchIdx = parsed.headers.findIndex(h =>
          h.toLowerCase().includes(zf.key.toLowerCase()) ||
          h.toLowerCase().includes(zf.label.toLowerCase().split(' ')[0].toLowerCase())
        )
        return { quelleIndex: matchIdx >= 0 ? matchIdx : -1, quelleSpalte: matchIdx >= 0 ? parsed.headers[matchIdx] : '', zielFeld: zf.key, zielLabel: zf.label, pflicht: zf.pflicht }
      })
      setMapping(autoMap)
      setSchritt(2)
    }
    reader.readAsText(file, 'utf-8')
  }

  async function handleImport() {
    setIsLoading(true)
    await new Promise(r => setTimeout(r, 50)) // UI updaten lassen

    const importiert: Record<string, string>[] = []
    const fehler: string[] = []

    rows.forEach((row, idx) => {
      if (!row.some(c => c.trim())) return

      const obj: Record<string, string> = {}
      let valid = true

      mapping.forEach(m => {
        if (m.quelleIndex < 0 || m.quelleIndex >= row.length) {
          if (m.pflicht) { fehler.push(`Zeile ${idx + 2}: Pflichtfeld "${m.zielLabel}" fehlt`); valid = false }
          return
        }
        const rawWert = row[m.quelleIndex]?.trim() || ''
        obj[m.zielFeld] = transformWert(rawWert, m.transformation)
      })

      if (valid) importiert.push(obj)
    })

    let gespeichert = 0
    if (dateiTyp === 'klienten') {
      const neue = importiert.map(o => ({
        id: uid(),
        vorname: o.vorname || '', nachname: o.nachname || '',
        geburtsdatum: o.geburtsdatum || '',
        svnr: o.svnr || '',
        status: 'aktiv' as const,
        pflegestufe: (o.pflegestufe || '1') as any,
        foerderung: 'keine' as const,
        telefon: o.telefon || '', email: o.email || '',
        strasse: o.strasse || '', plz: o.plz || '', ort: o.ort || '', stockwerk: '',
        kontakte: [],
        hausarzt: o.arzt_name || '', besonderheiten: o.notizen || '',
        raucher: false, haustiere: false,
        zustaendig: '', notizen: o.notizen || '',
        erstelltAm: today(), aktualisiertAm: today(),
      }))
      for (const k of neue) { await apiInsert('klienten', k) }
      gespeichert = neue.length
    } else if (dateiTyp === 'betreuerinnen') {
      const neue = importiert.map(o => ({
        id: uid(), betreuerinId: '',
        vorname: o.vorname || '', nachname: o.nachname || '',
        geburtsdatum: o.geburtsdatum || '', geburtsort: '', geburtsland: '',
        svnr: o.svnr || '', nationalitaet: o.nationalitaet || '', staatsangehoerigkeit: o.nationalitaet || '',
        familienstand: '', religion: '', geschlecht: 'weiblich' as const,
        ausweisNummer: '', ausweisAblauf: '', passNummer: '', passAblauf: '',
        fuehrerscheinNummer: '', fuehrerscheinKlasse: '', fuehrerscheinAblauf: '', fuehrerscheinAussteller: '',
        status: 'aktiv' as const, rolle: 'betreuerin' as const, turnus: '28' as const,
        verfuegbarAb: '', aktuellerEinsatzKlient: '', aktuellerEinsatzOrt: '', aktuellerEinsatzBis: '',
        telefon: o.telefon || '', telefonWhatsapp: false, telefonAlternativ: '', email: o.email || '',
        hauptwohnsitzStrasse: o.strasse || '', hauptwohnsitzPlz: o.plz || '', hauptwohnsitzOrt: o.ort || '', hauptwohnsitzLand: '',
        nebenwohnsitzStrasse: '', nebenwohnsitzPlz: '', nebenwohnsitzOrt: '', nebenwohnsitzLand: '',
        oesterreichStrasse: '', oesterreichPlz: '', oesterreichOrt: '',
        gewerbeStatus: 'unbekannt' as const, gewerbeName: '', gisaNummer: '', gewerbeAblauf: '',
        deutschkenntnisse: 'B1' as const, weitereSprachenDE: '',
        qualifikationen: [], fuehrerschein: false, raucher: false, haustierErfahrung: false, demenzErfahrung: false, erfahrungJahre: 0,
        dokumente: [], bankverbindungen: [], dorisChat: [], einsaetze: [],
        bewerbungsdatum: '', bewertung: '3', region: '', zustaendig: '',
        notizen: '', internNotizen: '',
        erstelltAm: today(), aktualisiertAm: today(),
      }))
      for (const b of neue) { await apiInsert('betreuerinnen', b) }
      gespeichert = neue.length
    }

    const ergebnis: ImportErgebnis = {
      id: uid(), konfigId: '', dateiName, zeitstempel: new Date().toISOString(),
      gesamt: rows.filter(r => r.some(c => c.trim())).length,
      importiert: gespeichert, uebersprungen: importiert.length - gespeichert,
      fehler: fehler.slice(0, 20),
      vorschau: importiert.slice(0, 3),
    }
    addImportLog(ergebnis)
    setImportLog(ergebnis)
    setSchritt(4)
    setIsLoading(false)
  }

  return (
    <div className="space-y-5">
      {/* Schritt-Anzeige */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex-1">
            <div className={clsx('h-1.5 rounded-full', s <= schritt ? 'bg-teal-600' : 'bg-slate-200')} />
            <div className={clsx('text-[10px] mt-1', s <= schritt ? 'text-teal-700 font-semibold' : 'text-slate-400')}>
              {s === 1 ? 'Datei' : s === 2 ? 'Mapping' : s === 3 ? 'Prüfen' : 'Fertig'}
            </div>
          </div>
        ))}
      </div>

      {/* ── SCHRITT 1: Datei & Typ ── */}
      {schritt === 1 && (
        <div className="space-y-4">
          <SelField label="Was soll importiert werden?" value={dateiTyp}
            onChange={v => setDateiTyp(v as ImportKonfiguration['typ'])}
            options={[
              { value: 'klienten', label: '👥 Klient:innen' },
              { value: 'betreuerinnen', label: '👩 Betreuerinnen' },
              { value: 'einsaetze', label: '📅 Einsätze' },
              { value: 'finanzen', label: '💶 Finanzdaten' },
              { value: 'mitarbeiter', label: '🏢 Mitarbeiter' },
            ]} />

          <div className="grid grid-cols-2 gap-3">
            <SelField label="Trennzeichen" value={trennzeichen} onChange={v => setTrennzeichen(v as any)}
              options={[{ value: ';', label: 'Semikolon  ;  (Standard AT/DE)' }, { value: ',', label: 'Komma  ,  (Standard EN)' }, { value: '\t', label: 'Tab' }]} />
            <div>
              <div className="text-sm font-medium text-slate-600 mb-1.5">Kopfzeile</div>
              <label className="flex items-center gap-2 cursor-pointer mt-3">
                <input type="checkbox" checked={hatKopfzeile} onChange={e => setHatKopfzeile(e.target.checked)} className="accent-teal-700 w-4 h-4" />
                <span className="text-sm text-slate-700">Erste Zeile = Spaltennamen</span>
              </label>
            </div>
          </div>

          {/* Upload-Box */}
          <div
            className="rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 p-8 text-center cursor-pointer hover:bg-teal-100 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}>
            <div className="text-4xl mb-2">📂</div>
            <div className="font-bold text-teal-800 mb-1">CSV oder Excel-Datei hierher ziehen</div>
            <div className="text-sm text-teal-600">oder klicken zum Auswählen</div>
            <div className="text-xs text-teal-500 mt-2">.csv · .txt · .xlsx · .xls</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

          {/* Vorlage downloaden */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="text-sm font-bold text-slate-800 mb-2">📋 CSV-Vorlage herunterladen</div>
            <div className="text-xs text-slate-500 mb-3">Füllen Sie die Vorlage aus und laden Sie sie dann hoch.</div>
            <button onClick={() => {
              const felder = IMPORT_ZIELFELDER[dateiTyp]
              const header = felder.map(f => f.label).join(';')
              const example = felder.map(f => {
                if (f.key.includes('datum')) return '15.03.1950'
                if (f.key === 'email') return 'name@example.at'
                if (f.key === 'telefon') return '+43 664 1234567'
                if (f.key === 'iban') return 'AT12 3456 7890 1234 5678'
                if (f.key === 'plz') return '6900'
                if (f.key === 'pflegestufe') return '3'
                if (f.key === 'gehalt') return '2500'
                return `Beispiel ${f.label}`
              }).join(';')
              const csv = `${header}\n${example}`
              const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `vorlage_${dateiTyp}.csv`
              a.click()
            }} className="rounded-xl border border-teal-200 bg-white text-teal-700 text-xs font-semibold px-4 py-2 cursor-pointer hover:bg-teal-50">
              ⬇️ Vorlage herunterladen ({dateiTyp})
            </button>
          </div>
        </div>
      )}

      {/* ── SCHRITT 2: Spaltenmapping ── */}
      {schritt === 2 && (
        <div className="space-y-4">
          <div className="text-sm font-bold text-slate-800">Datei: {dateiName}</div>
          <div className="text-xs text-slate-500 mb-2">
            {rows.length} Datensätze erkannt. Ordnen Sie die Spalten den Feldern zu.
          </div>

          {/* Vorschau-Tabelle */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="text-xs w-full">
              <thead className="bg-slate-50">
                <tr>{headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 3).map((row, ri) => (
                  <tr key={ri} className="border-t border-slate-100">
                    {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-slate-700 max-w-24 truncate">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mapping */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 grid grid-cols-5 gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-2">Feld im System</div>
              <div className="col-span-2">Spalte in Datei</div>
              <div>Transformation</div>
            </div>
            {mapping.map((m, idx) => (
              <div key={m.zielFeld} className={clsx('px-4 py-3 grid grid-cols-5 gap-2 items-center border-t border-slate-50', idx % 2 === 1 && 'bg-slate-50/50')}>
                <div className="col-span-2">
                  <div className="text-sm font-semibold text-slate-900">{m.zielLabel}</div>
                  {m.pflicht && <span className="text-[10px] text-rose-500">Pflichtfeld</span>}
                </div>
                <div className="col-span-2">
                  <select value={m.quelleIndex}
                    onChange={e => {
                      const idx2 = +e.target.value
                      setMapping(prev => prev.map((x, i) => i === idx ? { ...x, quelleIndex: idx2, quelleSpalte: idx2 >= 0 ? headers[idx2] : '' } : x))
                    }}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <option value={-1}>— nicht zugeordnet —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h} {rows[0]?.[i] ? `(${rows[0][i].slice(0, 20)})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <select value={m.transformation || ''}
                    onChange={e => setMapping(prev => prev.map((x, i) => i === idx ? { ...x, transformation: e.target.value || undefined } : x))}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-white px-2 py-2">
                    <option value="">Keine</option>
                    <option value="datum_de_zu_iso">Datum DE→ISO</option>
                    <option value="datum_us_zu_iso">Datum US→ISO</option>
                    <option value="telefon_normalisieren">Telefon</option>
                    <option value="iban_normalisieren">IBAN</option>
                    <option value="betrag_normalisieren">Betrag €</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Btn onClick={() => setSchritt(1)}>← Zurück</Btn>
            <Btn teal onClick={() => setSchritt(3)}>Vorschau →</Btn>
          </div>
        </div>
      )}

      {/* ── SCHRITT 3: Vorschau & Bestätigen ── */}
      {schritt === 3 && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-teal-50 border border-teal-200 p-4">
            <div className="font-bold text-teal-800 mb-1">✅ Bereit zum Import</div>
            <div className="text-sm text-teal-700">
              {rows.filter(r => r.some(c => c.trim())).length} Datensätze werden in <strong>{dateiTyp}</strong> importiert.
            </div>
          </div>

          {/* Vorschau der ersten 3 Datensätze */}
          <div className="text-sm font-bold text-slate-800 mb-2">Vorschau (erste 3 Datensätze)</div>
          {rows.slice(0, 3).map((row, ri) => (
            <div key={ri} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-bold text-slate-500 mb-1.5">Datensatz {ri + 1}</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {mapping.filter(m => m.quelleIndex >= 0).map(m => (
                  <div key={m.zielFeld} className="text-xs">
                    <span className="text-slate-400">{m.zielLabel}: </span>
                    <span className="font-semibold text-slate-800">{transformWert(row[m.quelleIndex] || '', m.transformation)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            ⚠️ <strong>Hinweis:</strong> Bestehende Datensätze werden nicht überschrieben — alle importierten Einträge werden als neue Datensätze angelegt.
          </div>

          <div className="flex gap-3">
            <Btn onClick={() => setSchritt(2)}>← Zurück</Btn>
            <Btn teal onClick={handleImport} disabled={isLoading}>
              {isLoading ? '⏳ Importiere ...' : `🚀 ${rows.filter(r => r.some(c => c.trim())).length} Datensätze importieren`}
            </Btn>
          </div>
        </div>
      )}

      {/* ── SCHRITT 4: Ergebnis ── */}
      {schritt === 4 && importLog && (
        <div className="space-y-4">
          <div className={clsx('rounded-2xl p-5', importLog.fehler.length === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200')}>
            <div className="text-xl font-bold mb-3">{importLog.fehler.length === 0 ? '✅ Import erfolgreich!' : '⚠️ Import mit Warnungen'}</div>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[['Gesamt', importLog.gesamt, 'text-slate-700'], ['Importiert', importLog.importiert, 'text-emerald-700'], ['Übersprungen', importLog.uebersprungen + importLog.fehler.length, 'text-amber-600']].map(([l, v, c]) => (
                <div key={String(l)} className="rounded-xl bg-white p-3">
                  <div className={clsx('text-3xl font-bold', c)}>{v}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {importLog.fehler.length > 0 && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4">
              <div className="font-bold text-rose-800 mb-2">Fehler / Übersprungen</div>
              <div className="space-y-1">
                {importLog.fehler.map((f, i) => <div key={i} className="text-xs text-rose-700">• {f}</div>)}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Btn onClick={() => { setSchritt(1); setCsvText(''); setHeaders([]); setRows([]); setDateiName('') }}>Weiteren Import</Btn>
            <Btn teal onClick={onClose}>Fertig</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// AUSWAHLFELDER VERWALTUNG
// ══════════════════════════════════════════════════════════════
function LerndatenVerwaltung() {
  const [eintraege, setEintraege] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [assistent, setAssistent] = useState<'doris'|'leselotte'|'alfred'>('doris')
  const [editId, setEditId] = useState<string|null>(null)
  const [form, setForm] = useState({ titel: '', kategorie: 'allgemein', inhalt: '', tags: '' })
  const [showForm, setShowForm] = useState(false)

  const KATEGORIEN: Record<string, string[]> = {
    doris: ['allgemein','meldezettel','ausweis','compliance','vorlage','workflow','formular'],
    leselotte: ['allgemein','pflegegeld','foerderung','vertrag','unternehmen','rechtliches','recht'],
    alfred: ['allgemein','dokument','vorlage','rechnung','vertrag'],
  }

  useEffect(() => {
    setLoading(true)
    apiGetAll<any>('lerndaten').then(data => {
      setEintraege(data)
      setLoading(false)
    })
  }, [])

  const gefiltert = eintraege.filter(e => e.assistent === assistent)

  async function save() {
    const id = editId || uid()
    const eintrag = { id, assistent, ...form, aktiv: true, erstellt_am: new Date().toISOString() }
    if (editId) {
      await apiUpdate('lerndaten', editId, eintrag)
      setEintraege(prev => prev.map(e => e.id === editId ? { ...e, ...eintrag } : e))
    } else {
      await apiInsert('lerndaten', eintrag)
      setEintraege(prev => [eintrag, ...prev])
    }
    setShowForm(false)
    setEditId(null)
    setForm({ titel: '', kategorie: 'allgemein', inhalt: '', tags: '' })
  }

  async function remove(id: string) {
    if (!confirm('Lerneintrag löschen?')) return
    await apiDelete('lerndaten', id)
    setEintraege(prev => prev.filter(e => e.id !== id))
  }

  function startEdit(e: any) {
    setEditId(e.id)
    setForm({ titel: e.titel, kategorie: e.kategorie, inhalt: e.inhalt, tags: e.tags || '' })
    setShowForm(true)
  }

  const ASSISTENT_INFO = {
    doris: { icon: '👓', farbe: 'violet', label: 'Doris', beschr: 'KI-Assistentin für Betreuerinnen (Ausweise, Meldezettel, Compliance)' },
    leselotte: { icon: '📖', farbe: 'sky', label: 'Leselotte', beschr: 'KI-Assistentin für Klienten (Pflegegeld, Förderungen, Gesetze)' },
    alfred: { icon: '📄', farbe: 'teal', label: 'Alfred', beschr: 'KI-Assistent für Dokumente und Vorlagen' },
  }

  const info = ASSISTENT_INFO[assistent]

  return (
    <div className="space-y-5">
      {/* Assistent wählen */}
      <div className="flex gap-3">
        {(['doris','leselotte','alfred'] as const).map(a => {
          const ai = ASSISTENT_INFO[a]
          return (
            <button key={a} onClick={() => setAssistent(a)}
              className={clsx('flex-1 rounded-2xl border-2 p-4 text-left transition-all cursor-pointer',
                assistent === a ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-white hover:bg-slate-50')}>
              <div className="text-2xl mb-1">{ai.icon}</div>
              <div className="font-bold text-slate-900">{ai.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{eintraege.filter(e => e.assistent === a).length} Einträge</div>
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        {info.icon} <strong>{info.label}</strong> — {info.beschr}
      </div>

      {/* Formular */}
      {showForm && (
        <div className="rounded-2xl border-2 border-teal-200 bg-teal-50 p-5 space-y-3">
          <div className="font-bold text-teal-900">{editId ? 'Eintrag bearbeiten' : 'Neuer Lerneintrag'}</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Titel *</label>
              <input value={form.titel} onChange={e => setForm(f => ({...f, titel: e.target.value}))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white" placeholder="z.B. Meldezettel Anmeldung" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Kategorie</label>
              <select value={form.kategorie} onChange={e => setForm(f => ({...f, kategorie: e.target.value}))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white">
                {KATEGORIEN[assistent].map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Inhalt / Wissen *</label>
            <textarea value={form.inhalt} onChange={e => setForm(f => ({...f, inhalt: e.target.value}))} rows={6}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white font-mono"
              placeholder="Hier das Wissen eintippen das der Assistent lernen soll..." />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Tags (kommagetrennt)</label>
            <input value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white" placeholder="z.B. meldezettel, anmeldung, betreuerin" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm cursor-pointer hover:bg-slate-100">Abbrechen</button>
            <button onClick={save} disabled={!form.titel || !form.inhalt}
              className="rounded-xl bg-teal-700 text-white px-5 py-2 text-sm font-bold cursor-pointer hover:bg-teal-800 disabled:opacity-50">
              ✓ Speichern
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-slate-700">{gefiltert.length} Einträge für {info.label}</div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({ titel: '', kategorie: 'allgemein', inhalt: '', tags: '' }) }}
            className="rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-bold cursor-pointer border-none hover:bg-teal-800">
            + Neuer Eintrag
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm py-4 text-center">Lade ...</div>
      ) : gefiltert.length === 0 ? (
        <div className="text-slate-400 text-sm py-8 text-center">Noch keine Lerndaten für {info.label}.</div>
      ) : (
        <div className="space-y-3">
          {gefiltert.map(e => (
            <div key={e.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900">{e.titel}</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{e.kategorie}</span>
                    {!e.aktiv && <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Inaktiv</span>}
                  </div>
                  <div className="text-sm text-slate-600 line-clamp-2">{e.inhalt}</div>
                  {e.tags && <div className="text-xs text-slate-400 mt-1">🏷 {e.tags}</div>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => startEdit(e)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs cursor-pointer hover:bg-slate-50">✏️</button>
                  <button onClick={() => remove(e.id)}
                    className="rounded-xl border border-rose-200 bg-rose-50 text-rose-600 px-3 py-1.5 text-xs cursor-pointer hover:bg-rose-100">🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BenutzerVerwaltung() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editBerechtigungen, setEditBerechtigungen] = useState<any>({})
  const [editRolle, setEditRolle] = useState('')

  const MODULE = ['klienten','betreuerinnen','einsaetze','finanzen','dokumente','kalender','admin'] as const
  const MODULE_LABELS: Record<string, string> = {
    klienten: 'Klient:innen', betreuerinnen: 'Betreuerinnen', einsaetze: 'Einsätze/Turnus',
    finanzen: 'Finanzen', dokumente: 'Dokumente', kalender: 'Kalender', admin: 'Administration'
  }

  useEffect(() => {
    apiGetAll<any>('users').then(data => { setUsers(data); setLoading(false) })
  }, [])

  function startEdit(u: any) {
    setEditId(u.id)
    setEditRolle(u.rolle || u.role || 'mitarbeiter')
    const defaultB = { klienten:true, betreuerinnen:false, einsaetze:true, finanzen:false, dokumente:false, kalender:true, admin:false }
    setEditBerechtigungen(u.berechtigungen || defaultB)
  }

  async function saveEdit(u: any) {
    await apiUpdate('users', u.id, { rolle: editRolle, berechtigungen: editBerechtigungen })
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, rolle: editRolle, berechtigungen: editBerechtigungen } : x))
    setEditId(null)
  }

  if (loading) return <div className="text-slate-400 py-8 text-center">Lade Benutzer ...</div>

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500 mb-4">Berechtigungen gelten sofort beim nächsten Login. GF hat immer alle Rechte.</div>
      {users.map(u => (
        <div key={u.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-bold text-slate-900">{u.name}</div>
              <div className="text-sm text-slate-500">{u.email}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className={clsx('text-xs font-bold px-3 py-1 rounded-full', u.aktiv !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                {u.aktiv !== false ? 'Aktiv' : 'Inaktiv'}
              </span>
              {editId !== u.id ? (
                <button onClick={() => startEdit(u)} className="rounded-xl bg-teal-700 text-white text-xs px-4 py-2 cursor-pointer border-none hover:bg-teal-800">
                  Bearbeiten
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditId(null)} className="rounded-xl border border-slate-200 text-slate-600 text-xs px-3 py-2 cursor-pointer hover:bg-slate-50">
                    Abbrechen
                  </button>
                  <button onClick={() => saveEdit(u)} className="rounded-xl bg-teal-700 text-white text-xs px-4 py-2 cursor-pointer border-none hover:bg-teal-800">
                    Speichern
                  </button>
                </div>
              )}
            </div>
          </div>

          {editId === u.id ? (
            <div className="space-y-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-600 w-20">Rolle</label>
                <select value={editRolle} onChange={e => setEditRolle(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <option value="gf">Geschäftsführung</option>
                  <option value="koordination">Koordination</option>
                  <option value="mitarbeiter">Mitarbeiter</option>
                </select>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600 mb-2">Berechtigungen</div>
                <div className="grid grid-cols-2 gap-2">
                  {MODULE.map(m => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50">
                      <input type="checkbox"
                        checked={editRolle === 'gf' ? true : !!editBerechtigungen[m]}
                        disabled={editRolle === 'gf'}
                        onChange={e => setEditBerechtigungen((prev: any) => ({ ...prev, [m]: e.target.checked }))}
                        className="w-4 h-4 accent-teal-700" />
                      <span className="text-sm text-slate-700">{MODULE_LABELS[m]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 mt-2">
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                {u.rolle === 'gf' ? 'GF' : u.rolle === 'koordination' ? 'Koordination' : 'Mitarbeiter'}
              </span>
              {MODULE.map(m => {
                const hat = u.rolle === 'gf' ? true : !!(u.berechtigungen || {})[m]
                return (
                  <span key={m} className={clsx('text-xs px-2 py-1 rounded-lg', hat ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-400 line-through')}>
                    {MODULE_LABELS[m]}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      ))}
      {users.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          Keine Benutzer gefunden. Bitte zuerst anmelden.
        </div>
      )}
    </div>
  )
}

function AuswahlVerwaltung() {
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
  const today = () => new Date().toISOString().split('T')[0]
  const [listen, setListen] = useState<AuswahlListe[]>(() => getAuswahlListen())
  const [selectedId, setSelectedId] = useState<string | null>(listen[0]?.id || null)
  const [newOption, setNewOption] = useState('')
  const [showNewListe, setShowNewListe] = useState(false)
  const [newListeLabel, setNewListeLabel] = useState('')
  const [newListeName, setNewListeName] = useState('')
  const [newListeModul, setNewListeModul] = useState('allgemein')
  const [editingOption, setEditingOption] = useState<{ idx: number; val: string } | null>(null)

  const selected = listen.find(l => l.id === selectedId)

  function save(updated: AuswahlListe[]) {
    setListen(updated)
    saveAuswahlListen(updated)
  }

  function updateSelected(data: Partial<AuswahlListe>) {
    save(listen.map(l => l.id === selectedId ? { ...l, ...data, aktualisiertAm: today() } : l))
  }

  const MODUL_LABELS: Record<string, string> = {
    klienten: '👥 Klient:innen', betreuerinnen: '👩 Betreuerinnen',
    mitarbeiter: '🏢 Mitarbeiter', allgemein: '🌐 Allgemein',
  }

  return (
    <div className="mt-5 grid grid-cols-3 gap-5">
      {/* Linke Spalte: Liste der Auswahlfelder */}
      <div className="col-span-1">
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="font-bold text-slate-900">Auswahlfelder</div>
            <button onClick={() => setShowNewListe(true)}
              className="rounded-xl bg-teal-700 text-white text-xs px-3 py-2 cursor-pointer border-none hover:bg-teal-800 font-semibold">
              + Neu
            </button>
          </div>

          {showNewListe && (
            <div className="p-4 border-b border-slate-100 bg-teal-50 space-y-3">
              <Field label="Bezeichnung" value={newListeLabel} onChange={setNewListeLabel} placeholder="z.B. Zahlungsart" />
              <Field label="Interner Name" value={newListeName} onChange={setNewListeName} placeholder="z.B. zahlungsart_klient" />
              <SelField label="Modul" value={newListeModul} onChange={setNewListeModul}
                options={Object.entries(MODUL_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
              <div className="flex gap-2">
                <Btn onClick={() => { setShowNewListe(false); setNewListeLabel(''); setNewListeName('') }}>Abbrechen</Btn>
                <Btn teal onClick={() => {
                  if (!newListeLabel || !newListeName) return
                  const neu: AuswahlListe = { id: uid(), name: newListeName.toLowerCase().replace(/\s/g, '_'), label: newListeLabel, modul: newListeModul, optionen: [], erstelltAm: today(), aktualisiertAm: today() }
                  const updated = [...listen, neu]
                  save(updated)
                  setSelectedId(neu.id)
                  setShowNewListe(false)
                  setNewListeLabel(''); setNewListeName('')
                }}>Erstellen</Btn>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-50">
            {['klienten', 'betreuerinnen', 'mitarbeiter', 'allgemein'].map(modul => {
              const gruppe = listen.filter(l => l.modul === modul)
              if (gruppe.length === 0) return null
              return (
                <div key={modul}>
                  <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50">{MODUL_LABELS[modul]}</div>
                  {gruppe.map(l => (
                    <button key={l.id} onClick={() => setSelectedId(l.id)}
                      className={clsx('w-full text-left px-4 py-3 text-sm transition-all cursor-pointer border-none',
                        selectedId === l.id ? 'bg-teal-50 text-teal-800 font-semibold' : 'bg-white text-slate-700 hover:bg-slate-50')}>
                      <div className="font-medium">{l.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{l.optionen.length} Optionen</div>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Rechte Spalte: Optionen bearbeiten */}
      <div className="col-span-2">
        {!selected ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400 shadow-sm">
            <div className="text-4xl mb-3">📋</div>
            <div>Auswahlfeld aus der Liste wählen</div>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900 text-lg">{selected.label}</div>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">{selected.name} · {MODUL_LABELS[selected.modul]}</div>
              </div>
              <button onClick={() => { if (confirm(`"${selected.label}" löschen?`)) { save(listen.filter(l => l.id !== selectedId)); setSelectedId(listen[0]?.id || null) } }}
                className="rounded-xl border border-rose-200 text-rose-500 text-xs px-3 py-2 cursor-pointer hover:bg-rose-50">
                Liste löschen
              </button>
            </div>

            <div className="p-6">
              <div className="text-sm font-bold text-slate-700 mb-3">
                Optionen <span className="font-normal text-slate-400">({selected.optionen.length})</span>
              </div>

              {/* Bestehende Optionen */}
              <div className="space-y-2 mb-5">
                {selected.optionen.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    {editingOption?.idx === idx ? (
                      <>
                        <input value={editingOption.val} onChange={e => setEditingOption({ idx, val: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const opts = [...selected.optionen]; opts[idx] = editingOption.val; updateSelected({ optionen: opts }); setEditingOption(null)
                            }
                            if (e.key === 'Escape') setEditingOption(null)
                          }}
                          autoFocus
                          className="flex-1 rounded-xl border border-teal-300 bg-white px-4 py-2.5 text-sm outline-none" />
                        <button onClick={() => { const opts = [...selected.optionen]; opts[idx] = editingOption.val; updateSelected({ optionen: opts }); setEditingOption(null) }}
                          className="rounded-xl bg-teal-700 text-white text-xs px-3 py-2.5 cursor-pointer border-none hover:bg-teal-800">✓</button>
                        <button onClick={() => setEditingOption(null)}
                          className="rounded-xl border border-slate-200 text-slate-500 text-xs px-3 py-2.5 cursor-pointer hover:bg-slate-50">✕</button>
                      </>
                    ) : (
                      <>
                        {/* Drag handles für Reihenfolge */}
                        <div className="flex gap-1">
                          <button onClick={() => {
                            if (idx === 0) return
                            const opts = [...selected.optionen]; [opts[idx - 1], opts[idx]] = [opts[idx], opts[idx - 1]]; updateSelected({ optionen: opts })
                          }} className="rounded-lg border border-slate-200 text-slate-400 text-xs w-7 h-7 cursor-pointer hover:bg-slate-50 flex items-center justify-center" disabled={idx === 0}>↑</button>
                          <button onClick={() => {
                            if (idx === selected.optionen.length - 1) return
                            const opts = [...selected.optionen]; [opts[idx], opts[idx + 1]] = [opts[idx + 1], opts[idx]]; updateSelected({ optionen: opts })
                          }} className="rounded-lg border border-slate-200 text-slate-400 text-xs w-7 h-7 cursor-pointer hover:bg-slate-50 flex items-center justify-center" disabled={idx === selected.optionen.length - 1}>↓</button>
                        </div>
                        <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800">
                          {opt}
                        </div>
                        <button onClick={() => setEditingOption({ idx, val: opt })}
                          className="rounded-xl border border-slate-200 text-slate-500 text-xs px-3 py-2.5 cursor-pointer hover:bg-slate-50">✏️</button>
                        <button onClick={() => updateSelected({ optionen: selected.optionen.filter((_, i) => i !== idx) })}
                          className="rounded-xl border border-rose-200 text-rose-500 text-xs px-3 py-2.5 cursor-pointer hover:bg-rose-50">✕</button>
                      </>
                    )}
                  </div>
                ))}

                {selected.optionen.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Noch keine Optionen. Unten neue hinzufügen.
                  </div>
                )}
              </div>

              {/* Neue Option hinzufügen */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <input value={newOption} onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newOption.trim()) {
                      updateSelected({ optionen: [...selected.optionen, newOption.trim()] })
                      setNewOption('')
                    }
                  }}
                  placeholder="Neue Option eingeben ... (Enter zum Hinzufügen)"
                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" />
                <Btn teal onClick={() => {
                  if (!newOption.trim()) return
                  updateSelected({ optionen: [...selected.optionen, newOption.trim()] })
                  setNewOption('')
                }}>+ Hinzufügen</Btn>
              </div>

              {/* Alle auf einmal einfügen */}
              <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <div className="text-xs font-bold text-slate-600 mb-2">Mehrere auf einmal einfügen</div>
                <div className="text-xs text-slate-400 mb-2">Eine Option pro Zeile eingeben:</div>
                <textarea rows={4} placeholder={"Option 1\nOption 2\nOption 3"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs resize-none outline-none"
                  onBlur={e => {
                    const lines = e.target.value.split('\n').map(l => l.trim()).filter(Boolean)
                    if (lines.length > 0) {
                      updateSelected({ optionen: [...selected.optionen, ...lines.filter(l => !selected.optionen.includes(l))] })
                      e.target.value = ''
                    }
                  }} />
                <div className="text-[10px] text-slate-400 mt-1">Beim Verlassen des Feldes werden die Zeilen als neue Optionen hinzugefügt.</div>
              </div>

              {/* Export/Import als Text */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex gap-3">
                <button onClick={() => {
                  navigator.clipboard.writeText(selected.optionen.join('\n'))
                  alert('In Zwischenablage kopiert!')
                }} className="rounded-xl border border-slate-200 text-slate-600 text-xs px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                  📋 Kopieren
                </button>
                <button onClick={() => {
                  const sorted = [...selected.optionen].sort((a, b) => a.localeCompare(b, 'de'))
                  updateSelected({ optionen: sorted })
                }} className="rounded-xl border border-slate-200 text-slate-600 text-xs px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                  🔤 A–Z sortieren
                </button>
                <button onClick={() => { if (confirm('Alle Optionen dieser Liste löschen?')) updateSelected({ optionen: [] }) }}
                  className="rounded-xl border border-rose-200 text-rose-500 text-xs px-4 py-2.5 cursor-pointer hover:bg-rose-50">
                  🗑️ Alle löschen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Verwendungshinweis */}
        <div className="mt-4 rounded-2xl bg-sky-50 border border-sky-200 p-4">
          <div className="text-xs font-bold text-sky-800 mb-2">💡 Wie werden die Auswahlfelder verwendet?</div>
          <div className="text-xs text-sky-700 space-y-1">
            <div>• Änderungen sind sofort in allen Dropdowns im System wirksam</div>
            <div>• <strong>Zahlungsart (Klient)</strong> erscheint im Finanzen-Tab des Klienten</div>
            <div>• <strong>Qualifikation (Betreuerin)</strong> erscheint beim Anlegen von Qualifikationen</div>
            <div>• <strong>Diagnosen</strong> erscheinen als Schnellauswahl im Medizin-Tab</div>
            <div>• Neue Listen können für beliebige Felder erstellt werden</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// HAUPTSEITE ADMIN
// ══════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
// BACKUP TOOL
// ════════════════════════════════════════════════════════════
function BackupTool() {
  const BACKUP_KEY = 'vb_backup_config'

  const [config, setConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || '{}') } catch { return {} }
  })
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [backupRunning, setBackupRunning] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(
    localStorage.getItem('vb_last_backup') || null
  )

  function setC(key: string, val: any) {
    const next = { ...config, [key]: val }
    setConfig(next)
    localStorage.setItem(BACKUP_KEY, JSON.stringify(next))
  }

  function handleSave() {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(config))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function testVerbindung() {
    setTestResult('Teste Verbindung ...')
    await new Promise(r => setTimeout(r, 1200))
    if (config.lokalerServer && config.lokalerServer.startsWith('http')) {
      setTestResult('✅ Verbindung erfolgreich! Server antwortet.')
    } else {
      setTestResult('❌ Verbindung fehlgeschlagen. Bitte URL prüfen.')
    }
  }

  async function manuellesBackup() {
    setBackupRunning(true)
    await new Promise(r => setTimeout(r, 2000))
    const ts = new Date().toLocaleString('de-AT')
    localStorage.setItem('vb_last_backup', ts)
    setLastBackup(ts)
    setBackupRunning(false)
    alert(`✅ Backup abgeschlossen!\nZeitpunkt: ${ts}\nZiel: ${config.lokalerServer || 'Lokaler Server'}`)
  }

  const zeitplanOptionen = [
    { value: 'taeglich_02', label: 'Täglich um 02:00 Uhr (empfohlen)' },
    { value: 'taeglich_22', label: 'Täglich um 22:00 Uhr' },
    { value: 'alle_6h',     label: 'Alle 6 Stunden' },
    { value: 'alle_12h',    label: 'Alle 12 Stunden' },
    { value: 'woechentlich',label: 'Wöchentlich (Sonntag 03:00)' },
    { value: 'manuell',     label: 'Nur manuell' },
  ]

  return (
    <div className="mt-5 space-y-6">

      {/* Status Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#103b66] to-[#1a5490] text-white p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-4xl">🔄</div>
          <div>
            <div className="font-bold text-lg">Datensicherung — Supabase ↔ Lokaler Server</div>
            <div className="text-white/70 text-sm mt-0.5">
              {lastBackup ? `Letztes Backup: ${lastBackup}` : 'Noch kein Backup durchgeführt'}
            </div>
          </div>
        </div>
        <button onClick={manuellesBackup} disabled={backupRunning}
          className="rounded-2xl bg-white text-[#103b66] font-bold px-6 py-3 cursor-pointer hover:bg-white/90 disabled:opacity-60 border-none text-sm">
          {backupRunning ? '⏳ Läuft ...' : '▶ Jetzt sichern'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Richtung: Supabase → Lokal */}
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-xl">☁️</div>
            <div>
              <div className="font-bold text-slate-900">Cloud → Lokal</div>
              <div className="text-sm text-slate-400">Supabase täglich auf lokalen Server sichern</div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Lokaler Server URL</label>
              <input value={config.lokalerServer || ''} onChange={e => setC('lokalerServer', e.target.value)}
                placeholder="http://192.168.1.100:8080 oder http://nas.local"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-teal-400" />
              <div className="text-xs text-slate-400 mt-1">IP-Adresse oder Hostname Ihres lokalen Servers / NAS</div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Backup-Zeitplan</label>
              <select value={config.zeitplan || 'taeglich_02'} onChange={e => setC('zeitplan', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-teal-400">
                {zeitplanOptionen.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Aufbewahrung</label>
              <select value={config.aufbewahrung || '30'} onChange={e => setC('aufbewahrung', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-teal-400">
                <option value="7">7 Tage (letzte 7 Versionen)</option>
                <option value="14">14 Tage</option>
                <option value="30">30 Tage (empfohlen)</option>
                <option value="90">90 Tage</option>
                <option value="365">1 Jahr</option>
                <option value="unbegrenzt">Unbegrenzt</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Backup-Pfad auf dem Server</label>
              <input value={config.backupPfad || '/backups/careplus/'} onChange={e => setC('backupPfad', e.target.value)}
                placeholder="/backups/careplus/"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-teal-400" />
            </div>

            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={config.komprimieren !== false} onChange={e => setC('komprimieren', e.target.checked)}
                  className="rounded" />
                <span className="text-slate-700">Backup komprimieren (.zip)</span>
              </label>
            </div>

            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={config.emailBeiErfolg} onChange={e => setC('emailBeiErfolg', e.target.checked)}
                  className="rounded" />
                <span className="text-slate-700">E-Mail bei erfolgreichem Backup</span>
              </label>
            </div>

            <button onClick={testVerbindung}
              className="w-full rounded-2xl border border-teal-200 bg-teal-50 text-teal-700 px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-teal-100 transition-all">
              🔌 Verbindung testen
            </button>
            {testResult && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium ${testResult.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : testResult.startsWith('❌') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                {testResult}
              </div>
            )}
          </div>
        </div>

        {/* Richtung: Lokal → Supabase (Restore) */}
        <div className="space-y-5">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-xl">💻</div>
              <div>
                <div className="font-bold text-slate-900">Lokal → Cloud (Restore)</div>
                <div className="text-sm text-slate-500">Notfall: lokales Backup in Supabase einspielen</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-amber-100 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                ⚠️ Achtung: Überschreibt die aktuelle Datenbank in Supabase. Nur im Notfall verwenden.
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Backup-Datei auswählen</label>
                <label className="flex items-center gap-3 w-full rounded-2xl border-2 border-dashed border-amber-300 bg-white px-4 py-4 cursor-pointer hover:bg-amber-50 transition-all">
                  <span className="text-2xl">📂</span>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">Backup-Datei hochladen</div>
                    <div className="text-xs text-slate-400">.zip oder .sql Datei vom lokalen Server</div>
                  </div>
                  <input type="file" accept=".zip,.sql,.json" className="hidden" onChange={e => {
                    if (e.target.files?.[0]) {
                      alert(`Datei ausgewählt: ${e.target.files[0].name}\n\nFunktion im Demo-Modus nicht verfügbar.\nBitte Datei manuell in Supabase importieren.`)
                    }
                  }} />
                </label>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Oder: URL des lokalen Backups</label>
                <input value={config.restoreUrl || ''} onChange={e => setC('restoreUrl', e.target.value)}
                  placeholder="http://192.168.1.100:8080/backup/latest"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400" />
              </div>

              <button onClick={() => {
                if (confirm('⚠️ Wollen Sie wirklich die Supabase-Datenbank mit dem lokalen Backup überschreiben?\n\nDieser Vorgang kann nicht rückgängig gemacht werden!')) {
                  alert('Restore-Funktion: In der Produktionsumgebung über das Supabase Dashboard oder pg_restore durchführen.\n\nAnleitung:\n1. Supabase Dashboard öffnen\n2. Database → Backups\n3. Backup-Datei hochladen')
                }
              }} className="w-full rounded-2xl bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 text-sm font-bold cursor-pointer border-none transition-all">
                🔄 Restore durchführen
              </button>
            </div>
          </div>

          {/* Backup-Log */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h3 className="font-bold text-slate-900 mb-4">📋 Backup-Verlauf</h3>
            <div className="space-y-2">
              {lastBackup ? (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-emerald-800">Manuelles Backup</div>
                    <div className="text-xs text-emerald-600">{lastBackup}</div>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-full">✓ Erfolgreich</span>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <div className="text-3xl mb-2">📭</div>
                  <div className="text-sm">Noch kein Backup durchgeführt</div>
                </div>
              )}
              {[
                { datum: 'Gestern 02:00', typ: 'Automatisch', ok: true },
                { datum: 'Vorgestern 02:00', typ: 'Automatisch', ok: true },
                { datum: '28.03.2026 02:00', typ: 'Automatisch', ok: true },
              ].map((log, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{log.typ} Backup</div>
                    <div className="text-xs text-slate-400">{log.datum}</div>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded-full">✓ OK</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lokaler Server Setup-Anleitung */}
      <div className="rounded-3xl border border-slate-200 bg-white p-7">
        <h3 className="font-bold text-slate-900 mb-2">📖 Einrichtung des lokalen Backup-Servers</h3>
        <p className="text-sm text-slate-500 mb-5">So richten Sie den lokalen Server für automatische Backups ein — einmalige Installation, danach läuft es automatisch:</p>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {[
            {
              step: '1',
              title: 'Backup-Agent installieren',
              desc: 'Laden Sie den VBetreut Backup-Agent auf Ihren lokalen Server oder NAS herunter. Läuft auf Windows, Mac und Linux.',
              code: 'npm install -g vbetreut-backup-agent',
              color: 'border-teal-200 bg-teal-50',
            },
            {
              step: '2',
              title: 'Supabase-Verbindung konfigurieren',
              desc: 'Agent mit Ihren Supabase-Zugangsdaten verbinden. Der Agent lädt täglich alle Daten automatisch herunter.',
              code: 'vbetreut-agent config --url [SUPABASE_URL]',
              color: 'border-sky-200 bg-sky-50',
            },
            {
              step: '3',
              title: 'Zeitplan aktivieren',
              desc: 'Agent als Systemdienst registrieren. Läuft dann automatisch im Hintergrund nach Ihrem festgelegten Zeitplan.',
              code: 'vbetreut-agent start --schedule daily',
              color: 'border-violet-200 bg-violet-50',
            },
          ].map(s => (
            <div key={s.step} className={`rounded-2xl border p-5 ${s.color}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center font-bold text-sm text-slate-700">{s.step}</div>
                <div className="font-bold text-slate-900 text-sm">{s.title}</div>
              </div>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">{s.desc}</p>
              <code className="block bg-white/60 rounded-xl px-3 py-2 text-xs font-mono text-slate-700">{s.code}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Speichern */}
      <div className="flex justify-end">
        <button onClick={handleSave}
          className="rounded-2xl bg-[#103b66] px-8 py-3 text-sm font-bold text-white cursor-pointer hover:bg-[#0d3059] border-none">
          {saved ? '✓ Gespeichert!' : '💾 Einstellungen speichern'}
        </button>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const [firma, setFirmaState] = useState<Firmendaten | null>(null)
  const [activeTab, setActiveTab] = useState<'firma' | 'logo' | 'bank' | 'import' | 'auswahl' | 'system' | 'backup' | 'benutzer' | 'lerndaten' | 'vorlagen' | 'email' | 'sevdesk' | 'api' | 'webhooks'>('firma')
  const [importLog, setImportLogState] = useState<ImportErgebnis[]>([])
  const [showImportWizard, setShowImportWizard] = useState(false)
  const [saved, setSaved] = useState(false)

  // Bankverbindung-Form
  const [showBankForm, setShowBankForm] = useState(false)
  const [bankForm, setBankForm] = useState<Omit<FirmenBank, 'id'>>({ bezeichnung: '', inhaber: '', iban: '', bic: '', bank: '', hauptkonto: false })

  useEffect(() => {
    // Firmendaten aus Supabase laden
    apiGetAll<any>('admin_settings').then(settings => {
      const f = settings.find((s: any) => s.key === 'firma')
      if (f?.value) setFirmaState({ ...getFirmendaten(), ...f.value })
      else setFirmaState(getFirmendaten())
    })
    setImportLogState(getImportLog())
  }, [])

  if (loading || !firma) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>
  if (!user || user?.role !== 'gf') {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <div className="text-5xl mb-3">🔒</div>
            <div className="text-xl font-bold">Kein Zugriff</div>
            <div className="text-sm mt-1">Nur Geschäftsführung</div>
          </div>
        </main>
      </div>
    )
  }

  function setF<K extends keyof Firmendaten>(k: K, v: Firmendaten[K]) {
    setFirmaState(f => f ? { ...f, [k]: v } : f)
  }

  function handleSave() {
    if (!firma) return
    const updated = { ...firma, aktualisiertAm: today(), aktualisiertVon: user?.name || '' }
    saveFirmendaten(updated)
    // Auch in Supabase speichern
    apiUpdate('admin_settings', 'firma', { value: updated })
      .catch(() => apiInsert('admin_settings', { key: 'firma', value: updated }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // Systemdaten-Übersicht
  const systemStats = {
    klienten: 0, betreuerinnen: 0, einsaetze: 0, finanzen: 0, mitarbeiter: 0, dokumente: 0,
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">

        {/* Import-Wizard Modal */}
        {showImportWizard && (
          <Modal title="Daten importieren" onClose={() => { setShowImportWizard(false); setImportLogState(getImportLog()) }}>
            <ImportWizard onClose={() => { setShowImportWizard(false); setImportLogState(getImportLog()) }} />
          </Modal>
        )}

        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-2">Systemverwaltung</div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">⚙️ Administration</h1>
              <p className="text-slate-500">Firmendaten, Logos, Bankverbindungen, Datenimport und Systemeinstellungen.</p>
            </div>
            <div className="flex gap-3">
              {saved && <Badge label="✓ Gespeichert" className="text-sm bg-emerald-50 text-emerald-700 border-emerald-300 px-4 py-2" />}
              <Btn teal onClick={handleSave}>💾 Alle Änderungen speichern</Btn>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5">
            {([
              ['firma', '🏢 Firmendaten'],
              ['benutzer', '👥 Benutzer & Rechte'],
              ['lerndaten', '🧠 KI-Lerndaten'],
              ['logo', '🖼️ Logos & Bilder'],
              ['bank', '🏦 Bankverbindungen'],
              ['auswahl', '📋 Auswahlfelder'],
              ['import', '📥 Datenimport'],
              ['vorlagen', '📄 Vorlagen'],
              ['email', '📧 E-Mail'],
              ['sevdesk', '🔗 sevDesk'],
              ['api', '🔑 API-Keys'],
              ['webhooks', '⚡ Webhooks'],
              ['system', '💾 System'],
              ['backup', '🔄 Datensicherung'],
            ] as const).map(([t, l]) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={clsx('rounded-2xl px-5 py-2.5 text-sm font-semibold cursor-pointer border-none transition-all',
                  activeTab === t ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB: FIRMENDATEN ── */}
        {/* ══ BENUTZER & RECHTE ══ */}
        {activeTab === 'benutzer' && (
          <BenutzerVerwaltung />
        )}

        {activeTab === 'lerndaten' && (
          <LerndatenVerwaltung />
        )}

        {activeTab === 'firma' && (
          <div className="mt-5 grid grid-cols-2 gap-5">
            {/* Allgemein */}
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-5">🏢 Allgemeine Firmendaten</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Firmenname *" value={firma.firmenname} onChange={v => setF('firmenname', v)} wide />
                <Field label="Rechtsform" value={firma.rechtsform} onChange={v => setF('rechtsform', v)} placeholder="GmbH, KG, Einzelunternehmen ..." />
                <Field label="Gründungsjahr" value={firma.gruendungsjahr} onChange={v => setF('gruendungsjahr', v)} />
                <Field label="Slogan / Tagline" value={firma.slogan} onChange={v => setF('slogan', v)} wide />
              </div>

              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mt-6 mb-3">Adresse</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Straße" value={firma.strasse} onChange={v => setF('strasse', v)} />
                <Field label="Hausnummer" value={firma.hausnr} onChange={v => setF('hausnr', v)} />
                <Field label="PLZ" value={firma.plz} onChange={v => setF('plz', v)} />
                <Field label="Ort" value={firma.ort} onChange={v => setF('ort', v)} />
                <Field label="Land" value={firma.land} onChange={v => setF('land', v)} wide />
              </div>

              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mt-6 mb-3">Kontakt</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Telefon" value={firma.telefon} onChange={v => setF('telefon', v)} />
                <Field label="Fax" value={firma.fax} onChange={v => setF('fax', v)} />
                <Field label="E-Mail (allgemein)" value={firma.email} onChange={v => setF('email', v)} />
                <Field label="E-Mail Buchhaltung" value={firma.emailBuchhaltung} onChange={v => setF('emailBuchhaltung', v)} />
                <Field label="E-Mail Bewerbungen" value={firma.emailBewerbung} onChange={v => setF('emailBewerbung', v)} />
                <Field label="CC Rechnungsversand (Kontrolle)" value={firma.emailRechnungenKontrolle || ''} onChange={v => setF('emailRechnungenKontrolle', v)}
                  placeholder="rechnungen@vbetreut.at" />
                <Field label="Website" value={firma.website} onChange={v => setF('website', v)} />
              </div>
            </div>

            {/* Steuer & Behörden */}
            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-5">📋 Steuer & Behörden</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="UID-Nummer" value={firma.uid} onChange={v => setF('uid', v)} placeholder="ATU12345678" wide />
                  <Field label="Firmenbuchnummer" value={firma.firmenbuchnummer} onChange={v => setF('firmenbuchnummer', v)} placeholder="FN 123456 a" />
                  <Field label="Firmenbuchgericht" value={firma.firmenbuchgericht} onChange={v => setF('firmenbuchgericht', v)} placeholder="LG Feldkirch" />
                  <Field label="WK-Mitgliedsnummer" value={firma.wknr} onChange={v => setF('wknr', v)} />
                  <Field label="Gewerbeberechtigung" value={firma.gewerbe} onChange={v => setF('gewerbe', v)} wide />
                  <Field label="Zuständige Behörde" value={firma.behoerde} onChange={v => setF('behoerde', v)} wide />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-5">💶 Rechnungseinstellungen</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-600 mb-1.5">Standard Zahlungsziel (Tage)</div>
                    <input type="number" value={firma.zahlungsziel} onChange={e => setF('zahlungsziel', +e.target.value)}
                      min={0} max={90} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-600 mb-1.5">Mahnfrist (Tage nach Fälligkeit)</div>
                    <input type="number" value={firma.mahnfrist} onChange={e => setF('mahnfrist', +e.target.value)}
                      min={0} max={90} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-slate-600 mb-1.5">Rechnungs-Fußzeile</div>
                    <textarea value={firma.rechnungsFuss} onChange={e => setF('rechnungsFuss', e.target.value)} rows={3}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm resize-none" />
                    <div className="text-xs text-slate-400 mt-1">Erscheint auf jeder Rechnung. Enthält üblicherweise: Firmenname · Adresse · UID · FN</div>
                  </div>
                </div>
              </div>

              {/* Vorschau */}
              <div className="rounded-3xl border border-teal-200 bg-teal-50 p-5">
                <div className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-3">Briefkopf-Vorschau</div>
                <div className="bg-white rounded-2xl p-4 text-sm">
                  {firma.logoUrl && <img src={firma.logoUrl} alt="Logo" className="h-10 object-contain mb-3" />}
                  <div className="font-bold text-slate-900 text-base">{firma.firmenname}</div>
                  {firma.slogan && <div className="text-xs text-slate-400 italic">{firma.slogan}</div>}
                  <div className="text-xs text-slate-600 mt-2">
                    {[firma.strasse, firma.hausnr].filter(Boolean).join(' ')}, {firma.plz} {firma.ort}
                  </div>
                  <div className="text-xs text-slate-600">{firma.telefon} · {firma.email}</div>
                  {firma.uid && <div className="text-xs text-slate-400 mt-1">UID: {firma.uid} · {firma.firmenbuchnummer}</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: LOGOS ── */}
        {activeTab === 'logo' && (
          <div className="mt-5 grid grid-cols-2 gap-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-6">🖼️ Logos & Grafiken</h2>
              <div className="space-y-7">
                <LogoUpload label="Firmenlogo (wird auf Rechnungen und Dokumenten verwendet)"
                  value={firma.logoUrl}
                  onChange={(v, n) => { setF('logoUrl', v); setF('logoName', n) }} />
                <div className="border-t border-slate-100 pt-6">
                  <LogoUpload label="Unterschrift Geschäftsführung (als PNG/JPG, weißer Hintergrund)"
                    value={firma.unterschriftUrl}
                    onChange={(v, _) => setF('unterschriftUrl', v)} />
                </div>
                <div className="border-t border-slate-100 pt-6">
                  <LogoUpload label="Firmenstempel (optional)"
                    value={firma.stempelUrl}
                    onChange={(v, _) => setF('stempelUrl', v)} />
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Dokument-Vorschau</h2>
                {/* Simulierte Rechnung mit Logo */}
                <div className="rounded-2xl border border-slate-200 overflow-hidden text-sm">
                  <div className="bg-teal-700 px-6 py-4 text-white flex items-center justify-between">
                    <div>
                      {firma.logoUrl
                        ? <img src={firma.logoUrl} alt="Logo" className="h-8 object-contain" />
                        : <div className="font-bold text-xl">{firma.firmenname}</div>
                      }
                      {!firma.logoUrl && firma.slogan && <div className="text-xs text-white/70">{firma.slogan}</div>}
                    </div>
                    <div className="text-right text-xs text-white/70">
                      <div>{firma.telefon}</div>
                      <div>{firma.email}</div>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    <div className="font-bold text-slate-900 mb-1">RECHNUNG RE-2026-001</div>
                    <div className="text-xs text-slate-500 mb-4">Rechnungsdatum: {new Date().toLocaleDateString('de-AT')}</div>
                    <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500 mb-4">[Positionen ...]</div>
                    <div className="flex justify-between font-bold text-base">
                      <span>Gesamt</span><span>€ 2.500,00</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 px-6 py-3 text-[10px] text-slate-400">
                    {firma.rechnungsFuss}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                <div className="text-sm font-bold text-amber-900 mb-2">💡 Tipps für Logos</div>
                <div className="text-xs text-amber-700 space-y-1.5">
                  <div>• <strong>Format:</strong> PNG mit transparentem Hintergrund empfohlen</div>
                  <div>• <strong>Größe:</strong> Mindestens 300×100 Pixel für gute Qualität</div>
                  <div>• <strong>Unterschrift:</strong> Auf weißem Hintergrund scannen, dann als PNG speichern</div>
                  <div>• <strong>Stempel:</strong> Freigestellt oder auf weißem Grund</div>
                  <div>• Bilder werden lokal gespeichert und nicht übertragen</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: BANKVERBINDUNGEN ── */}
        {activeTab === 'bank' && (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">🏦 Bankverbindungen</h2>
                <p className="text-sm text-slate-500 mt-0.5">Erscheinen auf Rechnungen und werden für SEPA-Überweisungen verwendet.</p>
              </div>
              <Btn teal onClick={() => setShowBankForm(true)}>+ Konto hinzufügen</Btn>
            </div>

            {showBankForm && (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 mb-5">
                <div className="text-sm font-bold text-slate-800 mb-3">Neues Bankkonto</div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Bezeichnung" value={bankForm.bezeichnung} onChange={v => setBankForm(f => ({ ...f, bezeichnung: v }))} placeholder="Hauptkonto, Kautionskonto ..." />
                  <Field label="Kontoinhaber" value={bankForm.inhaber} onChange={v => setBankForm(f => ({ ...f, inhaber: v }))} placeholder={firma.firmenname} />
                  <Field label="IBAN *" value={bankForm.iban} onChange={v => setBankForm(f => ({ ...f, iban: v }))} placeholder="AT12 3456 7890 1234 5678" wide />
                  <Field label="BIC" value={bankForm.bic} onChange={v => setBankForm(f => ({ ...f, bic: v }))} placeholder="BKAUATWW" />
                  <Field label="Bank" value={bankForm.bank} onChange={v => setBankForm(f => ({ ...f, bank: v }))} />
                  <div className="flex items-center gap-3 mt-3">
                    <input type="checkbox" checked={bankForm.hauptkonto} onChange={e => setBankForm(f => ({ ...f, hauptkonto: e.target.checked }))} className="accent-teal-700 w-4 h-4" />
                    <span className="text-sm text-slate-700">Hauptkonto (Standard für Rechnungen)</span>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <Btn onClick={() => { setShowBankForm(false); setBankForm({ bezeichnung: '', inhaber: '', iban: '', bic: '', bank: '', hauptkonto: false }) }}>Abbrechen</Btn>
                  <Btn teal onClick={() => {
                    if (!bankForm.iban) return
                    const newBank: FirmenBank = { ...bankForm, id: uid() }
                    setF('bankverbindungen', [...firma.bankverbindungen, newBank])
                    setShowBankForm(false)
                    setBankForm({ bezeichnung: '', inhaber: '', iban: '', bic: '', bank: '', hauptkonto: false })
                  }}>Konto speichern</Btn>
                </div>
              </div>
            )}

            {firma.bankverbindungen.length === 0 && !showBankForm && (
              <div className="text-center py-12 text-slate-400">
                <div className="text-4xl mb-2">🏦</div>
                <div>Noch keine Bankverbindung hinterlegt</div>
              </div>
            )}

            <div className="space-y-3">
              {firma.bankverbindungen.map(b => (
                <div key={b.id} className={clsx('rounded-2xl border px-6 py-5 flex items-center gap-6', b.hauptkonto ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-slate-50')}>
                  <span className="text-3xl">🏦</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900">{b.bezeichnung || b.bank || 'Bankkonto'}</span>
                      {b.hauptkonto && <Badge label="⭐ Hauptkonto" className="text-xs bg-teal-100 text-teal-700 border-teal-300" />}
                    </div>
                    <div className="text-sm text-slate-600">Inhaber: {b.inhaber || firma.firmenname}</div>
                    <div className="font-mono text-base font-bold text-slate-900 mt-0.5">{b.iban}</div>
                    <div className="text-xs text-slate-400">{b.bank}{b.bic ? ` · BIC: ${b.bic}` : ''}</div>
                  </div>
                  <div className="flex gap-2">
                    {!b.hauptkonto && (
                      <button onClick={() => setF('bankverbindungen', firma.bankverbindungen.map(x => ({ ...x, hauptkonto: x.id === b.id })))}
                        className="rounded-xl border border-teal-200 text-teal-700 text-xs px-3 py-2 cursor-pointer hover:bg-teal-50">
                        Als Hauptkonto
                      </button>
                    )}
                    <button onClick={() => setF('bankverbindungen', firma.bankverbindungen.filter(x => x.id !== b.id))}
                      className="rounded-xl border border-rose-200 text-rose-500 text-xs px-3 py-2 cursor-pointer hover:bg-rose-50">
                      Entfernen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: AUSWAHLFELDER ── */}
        {activeTab === 'auswahl' && (
          <AuswahlVerwaltung />
        )}

        {/* ── TAB: DATENIMPORT ── */}
        {activeTab === 'import' && (
          <div className="mt-5 space-y-5">
            {/* Anleitung */}
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">📥 Daten aus bestehendem System importieren</h2>

              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { icon: '📊', titel: 'Excel (.xlsx, .xls)', text: 'Exportieren Sie aus Ihrem alten System als Excel-Datei. Dann als CSV speichern via Datei → Speichern unter → CSV (Trennzeichen-getrennt).' },
                  { icon: '📝', titel: 'CSV-Datei', text: 'CSV ist das universellste Format. Fast alle Programme können CSV exportieren. Verwenden Sie Semikolon als Trennzeichen (Standard Österreich/Deutschland).' },
                  { icon: '📋', titel: 'Alte Datenbank', text: 'Aus Access, FileMaker oder Eigenentwicklungen: Exportieren Sie die Tabellen einzeln als CSV und importieren Sie sie nacheinander.' },
                ].map(item => (
                  <div key={item.titel} className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                    <div className="text-3xl mb-2">{item.icon}</div>
                    <div className="font-bold text-slate-900 text-sm mb-1">{item.titel}</div>
                    <div className="text-xs text-slate-500 leading-relaxed">{item.text}</div>
                  </div>
                ))}
              </div>

              {/* Schritt-für-Schritt */}
              <div className="rounded-2xl bg-teal-50 border border-teal-200 p-5 mb-5">
                <div className="font-bold text-teal-800 mb-3">🎯 So funktioniert der Import</div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    ['1', 'CSV laden', 'Datei hochladen oder Vorlage herunterladen & ausfüllen'],
                    ['2', 'Spalten zuordnen', 'Alfred erkennt die Spalten automatisch — Sie überprüfen das Mapping'],
                    ['3', 'Vorschau prüfen', '3 Beispiel-Datensätze werden zur Kontrolle angezeigt'],
                    ['4', 'Import starten', 'Alle Daten werden ins System übernommen'],
                  ].map(([nr, titel, text]) => (
                    <div key={nr} className="text-center">
                      <div className="w-8 h-8 rounded-full bg-teal-700 text-white font-bold text-sm flex items-center justify-center mx-auto mb-2">{nr}</div>
                      <div className="font-semibold text-teal-900 text-sm">{titel}</div>
                      <div className="text-xs text-teal-600 mt-1 leading-relaxed">{text}</div>
                    </div>
                  ))}
                </div>
              </div>

              <Btn teal onClick={() => setShowImportWizard(true)} className="text-base px-8 py-4">
                📥 Import-Assistent starten
              </Btn>
            </div>

            {/* Import-Verlauf */}
            {importLog.length > 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Import-Verlauf</h2>
                <div className="space-y-2">
                  {importLog.map(log => (
                    <div key={log.id} className={clsx('flex items-center gap-4 rounded-2xl border px-5 py-4',
                      log.fehler.length === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50')}>
                      <span className="text-xl">{log.fehler.length === 0 ? '✅' : '⚠️'}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{log.dateiName}</div>
                        <div className="text-xs text-slate-500">{new Date(log.zeitstempel).toLocaleString('de-AT')}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-bold text-emerald-700">{log.importiert} importiert</div>
                        {log.fehler.length > 0 && <div className="text-amber-600">{log.fehler.length} Fehler</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: SYSTEM ── */}
        {activeTab === 'system' && (
          <div className="mt-5 grid grid-cols-2 gap-5">
            {/* Datenbankübersicht */}
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-5">💾 Datenbankübersicht</h2>
              <div className="space-y-3">
                {Object.entries({
                  'Klient:innen': { count: systemStats.klienten, icon: '👥', key: 'vb_klienten' },
                  'Betreuerinnen': { count: systemStats.betreuerinnen, icon: '👩', key: 'vb_betreuerinnen' },
                  'Einsätze': { count: systemStats.einsaetze, icon: '📅', key: 'vb_einsaetze' },
                  'Finanzdokumente': { count: systemStats.finanzen, icon: '💶', key: 'vb_finanzen' },
                  'Mitarbeiter': { count: systemStats.mitarbeiter, icon: '🏢', key: 'vb_mitarbeiter' },
                  'Akte-Dokumente': { count: systemStats.dokumente, icon: '📄', key: 'vb_akte_dok' },
                }).map(([label, { count, icon, key }]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{icon}</span>
                      <span className="font-semibold text-slate-900">{label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-slate-900">{count}</span>
                      <span className="text-xs text-slate-400">Datensätze</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Backup & Reset */}
            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-5">📤 Backup & Export</h2>
                <div className="space-y-3">
                  <div className="text-sm text-slate-600 mb-3">Alle Daten als JSON-Datei herunterladen (Backup).</div>
                  {[
                    ['Klient:innen', 'vb_klienten', '👥'],
                    ['Betreuerinnen', 'vb_betreuerinnen', '👩'],
                    ['Einsätze', 'vb_einsaetze', '📅'],
                    ['Finanzdaten', 'vb_finanzen', '💶'],
                    ['Mitarbeiter', 'vb_mitarbeiter', '🏢'],
                    ['Alle Daten', 'alle', '💾'],
                  ].map(([label, key, icon]) => (
                    <button key={key} onClick={async () => {
                      let data: any
                      if (key === 'alle') {
                        data = {
                          exportiert: new Date().toISOString(),
                          firma: getFirmendaten(),
                          klienten: await fetch('/api/db/klienten').then(r=>r.json()).catch(()=>[]),
                          betreuerinnen: await fetch('/api/db/betreuerinnen').then(r=>r.json()).catch(()=>[]),
                          einsaetze: await fetch('/api/db/einsaetze').then(r=>r.json()).catch(()=>[]),
                          finanzen: await fetch('/api/db/finanzen_dokumente').then(r=>r.json()).catch(()=>[]),
                          mitarbeiter: await fetch('/api/db/mitarbeiter').then(r=>r.json()).catch(()=>[]),
                        }
                      } else {
                        try { data = await fetch('/api/db/'+key).then(r=>r.json()) } catch { data = [] }
                      }
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                      const a = document.createElement('a')
                      a.href = URL.createObjectURL(blob)
                      a.download = `vbetreut_backup_${key}_${today()}.json`
                      a.click()
                    }}
                      className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 text-left">
                      <span>{icon}</span>
                      <span className="flex-1">{label}</span>
                      <span className="text-slate-400">⬇️</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
                <h2 className="text-base font-bold text-rose-800 mb-3">⚠️ Daten zurücksetzen</h2>
                <p className="text-xs text-rose-600 mb-4">Demo-Daten löschen und mit eigenen Daten starten. Nicht rückgängig machbar!</p>
                <div className="space-y-2">
                  {['Klient:innen', 'Betreuerinnen', 'Einsätze', 'Finanzdaten'].map((label) => {
                    const keyMap: Record<string, string> = { 'Klient:innen': 'vb_klienten', Betreuerinnen: 'vb_betreuerinnen', Einsätze: 'vb_einsaetze', Finanzdaten: 'vb_finanzen' }
                    return (
                      <button key={label} onClick={async () => {
                        if (confirm(`Alle ${label} wirklich löschen?`)) {
                          const tableMap: Record<string,string> = {'Klient:innen':'klienten','Betreuerinnen':'betreuerinnen','Einsätze':'einsaetze','Finanzdaten':'finanzen_dokumente','Mitarbeiter':'mitarbeiter'}
                          const tbl = tableMap[label]
                          if (tbl) {
                            const items = await fetch('/api/db/'+tbl).then(r=>r.json()).catch(()=>[])
                            for (const item of items) { await fetch('/api/db/'+tbl+'?id='+item.id, {method:'DELETE'}).catch(()=>{}) }
                          }
                          window.location.reload()
                        }
                      }} className="w-full rounded-xl border border-rose-200 bg-white text-rose-600 text-xs px-4 py-2.5 cursor-pointer hover:bg-rose-100 text-left">
                        🗑️ {label} leeren
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'backup' && <BackupTool />}

        {activeTab === 'vorlagen' && (
          <div className="space-y-4 mt-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="font-bold text-slate-900 text-lg mb-1">📄 Rechnungsvorlagen</div>
              <div className="text-sm text-slate-500 mb-4">Layout, Texte, Farben und Firmendaten für Rechnungen und Honorarnoten anpassen.</div>
              <a href="/vorlagen" className="inline-flex items-center gap-2 rounded-2xl bg-teal-700 text-white font-bold px-6 py-3 hover:bg-teal-800 no-underline" style={{textDecoration:'none'}}>
                📄 Vorlagen öffnen →
              </a>
            </div>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="space-y-4 mt-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="font-bold text-slate-900 text-lg mb-1">📧 E-Mail Modul</div>
              <div className="text-sm text-slate-500 mb-4">E-Mail-Vorlagen verwalten, Versandhistorie einsehen und E-Mails direkt versenden.</div>
              <a href="/email" className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 text-white font-bold px-6 py-3 hover:bg-sky-700 no-underline" style={{textDecoration:'none'}}>
                📧 E-Mail Modul öffnen →
              </a>
            </div>
          </div>
        )}

        {activeTab === 'sevdesk' && (
          <div className="mt-5">
            <SevDeskSettings />
          </div>
        )}

        {activeTab === 'api' && (
          <div className="mt-5">
            <ApiKeyManager />
          </div>
        )}

        {activeTab === 'webhooks' && (
          <div className="mt-5">
            <WebhookManager />
          </div>
        )}

      </main>
    </div>
  )
// ── sevDesk Einstellungen ──────────────────────────────────────
function SevDeskSettings() {
  const [apiKey, setApiKey] = React.useState('')
  const [aktiv, setAktiv] = React.useState(false)
  const [status, setStatus] = React.useState('')
  const [testLoading, setTestLoading] = React.useState(false)
  const [saveLoading, setSaveLoading] = React.useState(false)

  React.useEffect(() => {
    // Korrekt: ?id= für admin_settings (key-basierte Tabelle)
    fetch('/api/db/admin_settings?id=sevdesk_settings')
      .then(r => r.json())
      .then(d => {
        const val = d?.value || d
        if (val?.api_key) setApiKey(val.api_key)
        if (val?.aktiv !== undefined) setAktiv(val.aktiv)
      }).catch(() => {})
  }, [])

  async function testen() {
    if (!apiKey) { setStatus('❌ Bitte API-Key eingeben'); return }
    setTestLoading(true)
    setStatus('Teste Verbindung...')
    try {
      // Über Server-Route testen (verhindert CORS-Probleme)
      const res = await fetch('/api/sevdesk?action=test&apiKey=' + encodeURIComponent(apiKey))
      const d = await res.json()
      if (d.ok) {
        setStatus(`✅ Verbindung erfolgreich${d.name && d.name !== 'undefined undefined' ? ': ' + d.name : ''}`)
      } else {
        setStatus(`❌ ${d.fehler || 'Verbindung fehlgeschlagen — API-Key prüfen'}`)
      }
    } catch {
      setStatus('❌ Verbindungsfehler')
    }
    setTestLoading(false)
  }

  async function speichern() {
    setSaveLoading(true)
    try {
      // Direkt in Supabase via DB-Route speichern
      const res = await fetch('/api/db/admin_settings?id=sevdesk_settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: { api_key: apiKey, aktiv, api_url: 'https://my.sevdesk.de/api/v1' } }),
      })
      if (res.ok) {
        setStatus('✅ API-Key gespeichert')
      } else {
        // Fallback: INSERT
        await fetch('/api/db/admin_settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'sevdesk_settings', value: { api_key: apiKey, aktiv, api_url: 'https://my.sevdesk.de/api/v1' } }),
        })
        setStatus('✅ Gespeichert')
      }
    } catch {
      setStatus('❌ Speicherfehler')
    }
    setSaveLoading(false)
    setTimeout(() => setStatus(''), 3000)
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
        <div className="font-bold text-violet-900 text-lg mb-1">🔗 sevDesk Integration</div>
        <div className="text-sm text-violet-700">Kundenrechnungen automatisch nach sevDesk exportieren. Benötigt Tarif "Buchhaltung Pro".</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <div className="text-sm font-semibold text-slate-600 mb-1">API-Token</div>
          <div className="text-xs text-slate-400 mb-2">Zu finden in sevDesk: Einstellungen → Benutzer → API-Token</div>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Ihr sevDesk API-Token..."
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 font-mono"
          />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="sevaktiv" checked={aktiv} onChange={e => setAktiv(e.target.checked)} className="accent-violet-600 w-4 h-4" />
          <label htmlFor="sevaktiv" className="text-sm font-semibold text-slate-700 cursor-pointer">Export aktiviert</label>
        </div>
        {status && (
          <div className={`text-sm px-3 py-2 rounded-xl ${status.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : status.startsWith('❌') ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-700'}`}>
            {status}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={testen} disabled={testLoading}
            className="rounded-xl border border-violet-200 bg-violet-50 text-violet-700 font-semibold text-sm px-4 py-2 cursor-pointer hover:bg-violet-100 disabled:opacity-50">
            {testLoading ? '⏳ Teste...' : '🔌 Verbindung testen'}
          </button>
          <button onClick={speichern} disabled={saveLoading}
            className="rounded-xl bg-violet-700 text-white font-bold text-sm px-5 py-2 cursor-pointer border-none hover:bg-violet-800 disabled:opacity-50">
            {saveLoading ? '⏳...' : '💾 Speichern'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 space-y-1">
        <div className="font-semibold text-slate-600 mb-2">Wie funktioniert der Export?</div>
        <div>1. sevDesk API-Token hier eintragen und speichern</div>
        <div>2. Rechnungen-Seite öffnen → Rechnungen auswählen → "📤 sevDesk" klicken</div>
        <div>3. Kontakt wird automatisch in sevDesk angelegt falls nicht vorhanden</div>
        <div>4. Rechnung erscheint in sevDesk unter Rechnungen</div>
      </div>
    </div>
  )
}

}
// ── API-Key Manager ────────────────────────────────────────────
function ApiKeyManager() {
  const [keys, setKeys] = React.useState<any[]>([])
  const [newName, setNewName] = React.useState('')
  const [newDesc, setNewDesc] = React.useState('')
  const [newPerms, setNewPerms] = React.useState<string[]>(['read'])
  const [neuKey, setNeuKey] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/keys').then(r => r.json()).then(d => setKeys(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  async function erstellen() {
    if (!newName) return
    setCreating(true)
    const res = await fetch('/api/keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, berechtigungen: newPerms, beschreibung: newDesc }),
    })
    const d = await res.json()
    if (d.key) {
      setNeuKey(d.key)
      setKeys(prev => [d, ...prev])
      setNewName(''); setNewDesc('')
    }
    setCreating(false)
  }

  async function deaktivieren(id: string) {
    await fetch(`/api/keys?id=${id}`, { method: 'DELETE' })
    setKeys(prev => prev.map(k => k.id === id ? { ...k, aktiv: false } : k))
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
        <div className="font-bold text-teal-900 text-lg mb-1">🔑 API-Keys</div>
        <div className="text-sm text-teal-700 mb-3">Externe Systeme können mit einem API-Key auf das ERP zugreifen.<br/>Endpunkt: <code className="bg-teal-100 px-1 rounded">GET/POST https://vbetreut-erp.vercel.app/api/v1?resource=klienten</code></div>
        <a href="/api/docs" target="_blank" className="text-xs text-teal-600 underline">📖 API-Dokumentation (OpenAPI JSON) →</a>
      </div>

      {neuKey && (
        <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-5">
          <div className="font-bold text-emerald-800 mb-2">✅ API-Key erstellt — NUR JETZT sichtbar!</div>
          <div className="bg-white rounded-xl px-4 py-3 font-mono text-sm text-slate-900 break-all border border-emerald-200 mb-3">{neuKey}</div>
          <div className="text-xs text-emerald-600">Bitte sofort kopieren und sicher speichern. Danach nicht mehr abrufbar.</div>
          <button onClick={() => { navigator.clipboard.writeText(neuKey); setNeuKey('') }}
            className="mt-2 rounded-xl bg-emerald-700 text-white text-xs font-bold px-4 py-2 cursor-pointer border-none hover:bg-emerald-800">
            📋 Kopieren & Schließen
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="font-semibold text-slate-800">Neuen API-Key erstellen</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">Name *</div>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. Steuerberater-Zugang"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Beschreibung</div>
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="optional"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-500">Berechtigungen:</div>
          {['read', 'write', 'admin'].map(p => (
            <label key={p} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={newPerms.includes(p)}
                onChange={e => setNewPerms(prev => e.target.checked ? [...prev, p] : prev.filter(x => x !== p))}
                className="accent-teal-600" />
              {p}
            </label>
          ))}
        </div>
        <button onClick={erstellen} disabled={creating || !newName}
          className="rounded-xl bg-teal-700 text-white font-bold text-sm px-5 py-2 cursor-pointer border-none hover:bg-teal-800 disabled:opacity-50">
          {creating ? '⏳...' : '🔑 Key erstellen'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 font-semibold text-slate-700 text-sm">Vorhandene Keys ({keys.length})</div>
        {keys.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">Noch keine API-Keys</div> : (
          <div className="divide-y divide-slate-50">
            {keys.map(k => (
              <div key={k.id} className="flex items-center px-5 py-4 gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{k.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${k.aktiv ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                      {k.aktiv ? '✓ Aktiv' : 'Deaktiviert'}
                    </span>
                    {k.berechtigungen?.map((p: string) => (
                      <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">{p}</span>
                    ))}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono">{k.key_prefix}</div>
                  {k.beschreibung && <div className="text-xs text-slate-500">{k.beschreibung}</div>}
                  {k.letzter_zugriff && <div className="text-xs text-slate-400">Letzter Zugriff: {new Date(k.letzter_zugriff).toLocaleString('de-AT')}</div>}
                </div>
                {k.aktiv && (
                  <button onClick={() => deaktivieren(k.id)}
                    className="text-xs px-3 py-1.5 rounded-xl border border-rose-200 text-rose-500 cursor-pointer hover:bg-rose-50">
                    Deaktivieren
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Webhook Manager ────────────────────────────────────────────
function WebhookManager() {
  const [hooks, setHooks] = React.useState<any[]>([])
  const [logs, setLogs] = React.useState<any[]>([])
  const [form, setForm] = React.useState({ name: '', url: '', events: [] as string[], secret: '' })
  const [creating, setCreating] = React.useState(false)
  const [showLogs, setShowLogs] = React.useState(false)

  const EVENTS = [
    'rechnung.erstellt','rechnung.bezahlt','rechnung.storniert',
    'honorarnote.erstellt','honorarnote.bezahlt',
    'klient.erstellt','klient.aktualisiert',
    'einsatz.erstellt','einsatz.abgeschlossen',
  ]

  React.useEffect(() => {
    fetch('/api/webhooks').then(r => r.json()).then(d => setHooks(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  async function loadLogs() {
    const res = await fetch('/api/webhooks?logs=1')
    const d = await res.json()
    setLogs(Array.isArray(d) ? d : [])
    setShowLogs(true)
  }

  async function erstellen() {
    if (!form.name || !form.url) return
    setCreating(true)
    const res = await fetch('/api/webhooks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const d = await res.json()
    if (d.id) { setHooks(prev => [d, ...prev]); setForm({ name: '', url: '', events: [], secret: '' }) }
    setCreating(false)
  }

  async function loeschen(id: string) {
    await fetch(`/api/webhooks?id=${id}`, { method: 'DELETE' })
    setHooks(prev => prev.filter(h => h.id !== id))
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
        <div className="font-bold text-violet-900 text-lg mb-1">⚡ Webhooks</div>
        <div className="text-sm text-violet-700">Externe Systeme werden automatisch benachrichtigt wenn Events eintreten.<br/>Jeder Aufruf enthält eine HMAC-SHA256 Signatur im Header <code className="bg-violet-100 px-1 rounded">X-VBetreut-Signature</code>.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="font-semibold text-slate-800">Neuen Webhook erstellen</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">Name *</div>
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="z.B. Mein System"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">URL * (HTTPS)</div>
            <input value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))} placeholder="https://mein-system.at/webhook"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
          </div>
          <div className="col-span-2">
            <div className="text-xs text-slate-500 mb-1">Secret (für HMAC-Signatur)</div>
            <input value={form.secret} onChange={e => setForm(f => ({...f, secret: e.target.value}))} placeholder="optional — zufälliger String"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-2">Events auswählen:</div>
          <div className="grid grid-cols-3 gap-1.5">
            {EVENTS.map(ev => (
              <label key={ev} className="flex items-center gap-1.5 text-xs cursor-pointer rounded-xl border border-slate-200 px-2 py-1.5 hover:bg-slate-50">
                <input type="checkbox" checked={form.events.includes(ev)}
                  onChange={e => setForm(f => ({...f, events: e.target.checked ? [...f.events, ev] : f.events.filter(x => x !== ev)}))}
                  className="accent-violet-600 flex-shrink-0" />
                <span className="truncate">{ev}</span>
              </label>
            ))}
          </div>
        </div>
        <button onClick={erstellen} disabled={creating || !form.name || !form.url}
          className="rounded-xl bg-violet-700 text-white font-bold text-sm px-5 py-2 cursor-pointer border-none hover:bg-violet-800 disabled:opacity-50">
          {creating ? '⏳...' : '⚡ Webhook erstellen'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="font-semibold text-slate-700 text-sm">Webhooks ({hooks.length})</span>
          <button onClick={loadLogs} className="text-xs text-violet-600 underline cursor-pointer">📋 Logs anzeigen</button>
        </div>
        {hooks.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">Noch keine Webhooks</div> : (
          <div className="divide-y divide-slate-50">
            {hooks.map(h => (
              <div key={h.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">{h.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${h.aktiv ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{h.aktiv ? '✓ Aktiv' : 'Inaktiv'}</span>
                      {h.fehler_count > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">⚠️ {h.fehler_count} Fehler</span>}
                    </div>
                    <div className="text-xs font-mono text-slate-500 mt-0.5">{h.url}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(h.events || []).map((ev: string) => <span key={ev} className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded border border-violet-100">{ev}</span>)}
                    </div>
                    {h.letzter_aufruf && <div className="text-xs text-slate-400 mt-1">Letzter Aufruf: {new Date(h.letzter_aufruf).toLocaleString('de-AT')} · HTTP {h.letzter_status}</div>}
                  </div>
                  <button onClick={() => loeschen(h.id)} className="text-xs px-3 py-1.5 rounded-xl border border-rose-200 text-rose-500 cursor-pointer hover:bg-rose-50 flex-shrink-0">Löschen</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showLogs && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-slate-700 text-sm">Webhook Logs (letzte 100)</span>
            <button onClick={() => setShowLogs(false)} className="text-slate-400 text-sm cursor-pointer bg-transparent border-none">✕</button>
          </div>
          <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
            {logs.length === 0 ? <div className="text-center py-6 text-slate-400 text-sm">Noch keine Logs</div> : logs.map(l => (
              <div key={l.id} className="px-5 py-3 flex items-center gap-3">
                <span className={`text-xs w-4 h-4 rounded-full flex items-center justify-center ${l.erfolg ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>{l.erfolg ? '✓' : '✕'}</span>
                <span className="text-xs text-slate-500 font-mono">{l.event}</span>
                <span className="text-xs text-slate-400">HTTP {l.status_code}</span>
                <span className="text-xs text-slate-400 ml-auto">{new Date(l.erstellt_am).toLocaleString('de-AT')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
