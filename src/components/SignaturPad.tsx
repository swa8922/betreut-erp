'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'

export interface SignaturDaten {
  dataUrl: string          // PNG Base64
  unterzeichnetVon: string
  unterzeichnetAm: string
  unterzeichnetUm: string
  ipHinweis: string
}

interface Props {
  onSave: (sig: SignaturDaten) => void
  onAbbrechen: () => void
  unterzeichnerName: string   // z.B. Klient- oder Betreuerinname
  dokumentTitel: string
  hinweisText?: string
}

export default function SignaturPad({ onSave, onAbbrechen, unterzeichnerName, dokumentTitel, hinweisText }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zeichnet, setZeichnet] = useState(false)
  const [hatZeichnung, setHatZeichnung] = useState(false)
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null)
  const [strichBreite, setStrichBreite] = useState(2)
  const [farbe, setFarbe] = useState('#1e293b')
  const [name, setName] = useState(unterzeichnerName)

  // Canvas initialisieren
  function initCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Weißer Hintergrund
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // Linie unten
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(20, canvas.height - 40)
    ctx.lineTo(canvas.width - 20, canvas.height - 40)
    ctx.stroke()
    ctx.setLineDash([])
    // X-Markierung
    ctx.fillStyle = '#94a3b8'
    ctx.font = '14px sans-serif'
    ctx.fillText('× Hier unterschreiben', 22, canvas.height - 24)
  }

  useEffect(() => {
    initCanvas()
  }, [])

  // Koordinaten normalisieren (DPI-aware)
  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    } else {
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
    }
  }

  function startZeichnen(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    setZeichnet(true)
    setHatZeichnung(true)
    const pos = getPos(e, canvas)
    setLastPos(pos)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, strichBreite / 2, 0, Math.PI * 2)
      ctx.fillStyle = farbe
      ctx.fill()
    }
  }

  function zeichnen(e: React.MouseEvent | React.TouchEvent) {
    if (!zeichnet) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const pos = getPos(e, canvas)
    if (!lastPos) { setLastPos(pos); return }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(lastPos.x, lastPos.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = farbe
    ctx.lineWidth = strichBreite
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    setLastPos(pos)
  }

  function stopZeichnen() {
    setZeichnet(false)
    setLastPos(null)
  }

  function loeschen() {
    setHatZeichnung(false)
    initCanvas()
  }

  function speichern() {
    const canvas = canvasRef.current
    if (!canvas || !hatZeichnung) return
    const now = new Date()
    onSave({
      dataUrl: canvas.toDataURL('image/png'),
      unterzeichnetVon: name || unterzeichnerName,
      unterzeichnetAm: now.toISOString().split('T')[0],
      unterzeichnetUm: now.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }),
      ipHinweis: 'Elektronische Unterschrift gemäß §4 Abs. 1 E-Commerce-Gesetz',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-7 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-white/60 uppercase tracking-widest mb-0.5">Digitale Unterschrift</div>
              <h2 className="text-xl font-bold text-white">{dokumentTitel}</h2>
            </div>
            <button onClick={onAbbrechen} className="text-white/70 hover:text-white text-2xl cursor-pointer bg-transparent border-none">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-4">

          {/* Unterzeichner-Name */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Unterzeichnet von</div>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none"
              placeholder="Name der unterzeichnenden Person" />
          </div>

          {/* Hinweistext */}
          {hinweisText && (
            <div className="rounded-2xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-800">
              ℹ️ {hinweisText}
            </div>
          )}

          {/* Steuerlemente */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Strichstärke:</span>
              {[1, 2, 3.5, 5].map(s => (
                <button key={s} onClick={() => setStrichBreite(s)}
                  className={clsx('rounded-full cursor-pointer border-2 transition-all flex items-center justify-center',
                    strichBreite === s ? 'border-teal-600 bg-teal-50' : 'border-slate-200 bg-white')}
                  style={{ width: 28, height: 28 }}>
                  <div className="rounded-full bg-slate-800" style={{ width: s * 2, height: s * 2 }} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-slate-500">Farbe:</span>
              {['#1e293b', '#1d4ed8', '#047857'].map(f => (
                <button key={f} onClick={() => setFarbe(f)}
                  className={clsx('w-7 h-7 rounded-full cursor-pointer border-2 transition-all',
                    farbe === f ? 'border-teal-600 scale-110' : 'border-white')}
                  style={{ background: f }} />
              ))}
            </div>
            <button onClick={loeschen}
              className="rounded-xl border border-slate-200 text-slate-500 text-xs px-3 py-2 cursor-pointer hover:bg-slate-50">
              🗑 Leeren
            </button>
          </div>

          {/* Canvas */}
          <div className={clsx('rounded-2xl border-2 overflow-hidden touch-none select-none',
            zeichnet ? 'border-teal-400 shadow-lg shadow-teal-100' : 'border-slate-200',
            'cursor-crosshair'
          )}>
            <canvas
              ref={canvasRef}
              width={680}
              height={220}
              style={{ width: '100%', height: '200px', display: 'block', touchAction: 'none' }}
              onMouseDown={startZeichnen}
              onMouseMove={zeichnen}
              onMouseUp={stopZeichnen}
              onMouseLeave={stopZeichnen}
              onTouchStart={startZeichnen}
              onTouchMove={zeichnen}
              onTouchEnd={stopZeichnen}
            />
          </div>

          {!hatZeichnung && (
            <div className="text-center text-sm text-slate-400 -mt-2">
              Bitte mit Maus oder Finger/Stift unterschreiben
            </div>
          )}

          {/* Rechtlicher Hinweis */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500 leading-relaxed">
            <strong>Rechtliche Information:</strong> Diese digitale Unterschrift stellt eine elektronische Signatur im Sinne des §4 E-Commerce-Gesetzes (ECG) dar. 
            Mit dem Klick auf "Unterschrift speichern" bestätigen Sie Ihre Zustimmung zu den Inhalten des Dokuments. 
            Datum und Uhrzeit der Signatur werden automatisch erfasst und sind unveränderlich gespeichert.
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button onClick={onAbbrechen}
              className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">
              Abbrechen
            </button>
            <button onClick={speichern} disabled={!hatZeichnung || !name.trim()}
              className="flex-1 rounded-2xl bg-teal-700 text-white px-6 py-3 text-sm font-bold cursor-pointer border-none hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed">
              ✍️ Unterschrift speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
