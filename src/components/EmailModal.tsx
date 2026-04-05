'use client'
import { useState, useEffect } from 'react'

interface EmailModalProps {
  // Vorausgefüllte Werte
  anEmail?: string
  anName?: string
  betreff?: string
  inhalt?: string
  // Kontext
  typ?: string
  klientId?: string
  klientName?: string
  betreuerinId?: string
  betreuerinName?: string
  dokumentId?: string
  dokumentTyp?: string
  erstelltVon?: string
  onClose: () => void
  onSent?: (logId: string) => void
}

export default function EmailModal({
  anEmail = '', anName = '', betreff: initBetreff = '', inhalt: initInhalt = '',
  typ = 'allgemein', klientId = '', klientName = '', betreuerinId = '',
  betreuerinName = '', dokumentId = '', dokumentTyp = '',
  erstelltVon = 'Stefan Wagner', onClose, onSent,
}: EmailModalProps) {
  const [an, setAn] = useState(anEmail)
  const [anNameVal, setAnName] = useState(anName)
  const [betreff, setBetreff] = useState(initBetreff)
  const [inhalt, setInhalt] = useState(initInhalt)
  const [cc, setCc] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; status: string; hatApiKey: boolean; fehler?: string } | null>(null)

  async function senden() {
    if (!an || !betreff || !inhalt) return
    setSending(true)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          an, anName: anNameVal, betreff, inhalt, typ,
          klientId, klientName, betreuerinId, betreuerinName,
          dokumentId, dokumentTyp, erstelltVon,
        }),
      })
      const data = await res.json()
      setResult(data)
      if (data.success && onSent) onSent(data.logId)
    } catch (e: any) {
      setResult({ success: false, status: 'fehler', hatApiKey: false, fehler: e.message })
    }
    setSending(false)
  }

  function mailtoOeffnen() {
    const body = encodeURIComponent(inhalt)
    const sub = encodeURIComponent(betreff)
    const ccStr = cc ? `&cc=${encodeURIComponent(cc)}` : ''
    window.open(`mailto:${an}?subject=${sub}${ccStr}&body=${body}`, '_blank')
  }

  const istErfolgreich = result?.success
  const keinApiKey = result?.status === 'kein_api_key'

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-teal-700 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-xs text-white/60 uppercase tracking-widest mb-0.5">E-Mail versenden</div>
            <div className="text-xl font-bold text-white">✉️ {dokumentTyp || typ || 'Dokument'}</div>
            {(klientName || betreuerinName) && (
              <div className="text-sm text-white/70 mt-0.5">
                {klientName && `Klient: ${klientName}`}
                {klientName && betreuerinName && ' · '}
                {betreuerinName && `Betreuerin: ${betreuerinName}`}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl bg-transparent border-none cursor-pointer">✕</button>
        </div>

        {/* Erfolgsmeldung */}
        {istErfolgreich && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <div className="text-2xl font-bold text-emerald-700 mb-2">E-Mail gesendet!</div>
            <div className="text-slate-500 mb-6">An: {an}</div>
            <button onClick={onClose}
              className="rounded-2xl bg-teal-700 text-white font-bold px-8 py-3 cursor-pointer border-none hover:bg-teal-800">
              Schließen
            </button>
          </div>
        )}

        {/* Kein API Key - mailto Fallback */}
        {keinApiKey && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="text-5xl mb-4">📧</div>
            <div className="text-xl font-bold text-slate-800 mb-2">E-Mail-Client öffnen</div>
            <div className="text-slate-500 mb-2 max-w-md">
              Kein Resend API-Key konfiguriert. Die E-Mail wird in Ihrem lokalen E-Mail-Programm geöffnet.
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-left text-sm max-w-md">
              <div className="font-semibold text-amber-800 mb-1">✉️ Wird vorbereitet:</div>
              <div className="text-amber-700"><strong>An:</strong> {an}</div>
              <div className="text-amber-700"><strong>Betreff:</strong> {betreff}</div>
            </div>
            <div className="flex gap-3">
              <button onClick={mailtoOeffnen}
                className="rounded-2xl bg-teal-700 text-white font-bold px-6 py-3 cursor-pointer border-none hover:bg-teal-800">
                📧 E-Mail-Client öffnen
              </button>
              <button onClick={onClose}
                className="rounded-2xl border border-slate-200 text-slate-600 px-6 py-3 cursor-pointer hover:bg-slate-50">
                Schließen
              </button>
            </div>
            <div className="mt-4 text-xs text-slate-400">
              Für direkten Versand: RESEND_API_KEY in Vercel Umgebungsvariablen hinterlegen
            </div>
          </div>
        )}

        {/* Fehler */}
        {result && !istErfolgreich && !keinApiKey && (
          <div className="p-6">
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 mb-4">
              <div className="font-bold text-rose-700 mb-1">❌ Fehler beim Senden</div>
              <div className="text-sm text-rose-600">{result.fehler}</div>
            </div>
            <button onClick={() => setResult(null)}
              className="text-sm text-teal-600 underline cursor-pointer bg-transparent border-none">
              Nochmals versuchen
            </button>
          </div>
        )}

        {/* Formular */}
        {!result && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* An */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">AN (E-Mail) *</label>
                <input value={an} onChange={e => setAn(e.target.value)} type="email"
                  placeholder="empfaenger@example.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Name Empfänger</label>
                <input value={anNameVal} onChange={e => setAnName(e.target.value)}
                  placeholder="z.B. Frau Müller"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
              </div>
            </div>

            {/* CC */}
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">CC (optional)</label>
              <input value={cc} onChange={e => setCc(e.target.value)} type="email"
                placeholder="kopie@example.com"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
            </div>

            {/* Betreff */}
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">BETREFF *</label>
              <input value={betreff} onChange={e => setBetreff(e.target.value)}
                placeholder="Betreff der E-Mail"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400 font-medium" />
            </div>

            {/* Inhalt */}
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">NACHRICHT *</label>
              <textarea value={inhalt} onChange={e => setInhalt(e.target.value)}
                rows={10} placeholder="Nachrichtentext..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none resize-y focus:border-teal-400 font-mono" />
            </div>

            {/* Vorschau-Info */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-xs text-slate-400">
              📤 Absender: <strong>VBetreut GmbH &lt;info@vbetreut.at&gt;</strong> · 
              Die E-Mail wird mit VBetreut-Header und Footer versandt
            </div>
          </div>
        )}

        {/* Footer */}
        {!result && (
          <div className="border-t border-slate-200 px-6 py-4 flex gap-3 flex-shrink-0">
            <button onClick={mailtoOeffnen}
              className="rounded-2xl border border-slate-200 text-slate-600 text-sm px-4 py-2.5 cursor-pointer hover:bg-slate-50 font-medium">
              📧 Im E-Mail-Client öffnen
            </button>
            <div className="flex-1" />
            <button onClick={onClose}
              className="rounded-2xl border border-slate-200 text-slate-600 text-sm px-5 py-2.5 cursor-pointer hover:bg-slate-50">
              Abbrechen
            </button>
            <button onClick={senden} disabled={sending || !an || !betreff || !inhalt}
              className="rounded-2xl bg-teal-700 text-white font-bold text-sm px-6 py-2.5 cursor-pointer border-none hover:bg-teal-800 disabled:opacity-50">
              {sending ? '⏳ Wird gesendet...' : '✉️ Jetzt senden'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
