'use client'
import { useState, useRef } from 'react'
import clsx from 'clsx'

export interface DokumentLeseErgebnis {
  text: string
  html: string
  dateiName: string
  dateiTyp: 'docx' | 'pdf' | 'txt' | 'sonstig'
  base64: string       // data:mediaType;base64,... for storage
  mediaType: string
}

interface Props {
  onErgebnis: (r: DokumentLeseErgebnis) => void
  onAbbrechen: () => void
  erlaubteTypen?: string[]
  titel?: string
  hinweis?: string
}

export default function DokumentReader({
  onErgebnis,
  onAbbrechen,
  erlaubteTypen = ['.docx', '.doc', '.pdf', '.txt'],
  titel = 'Dokument hochladen & lesen',
  hinweis,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [lesen, setLesen] = useState(false)
  const [status, setStatus] = useState('')
  const [fehler, setFehler] = useState('')
  const [vorschau, setVorschau] = useState<DokumentLeseErgebnis | null>(null)
  const [drag, setDrag] = useState(false)

  async function verarbeite(file: File) {
    setLesen(true)
    setFehler('')
    setVorschau(null)

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const mediaType = file.type ||
      (ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
       ext === 'doc'  ? 'application/msword' :
       ext === 'pdf'  ? 'application/pdf' :
       ext === 'txt'  ? 'text/plain' : 'application/octet-stream')

    setStatus(
      ext === 'pdf'  ? 'PDF wird über KI ausgelesen ...' :
      ext === 'docx' ? 'Word-Dokument wird eingelesen ...' :
      'Datei wird gelesen ...'
    )

    try {
      // Read file as Base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => {
          const result = e.target?.result as string
          // result is "data:...;base64,XXXX" — we want only XXXX
          resolve(result.split(',')[1] || '')
        }
        reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'))
        reader.readAsDataURL(file)
      })

      if (!base64) throw new Error('Leere Datei')

      // Send to server-side route which handles mammoth + Claude API
      const res = await fetch('/api/dokument-lesen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64,
          dateiName: file.name,
          mediaType,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.fehler) {
        setFehler(data.fehler || `Server-Fehler ${res.status}`)
        if (!data.ok) {
          setLesen(false)
          setStatus('')
          return
        }
      }

      if (data.warnungen?.length > 0) {
        console.warn('Dokument-Warnungen:', data.warnungen)
      }

      const ergebnis: DokumentLeseErgebnis = {
        text: data.text || '',
        html: data.html || '',
        dateiName: file.name,
        dateiTyp: data.dateiTyp || 'sonstig',
        base64: `data:${mediaType};base64,${base64}`,
        mediaType,
      }

      setVorschau(ergebnis)
    } catch (e: any) {
      setFehler(e.message || 'Unbekannter Fehler')
    } finally {
      setLesen(false)
      setStatus('')
    }
  }

  function handleFiles(files: FileList | null) {
    if (files && files.length > 0) verarbeite(files[0])
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/50 overflow-y-auto pt-8 pb-8 p-4"
      onClick={onAbbrechen}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-7 py-5 flex items-center justify-between">
          <div>
            <div className="text-xs text-white/60 uppercase tracking-widest mb-0.5">Dokumenten-Leser</div>
            <h2 className="text-xl font-bold text-white">{titel}</h2>
          </div>
          <button
            onClick={onAbbrechen}
            className="text-white/70 hover:text-white text-2xl cursor-pointer bg-transparent border-none"
          >✕</button>
        </div>

        <div className="p-6 space-y-5">

          {/* Upload-Zone (wenn noch kein Ergebnis) */}
          {!vorschau && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files) }}
                onClick={() => !lesen && inputRef.current?.click()}
                className={clsx(
                  'rounded-2xl border-2 border-dashed p-12 text-center transition-all',
                  lesen
                    ? 'cursor-wait border-teal-300 bg-teal-50'
                    : drag
                    ? 'cursor-copy border-teal-400 bg-teal-50 scale-[1.01]'
                    : 'cursor-pointer border-slate-300 bg-slate-50 hover:border-teal-400 hover:bg-teal-50'
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={erlaubteTypen.join(',')}
                  onChange={e => handleFiles(e.target.files)}
                  className="hidden"
                />

                {lesen ? (
                  <div>
                    <div className="text-5xl mb-4 animate-pulse">⏳</div>
                    <div className="text-lg font-semibold text-teal-700 mb-2">{status}</div>
                    <div className="flex justify-center gap-1 mt-3">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-bounce"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-slate-400 mt-4">
                      Word-Dokumente und PDFs werden server-seitig verarbeitet
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-5xl mb-4">📂</div>
                    <div className="text-lg font-semibold text-slate-700 mb-1">
                      Datei hierher ziehen oder klicken
                    </div>
                    <div className="text-sm text-slate-400 mb-5">
                      Word (.docx), PDF, Textdateien (.txt)
                    </div>
                    <div className="flex justify-center gap-3">
                      {[
                        { label: 'Word', icon: '📝', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                        { label: 'PDF',  icon: '📄', color: 'bg-rose-50 text-rose-700 border-rose-200' },
                        { label: 'Text', icon: '📃', color: 'bg-slate-100 text-slate-600 border-slate-200' },
                      ].map(t => (
                        <span key={t.label} className={clsx('rounded-xl border px-4 py-2 text-xs font-semibold', t.color)}>
                          {t.icon} {t.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {hinweis && (
                <div className="rounded-2xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-800">
                  ℹ️ {hinweis}
                </div>
              )}

              {fehler && (
                <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
                  <strong>❌ Fehler:</strong> {fehler}
                </div>
              )}
            </>
          )}

          {/* Ergebnis-Vorschau */}
          {vorschau && (
            <div className="space-y-4">

              {/* Datei-Info Banner */}
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3">
                <span className="text-2xl">
                  {vorschau.dateiTyp === 'pdf' ? '📄' : vorschau.dateiTyp === 'docx' ? '📝' : '📃'}
                </span>
                <div className="flex-1">
                  <div className="font-semibold text-emerald-900">{vorschau.dateiName}</div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    {vorschau.dateiTyp.toUpperCase()}
                    {vorschau.text ? ` · ${vorschau.text.length.toLocaleString('de-AT')} Zeichen extrahiert` : ''}
                    {fehler ? ' · ⚠️ Teilweise eingelesen' : ' · ✅ Erfolgreich eingelesen'}
                  </div>
                </div>
                <button
                  onClick={() => { setVorschau(null); setFehler('') }}
                  className="text-emerald-600 text-xs px-3 py-1.5 rounded-xl border border-emerald-300 cursor-pointer hover:bg-emerald-100"
                >
                  ✕ Andere Datei
                </button>
              </div>

              {fehler && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  ⚠️ {fehler}
                </div>
              )}

              {/* Textvorschau */}
              {vorschau.text && (
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Extrahierter Text (erste 500 Zeichen)
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700 leading-relaxed max-h-40 overflow-y-auto font-mono whitespace-pre-wrap">
                    {vorschau.text.slice(0, 500)}{vorschau.text.length > 500 ? '\n…' : ''}
                  </div>
                </div>
              )}

              {/* HTML-Vorschau für Word-Dokumente */}
              {vorschau.dateiTyp === 'docx' && vorschau.html && (
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Formatierte Vorschau
                  </div>
                  <div
                    className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-700 leading-relaxed max-h-64 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: vorschau.html }}
                  />
                </div>
              )}

              {/* Keine Inhalte */}
              {!vorschau.text && !vorschau.html && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  ⚠️ Kein Text extrahiert. Die Datei wurde hochgeladen aber der Inhalt konnte nicht gelesen werden.
                  {vorschau.dateiTyp === 'pdf' && ' Prüfen Sie ob der ANTHROPIC_API_KEY in .env.local eingetragen ist.'}
                  {vorschau.dateiTyp === 'docx' && ' Versuchen Sie das Dokument als PDF oder TXT zu speichern.'}
                </div>
              )}

              {/* Aktions-Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onAbbrechen}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => { setVorschau(null); setFehler('') }}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-50"
                >
                  Andere Datei
                </button>
                <button
                  onClick={() => onErgebnis(vorschau)}
                  className="flex-1 rounded-2xl bg-teal-700 text-white px-6 py-3 text-sm font-bold cursor-pointer border-none hover:bg-teal-800"
                >
                  ✓ Dokument übernehmen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
