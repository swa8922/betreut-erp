'use client'
/**
 * DokumentationsNotiz — Intelligentes Notiz- und Dokumentations-Tool
 * Passt ins VBetreut Design (teal, rounded-3xl, slate)
 * Für Betreuerinnen und Klienten
 */
import { useState, useRef, useCallback } from 'react'

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface Notizeintrag {
  id: string
  typ: string
  medium: string
  datum: string
  uhrzeit: string
  text: string
  privat: boolean
  anhaenge: Anhang[]
  erstellt_am: string
  erstellt_von: string
  bearbeitet_am?: string
}

export interface Anhang {
  name: string
  typ: string      // 'image' | 'pdf' | 'doc' | 'other'
  base64: string
  groesse: number  // bytes
}

const TYPEN = [
  'Telefonat', 'E-Mail', 'Persönliches Gespräch', 'Hausbesuch',
  'WhatsApp', 'Notiz', 'Beschwerde', 'Lob', 'Übergabe',
  'Medizinisch', 'Finanzen', 'Behördengang', 'Sonstiges'
]

const MEDIEN = [
  'Telefon', 'E-Mail', 'WhatsApp', 'Vor Ort', 'Video-Call', 'Brief', 'Fax', 'Intern'
]

const TYP_ICONS: Record<string, string> = {
  'Telefonat': '📞', 'E-Mail': '✉️', 'Persönliches Gespräch': '💬',
  'Hausbesuch': '🏠', 'WhatsApp': '💚', 'Notiz': '📝',
  'Beschwerde': '⚠️', 'Lob': '⭐', 'Übergabe': '🔄',
  'Medizinisch': '🏥', 'Finanzen': '💶', 'Behördengang': '🏛️',
  'Sonstiges': '📋',
}

const TYP_FARBEN: Record<string, string> = {
  'Beschwerde': 'border-rose-200 bg-rose-50',
  'Lob': 'border-amber-200 bg-amber-50',
  'Medizinisch': 'border-sky-200 bg-sky-50',
  'Behördengang': 'border-violet-200 bg-violet-50',
  'Übergabe': 'border-teal-200 bg-teal-50',
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

function formatDateDE(iso: string) {
  if (!iso) return ''
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('de-AT') } catch { return iso }
}

function formatDateTime(iso: string) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return iso }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ─── Eingabe-Formular ─────────────────────────────────────────────────────────

function EingabeFormular({
  onSave, onCancel, initial, userName
}: {
  onSave: (e: Notizeintrag) => void
  onCancel?: () => void
  initial?: Notizeintrag
  userName?: string
}) {
  const [typ, setTyp] = useState(initial?.typ || '')
  const [medium, setMedium] = useState(initial?.medium || '')
  const [datum, setDatum] = useState(initial?.datum || new Date().toISOString().split('T')[0])
  const [uhrzeit, setUhrzeit] = useState(initial?.uhrzeit || new Date().toTimeString().slice(0, 5))
  const [text, setText] = useState(initial?.text || '')
  const [privat, setPrivat] = useState(initial?.privat || false)
  const [anhaenge, setAnhaenge] = useState<Anhang[]>(initial?.anhaenge || [])
  const [formatting, setFormatting] = useState<Record<string, boolean>>({})
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Rich-Text Formatierung (Markdown-ähnlich im Textarea)
  function insertFormat(prefix: string, suffix = prefix) {
    const ta = textRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const sel = text.slice(start, end)
    const newText = text.slice(0, start) + prefix + (sel || 'Text') + suffix + text.slice(end)
    setText(newText)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + prefix.length, start + prefix.length + (sel || 'Text').length)
    }, 0)
  }

  async function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = ev => {
      const base64 = (ev.target?.result as string).split(',')[1]
      const typ = file.type.startsWith('image/') ? 'image'
        : file.type.includes('pdf') ? 'pdf'
        : file.type.includes('word') || file.type.includes('openxml') ? 'doc'
        : 'other'
      setAnhaenge(prev => [...prev, { name: file.name, typ, base64, groesse: file.size }])
    }
    reader.readAsDataURL(file)
  }

  function speichern() {
    if (!text.trim()) return
    const eintrag: Notizeintrag = {
      id: initial?.id || uid(),
      typ: typ || 'Notiz',
      medium: medium || '',
      datum,
      uhrzeit,
      text,
      privat,
      anhaenge,
      erstellt_am: initial?.erstellt_am || new Date().toISOString(),
      erstellt_von: initial?.erstellt_von || userName || '',
      ...(initial ? { bearbeitet_am: new Date().toISOString() } : {}),
    }
    onSave(eintrag)
    if (!initial) {
      // Reset
      setTyp(''); setMedium(''); setText(''); setPrivat(false); setAnhaenge([])
    }
  }

  const TOOLBAR = [
    { label: 'F', title: 'Fett', action: () => insertFormat('**') },
    { label: 'K', title: 'Kursiv', action: () => insertFormat('_') },
    { label: 'U', title: 'Unterstrichen', action: () => insertFormat('<u>', '</u>') },
    { label: '•', title: 'Aufzählung', action: () => { setText(t => t + '\n• ') } },
    { label: '1.', title: 'Nummerierung', action: () => { setText(t => t + '\n1. ') } },
    { label: 'A', title: 'Wichtig', action: () => insertFormat('⚠️ ', '') },
  ]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Typ + Medium */}
      <div className="grid grid-cols-2 gap-0 border-b border-slate-100">
        <div className="border-r border-slate-100">
          <select value={typ} onChange={e => setTyp(e.target.value)}
            className="w-full px-4 py-3 text-sm text-slate-700 bg-transparent border-none outline-none cursor-pointer">
            <option value="">Typ (z.B. Telefonat, Notiz...)</option>
            {TYPEN.map(t => <option key={t} value={t}>{TYP_ICONS[t]} {t}</option>)}
          </select>
        </div>
        <div>
          <select value={medium} onChange={e => setMedium(e.target.value)}
            className="w-full px-4 py-3 text-sm text-slate-700 bg-transparent border-none outline-none cursor-pointer">
            <option value="">Medium (Telefon, Einsatz...)</option>
            {MEDIEN.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Datum + Uhrzeit */}
      <div className="grid grid-cols-2 gap-0 border-b border-slate-100">
        <div className="border-r border-slate-100">
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
            className="w-full px-4 py-3 text-sm text-slate-700 bg-transparent border-none outline-none" />
        </div>
        <div>
          <input type="time" value={uhrzeit} onChange={e => setUhrzeit(e.target.value)}
            className="w-full px-4 py-3 text-sm text-slate-700 bg-transparent border-none outline-none" />
        </div>
      </div>

      {/* Datei-Upload */}
      <div
        className="border-b border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-all"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(handleFile) }}
      >
        {anhaenge.length === 0 ? (
          <div className="text-center text-sm text-slate-400">
            Dateien hier ablegen oder klicken zum Hochladen
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {anhaenge.map((a, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2 py-1 text-xs text-slate-600">
                <span>{a.typ === 'image' ? '🖼️' : a.typ === 'pdf' ? '📄' : '📎'}</span>
                <span className="max-w-[120px] truncate">{a.name}</span>
                <span className="text-slate-400">{formatBytes(a.groesse)}</span>
                <button onClick={ev => { ev.stopPropagation(); setAnhaenge(prev => prev.filter((_, j) => j !== i)) }}
                  className="text-slate-400 hover:text-rose-500 bg-transparent border-none cursor-pointer ml-0.5">✕</button>
              </div>
            ))}
            <div className="flex items-center text-xs text-teal-600 cursor-pointer hover:text-teal-800">+ weitere</div>
          </div>
        )}
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={e => Array.from(e.target.files || []).forEach(handleFile)} />
      </div>

      {/* Toolbar + Textarea */}
      <div className="border-b border-slate-100">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-slate-100">
          {TOOLBAR.map(btn => (
            <button key={btn.label} title={btn.title} onClick={btn.action}
              className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer bg-transparent border-none transition-all min-w-[28px]">
              {btn.label === 'U' ? <span className="underline">{btn.label}</span>
               : btn.label === 'F' ? <span className="font-extrabold">{btn.label}</span>
               : btn.label === 'K' ? <span className="italic">{btn.label}</span>
               : btn.label}
            </button>
          ))}
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button onClick={() => setText(t => t + '\n---\n')}
            title="Trennlinie"
            className="rounded-lg px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-100 cursor-pointer bg-transparent border-none">
            ─
          </button>
        </div>
        {/* Textarea */}
        <textarea
          ref={textRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.ctrlKey) speichern()
          }}
          placeholder="Dokumentation hier eingeben... (Strg+Enter zum Speichern)"
          rows={5}
          className="w-full px-4 py-3 text-sm text-slate-800 bg-transparent border-none outline-none resize-y font-sans leading-relaxed placeholder:text-slate-400"
          style={{ minHeight: 120 }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/50">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={privat} onChange={e => setPrivat(e.target.checked)}
            className="rounded accent-teal-600 w-4 h-4" />
          <span className="text-xs text-slate-600">Privat</span>
        </label>
        <div className="flex gap-2">
          {onCancel && (
            <button onClick={onCancel}
              className="rounded-xl border border-slate-200 text-slate-600 text-sm px-4 py-2 cursor-pointer hover:bg-slate-100 bg-white">
              Abbrechen
            </button>
          )}
          <button onClick={speichern} disabled={!text.trim()}
            className="rounded-xl bg-teal-700 text-white text-sm font-bold px-5 py-2 cursor-pointer border-none hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {initial ? 'Aktualisieren' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Eintrag-Anzeige ──────────────────────────────────────────────────────────

function EintragKarte({
  eintrag, onEdit, onDelete, canEdit
}: {
  eintrag: Notizeintrag
  onEdit: (e: Notizeintrag) => void
  onDelete: (id: string) => void
  canEdit: boolean
}) {
  const [expand, setExpand] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const farbe = TYP_FARBEN[eintrag.typ] || 'border-slate-200 bg-white'
  const icon = TYP_ICONS[eintrag.typ] || '📋'

  // Einfaches Markdown-Rendering
  function renderText(t: string) {
    return t
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
      .replace(/^• /gm, '&bull; ')
      .replace(/\n---\n/g, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:6px 0"/>')
      .replace(/\n/g, '<br/>')
  }

  const kurzText = eintrag.text.length > 150 && !expand
    ? eintrag.text.slice(0, 150) + '...'
    : eintrag.text

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all shadow-sm ${farbe}`}>
      {showEdit ? (
        <div className="p-3">
          <EintragAnzeigeForm
            initial={eintrag}
            onSave={updated => { onEdit(updated); setShowEdit(false) }}
            onCancel={() => setShowEdit(false)}
          />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start gap-3 px-4 py-3">
            <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900 text-sm">{eintrag.typ || 'Notiz'}</span>
                {eintrag.medium && (
                  <span className="text-xs text-slate-400">· {eintrag.medium}</span>
                )}
                {eintrag.privat && (
                  <span className="text-[10px] rounded-full bg-slate-200 text-slate-600 px-2 py-0.5">🔒 Privat</span>
                )}
                {eintrag.anhaenge.length > 0 && (
                  <span className="text-[10px] rounded-full bg-teal-100 text-teal-700 px-2 py-0.5">
                    📎 {eintrag.anhaenge.length}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{formatDateDE(eintrag.datum)}{eintrag.uhrzeit ? ` · ${eintrag.uhrzeit} Uhr` : ''}</span>
                {eintrag.erstellt_von && <span>· {eintrag.erstellt_von}</span>}
                {eintrag.bearbeitet_am && <span>· bearbeitet</span>}
              </div>
            </div>
            {canEdit && (
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setShowEdit(true)}
                  className="rounded-lg border border-slate-200 bg-white/80 text-slate-500 text-xs px-2 py-1 cursor-pointer hover:bg-white hover:text-slate-800">✏️</button>
                <button onClick={() => onDelete(eintrag.id)}
                  className="rounded-lg border border-slate-200 bg-white/80 text-slate-400 text-xs px-2 py-1 cursor-pointer hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200">✕</button>
              </div>
            )}
          </div>

          {/* Text */}
          <div className="px-4 pb-3">
            <div
              className="text-sm text-slate-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderText(kurzText) }}
            />
            {eintrag.text.length > 150 && (
              <button onClick={() => setExpand(!expand)}
                className="text-xs text-teal-600 hover:underline cursor-pointer bg-transparent border-none mt-1">
                {expand ? 'Weniger anzeigen' : 'Mehr anzeigen'}
              </button>
            )}
          </div>

          {/* Anhänge */}
          {eintrag.anhaenge.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {eintrag.anhaenge.map((a, i) => (
                <a key={i}
                  href={`data:${a.typ === 'image' ? 'image/jpeg' : a.typ === 'pdf' ? 'application/pdf' : 'application/octet-stream'};base64,${a.base64}`}
                  download={a.name}
                  className="flex items-center gap-1.5 rounded-lg bg-white/80 border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-white no-underline">
                  {a.typ === 'image' ? '🖼️' : a.typ === 'pdf' ? '📄' : '📎'}
                  <span className="max-w-[100px] truncate">{a.name}</span>
                  <span className="text-slate-400">{formatBytes(a.groesse)}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Inline-Edit Formular (ohne Datei-Upload, minimaler)
function EintragAnzeigeForm({ initial, onSave, onCancel }: { initial: Notizeintrag; onSave: (e: Notizeintrag) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial.text)
  const [typ, setTyp] = useState(initial.typ)
  return (
    <div className="space-y-2">
      <select value={typ} onChange={e => setTyp(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white">
        {TYPEN.map(t => <option key={t} value={t}>{TYP_ICONS[t]} {t}</option>)}
      </select>
      <textarea value={text} onChange={e => setText(e.target.value)}
        rows={4} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none resize-none" />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="rounded-xl border border-slate-200 text-slate-600 text-xs px-3 py-2 cursor-pointer bg-white">Abbrechen</button>
        <button onClick={() => onSave({ ...initial, typ, text, bearbeitet_am: new Date().toISOString() })}
          className="rounded-xl bg-teal-700 text-white text-xs px-3 py-2 cursor-pointer border-none hover:bg-teal-800">Speichern</button>
      </div>
    </div>
  )
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

interface Props {
  eintraege: Notizeintrag[]
  onChange: (eintraege: Notizeintrag[]) => void
  canGF?: boolean
  userName?: string
  // Einfache Notiz (alter Modus) für Rückwärtskompatibilität
  notiz?: string
  onNotizChange?: (v: string) => void
  internNotiz?: string
  onInternNotizChange?: (v: string) => void
  label?: string
}

export default function DokumentationsNotiz({
  eintraege = [], onChange, canGF = false, userName = '',
  notiz, onNotizChange, internNotiz, onInternNotizChange, label
}: Props) {
  const [filter, setFilter] = useState('')
  const [filterTyp, setFilterTyp] = useState('')
  const [showNeu, setShowNeu] = useState(eintraege.length === 0)
  const [showAlt, setShowAlt] = useState(false)

  function addEintrag(e: Notizeintrag) {
    onChange([e, ...eintraege])
    setShowNeu(false)
  }

  function editEintrag(updated: Notizeintrag) {
    onChange(eintraege.map(e => e.id === updated.id ? updated : e))
  }

  function deleteEintrag(id: string) {
    if (!confirm('Eintrag löschen?')) return
    onChange(eintraege.filter(e => e.id !== id))
  }

  const gefiltertE = eintraege.filter(e => {
    if (filterTyp && e.typ !== filterTyp) return false
    if (filter && !e.text.toLowerCase().includes(filter.toLowerCase()) &&
        !e.typ.toLowerCase().includes(filter.toLowerCase())) return false
    if (e.privat && !canGF) return false
    return true
  })

  const typenVorhanden = [...new Set(eintraege.map(e => e.typ))].filter(Boolean)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-slate-900 text-sm">
            📋 {label || 'Dokumentation & Notizen'}
          </h3>
          {eintraege.length > 0 && (
            <span className="rounded-full bg-teal-100 text-teal-700 text-xs px-2 py-0.5 font-semibold">
              {eintraege.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Alter Modus */}
          {(onNotizChange || onInternNotizChange) && (
            <button onClick={() => setShowAlt(!showAlt)}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none">
              {showAlt ? '↑ Einfach' : '··· Einfache Notiz'}
            </button>
          )}
          <button onClick={() => setShowNeu(!showNeu)}
            className={`rounded-xl text-sm font-bold px-4 py-2 cursor-pointer border-none transition-all ${
              showNeu
                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                : 'bg-teal-700 text-white hover:bg-teal-800 shadow-sm'
            }`}>
            {showNeu ? '↑ Schließen' : '+ Neue Dokumentation'}
          </button>
        </div>
      </div>

      {/* Einfacher Notiz-Modus (Legacy) */}
      {showAlt && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          {onNotizChange && (
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Allgemeine Notiz</label>
              <textarea value={notiz || ''} onChange={e => onNotizChange?.(e.target.value)}
                rows={3} placeholder="Freie Notiz..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400 resize-none" />
            </div>
          )}
          {canGF && onInternNotizChange && (
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">🔒 Interne Notiz (nur GF)</label>
              <textarea value={internNotiz || ''} onChange={e => onInternNotizChange?.(e.target.value)}
                rows={3} placeholder="Intern..."
                className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm outline-none focus:border-amber-400 resize-none" />
            </div>
          )}
        </div>
      )}

      {/* Neuer Eintrag Formular */}
      {showNeu && (
        <EingabeFormular
          onSave={addEintrag}
          onCancel={eintraege.length > 0 ? () => setShowNeu(false) : undefined}
          userName={userName}
        />
      )}

      {/* Filter */}
      {eintraege.length > 2 && (
        <div className="flex items-center gap-2">
          <input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="🔍 Suchen..."
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400" />
          <select value={filterTyp} onChange={e => setFilterTyp(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none cursor-pointer">
            <option value="">Alle Typen</option>
            {typenVorhanden.map(t => <option key={t} value={t}>{TYP_ICONS[t]} {t}</option>)}
          </select>
        </div>
      )}

      {/* Einträge Liste */}
      {gefiltertE.length === 0 && !showNeu && (
        <div className="text-center py-10 text-slate-400">
          <div className="text-3xl mb-2">📝</div>
          <div className="text-sm">Noch keine Dokumentation vorhanden</div>
          <button onClick={() => setShowNeu(true)}
            className="mt-3 text-teal-600 text-sm hover:underline cursor-pointer bg-transparent border-none">
            + Erste Dokumentation erstellen
          </button>
        </div>
      )}

      <div className="space-y-3">
        {gefiltertE.map(e => (
          <EintragKarte
            key={e.id}
            eintrag={e}
            onEdit={editEintrag}
            onDelete={deleteEintrag}
            canEdit={canGF || e.erstellt_von === userName}
          />
        ))}
      </div>
    </div>
  )
}
