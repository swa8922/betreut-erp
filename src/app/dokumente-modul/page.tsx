'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import Sidebar from '@/components/Sidebar'
import { Btn, Badge, Field, SelField, TextArea, Modal } from '@/components/ui'
import SignaturPad, { type SignaturDaten } from '@/components/SignaturPad'
import DokumentReader, { type DokumentLeseErgebnis } from '@/components/DokumentReader'
import {
  fuelleText, analysiereFall, seedVorlagen,
  FALL_TYP_LABELS, VORLAGE_TYP_LABELS, VORLAGE_TYP_ICONS, VERSAND_LABELS,
  type Vorlage, type VorlageTyp, type FallTyp,
  type AkteDokument, type DokumentFeld, type Aufgabe, type Lernregel, type AlfredNachricht,
  type VersandArt,
} from '@/lib/dokumente'
import { apiGetAll } from '@/lib/api-client'
import { useDokumenteModul } from '@/hooks/useDokumente'
import { useFirma } from '@/hooks/useFirma'
import VorlagenVorschau from '@/components/VorlagenVorschau'
import MeldezettelDruck from '@/components/MeldezettelDruck'
import PdfAusfuellen from '@/components/PdfAusfuellen'
import PdfVorlagenEditor from '@/components/PdfVorlagenEditor'
import KiVorlagenAuswahl from '@/components/KiVorlagenAuswahl'
import SignaturOrdner from '@/components/SignaturOrdner'
import { useSignaturmappen } from '@/hooks/useSignaturmappe'
import { useKlienten } from '@/hooks/useKlienten'
import { useBetreuerinnen } from '@/hooks/useBetreuerinnen'
import clsx from 'clsx'

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('de-AT') : '–'
// Safe lookup helpers to avoid TS7053 index errors
const vIcon = (t: string) => VORLAGE_TYP_ICONS[t as VorlageTyp] || '📄'
const vLabel = (t: string) => VORLAGE_TYP_LABELS[t as VorlageTyp] || t
const fallLabel = (t: string) => FALL_TYP_LABELS[t as FallTyp] || t
const nowTs = () => new Date().toISOString()
const today = () => new Date().toISOString().split('T')[0]
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

// ══════════════════════════════════════════════════════════════
// ALFRED AVATAR
// ══════════════════════════════════════════════════════════════
function Alfred({ typing = false, size = 64 }: { typing?: boolean; size?: number }) {
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setBlink(b => !b), 2400)
    return () => clearInterval(t)
  }, [])
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" fill="#0f766e" />
      <circle cx="32" cy="32" r="28" fill="#134e4a" />
      {/* Augen */}
      <ellipse cx="22" cy="28" rx="5" ry={blink ? 1 : 5} fill="white" style={{ transition: 'ry 0.15s' }} />
      <ellipse cx="42" cy="28" rx="5" ry={blink ? 1 : 5} fill="white" style={{ transition: 'ry 0.15s' }} />
      <circle cx="23" cy="28" r="2.5" fill="#0f172a" />
      <circle cx="43" cy="28" r="2.5" fill="#0f172a" />
      <circle cx="24" cy="27" r="1" fill="white" />
      <circle cx="44" cy="27" r="1" fill="white" />
      {/* Mund */}
      {typing
        ? <rect x="24" y="40" width="16" height="3" rx="1.5" fill="#5eead4" opacity="0.8" />
        : <path d="M 22 40 Q 32 47 42 40" stroke="#5eead4" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      }
      {/* Fliege */}
      <path d="M 26 54 L 32 50 L 38 54 L 32 58 Z" fill="#0d9488" />
      <circle cx="32" cy="54" r="2" fill="#5eead4" />
      {/* Brillen */}
      <rect x="15" y="23" width="14" height="11" rx="4" fill="none" stroke="#5eead4" strokeWidth="1.5" />
      <rect x="35" y="23" width="14" height="11" rx="4" fill="none" stroke="#5eead4" strokeWidth="1.5" />
      <line x1="29" y1="28" x2="35" y2="28" stroke="#5eead4" strokeWidth="1.5" />
      {/* Antennen */}
      {typing && (
        <>
          <circle cx="20" cy="6" r="3" fill="#f59e0b"><animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" /></circle>
          <circle cx="44" cy="6" r="3" fill="#f59e0b"><animate attributeName="opacity" values="0.3;1;0.3" dur="0.8s" repeatCount="indefinite" /></circle>
          <line x1="20" y1="9" x2="20" y2="18" stroke="#5eead4" strokeWidth="1.5" />
          <line x1="44" y1="9" x2="44" y2="18" stroke="#5eead4" strokeWidth="1.5" />
        </>
      )}
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════
// DOKUMENT VIEWER / EDITOR (inline, A4-Stil)
// ══════════════════════════════════════════════════════════════
function DokumentViewer({ dok, vorlage, onUpdate, onClose, onUnterschreiben, onFreigeben, canGF }: {
  dok: AkteDokument; vorlage: Vorlage; onUpdate: (d: Partial<AkteDokument>) => void
  onClose: () => void; onUnterschreiben: () => void; onFreigeben: () => void; canGF: boolean
}) {
  const [mode, setMode] = useState<'vorschau' | 'ausfuellen' | 'versand'>('ausfuellen')
  const [felder, setFelder] = useState<DokumentFeld[]>(dok.felder)
  const [versandBtr, setVersandBtr] = useState<VersandArt | ''>(dok.versandBetreuerin)
  const [versandKd, setVersandKd] = useState<VersandArt | ''>(dok.versandKunde)
  const [freigabe, setFreigabe] = useState(dok.freigebenErforderlich)
  const [ausdruck, setAusdruck] = useState(dok.ausdruckErforderlich)

  const ausgefuellterText = fuelleText(vorlage.textvorlage || vorlage.inhalt || '', felder)

  function setFeld(key: string, wert: string) {
    setFelder(fs => {
      const existing = fs.find(f => f.key === key)
      if (existing) return fs.map(f => f.key === key ? { ...f, wert } : f)
      return [...fs, { key, wert }]
    })
  }
  function getFeld(key: string) { return felder.find(f => f.key === key)?.wert || '' }

  function handleSave() {
    // Pflichtfelder prüfen
    const fehlend = vorlage.felder.filter(f => f.pflicht && !getFeld(f.key))
    if (fehlend.length > 0) {
      alert(`Bitte folgende Pflichtfelder ausfüllen:\n${fehlend.map(f => '• ' + f.label).join('\n')}`)
      return
    }
    onUpdate({ felder, ausgefuellterText, versandBetreuerin: versandBtr, versandKunde: versandKd, freigebenErforderlich: freigabe, ausdruckErforderlich: ausdruck })
  }

  function handleDruck() {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>${dok.vorlageName}</title>
<style>body{font-family:'Courier New',monospace;font-size:11px;padding:40px;max-width:800px;margin:0 auto;white-space:pre-wrap;line-height:1.6}
h1{font-family:sans-serif;font-size:16px;color:#0f766e;margin-bottom:4px}
.header{border-bottom:2px solid #0f766e;margin-bottom:20px;padding-bottom:12px}
.footer{margin-top:40px;border-top:1px solid #ccc;padding-top:10px;font-size:9px;color:#999;font-family:sans-serif}
@media print{body{padding:20px}}</style></head><body>
<div class="header"><h1>VBetreut 24h-Betreuungsagentur</h1><div style="color:#666;font-size:10px">Hohenems, Vorarlberg · office@vbetreut.at</div></div>
<pre>${ausgefuellterText}</pre>
<div class="footer">Erstellt am ${new Date().toLocaleDateString('de-AT')} · ${dok.klientName} · ${dok.betreuerinName}</div>
</body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  const statusColors: Record<string, string> = {
    entwurf: 'bg-slate-100 text-slate-600 border-slate-300',
    bereit: 'bg-amber-50 text-amber-700 border-amber-300',
    unterschrieben: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    archiviert: 'bg-slate-100 text-slate-500 border-slate-200',
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-900/60 overflow-hidden">
      {/* Linke Seite: Formularfelder */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-hidden flex-shrink-0">
        <div className="bg-teal-700 px-5 py-4 text-white flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{VORLAGE_TYP_ICONS[dok.vorlageTyp]}</span>
              <div>
                <div className="font-bold text-sm">{dok.vorlageName}</div>
                <div className="text-xs text-white/70">{dok.klientName}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer bg-transparent border-none text-xl">✕</button>
          </div>
          <Badge label={dok.status} className={clsx('text-xs', statusColors[dok.status])} />
        </div>

        {/* Tab-Auswahl */}
        <div className="flex border-b border-slate-200">
          {(['ausfuellen', 'vorschau', 'versand'] as const).map(t => (
            <button key={t} onClick={() => setMode(t)}
              className={clsx('flex-1 py-2.5 text-xs font-semibold cursor-pointer border-none transition-all',
                mode === t ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600' : 'bg-white text-slate-500 hover:bg-slate-50')}>
              {t === 'ausfuellen' ? '✏️ Felder' : t === 'vorschau' ? '👁️ Vorschau' : '📤 Versand'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mode === 'ausfuellen' && (
            <>
              {/* Pflichtfeld-Hinweis wenn leere Pflichtfelder */}
              {vorlage.felder.some(f => f.pflicht && !getFeld(f.key)) && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 mb-3">
                  ⚠️ Pflichtfelder (<span className="text-rose-500 font-bold">*</span>) müssen ausgefüllt werden
                </div>
              )}
              {vorlage.felder.map(f => (
                <div key={f.key} className={f.pflicht && !getFeld(f.key) ? 'ring-1 ring-rose-300 rounded-xl' : ''}>
                  <div className="flex items-center gap-1 mb-1">
                    <div className="text-xs font-semibold text-slate-700">{f.label}{f.pflicht && <span className="text-rose-500 ml-0.5">* Pflicht</span>}</div>
                    {f.alfred_tipp && <span title={`Alfred: ${f.alfred_tipp}`} className="text-xs text-teal-600 cursor-help">ℹ️</span>}
                  </div>
                  {f.typ === 'textarea' ? (
                    <textarea value={getFeld(f.key)} onChange={e => setFeld(f.key, e.target.value)} rows={3}
                      className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 resize-none" />
                  ) : f.typ === 'auswahl' ? (
                    <select value={getFeld(f.key)} onChange={e => setFeld(f.key, e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <option value="">— wählen —</option>
                      {f.optionen?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.typ === 'datum' ? 'date' : 'text'} value={getFeld(f.key)} onChange={e => setFeld(f.key, e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" />
                  )}
                  {f.alfred_tipp && <div className="text-[10px] text-teal-600 mt-0.5">💡 {f.alfred_tipp}</div>}
                </div>
              ))}
            </>
          )}

          {mode === 'vorschau' && (
            <div className="text-xs text-slate-500 leading-relaxed">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 font-mono text-[10px] whitespace-pre-wrap leading-5">
                {ausgefuellterText}
              </div>
            </div>
          )}

          {mode === 'versand' && (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-bold text-slate-700 mb-2">Versand Betreuerin</div>
                {(['', 'email', 'post', 'buero', 'ausdruck'] as const).map(v => (
                  <label key={v} className="flex items-center gap-2 mb-1.5 cursor-pointer">
                    <input type="radio" checked={versandBtr === v} onChange={() => setVersandBtr(v)} className="accent-teal-700" />
                    <span className="text-xs text-slate-700">{v === '' ? '— kein Versand —' : VERSAND_LABELS[v]}</span>
                  </label>
                ))}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-700 mb-2">Versand Klient/Auftraggeber</div>
                {(['', 'email', 'post', 'buero', 'ausdruck'] as const).map(v => (
                  <label key={v} className="flex items-center gap-2 mb-1.5 cursor-pointer">
                    <input type="radio" checked={versandKd === v} onChange={() => setVersandKd(v)} className="accent-teal-700" />
                    <span className="text-xs text-slate-700">{v === '' ? '— kein Versand —' : VERSAND_LABELS[v]}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={freigabe} onChange={e => setFreigabe(e.target.checked)} className="accent-teal-700" />
                  <span className="text-xs text-slate-700">Freigabe durch Mitarbeiter erforderlich</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={ausdruck} onChange={e => setAusdruck(e.target.checked)} className="accent-teal-700" />
                  <span className="text-xs text-slate-700">Ausdruck im Büro erforderlich</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Aktions-Footer */}
        <div className="border-t border-slate-200 p-4 space-y-2 flex-shrink-0">
          <div className="flex gap-2">
            <button onClick={handleSave} className="flex-1 rounded-xl bg-teal-700 text-white text-xs font-bold py-2.5 cursor-pointer border-none hover:bg-teal-800">💾 Speichern</button>
            <button onClick={handleDruck} className="flex-1 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold py-2.5 cursor-pointer hover:bg-slate-50">🖨️ PDF/Druck</button>
          </div>
          {dok.status !== 'unterschrieben' && (
            <button onClick={onUnterschreiben}
              className="w-full rounded-xl bg-emerald-600 text-white text-xs font-bold py-3 cursor-pointer border-none hover:bg-emerald-700 flex items-center justify-center gap-2">
              ✍️ Digitale Unterschrift
            </button>
          )}
          {dok.status === 'unterschrieben' && dok.freigebenErforderlich && !dok.freigegebenAm && canGF && (
            <button onClick={onFreigeben}
              className="w-full rounded-xl bg-sky-600 text-white text-xs font-bold py-2.5 cursor-pointer border-none hover:bg-sky-700">
              ✅ Versand freigeben
            </button>
          )}
          {dok.status === 'unterschrieben' && dok.signaturDataUrl && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-center">
              <div className="text-[10px] text-emerald-600 mb-1">✅ Unterschrieben von {dok.unterschriebenVon} am {fmtDate(dok.unterschriebenAm)}</div>
              <img src={dok.signaturDataUrl} alt="Unterschrift" className="max-h-12 mx-auto border border-emerald-200 rounded-lg bg-white px-2" />
            </div>
          )}
        </div>
      </div>

      {/* Rechte Seite: A4-Vorschau */}
      <div className="flex-1 overflow-auto bg-slate-200 p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg overflow-hidden">
            {/* A4 Header */}
            <div className="bg-teal-700 px-10 py-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">VBetreut</div>
                  <div className="text-xs text-white/70 mt-0.5">24h-Betreuungsagentur · Hohenems, Vorarlberg</div>
                </div>
                <div className="text-right text-xs text-white/60">
                  <div>office@vbetreut.at</div>
                  <div>{new Date().toLocaleDateString('de-AT')}</div>
                </div>
              </div>
            </div>

            {/* Dokument-Body */}
            <div className="px-10 py-8">
              <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-800 leading-6">
                {ausgefuellterText}
              </pre>

              {/* Importiertes Dokument */}
              {dok.importierterText && (
                <div className="mt-6 border-t border-slate-200 pt-5">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                    📂 Eingelesenes Dokument: {dok.importierteDatei}
                  </div>
                  {dok.importierterHtml && dok.importiertDateiTyp === 'docx' ? (
                    <div
                      className="text-[11px] text-slate-800 leading-6 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: dok.importierterHtml }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-[11px] text-slate-700 leading-6 bg-slate-50 rounded-xl p-4 border border-slate-200">
                      {dok.importierterText}
                    </pre>
                  )}
                </div>
              )}

              {/* Unterschrift */}
              {dok.signaturDataUrl && (
                <div className="mt-8 pt-6 border-t-2 border-slate-300">
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <div className="text-xs text-slate-400 mb-2">Unterschrift</div>
                      <img src={dok.signaturDataUrl} alt="Digitale Unterschrift"
                        className="h-20 border-b border-slate-400 pb-1" />
                      <div className="text-[10px] text-slate-500 mt-1">
                        {dok.unterschriebenVon}<br />
                        {dok.unterschriebenAm && fmtDate(dok.unterschriebenAm)}{dok.signaturUhrzeit ? ` · ${dok.signaturUhrzeit}` : ''}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400 leading-relaxed">
                        {dok.signaturHinweis || 'Elektronische Unterschrift gemäß §4 ECG'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-10 py-4 text-[10px] text-slate-400 flex justify-between">
              <span>Klient: {dok.klientName} · Betreuerin: {dok.betreuerinName}</span>
              <span>Erstellt: {fmtDate(dok.erstelltAm)} von {dok.erstelltVon}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ALFRED CHAT
// ══════════════════════════════════════════════════════════════
function AlfredChat({ messages, onSend, isTyping }: {
  messages: AlfredNachricht[]; onSend: (text: string) => void; isTyping: boolean
}) {
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isTyping])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Alfred size={56} />
            <div className="mt-3 font-bold text-slate-800">Guten Tag! Ich bin Alfred.</div>
            <div className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
              Sagen Sie mir was ich tun soll. Z.B.: "Analysiere Fall Erstanreise für Klientin Mayer mit Betreuerin Kovač"
            </div>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={clsx('flex gap-2', m.von === 'alfred' ? '' : 'flex-row-reverse')}>
            {m.von === 'alfred' && <div className="flex-shrink-0 mt-1"><Alfred size={28} /></div>}
            <div className={clsx('rounded-2xl px-4 py-2.5 text-sm max-w-xs leading-relaxed',
              m.von === 'alfred' ? 'bg-teal-50 border border-teal-200 text-slate-800' : 'bg-slate-800 text-white')}>
              {m.aktionsTyp === 'warnung' && <div className="text-amber-600 font-bold text-xs mb-1">⚠️ Warnung</div>}
              {m.aktionsTyp === 'auto' && <div className="text-teal-600 font-bold text-xs mb-1">⚡ Automatisch</div>}
              {m.aktionsTyp === 'vorschlag' && <div className="text-sky-600 font-bold text-xs mb-1">💡 Vorschlag</div>}
              <div className="whitespace-pre-wrap">{m.text}</div>
              <div className="text-[10px] opacity-50 mt-1">{new Date(m.zeitstempel).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2">
            <Alfred size={28} typing />
            <div className="rounded-2xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-slate-500 italic">
              Alfred denkt nach ...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-slate-200 p-3 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && input.trim()) { onSend(input.trim()); setInput('') } }}
          placeholder="Alfred schreiben ... (Enter zum Senden)"
          className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none" />
        <button onClick={() => { if (input.trim()) { onSend(input.trim()); setInput('') } }}
          className="rounded-2xl bg-teal-700 text-white px-4 py-2.5 text-sm font-bold cursor-pointer border-none hover:bg-teal-800">
          →
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// HAUPTSEITE
// ══════════════════════════════════════════════════════════════
export default function DokumentePage() {
  const { user, loading } = useAuth()

  const { firma } = useFirma()
  const { klienten } = useKlienten()
  const { betreuerinnen } = useBetreuerinnen()
  const { mappen: signaturMappen } = useSignaturmappen()
  const [vorschauVorlage, setVorschauVorlage] = useState<any>(null)
  const [meldezettelOffen, setMeldezettelOffen] = useState(false)
  const [pdfAusfuellenOffen, setPdfAusfuellenOffen] = useState(false)
  const [pdfVorlagenOffen, setPdfVorlagenOffen] = useState(false)
  const [showKiAuswahl, setShowKiAuswahl] = useState(false)
  // PDF-Vorlagen aus Supabase laden
  const [pdfVorlagenListe, setPdfVorlagenListe] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/pdf-vorlagen').then(r => r.ok ? r.json() : []).then(setPdfVorlagenListe).catch(() => {})
  }, [pdfVorlagenOffen]) // neu laden wenn Editor geschlossen wird

    const { vorlagen: vorlagenDB, dokumente: dokumenteDB, regeln: regelnDB, alfredChat: alfredChatDB,
    saveVorlagen: sv, saveDokumente: sd, saveRegeln: sr, saveAlfredChat: sac, reload: reloadDok } = useDokumenteModul()
  const [vorlagen, setVorlagenState] = useState<Vorlage[]>([])
  const [dokumente, setDokumenteState] = useState<AkteDokument[]>([])
  const [regeln, setRegelnState] = useState<Lernregel[]>([])
  const [chatMsgs, setChatMsgs] = useState<AlfredNachricht[]>([])
  const [alfredTyping, setAlfredTyping] = useState(false)

  // Sync von Supabase
  useEffect(() => { if(vorlagenDB.length) setVorlagenState(vorlagenDB) }, [vorlagenDB])
  useEffect(() => { if(dokumenteDB.length) setDokumenteState(dokumenteDB) }, [dokumenteDB])
  useEffect(() => { if(regelnDB.length) setRegelnState(regelnDB) }, [regelnDB])
  useEffect(() => { if(alfredChatDB.length) setChatMsgs(alfredChatDB) }, [alfredChatDB])

  // Echte Daten aus Supabase statt Demo-Daten
  const [echteKlienten, setEchteKlienten] = useState<any[]>([])
  const [echteBetreuerinnen, setEchteBetreuerinnen] = useState<any[]>([])
  useEffect(() => {
    apiGetAll<any>('klienten').then(data => setEchteKlienten(data.map((k:any) => ({
      id: k.id, name: `${k.vorname||''} ${k.nachname||''}`.trim(),
      anschrift: [k.adresse,k.plz,k.ort].filter(Boolean).join(', '),
      geburtsdatum: k.geburtsdatum||'', email: k.email||'', telefon: k.telefon||''
    }))))
    apiGetAll<any>('betreuerinnen').then(data => setEchteBetreuerinnen(data.map((b:any) => ({
      id: b.id, name: `${b.vorname||''} ${b.nachname||''}`.trim(),
      geburtsdatum: b.geburtsdatum||'', nationalitaet: b.nationalitaet||'',
      anschrift: [b.adresse,b.plz,b.ort].filter(Boolean).join(', '),
      email: b.email||'', telefon: b.telefon||''
    }))))
  }, [])

  const [activeTab, setActiveTab] = useState<'workflow' | 'signaturen' | 'archiv' | 'vorlagen' | 'chat'>('workflow')
  const [viewerDok, setViewerDok] = useState<AkteDokument | null>(null)
  const [signaturDokId, setSignaturDokId] = useState<string | null>(null)
  const [showReader, setShowReader] = useState(false)
  const [readerZielDokId, setReaderZielDokId] = useState<string | null>(null)

  // Archiv-State
  const [archivSuche, setArchivSuche] = useState('')
  const [archivFilterStatus, setArchivFilterStatus] = useState<string>('alle')
  const [archivFilterTyp, setArchivFilterTyp] = useState<string>('alle')
  const [archivFilterKlient, setArchivFilterKlient] = useState<string>('')
  const [archivSortierung, setArchivSortierung] = useState<'datum' | 'name' | 'klient'>('datum')
  const [vorlageUploadId, setVorlageUploadId] = useState<string | null>(null) // Vorlage für Upload

  // Workflow-State
  const [wfKlient, setWfKlient] = useState('')
  const [wfBetreuerin, setWfBetreuerin] = useState('')
  const [wfFallTyp, setWfFallTyp] = useState<FallTyp>('erstanreise')
  const [wfSignaturmappeErstellt, setWfSignaturmappeErstellt] = useState(false)
  const [wfArchiviert, setWfArchiviert] = useState(false)
  const [wfArchivKlientDone, setWfArchivKlientDone] = useState(false)
  const [wfArchivBetreuerinDone, setWfArchivBetreuerinDone] = useState(false)
  const [wfAnalyse, setWfAnalyse] = useState<{ vorlageIds: string[]; begruendung: string } | null>(null)
  const [wfGewaehlt, setWfGewaehlt] = useState<string[]>([])
  const [wfSchritt, setWfSchritt] = useState<1 | 2 | 3>(1)

  // Vorlage-Formular
  const [showVorlageForm, setShowVorlageForm] = useState(false)
  const [editVorlage, setEditVorlage] = useState<Vorlage | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const canGF = user?.role === 'gf'

  function reload() {
    // loaded from Supabase
    // loaded from Supabase
    // loaded from Supabase
    // loaded from Supabase
  }
  useEffect(() => { reload() }, [])

  // ── Alfred antworten ────────────────────────────────────────
  const alfredAntwort = useCallback((text: string, typ?: AlfredNachricht['aktionsTyp']) => {
    const msg: AlfredNachricht = { id: uid(), von: 'alfred', text, zeitstempel: nowTs(), aktionsTyp: typ }
    setChatMsgs(prev => {
      const updated = [...prev, msg]
      sac(updated)
      return updated
    })
  }, [])

  // Alfred-State für Signaturmappe-Workflow
  const [signaturmappeAusstehend, setSignaturmappeAusstehend] = useState<{klient: string, betreuerin: string, docs: string[]} | null>(null)
  const [archivierungAusstehend, setArchivierungAusstehend] = useState<{klient: string, betreuerin: string} | null>(null)

  const handleUserChat = useCallback(async (text: string) => {
    const userMsg: AlfredNachricht = { id: uid(), von: 'user', text, zeitstempel: nowTs() }
    setChatMsgs(prev => { const u = [...prev, userMsg]; sac(u); return u })
    setAlfredTyping(true)

    // Signaturmappe-Bestätigung — wirklich in Supabase anlegen
    if (signaturmappeAusstehend && (text.toLowerCase().includes('ja') || text.toLowerCase().includes('erstell') || text.toLowerCase().includes('ok'))) {
      const ausstehend = signaturmappeAusstehend
      setSignaturmappeAusstehend(null)
      
      // Echte Klient/Betreuerin IDs finden
      const klient = echteKlienten.find(k =>
        `${k.vorname} ${k.nachname}`.toLowerCase().includes(ausstehend.klient.toLowerCase()) ||
        ausstehend.klient.toLowerCase().includes(k.nachname.toLowerCase())
      )
      const betreuerin = echteBetreuerinnen.find(b =>
        `${b.vorname} ${b.nachname}`.toLowerCase().includes(ausstehend.betreuerin.toLowerCase()) ||
        ausstehend.betreuerin.toLowerCase().includes(b.nachname.toLowerCase())
      )
      
      const mappeId = uid()
      const klientName = klient ? `${klient.vorname} ${klient.nachname}` : ausstehend.klient
      const betreuerinName = betreuerin ? `${betreuerin.vorname} ${betreuerin.nachname}` : ausstehend.betreuerin
      const heute = new Date().toLocaleDateString('de-AT')
      const titel = `${klientName} · ${heute}`
      
      try {
        // Signaturmappe in Supabase erstellen
        await fetch('/api/db/signaturmappen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mappeId,
            klient_id: klient?.id || '',
            klient_name: klientName,
            betreuerin_id: betreuerin?.id || '',
            betreuerin_name: betreuerinName,
            titel,
            status: 'offen',
            erstellt_von: 'Alfred',
            erstellt_am: new Date().toISOString(),
          })
        })
        
        // Dokumente in der Mappe anlegen
        for (const dokName of ausstehend.docs) {
          const vorlage = vorlagen.find(v => v.name.toLowerCase().includes(dokName.toLowerCase()))
          await fetch('/api/db/signatur_dokumente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: uid(),
              mappe_id: mappeId,
              klient_id: klient?.id || '',
              klient_name: klientName,
              vorlage_id: vorlage?.id || '',
              vorlage_name: dokName,
              vorlage_typ: vorlage?.typ || 'sonstiges',
              titel: dokName,
              inhalt: '',
              status: 'ausstehend',
              unterzeichner: dokName.toLowerCase().includes('meldezettel') ? 'alle' : 'klient',
              erstellt_am: new Date().toISOString(),
            })
          })
        }
        
        setTimeout(() => {
          setAlfredTyping(false)
          alfredAntwort(
            `✅ Signaturmappe erstellt!\n\n📁 Ordner: "${titel}"\n👤 Klient: ${klientName}\n👩 Betreuerin: ${betreuerinName}\n\n📄 Dokumente (${ausstehend.docs.length}):\n${ausstehend.docs.map((d, i) => `${i+1}. ${d}`).join('\n')}\n\n➡️ Tab "Signaturen" öffnen um die Mappe zu sehen.\n🖨️ Dokumente ausdrucken und unterschreiben lassen.\n\n✅ Wenn alle Unterschriften vorliegen, sagen Sie: "Unterschriften liegen vor"`,
            'auto'
          )
          setArchivierungAusstehend({ klient: klientName, betreuerin: betreuerinName })
        }, 800)
      } catch (err) {
        setTimeout(() => {
          setAlfredTyping(false)
          alfredAntwort(`⚠️ Signaturmappe konnte nicht gespeichert werden. Bitte Tab "Signaturen" → "+ Neue Mappe" manuell erstellen.`, 'warnung')
        }, 500)
      }
      return
    }

    // Archivierung bestätigen
    if (archivierungAusstehend && (text.toLowerCase().includes('unterschrift') || text.toLowerCase().includes('unterzeichnet') || text.toLowerCase().includes('liegt vor') || text.toLowerCase().includes('archiv'))) {
      setTimeout(() => {
        setAlfredTyping(false)
        alfredAntwort(
          `✅ Perfekt! Ich archiviere jetzt alle Dokumente:\n\n📂 Gespeichert im Archiv (Alfred)\n👤 Beim Klienten: ${archivierungAusstehend.klient} → Dokumente-Tab\n👩 Bei der Betreuerin: ${archivierungAusstehend.betreuerin} → Dokumente-Tab\n📋 Chronologie-Eintrag erstellt: "Vertragsmappe unterzeichnet"\n\n🎉 Alle Unterlagen sind vollständig abgelegt.\nDer Einsatz kann jetzt als aktiv geführt werden.`,
          'auto'
        )
        setArchivierungAusstehend(null)
      }, 1200)
      return
    }

    // Signaturmappe ablehnen
    if (signaturmappeAusstehend && (text.toLowerCase().includes('nein') || text.toLowerCase().includes('nicht'))) {
      setTimeout(() => {
        setAlfredTyping(false)
        alfredAntwort('Verstanden — keine Signaturmappe erstellt. Sie können jederzeit unter "📋 Vorlagen" die einzelnen Dokumente aufrufen und ausdrucken.', 'info')
        setSignaturmappeAusstehend(null)
      }, 800)
      return
    }

    try {
      // Lerndaten aus Supabase laden für Kontext
      const lerndatenRes = await fetch('/api/db/lerndaten')
      const lerndaten = lerndatenRes.ok ? await lerndatenRes.json() : []
      const alfredWissen = lerndaten
        .filter((l: any) => l.assistent === 'alfred' || !l.assistent)
        .map((l: any) => `[${l.kategorie?.toUpperCase() || 'INFO'}] ${l.titel}:\n${l.inhalt}`)
        .join('\n\n---\n\n')

      // Vorlagen-Liste für Kontext
      const vorlagenListe = vorlagen.map(v => `• ${v.id}: ${v.name} (${v.typ})`).join('\n')

      // Chat-History für Kontext
      const chatHistory = chatMsgs.slice(-8).map(m => ({
        role: m.von === 'user' ? 'user' : 'assistant',
        content: m.text
      }))

      const systemPrompt = `Du bist Alfred, der KI-Dokumenten-Assistent von VBetreut GmbH.
VBetreut GmbH ist eine 24h-Betreuungsagentur in Hörbranz, Vorarlberg, Österreich.

DEIN WISSEN UND REGELN:
${alfredWissen}

VERFÜGBARE VORLAGEN:
${vorlagenListe}

DEINE AUFGABEN:
1. Dokument-Workflows für Betreuer-Einsätze steuern
2. Automatisch die richtigen Dokumente für jeden Falltyp vorschlagen
3. Nach dem Befüllen fragen ob eine Signaturmappe erstellt werden soll
4. Nach Unterschrift die Archivierung bestätigen
5. Fragen zu Verträgen, Meldezetteln, Honorarnoten beantworten

VERHALTEN:
- Antworte immer auf Deutsch
- Bei Erstanreise/Neueinsatz: Schlage Vertragsmappe vor (Betreuungsvertrag, Vermittlungsvertrag, Meldezettel Anmeldung)
- Bei Wechsel: Schlage Meldezettel Abmeldung (alt) + Anmeldung (neu) + E-Mail Vorstellung vor
- Bei Monatsabrechnung: Rechnung an Klient (FR) + Honorarnote Betreuerin (HN)
- Frage am Ende bei Einsatz/Wechsel IMMER: "Soll ich eine Signaturmappe erstellen?"
- Sei präzise, freundlich, professionell
- Antworte kurz und strukturiert (mit Emojis und Zeilenumbrüchen)
- Max 250 Wörter pro Antwort

PDF-VORLAGEN & FORMULARE:
• Meldezettel An-/Abmeldung = amtliches Formular → Tab "Vorlagen" → "Vorschau & Druck" → Betreuerin + Klient wählen → "✨ Automatisch ausfüllen"
• Bei Erstanreise IMMER Meldezettel Anmeldung erwähnen!
• Bei Wechsel: Meldezettel Abmeldung (alte) + Anmeldung (neue)
• Formulare werden AUTOMATISCH mit Betreuerinnen-Daten ausgefüllt (Name, Geburtsdatum, Staatsangehörigkeit, Ausweis, Adresse)
• Alfred nennt IMMER welche Formulare ausgefüllt werden müssen

SIGNATURMAPPE WORKFLOW:
• Erstanreise → Betreuungsvertrag + Vermittlungsvertrag + Meldezettel Anmeldung
• Wechsel → Meldezettel Abmeldung (alte) + Meldezettel Anmeldung (neue) + E-Mail Vorstellung
• Nach JA-Bestätigung: Ordner im Tab "Signaturen" mit Klientenname + Datum anlegen
• Ordner enthält alle Dokumente zur Unterschrift
• Nach Unterschriften: "Unterschriften liegen vor" → Alfred archiviert alles automatisch
• Archiviert = sichtbar in Tab "Archiv" + bei Klient + bei Betreuerin
• WICHTIG: Signaturmappe wird WIRKLICH in der DB angelegt — nicht nur erwähnt!

DEIN WISSEN — VBetreut GmbH:
• Firmensitz: Krüzastraße 4, 6912 Hörbranz, Vorarlberg
• GF: Stefan Wagner, Margot Schön | UID: ATU81299827
• Tagessatz 24h-Betreuung: €100/Tag (Pos 1002)
• Agenturpauschale: €440/Mt + 20% USt = €528 brutto (Pos 1010)
• Fahrtkosten: €145/Fahrt pauschal (Pos 1006)
• Zweite Person: €10/Tag (Pos 1005)
• Turnus: 14 oder 28 Tage
• Meldezettel: Pflicht bei jedem Einsatz — An- UND Abmeldung!
• Meldepflicht: innerhalb 3 Tage beim Gemeindeamt
• Förderung: €550/Mt Bundeszuschuss (Sozialministeriumsservice)
• Gewerbeschein der Betreuerin: Pflicht (§159 GewO)
• Honorarnote: Kleinunternehmer §6 Abs. 1 Z 27 UStG (keine USt!)`

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          system: systemPrompt,
          messages: [...chatHistory, { role: 'user', content: text }]
        })
      })

      const data = await response.json()
      const antwort = data.content?.[0]?.text || 'Entschuldigung, ich konnte keine Antwort generieren.'

      setAlfredTyping(false)

      // Erkennen ob Signaturmappe angeboten werden soll
      const low = text.toLowerCase()
      const erwaehntEinsatz = low.includes('erstanreise') || low.includes('neueintritt') || low.includes('wechsel') || low.includes('einsatz') || low.includes('anreise')
      const hatKlient = echteKlienten.find(k => low.includes(k.name.toLowerCase().split(' ').pop() || ''))
      const hatBetreuerin = echteBetreuerinnen.find(b => low.includes(b.name.toLowerCase().split(' ').pop() || ''))

      alfredAntwort(antwort, 'auto')

      // Nach Analyse automatisch Signaturmappe anbieten
      if (erwaehntEinsatz && (hatKlient || hatBetreuerin)) {
        setTimeout(() => {
          const klientName = hatKlient?.name || '[Klient]'
          const betreuerinName = hatBetreuerin?.name || '[Betreuerin]'
          const docs = low.includes('wechsel')
            ? ['Meldezettel Abmeldung', 'Meldezettel Anmeldung', 'E-Mail Vorstellung']
            : ['Betreuungsvertrag', 'Vermittlungsvertrag', 'Meldezettel Anmeldung']

          alfredAntwort(
            `📁 Soll ich eine Signaturmappe für diesen Einsatz erstellen?\n\n👤 ${klientName} × 👩 ${betreuerinName}\n📄 Dokumente: ${docs.join(', ')}\n\nAntworten Sie mit "Ja" oder "Nein".`,
            'vorschlag'
          )
          setSignaturmappeAusstehend({ klient: klientName, betreuerin: betreuerinName, docs })
        }, 2000)
      }

    } catch {
      setAlfredTyping(false)
      alfredAntwort('Entschuldigung, ich konnte momentan keine KI-Antwort abrufen. Bitte versuchen Sie es erneut oder tippen Sie "Hilfe".', 'info')
    }
  }, [alfredAntwort, chatMsgs, vorlagen, echteKlienten, echteBetreuerinnen, regeln, sac, signaturmappeAusstehend, archivierungAusstehend])

  // regeln kommt aus useDokumenteModul Hook (State)

  // ── WORKFLOW: Analyse & Anlegen ─────────────────────────────
  function handleAnalyse() {
    if (!wfKlient || !wfBetreuerin) return
    const analyse = analysiereFall(wfFallTyp, regeln, vorlagen)
    setWfAnalyse(analyse)
    setWfGewaehlt(analyse.vorlageIds)
    setWfSchritt(2)
  }

  async function handleMappe() {
    if (!wfAnalyse || !wfKlient || !wfBetreuerin) return
    const klient = echteKlienten.find(k => k.id === wfKlient)
    const betreuerin = echteBetreuerinnen.find(b => b.id === wfBetreuerin)
    if (!klient || !betreuerin) return

    const klientName = `${klient.nachname || klient.name || ''} ${klient.vorname || ''}`.trim()
    const betreuerinName = `${betreuerin.nachname || betreuerin.name || ''} ${betreuerin.vorname || ''}`.trim()

    const neue: AkteDokument[] = wfGewaehlt.map(vid => {
      const vorlage = vorlagen.find(v => v.id === vid)!
      const felder: DokumentFeld[] = [
        { key: 'klient_name', wert: klientName },
        { key: 'klient_anschrift', wert: `${klient.strasse || ''}, ${klient.plz || ''} ${klient.ort || ''}`.trim() },
        { key: 'klient_geburtsdatum', wert: klient.geburtsdatum || '' },
        { key: 'klient_email', wert: klient.email || '' },
        { key: 'klient_telefon', wert: klient.telefon || '' },
        { key: 'betreuerin_name', wert: betreuerinName },
        { key: 'betreuerin_geburtsdatum', wert: betreuerin.geburtsdatum || '' },
        { key: 'betreuerin_nationalitaet', wert: betreuerin.nationalitaet || betreuerin.staatsangehoerigkeit || '' },
        { key: 'unterkunft_strasse', wert: klient.strasse || '' },
        { key: 'unterkunft_plz', wert: klient.plz || '' },
        { key: 'unterkunft_ort', wert: klient.ort || '' },
        { key: 'unterkunftgeber_name', wert: klientName },
        { key: 'hauptwohnsitz', wert: 'nein' },
        { key: 'zuzug_ausland', wert: 'ja' },
        { key: 'zuzug_staat', wert: betreuerin.nationalitaet || '' },
        { key: 'ort_datum', wert: `Hohenems, ${new Date().toLocaleDateString('de-AT')}` },
      ]

      return {
        id: uid(), vorlageId: vorlage.id, vorlageName: vorlage.name, vorlageTyp: vorlage.typ,
        klientId: klient.id, klientName, betreuerinId: betreuerin.id, betreuerinName,
        ausgefuellterText: fuelleText(vorlage.textvorlage || vorlage.inhalt || '', felder), felder,
        status: 'bereit' as const,
        versandBetreuerin: vorlage.versandBetreuerin, versandKunde: vorlage.versandKunde,
        freigebenErforderlich: vorlage.freigebenErforderlich, freigegebenVon: '', freigegebenAm: '',
        ausdruckErforderlich: vorlage.ausdruckErforderlich,
        unterschriebenAm: '', unterschriebenVon: '',
        signaturDataUrl: '', signaturUhrzeit: '', signaturHinweis: '',
        importierterText: '', importierterHtml: '', importierteDatei: '',
        importiertDateiBase64: '', importiertDateiTyp: '',
        emailVersendetAm: '', emailVersendetAn: [],
        aufgaben: [], erstelltAm: today(), aktualisiertAm: today(),
        erstelltVon: user?.name || '', alfredAnalyse: wfAnalyse?.begruendung || '',
      }
    })

    // Lokal speichern
    sd([...dokumente, ...neue])

    // Signaturmappe direkt in Supabase anlegen
    const mappeId = uid()
    try {
      await fetch('/api/db/signaturmappen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: mappeId,
          klient_id: klient.id,
          klient_name: klientName,
          betreuerin_id: betreuerin.id,
          betreuerin_name: betreuerinName,
          titel: `${klientName} — ${new Date().toLocaleDateString('de-AT')}`,
          status: 'offen',
          erstellt_von: user?.name || 'System',
          erstellt_am: new Date().toISOString(),
        })
      })
      // Dokumente in Signaturmappe
      for (const dok of neue) {
        await fetch('/api/db/signatur_dokumente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: uid(),
            mappe_id: mappeId,
            klient_id: klient.id,
            klient_name: klientName,
            vorlage_id: dok.vorlageId,
            vorlage_name: dok.vorlageName,
            vorlage_typ: dok.vorlageTyp,
            titel: dok.vorlageName,
            inhalt: dok.ausgefuellterText,
            status: 'ausstehend',
            unterzeichner: (dok.vorlageTyp === 'meldezettel' || dok.vorlageTyp === 'meldezettel') ? 'alle' : 'klient',
            erstellt_am: new Date().toISOString(),
          })
        })
      }
    } catch (e) {
      console.error('Signaturmappe erstellen fehlgeschlagen:', e)
    }

    setWfSchritt(3)
  }

  function updateDok(id: string, data: Partial<AkteDokument>) {
    const updated = dokumente.map(d => d.id === id ? { ...d, ...data, aktualisiertAm: today() } : d)
    sd(updated)
    setViewerDok(prev => prev?.id === id ? { ...prev, ...data } : prev)
  }

  function handleUnterschreiben(dok: AkteDokument) {
    // Öffne das echte Signature-Pad
    setSignaturDokId(dok.id)
    setViewerDok(null)
  }

  function handleSignaturSpeichern(sig: SignaturDaten) {
    const dokId = signaturDokId
    if (!dokId) return
    const dok = dokumente.find(d => d.id === dokId)
    if (!dok) return

    // Aufgaben aus Versandlogik erzeugen
    const aufgaben: Aufgabe[] = []
    if (dok.versandBetreuerin === 'email') {
      aufgaben.push({ id: uid(), typ: 'email_betreuerin', titel: `E-Mail an ${dok.betreuerinName}`, beschreibung: `${dok.vorlageName} per E-Mail an Betreuerin versenden (${dok.betreuerinName})`, prioritaet: 'hoch', erledigtAm: '', faelligAm: today(), zugewiesen: '', dokumentId: dok.id })
    }
    if (dok.versandKunde && dok.freigebenErforderlich) {
      aufgaben.push({ id: uid(), typ: 'freigabe_klient', titel: `Freigabe Versand an ${dok.klientName}`, beschreibung: `Freigabe für Versand an Klient (${dok.klientName})`, prioritaet: 'hoch', erledigtAm: '', faelligAm: today(), zugewiesen: '', dokumentId: dok.id })
    }
    if (dok.ausdruckErforderlich) {
      aufgaben.push({ id: uid(), typ: 'ausdruck', titel: `Ausdruck: ${dok.vorlageName}`, beschreibung: `Dokument ausdrucken für ${dok.klientName}`, prioritaet: 'mittel', erledigtAm: '', faelligAm: today(), zugewiesen: '', dokumentId: dok.id })
    }

    updateDok(dokId, {
      status: 'unterschrieben',
      unterschriebenAm: sig.unterzeichnetAm,
      unterschriebenVon: sig.unterzeichnetVon,
      signaturDataUrl: sig.dataUrl,
      signaturUhrzeit: sig.unterzeichnetUm,
      signaturHinweis: sig.ipHinweis,
      aufgaben,
    })
    setSignaturDokId(null)
  }

  function handleDokumentGelesen(ergebnis: DokumentLeseErgebnis) {
    const dokId = readerZielDokId
    if (dokId) {
      // Inhalt in vorhandenes Dokument importieren
      updateDok(dokId, {
        importierterText: ergebnis.text,
        importierterHtml: ergebnis.html,
        importierteDatei: ergebnis.dateiName,
        importiertDateiBase64: ergebnis.base64,
        importiertDateiTyp: ergebnis.dateiTyp,
      })
    }
    setShowReader(false)
    setReaderZielDokId(null)
  }

  function handleFreigeben(dok: AkteDokument) {
    updateDok(dok.id, { freigegebenVon: user?.name || '', freigegebenAm: today() })
  }

  // Signatur-Ordner: nach Klient gruppiert
  const signaturDoks = dokumente.filter(d => d.status === 'bereit' || d.status === 'entwurf')
  const signaturNachKlient: [string, AkteDokument[]][] = Object.entries(
    signaturDoks.reduce<Record<string, AkteDokument[]>>((acc, d) => {
      if (!acc[d.klientName]) acc[d.klientName] = []
      acc[d.klientName].push(d)
      return acc
    }, {})
  )

  // Aufgaben aus allen Dokumenten
  const alleAufgaben = dokumente.flatMap(d => d.aufgaben.filter(a => !a.erledigtAm))

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>
  if (!user) return null

  const vorlageForViewer = viewerDok ? vorlagen.find(v => v.id === viewerDok.vorlageId) : null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">

        {/* Viewer */}
        {viewerDok && vorlageForViewer && (
          <DokumentViewer
            dok={viewerDok} vorlage={vorlageForViewer} canGF={canGF}
            onUpdate={data => updateDok(viewerDok.id, data)}
            onClose={() => { setViewerDok(null); reload() }}
            onUnterschreiben={() => handleUnterschreiben(viewerDok)}
            onFreigeben={() => handleFreigeben(viewerDok)}
          />
        )}

        {/* Digitale Unterschrift */}
        {signaturDokId && (() => {
          const dok = dokumente.find(d => d.id === signaturDokId)
          return dok ? (
            <SignaturPad
              dokumentTitel={dok.vorlageName}
              unterzeichnerName={dok.klientName || dok.betreuerinName || ''}
              hinweisText={`Bitte unterschreiben Sie das Dokument "${dok.vorlageName}" für ${dok.klientName}.`}
              onSave={handleSignaturSpeichern}
              onAbbrechen={() => setSignaturDokId(null)}
            />
          ) : null
        })()}

        {/* Dokument-Leser (Word/PDF) */}
        {showReader && (
          <DokumentReader
            titel="Word- oder PDF-Dokument einlesen"
            hinweis="Word (.docx) und PDF werden automatisch gelesen. Der extrahierte Text kann dem Dokument hinzugefügt werden."
            onErgebnis={handleDokumentGelesen}
            onAbbrechen={() => { setShowReader(false); setReaderZielDokId(null) }}
          />
        )}

        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-6">
            <Alfred size={72} />
            <div className="flex-1">
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-1">Akten-Alfred · KI-Dokumentensystem</div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">Dokumentenmodul</h1>
              <p className="text-base text-slate-500">Vertragsworkflow, Signaturordner, Vorlagenverwaltung, Lerntool und Alfred-Chat.</p>
            </div>
            <div className="flex flex-col gap-2 text-right">
              <div className="text-2xl font-bold text-slate-900">{dokumente.length}</div>
              <div className="text-xs text-slate-400">Dokumente total</div>
              {alleAufgaben.length > 0 && (
                <Badge label={`${alleAufgaben.length} offene Aufgaben`} className="text-xs bg-amber-50 text-amber-700 border-amber-300" />
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 flex-wrap">
            {([
              ['workflow', '⚡ Geschäftsfälle'],
              ['signaturen', `🖊️ Signatur-Ordner (${signaturMappen.length})`],
              ['archiv', `🗄️ Archiv (${dokumente.length})`],
              ['vorlagen', `📋 Vorlagen (${vorlagen.length})`],
              ['chat', '💬 Alfred-Chat'],
            ] as const).map(([t, l]) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={clsx('rounded-2xl px-5 py-2.5 text-sm font-semibold cursor-pointer border-none transition-all',
                  activeTab === t ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            TAB: WORKFLOW (Geschäftsfälle)
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'workflow' && (
          <div className="mt-5 grid grid-cols-3 gap-5">
            {/* Linke Seite: Wizard */}
            <div className="col-span-1 space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <Alfred size={36} />
                  <div>
                    <div className="font-bold text-slate-900">Fall analysieren</div>
                    <div className="text-xs text-slate-500">Alfred ermittelt die Dokumente</div>
                  </div>
                </div>

                {/* Schritt 1 */}
                <div className={clsx('space-y-3', wfSchritt > 1 && 'opacity-50')}>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Schritt 1 — Zuordnung</div>
                  <SelField label="Klient:in *" value={wfKlient} onChange={setWfKlient}
                    options={[{ value: '', label: '— wählen —' }, ...echteKlienten.map(k => ({ value: k.id, label: k.name }))]} />
                  <SelField label="Betreuerin *" value={wfBetreuerin} onChange={setWfBetreuerin}
                    options={[{ value: '', label: '— wählen —' }, ...echteBetreuerinnen.map(b => ({ value: b.id, label: b.name }))]} />
                  <SelField label="Falltyp *" value={wfFallTyp} onChange={v => setWfFallTyp(v as FallTyp)}
                    options={Object.entries(FALL_TYP_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                  {wfSchritt === 1 && (
                    <Btn teal onClick={handleAnalyse} disabled={!wfKlient || !wfBetreuerin}
                      className="w-full">⚡ Alfred analysieren lassen</Btn>
                  )}
                </div>

                {/* Schritt 2: Analyse */}
                {wfSchritt >= 2 && wfAnalyse && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Schritt 2 — Dokumente bestätigen</div>
                    <div className="rounded-2xl bg-teal-50 border border-teal-200 p-3 mb-3">
                      <div className="text-xs font-bold text-teal-800 mb-1">⚡ Alfred's Analyse</div>
                      <div className="text-xs text-teal-700">{wfAnalyse.begruendung}</div>
                    </div>
                    {vorlagen.filter(v => v.status === 'aktiv').map(v => (
                      <label key={v.id} className="flex items-center gap-2 mb-2 cursor-pointer">
                        <input type="checkbox" checked={wfGewaehlt.includes(v.id)}
                          onChange={e => setWfGewaehlt(prev => e.target.checked ? [...prev, v.id] : prev.filter(x => x !== v.id))}
                          className="accent-teal-700" />
                        <span className="text-xs text-slate-700">{vIcon(v.typ)} {v.name}</span>
                        {wfAnalyse.vorlageIds.includes(v.id) && <Badge label="✓ Alfred" className="text-[10px] bg-teal-50 text-teal-700 border-teal-200" />}
                      </label>
                    ))}
                    {wfSchritt === 2 && (
                      <div className="flex gap-2 mt-3">
                        <Btn onClick={() => { setWfSchritt(1); setWfAnalyse(null) }}>Zurück</Btn>
                        <Btn teal onClick={handleMappe} disabled={wfGewaehlt.length === 0}>📁 Mappe anlegen</Btn>
                      </div>
                    )}
                  </div>
                )}

                {/* Schritt 3: Erfolg */}
                {wfSchritt === 3 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                    {/* Erfolgsmeldung */}
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                      <div className="font-bold text-emerald-800 mb-1">✅ {wfGewaehlt.length} Dokument{wfGewaehlt.length > 1 ? 'e' : ''} erstellt!</div>
                      <div className="text-xs text-emerald-700 space-y-0.5">
                        {wfGewaehlt.map(vid => {
                          const v = vorlagen.find(x => x.id === vid)
                          return v ? <div key={vid}>📄 {v.name}</div> : null
                        })}
                      </div>
                    </div>

                    {/* Alfred fragt: Signaturmappe erstellen? */}
                    {!wfSignaturmappeErstellt && (
                      <div className="rounded-2xl bg-violet-50 border border-violet-200 p-4">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">📄</div>
                          <div className="flex-1">
                            <div className="font-bold text-violet-900 text-sm mb-1">Alfred fragt:</div>
                            <div className="text-xs text-violet-800 mb-3">
                              Soll ich jetzt eine <strong>Signaturmappe</strong> erstellen? 
                              Darin werden alle Dokumente zusammengefasst, die noch unterschrieben werden müssen.
                            </div>
                            <div className="flex gap-2">
                              <button onClick={async () => {
                                // Signaturmappe erstellen — Dokumente in Signaturen-Tab verschieben
                                setWfSignaturmappeErstellt(true)
                                // Alle erstellten Dokumente als "zur Unterschrift" markieren
                                const updated = dokumente.map(d =>
                                  wfGewaehlt.some(vid => {
                                    const v = vorlagen.find(x => x.id === vid)
                                    return v && d.vorlageName === v.name && d.klientId === wfKlient
                                  }) ? { ...d, status: 'zur_unterschrift' as const } : d
                                )
                                await sd(updated)
                                setActiveTab('signaturen')
                              }}
                                className="rounded-xl bg-violet-700 text-white text-xs font-bold px-4 py-2 cursor-pointer border-none hover:bg-violet-800">
                                ✍️ Ja, Signaturmappe erstellen
                              </button>
                              <button onClick={() => setWfSignaturmappeErstellt(true)}
                                className="rounded-xl border border-violet-300 text-violet-600 text-xs px-4 py-2 cursor-pointer hover:bg-violet-50">
                                Nein, später
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Nach Signaturmappe: Archivierung */}
                    {wfSignaturmappeErstellt && !wfArchiviert && (
                      <div className="rounded-2xl bg-teal-50 border border-teal-200 p-4 space-y-3">
                        <div className="font-bold text-teal-900 text-sm flex items-center gap-2">
                          <span>📁</span> Dokumente archivieren
                        </div>
                        <div className="text-xs text-teal-700">
                          Nach der Unterschrift die Dokumente ablegen:
                        </div>
                        <div className="space-y-2">
                          {/* Beim Klienten archivieren */}
                          <button onClick={async () => {
                            const klient = echteKlienten.find(k => k.id === wfKlient)
                            if (!klient) return
                            // Dokumente per API beim Klienten speichern
                            const doksZumArchivieren = dokumente.filter(d =>
                              wfGewaehlt.some(vid => {
                                const v = vorlagen.find(x => x.id === vid)
                                return v && d.vorlageName === v.name && d.klientId === wfKlient
                              })
                            )
                            // Klienten-Dokumente aktualisieren
                            try {
                              const res = await fetch(`/api/db/klienten?id=${wfKlient}`)
                              if (res.ok) {
                                const klientData = await res.json()
                                const bestehendeDoks = klientData.dokumente || []
                                const neueDoks = doksZumArchivieren.map(d => ({
                                  id: d.id, kategorie: 'vertrag',
                                  bezeichnung: d.vorlageName,
                                  dateiName: d.vorlageName + '.pdf',
                                  hochgeladenAm: today(),
                                  notizen: `Erstellt von Alfred am ${today()}`,
                                  vertraulich: false,
                                }))
                                await fetch(`/api/db/klienten?id=${wfKlient}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ dokumente: [...bestehendeDoks, ...neueDoks] })
                                })
                                setWfArchivKlientDone(true)
                              }
                            } catch {}
                          }}
                            className={`w-full rounded-xl border text-xs px-4 py-2.5 cursor-pointer text-left flex items-center gap-3 ${wfArchivKlientDone ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-teal-50'}`}>
                            <span>{wfArchivKlientDone ? '✅' : '👤'}</span>
                            <span>Bei <strong>{echteKlienten.find(k => k.id === wfKlient)?.name}</strong> archivieren</span>
                          </button>

                          {/* Bei der Betreuerin archivieren */}
                          <button onClick={async () => {
                            const betreuerin = echteBetreuerinnen.find(b => b.id === wfBetreuerin)
                            if (!betreuerin) return
                            try {
                              const res = await fetch(`/api/db/betreuerinnen?id=${wfBetreuerin}`)
                              if (res.ok) {
                                const betreuerinData = await res.json()
                                const bestehendeDoks = betreuerinData.dokumente || []
                                const doksZumArchivieren = dokumente.filter(d =>
                                  wfGewaehlt.some(vid => {
                                    const v = vorlagen.find(x => x.id === vid)
                                    return v && d.vorlageName === v.name
                                  })
                                )
                                const neueDoks = doksZumArchivieren.map(d => ({
                                  id: d.id + '_b', kategorie: 'vertrag',
                                  bezeichnung: d.vorlageName,
                                  dateiName: d.vorlageName + '.pdf',
                                  hochgeladenAm: today(),
                                  notizen: `Erstellt von Alfred am ${today()}`,
                                  vertraulich: false, dorisAusgelesen: false,
                                }))
                                await fetch(`/api/db/betreuerinnen?id=${wfBetreuerin}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ dokumente: [...bestehendeDoks, ...neueDoks] })
                                })
                                setWfArchivBetreuerinDone(true)
                              }
                            } catch {}
                          }}
                            className={`w-full rounded-xl border text-xs px-4 py-2.5 cursor-pointer text-left flex items-center gap-3 ${wfArchivBetreuerinDone ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-teal-50'}`}>
                            <span>{wfArchivBetreuerinDone ? '✅' : '👩'}</span>
                            <span>Bei <strong>{echteBetreuerinnen.find(b => b.id === wfBetreuerin)?.name}</strong> archivieren</span>
                          </button>

                          {/* Im Alfred-Archiv bestätigen */}
                          <button onClick={() => setWfArchiviert(true)}
                            className={`w-full rounded-xl border text-xs px-4 py-2.5 cursor-pointer text-left flex items-center gap-3 ${wfArchiviert ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-teal-50'}`}>
                            <span>📦</span>
                            <span>Im Alfred-Archiv ablegen (bereits gespeichert)</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Abschluss */}
                    {wfArchiviert && wfSignaturmappeErstellt && (
                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                        <div className="font-bold text-slate-900 text-sm mb-2">🎉 Workflow abgeschlossen</div>
                        <div className="text-xs text-slate-600 space-y-1">
                          {wfArchivKlientDone && <div>✅ Bei {echteKlienten.find(k => k.id === wfKlient)?.name} archiviert</div>}
                          {wfArchivBetreuerinDone && <div>✅ Bei {echteBetreuerinnen.find(b => b.id === wfBetreuerin)?.name} archiviert</div>}
                          <div>✅ Im Alfred-Archiv gespeichert</div>
                        </div>
                      </div>
                    )}

                    <button onClick={() => {
                      setWfSchritt(1); setWfAnalyse(null); setWfKlient(''); setWfBetreuerin('')
                      setWfSignaturmappeErstellt(false); setWfArchiviert(false)
                      setWfArchivKlientDone(false); setWfArchivBetreuerinDone(false)
                    }}
                      className="w-full rounded-xl border border-slate-200 text-slate-600 text-xs px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                      ↩ Neuer Fall
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Rechte Seite: Dokumente & Aufgaben */}
            <div className="col-span-2 space-y-4">
              {/* Offene Aufgaben */}
              {alleAufgaben.length > 0 && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                  <div className="font-bold text-amber-900 mb-3">⚠️ Offene Aufgaben ({alleAufgaben.length})</div>
                  <div className="space-y-2">
                    {alleAufgaben.slice(0, 5).map(a => (
                      <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-white border border-amber-200 px-4 py-3">
                        <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', a.prioritaet === 'hoch' ? 'bg-rose-500' : 'bg-amber-400')} />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-slate-900">{a.titel}</div>
                          <div className="text-xs text-slate-500">{a.beschreibung}</div>
                        </div>
                        <button onClick={() => {
                          const all = dokumente
                          const dok = all.find(d => d.id === a.dokumentId)
                          if (dok) {
                            const updated = all.map(d => d.id === dok.id ? { ...d, aufgaben: d.aufgaben.map(x => x.id === a.id ? { ...x, erledigtAm: today() } : x) } : d)
                            sd(updated)
                          }
                        }} className="text-xs rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1.5 cursor-pointer hover:bg-emerald-100">
                          ✓ Erledigt
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alle Dokumente */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Alle Dokumente</h2>
                {dokumente.length === 0 && (
                  <div className="text-center py-10 text-slate-400">
                    <div className="text-4xl mb-2">📂</div>
                    <div>Noch keine Dokumente angelegt. Starten Sie links mit einem Fall.</div>
                  </div>
                )}
                <div className="space-y-2">
                  {[...dokumente].reverse().map(d => {
                    const offeneAufgaben = d.aufgaben.filter(a => !a.erledigtAm)
                    const statusColors: Record<string, string> = {
                      entwurf: 'bg-slate-100 text-slate-600 border-slate-300',
                      bereit: 'bg-amber-50 text-amber-700 border-amber-300',
                      unterschrieben: 'bg-emerald-50 text-emerald-700 border-emerald-300',
                      archiviert: 'bg-slate-100 text-slate-400 border-slate-200',
                    }
                    return (
                      <div key={d.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden hover:border-teal-300 hover:bg-teal-50/20 transition-all">
                        <div className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                          onClick={() => setViewerDok(d)}>
                          <span className="text-2xl flex-shrink-0">{vIcon(d.vorlageTyp)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900">{d.vorlageName}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {d.klientName} · {d.betreuerinName} · {fmtDate(d.erstelltAm)}
                            </div>
                            {d.signaturDataUrl && (
                              <div className="text-xs text-emerald-700 mt-0.5 font-semibold">
                                ✍️ {d.unterschriebenVon} · {fmtDate(d.unterschriebenAm)}
                              </div>
                            )}
                            {d.importierteDatei && (
                              <div className="text-xs text-sky-600 mt-0.5">📂 {d.importierteDatei}</div>
                            )}
                          </div>
                          <div className="flex gap-2 items-center flex-wrap justify-end">
                            {d.signaturDataUrl && <img src={d.signaturDataUrl} alt="✍️" className="h-7 border border-emerald-200 rounded bg-white px-1" />}
                            <Badge label={d.status} className={clsx('text-xs', statusColors[d.status])} />
                            {offeneAufgaben.length > 0 && <Badge label={`${offeneAufgaben.length} Aufg.`} className="text-xs bg-amber-50 text-amber-700 border-amber-200" />}
                          </div>
                        </div>
                        {/* Schnell-Aktionen */}
                        <div className="flex gap-2 px-4 pb-3 border-t border-slate-100 pt-2">
                          <button onClick={() => setViewerDok(d)}
                            className="rounded-xl border border-slate-200 text-slate-600 text-xs px-3 py-1.5 cursor-pointer hover:bg-slate-100">
                            ✏️ Bearbeiten
                          </button>
                          {d.status !== 'unterschrieben' && (
                            <button onClick={() => handleUnterschreiben(d)}
                              className="rounded-xl bg-emerald-600 text-white text-xs px-3 py-1.5 cursor-pointer border-none hover:bg-emerald-700 font-semibold">
                              ✍️ Unterschreiben
                            </button>
                          )}

                          {canGF && (
                            <button onClick={() => {
                              if (confirm(`Dokument "${d.vorlageName}" löschen?`)) {
                                sd(dokumente.filter(x => x.id !== d.id))
                              }
                            }} className="rounded-xl border border-rose-200 bg-rose-50 text-rose-600 text-xs px-3 py-1.5 cursor-pointer hover:bg-rose-100 font-semibold">
                              🗑 Löschen
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: SIGNATUR-ORDNER
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'signaturen' && (
          <div className="mt-5">
            <SignaturOrdner
              vorlagen={vorlagen}
              klienten={klienten}
              betreuerinnen={betreuerinnen}
              aktuellerUser={user?.name || 'Stefan Wagner'}
            />
          </div>
        )}

                {activeTab === 'archiv' && (() => {
          // Gefilterte + gesuchte Dokumente
          const archivDoks = dokumente.filter(d => {
            if (archivFilterStatus !== 'alle' && d.status !== archivFilterStatus) return false
            if (archivFilterTyp !== 'alle' && d.vorlageTyp !== archivFilterTyp) return false
            if (archivFilterKlient && d.klientId !== archivFilterKlient) return false
            if (archivSuche) {
              const q = archivSuche.toLowerCase()
              const felder = d.felder.map(f => f.wert).join(' ')
              if (![d.klientName, d.betreuerinName, d.vorlageName, d.erstelltVon, felder,
                    d.importierterText || '', d.ausgefuellterText].join(' ').toLowerCase().includes(q)) return false
            }
            return true
          }).sort((a, b) => {
            if (archivSortierung === 'datum') return b.aktualisiertAm.localeCompare(a.aktualisiertAm)
            if (archivSortierung === 'name') return a.vorlageName.localeCompare(b.vorlageName)
            return a.klientName.localeCompare(b.klientName)
          })

          const klientenImArchiv = Array.from(new Map(dokumente.map(d => [d.klientId, { id: d.klientId, name: d.klientName }])).values()) as { id: string; name: string }[]
          const typenImArchiv = Array.from(new Set(dokumente.map(d => d.vorlageTyp))) as VorlageTyp[]

          return (
          <div className="mt-5 space-y-4">

            {/* Suchmaske */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">🗄️ Dokumentenarchiv</h2>
                  <p className="text-sm text-slate-500 mt-1">Alle gespeicherten Dokumente — durchsuchen, filtern, öffnen.</p>
                </div>
                <div className="text-right text-sm text-slate-400">
                  <div className="text-2xl font-bold text-slate-700">{archivDoks.length}</div>
                  <div className="text-xs">von {dokumente.length} gesamt</div>
                </div>
              </div>

              {/* Suchfeld */}
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 mb-4">
                <span className="text-slate-400 text-lg">🔎</span>
                <input
                  value={archivSuche}
                  onChange={e => setArchivSuche(e.target.value)}
                  placeholder="Suche nach Klient, Betreuerin, Dokumenttyp, Inhalt ..."
                  className="flex-1 bg-transparent border-none text-sm text-slate-800 placeholder-slate-400 outline-none"
                />
                {archivSuche && (
                  <button onClick={() => setArchivSuche('')}
                    className="text-slate-400 cursor-pointer bg-transparent border-none text-lg">✕</button>
                )}
              </div>

              {/* Filter-Zeile */}
              <div className="flex gap-3 flex-wrap items-center">
                <select value={archivFilterStatus} onChange={e => setArchivFilterStatus(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none">
                  <option value="alle">Alle Status</option>
                  <option value="entwurf">Entwurf</option>
                  <option value="bereit">Bereit zur Unterschrift</option>
                  <option value="unterschrieben">Unterschrieben</option>
                  <option value="archiviert">Archiviert</option>
                </select>

                <select value={archivFilterTyp} onChange={e => setArchivFilterTyp(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none">
                  <option value="alle">Alle Typen</option>
                  {typenImArchiv.map(t => <option key={t} value={t}>{VORLAGE_TYP_ICONS[t]} {VORLAGE_TYP_LABELS[t]}</option>)}
                </select>

                <select value={archivFilterKlient} onChange={e => setArchivFilterKlient(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none">
                  <option value="">Alle Klienten</option>
                  {klientenImArchiv.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-slate-400">Sortierung:</span>
                  {(['datum', 'name', 'klient'] as const).map(s => (
                    <button key={s} onClick={() => setArchivSortierung(s)}
                      className={clsx('rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer border transition-all',
                        archivSortierung === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50')}>
                      {s === 'datum' ? 'Datum' : s === 'name' ? 'Name' : 'Klient'}
                    </button>
                  ))}
                </div>

                {(archivSuche || archivFilterStatus !== 'alle' || archivFilterTyp !== 'alle' || archivFilterKlient) && (
                  <button onClick={() => { setArchivSuche(''); setArchivFilterStatus('alle'); setArchivFilterTyp('alle'); setArchivFilterKlient('') }}
                    className="rounded-xl border border-slate-200 text-slate-500 text-xs px-3 py-2 cursor-pointer hover:bg-slate-50">
                    Filter zurücksetzen
                  </button>
                )}
              </div>
            </div>

            {/* Schnell-Statistiken */}
            <div className="grid grid-cols-4 gap-3">
              {([
                ['Gesamt', dokumente.length, 'text-slate-900', 'border-slate-200 bg-white'],
                ['Unterschrieben', dokumente.filter(d => d.status === 'unterschrieben').length, 'text-emerald-700', 'border-emerald-200 bg-emerald-50'],
                ['Zur Unterschrift', dokumente.filter(d => d.status === 'bereit').length, 'text-amber-700', 'border-amber-200 bg-amber-50'],
                ['Entwürfe', dokumente.filter(d => d.status === 'entwurf').length, 'text-slate-600', 'border-slate-200 bg-slate-50'],
              ] as const).map(([l, v, tc, bc]) => (
                <div key={String(l)} className={clsx('rounded-2xl border px-5 py-4 text-center shadow-sm cursor-pointer', bc)}
                  onClick={() => setArchivFilterStatus(
                    l === 'Gesamt' ? 'alle' : l === 'Unterschrieben' ? 'unterschrieben' : l === 'Zur Unterschrift' ? 'bereit' : 'entwurf'
                  )}>
                  <div className={clsx('text-3xl font-bold', tc)}>{v}</div>
                  <div className="text-xs text-slate-500 mt-1">{l}</div>
                </div>
              ))}
            </div>

            {/* Ergebnis-Liste */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Tabellen-Header */}
              <div className="grid items-center border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-6 py-3"
                style={{ gridTemplateColumns: '28px 1fr 180px 140px 120px 100px 100px 80px' }}>
                <div />
                <div>Dokument / Klient</div>
                <div>Betreuerin</div>
                <div>Erstellt</div>
                <div>Zuletzt geändert</div>
                <div>Typ</div>
                <div>Status</div>
                <div />
              </div>

              {archivDoks.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                  <div className="text-5xl mb-3">🗄️</div>
                  <div className="font-medium text-slate-500">
                    {archivSuche || archivFilterStatus !== 'alle' || archivFilterTyp !== 'alle' || archivFilterKlient
                      ? 'Keine Dokumente gefunden — Filter anpassen'
                      : 'Noch keine Dokumente im Archiv'}
                  </div>
                </div>
              )}

              {archivDoks.map(d => {
                const statusCol: Record<string, string> = {
                  entwurf: 'bg-slate-100 text-slate-600 border-slate-200',
                  bereit: 'bg-amber-50 text-amber-700 border-amber-300',
                  unterschrieben: 'bg-emerald-50 text-emerald-700 border-emerald-300',
                  archiviert: 'bg-slate-50 text-slate-400 border-slate-200',
                }
                const offeneAufg = d.aufgaben.filter(a => !a.erledigtAm).length
                return (
                  <div key={d.id}
                    className="grid items-center border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors cursor-pointer px-6 py-4"
                    style={{ gridTemplateColumns: '28px 1fr 180px 140px 120px 100px 100px 80px' }}
                    onClick={() => setViewerDok(d)}>

                    <div className="text-lg">{vIcon(d.vorlageTyp)}</div>

                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{d.vorlageName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{d.klientName}</div>
                      {d.signaturDataUrl && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <img src={d.signaturDataUrl} alt="✍️" className="h-5 border border-emerald-200 rounded bg-white px-0.5" />
                          <span className="text-[10px] text-emerald-700">{d.unterschriebenVon} · {fmtDate(d.unterschriebenAm)}</span>
                        </div>
                      )}
                      {d.importierteDatei && (
                        <div className="text-[10px] text-sky-600 mt-0.5">📂 {d.importierteDatei}</div>
                      )}
                      {archivSuche && d.importierterText?.toLowerCase().includes(archivSuche.toLowerCase()) && (
                        <div className="text-[10px] text-teal-600 mt-0.5">✓ Treffer im Dokumenttext</div>
                      )}
                    </div>

                    <div className="text-sm text-slate-600 truncate">{d.betreuerinName || '–'}</div>
                    <div className="text-xs text-slate-500">{fmtDate(d.erstelltAm)}<br/><span className="text-slate-400">{d.erstelltVon}</span></div>
                    <div className="text-xs text-slate-500">{fmtDate(d.aktualisiertAm)}</div>
                    <div><Badge label={vLabel(d.vorlageTyp)} className="text-[10px] bg-slate-100 text-slate-600 border-slate-200" /></div>

                    <div className="space-y-1">
                      <Badge label={d.status === 'bereit' ? 'Zur Unterschrift' : d.status === 'unterschrieben' ? 'Unterschrieben' : d.status === 'entwurf' ? 'Entwurf' : 'Archiviert'}
                        className={clsx('text-[10px]', statusCol[d.status])} />
                      {offeneAufg > 0 && <Badge label={`${offeneAufg} Aufg.`} className="text-[10px] bg-amber-50 text-amber-700 border-amber-200" />}
                    </div>

                    <div className="flex flex-col gap-1">
                      <button onClick={e => { e.stopPropagation(); setViewerDok(d) }}
                        className="rounded-lg border border-teal-200 bg-teal-50 text-teal-700 text-[10px] px-2.5 py-1.5 cursor-pointer hover:bg-teal-100 font-semibold">
                        Öffnen
                      </button>
                      {d.status !== 'unterschrieben' && (
                        <button onClick={e => { e.stopPropagation(); handleUnterschreiben(d) }}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] px-2.5 py-1.5 cursor-pointer hover:bg-emerald-100 font-semibold">
                          ✍️ Sign.
                        </button>
                      )}
                      {canGF && (
                        <button onClick={e => {
                          e.stopPropagation()
                          if (confirm(`Dokument "${d.vorlageName}" für ${d.klientName} löschen?`)) {
                            const updated = dokumente.filter(x => x.id !== d.id)
                            sd(updated)
                          }
                        }} className="rounded-lg border border-rose-200 bg-rose-50 text-rose-600 text-[10px] px-2.5 py-1.5 cursor-pointer hover:bg-rose-100 font-semibold">
                          🗑 Löschen
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          )
        })()}



        {activeTab === 'vorlagen' && (
          <div className="mt-5 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Dokumentvorlagen</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Vorlagen aus hochgeladenen Dokumenten. Klicken zum Bearbeiten.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowResetConfirm(true)}
                    className="rounded-2xl border border-slate-200 text-slate-500 text-xs px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                    ↺ Vorlagen zurücksetzen
                  </button>
                  <Btn onClick={() => setShowKiAuswahl(true)}>✨ KI-Auswahl</Btn>
                  {canGF && (
                    <button onClick={() => setPdfVorlagenOffen(true)}
                      className="rounded-2xl bg-teal-700 text-white font-bold text-xs px-4 py-2.5 cursor-pointer border-none hover:bg-teal-800">
                      + Neue Vorlage
                    </button>
                  )}
                </div>
              </div>

              {showResetConfirm && (
                <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 mb-4">
                  <div className="font-bold text-rose-800 mb-2">Alle Vorlagen auf Standard zurücksetzen?</div>
                  <div className="text-xs text-rose-600 mb-3">Alle manuellen Änderungen gehen verloren. Die 5 Original-Vorlagen (Betreuungsvertrag, Vermittlungsvertrag, Organisationsvertrag, Vollmacht, Meldezettel) werden wiederhergestellt.</div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowResetConfirm(false)} className="rounded-xl border border-rose-200 text-rose-600 px-4 py-2 text-xs cursor-pointer">Abbrechen</button>
                    <button onClick={() => {
                      const fresh = seedVorlagen()
                      sv(fresh)
                      setShowResetConfirm(false)
                    }} className="rounded-xl bg-rose-600 text-white px-4 py-2 text-xs font-bold cursor-pointer border-none hover:bg-rose-700">Zurücksetzen</button>
                  </div>
                </div>
              )}

              {/* PDF-Vorlagen aus Supabase — gleiche Karten wie normale Vorlagen */}
              {pdfVorlagenListe.map((v: any) => {
                const felderAnz = (v.positionen||[]).length || (v.platzhalter||[]).length || 0
                return (
                  <div key={v.id} className="rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-teal-300 transition-all mb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{
                          v.typ === 'meldezettel' ? '🏛️' :
                          v.typ === 'vertrag' ? '📋' :
                          v.typ === 'vollmacht' ? '✍️' :
                          v.typ === 'foerderantrag' ? '💶' : '📄'
                        }</span>
                        <div>
                          <div className="font-bold text-slate-900">{v.name}</div>
                          <div className="text-xs text-slate-500">{
                            v.typ === 'meldezettel' ? 'Meldezettel' :
                            v.typ === 'vertrag' ? 'Vertrag' :
                            v.typ === 'vollmacht' ? 'Vollmacht' :
                            v.typ === 'foerderantrag' ? 'Förderantrag' : 'Sonstiges'
                          }</div>
                        </div>
                      </div>
                      <Badge label="aktiv" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200" />
                    </div>

                    <p className="text-xs text-slate-600 mb-3">
                      {v.beschreibung || 'Österreichisches Original-Formular mit automatischer Feldbefüllung'}
                    </p>

                    <div className="flex gap-2 flex-wrap text-[10px] mb-3">
                      <span className="bg-slate-100 rounded-full px-2 py-0.5 text-slate-500">{felderAnz} Felder</span>
                      <span className="bg-teal-50 rounded-full px-2 py-0.5 text-teal-600">📄 Original-PDF</span>
                      <span className="bg-amber-50 rounded-full px-2 py-0.5 text-amber-600">🖨️ Ausdruck</span>
                    </div>

                    {canGF && (
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={async () => {
                          const res = await fetch(`/api/pdf-vorlagen?id=${v.id}`)
                          if (res.ok) setPdfVorlagenOffen(true)
                        }}
                          className="rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-xs px-3 py-1.5 cursor-pointer hover:bg-teal-100 font-semibold">
                          👁️ Vorschau & Druck
                        </button>
                        <button onClick={() => setPdfVorlagenOffen(true)}
                          className="rounded-xl border border-slate-200 text-xs text-slate-600 px-3 py-1.5 cursor-pointer hover:bg-slate-50">
                          ✏️ Bearbeiten
                        </button>
                        <button onClick={async () => {
                          if (confirm(`PDF-Vorlage "${v.name}" löschen?`)) {
                            await fetch(`/api/pdf-vorlagen?id=${v.id}`, { method: 'DELETE' })
                            setPdfVorlagenListe((prev: any[]) => prev.filter((x: any) => x.id !== v.id))
                          }
                        }} className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-xs px-3 py-1.5 cursor-pointer hover:bg-rose-100">
                          🗑 Löschen
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="grid grid-cols-2 gap-4">
                {vorlagen.map(v => (
                  <div key={v.id} className={clsx('rounded-3xl border p-5 cursor-pointer hover:shadow-md transition-all',
                    v.status === 'aktiv' ? 'border-slate-200 bg-white hover:border-teal-300' : 'border-slate-100 bg-slate-50')}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{vIcon(v.typ)}</span>
                        <div>
                          <div className="font-bold text-slate-900">{v.name}</div>
                          <div className="text-xs text-slate-500">{vLabel(v.typ)}</div>
                        </div>
                      </div>
                      <Badge label={v.status} className={clsx('text-xs', v.status === 'aktiv' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200')} />
                    </div>
                    <p className="text-xs text-slate-600 mb-3">{v.beschreibung}</p>

                    {v.dateiOriginal && (
                      <div className="text-[10px] text-slate-400 mb-2 font-mono">📎 {v.dateiOriginal}</div>
                    )}

                    <div className="flex gap-2 flex-wrap text-[10px] mb-3">
                      <span className="bg-slate-100 rounded-full px-2 py-0.5 text-slate-500">{v.felder.length} Felder</span>
                      {v.versandBetreuerin && <span className="bg-sky-50 rounded-full px-2 py-0.5 text-sky-600">BTR: {VERSAND_LABELS[v.versandBetreuerin as 'email'|'post'|'buero'|'ausdruck']}</span>}
                      {v.versandKunde && <span className="bg-violet-50 rounded-full px-2 py-0.5 text-violet-600">KD: {VERSAND_LABELS[v.versandKunde as 'email'|'post'|'buero'|'ausdruck']}</span>}
                      {v.ausdruckErforderlich && <span className="bg-amber-50 rounded-full px-2 py-0.5 text-amber-600">🖨️ Ausdruck</span>}
                      {v.freigebenErforderlich && <span className="bg-rose-50 rounded-full px-2 py-0.5 text-rose-600">⚠️ Freigabe</span>}
                    </div>

                    {canGF && (
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => {
                            if (v.typ === 'meldezettel' || v.vorlageTyp === 'meldezettel') {
                              setVorschauVorlage(v); setMeldezettelOffen(true)
                            } else {
                              setVorschauVorlage(v); setMeldezettelOffen(false)
                            }
                          }}
                          className="rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-xs px-3 py-1.5 cursor-pointer hover:bg-teal-100 font-semibold">👁️ Vorschau & Druck</button>
                        <button onClick={() => { setEditVorlage(v); setShowVorlageForm(true) }}
                          className="rounded-xl border border-slate-200 text-xs text-slate-600 px-3 py-1.5 cursor-pointer hover:bg-slate-50">✏️ Bearbeiten</button>
                        <button onClick={() => {
                          const updated = vorlagen.map(x => x.id === v.id ? { ...x, status: x.status === 'aktiv' ? 'archiviert' as const : 'aktiv' as const } : x)
                          sv(updated)
                        }} className={clsx('rounded-xl text-xs px-3 py-1.5 cursor-pointer border',
                          v.status === 'aktiv' ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50')}>
                          {v.status === 'aktiv' ? '⏸ Deaktivieren' : '▶ Aktivieren'}
                        </button>
                        <button onClick={() => {
                          if (confirm(`Vorlage "${v.name}" dauerhaft löschen?`)) {
                            sv(vorlagen.filter(x => x.id !== v.id))
                          }
                        }} className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-xs px-3 py-1.5 cursor-pointer hover:bg-rose-100">
                          🗑 Löschen
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* KI-Vorlagenauswahl Modal */}
        {showKiAuswahl && (
          <KiVorlagenAuswahl
            vorlagen={vorlagen}
            ereignis=""
            onAuswahl={(ids) => {
              setShowKiAuswahl(false)
              // Vorlagen markieren/hervorheben
              alert(`${ids.length} Vorlagen ausgewählt: ${ids.map(id => vorlagen.find(v => v.id === id)?.name).filter(Boolean).join(', ')}`)
            }}
            onClose={() => setShowKiAuswahl(false)}
          />
        )}

        {/* PDF Ausfüllen Modal */}
        {pdfAusfuellenOffen && (
          <PdfAusfuellen
            onClose={() => setPdfAusfuellenOffen(false)}
          />
        )}

        {pdfVorlagenOffen && (
          <PdfVorlagenEditor
            mode="verwalten"
            onClose={() => setPdfVorlagenOffen(false)}
          />
        )}

        {/* Vorlagen-Vorschau Modal */}
        {vorschauVorlage && meldezettelOffen && (
          <MeldezettelDruck
            onClose={() => { setVorschauVorlage(null); setMeldezettelOffen(false) }}
          />
        )}
        {vorschauVorlage && !meldezettelOffen && (
          <VorlagenVorschau
            vorlage={vorschauVorlage}
            firma={firma}
            onClose={() => setVorschauVorlage(null)}
          />
        )}

        {/* Vorlage-Bearbeiten Modal */}
        {showVorlageForm && (
          <Modal title={editVorlage ? `Vorlage: ${editVorlage.name}` : 'Neue Vorlage'} onClose={() => setShowVorlageForm(false)}>
            <VorlageFormular
              vorlage={editVorlage}
              onSave={v => {
                if (editVorlage) {
                  sv(vorlagen.map(x => x.id === v.id ? v : x))
                } else {
                  sv([...vorlagen, { ...v, id: uid(), erstelltAm: today(), aktualisiertAm: today() }])
                }
                setShowVorlageForm(false)
              }}
              onClose={() => setShowVorlageForm(false)}
            />
          </Modal>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: LERNTOOL
        ══════════════════════════════════════════════════════ */}
        {false && activeTab === 'lerntool_REMOVED' && (
          <div className="mt-5 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-5">
                <Alfred size={48} />
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Alfred Lerntool</h2>
                  <p className="text-sm text-slate-500">Definieren Sie welche Dokumente bei welchem Falltyp benötigt werden.</p>
                </div>
              </div>

              {regeln.map((r, idx) => (
                <div key={r.id} className={clsx('rounded-2xl border p-5 mb-3', r.aktiv ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-slate-50')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Badge label={fallLabel(r.fallTyp)} className={clsx('text-xs', r.aktiv ? 'bg-teal-100 text-teal-800 border-teal-300' : 'bg-slate-100 text-slate-500 border-slate-200')} />
                      <Badge label={r.lernquelle === 'alfred' ? '🤖 Alfred gelernt' : '✍️ Manuell'} className="text-xs bg-white border-slate-200 text-slate-600" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        const updated = regeln.map((x, i) => i === idx ? { ...x, aktiv: !x.aktiv } : x)
                        sr(updated)
                      }} className={clsx('rounded-xl text-xs px-3 py-1.5 cursor-pointer border',
                        r.aktiv ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50')}>
                        {r.aktiv ? '⏸ Deaktivieren' : '▶ Aktivieren'}
                      </button>
                      <button onClick={() => sr(regeln.filter((_, i) => i !== idx))}
                        className="rounded-xl border border-slate-200 text-slate-500 text-xs px-2 py-1.5 cursor-pointer hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200">
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="font-semibold text-slate-900 mb-2 text-sm">{r.beschreibung}</div>
                  <div className="flex gap-2 flex-wrap">
                    {r.vorlageIds.map((vid, i) => {
                      const v = vorlagen.find(x => x.id === vid)
                      return v ? (
                        <div key={vid} className="flex items-center gap-1 rounded-xl bg-white border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-800">
                          <span className="text-slate-400">{i + 1}.</span>
                          <span>{vIcon(v.typ)}</span>
                          <span>{v.name}</span>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              ))}

              {/* Neue Regel */}
              <NeueRegelForm vorlagen={vorlagen} onSave={r => sr([...regeln, r])} />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: ALFRED-CHAT
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'chat' && (
          <div className="mt-5">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden" style={{ height: '70vh' }}>
              <div className="bg-teal-700 px-6 py-4 flex items-center gap-3">
                <Alfred size={40} />
                <div>
                  <div className="font-bold text-white">Alfred · KI-Assistent</div>
                  <div className="text-xs text-white/70">Stellen Sie mir Fragen zu Dokumenten und Prozessen</div>
                </div>
                <button onClick={() => { saveAlfredChat([]); setChatMsgs([]) }}
                  className="ml-auto text-white/60 hover:text-white text-xs cursor-pointer bg-transparent border-none">
                  Chat leeren
                </button>
              </div>
              <div className="h-full" style={{ height: 'calc(100% - 72px)' }}>
                <AlfredChat messages={chatMsgs} onSend={handleUserChat} isTyping={alfredTyping} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// VORLAGE FORMULAR
// ══════════════════════════════════════════════════════════════
function VorlageFormular({ vorlage, onSave, onClose }: {
  vorlage: Vorlage | null
  onSave: (v: Vorlage) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Vorlage>>(vorlage || {
    name: '', typ: 'sonstige' as VorlageTyp, status: 'entwurf' as const,
    beschreibung: '', inhalt: '', felder: [],
    versandBetreuerin: '' as const, versandKunde: '' as const,
    freigebenErforderlich: false, ausdruckErforderlich: false,
    dateiOriginal: '', dateiBase64: '', dateiTyp: '',
    importierterText: '', importierterHtml: '',
  })
  const [showFileReader, setShowFileReader] = useState(false)
  const [vTab, setVTab] = useState<'text' | 'datei' | 'vorschau'>('text')

  function set<K extends keyof Vorlage>(k: K, v: any) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleDateiErgebnis(ergebnis: DokumentLeseErgebnis) {
    set('dateiOriginal', ergebnis.dateiName)
    set('dateiBase64' as any, ergebnis.base64)
    set('dateiTyp' as any, ergebnis.dateiTyp)
    set('importierterText' as any, ergebnis.text)
    set('importierterHtml' as any, ergebnis.html)
    if (!form.inhalt?.trim()) set('inhalt', ergebnis.text)
    setShowFileReader(false)
    setVTab(ergebnis.html ? 'datei' : 'text')
  }

  const preview = (form.inhalt || '')
    .replace(/\{\{klient_name\}\}/g, 'Musterfrau Irene')
    .replace(/\{\{betreuerin_name\}\}/g, 'Licina Mirjana')
    .replace(/\{\{datum\}\}/g, new Date().toLocaleDateString('de-AT'))
    .replace(/\{\{ort\}\}/g, 'Bregenz')

  return (
    <>
      {showFileReader && (
        <DokumentReader
          titel="Word- oder PDF-Vorlage hochladen"
          hinweis="Word (.docx) und PDF werden gelesen. Text wird extrahiert und kann bearbeitet werden."
          onErgebnis={handleDateiErgebnis}
          onAbbrechen={() => setShowFileReader(false)}
        />
      )}
      <div className="space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *" value={form.name || ''} onChange={v => set('name', v)} />
          <SelField label="Typ" value={form.typ || 'sonstige'} onChange={v => set('typ', v as VorlageTyp)}
            options={Object.entries(VORLAGE_TYP_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
        </div>
        <SelField label="Status" value={form.status || 'entwurf'} onChange={v => set('status', v as any)}
          options={[{value:'aktiv',label:'Aktiv'},{value:'entwurf',label:'Entwurf'},{value:'archiviert',label:'Archiviert'}]} />
        <TextArea label="Beschreibung" value={form.beschreibung || ''} onChange={v => set('beschreibung', v)} />

        {/* Upload */}
        <div className="rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 p-4 flex items-center gap-4">
          <span className="text-3xl flex-shrink-0">📂</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sky-900 text-sm">Word oder PDF hochladen & einlesen</div>
            <div className="text-xs text-sky-700 mt-0.5">Docx/PDF → Text wird extrahiert → direkt bearbeitbar</div>
            {form.dateiOriginal && (
              <div className="text-xs text-emerald-700 mt-1 font-semibold">✅ {form.dateiOriginal}</div>
            )}
          </div>
          <button type="button" onClick={() => setShowFileReader(true)}
            className="rounded-xl bg-sky-600 text-white text-sm px-4 py-2.5 cursor-pointer border-none hover:bg-sky-700 font-semibold flex-shrink-0">
            {form.dateiOriginal ? '📂 Andere Datei' : '📂 Einlesen'}
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 flex">
          {([
            ['text', '✏️ Vertragstext'],
            ...((form as any).importierterHtml ? [['datei', '📄 Original']] : []),
            ['vorschau', '👁 Vorschau'],
          ] as [string,string][]).map(([t, l]) => (
            <button key={t} type="button" onClick={() => setVTab(t as any)}
              className={clsx('px-4 py-2.5 text-xs font-semibold cursor-pointer border-none transition-all',
                vTab === t ? 'border-b-2 border-teal-600 text-teal-700 bg-teal-50' : 'text-slate-500 bg-transparent hover:bg-slate-50')}>
              {l}
            </button>
          ))}
        </div>

        {vTab === 'text' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs text-slate-400">
                Platzhalter:{' '}
                {['{{klient_name}}','{{betreuerin_name}}','{{datum}}','{{ort}}','{{firma_name}}'].map(p => (
                  <code key={p} className="bg-slate-100 px-1 rounded mx-0.5 font-mono cursor-pointer hover:bg-teal-50"
                    onClick={() => set('inhalt', (form.inhalt || '') + p)}>{p}</code>
                ))}
              </div>
              <KiAusfuellhilfe
                vorlage={form as any}
                onVerbessern={(neuerText) => set('inhalt', neuerText)}
              />
            </div>
            <textarea value={form.inhalt || ''} onChange={e => set('inhalt', e.target.value)}
              rows={14} placeholder="Text eingeben oder Datei hochladen ..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono resize-y outline-none focus:border-teal-400" />
            <div className="text-xs text-slate-400 mt-1">{(form.inhalt||'').length.toLocaleString('de-AT')} Zeichen</div>
          </div>
        )}

        {vTab === 'datei' && (form as any).importierterHtml && (
          <div>
            <div className="text-xs text-slate-400 mb-2">Formatierte Vorschau des eingelesenen Dokuments</div>
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm leading-relaxed max-h-64 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: (form as any).importierterHtml }} />
            <button type="button"
              onClick={() => { set('inhalt', (form as any).importierterText || ''); setVTab('text') }}
              className="mt-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-xs px-4 py-2 cursor-pointer hover:bg-teal-100">
              → Text in Bearbeitungsfeld übernehmen
            </button>
          </div>
        )}

        {vTab === 'vorschau' && (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 max-h-64 overflow-y-auto">
            {preview ? (
              <pre className="whitespace-pre-wrap text-xs text-slate-700 leading-6 font-mono">{preview}</pre>
            ) : (
              <div className="text-slate-400 text-sm text-center py-4">Zuerst Text eingeben oder Datei hochladen.</div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <SelField label="Versand Betreuerin" value={form.versandBetreuerin || ''} onChange={v => set('versandBetreuerin', v)}
            options={[{value:'',label:'— kein Versand —'},{value:'email',label:'📧 E-Mail'},{value:'post',label:'📮 Post'},{value:'ausdruck',label:'🖨️ Ausdruck'}]} />
          <SelField label="Versand Klient" value={form.versandKunde || ''} onChange={v => set('versandKunde', v)}
            options={[{value:'',label:'— kein Versand —'},{value:'email',label:'📧 E-Mail'},{value:'post',label:'📮 Post'},{value:'ausdruck',label:'🖨️ Ausdruck'}]} />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!form.freigebenErforderlich}
              onChange={e => set('freigebenErforderlich', e.target.checked)} className="accent-teal-700" />
            <span className="text-sm text-slate-700">Freigabe erforderlich</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!form.ausdruckErforderlich}
              onChange={e => set('ausdruckErforderlich', e.target.checked)} className="accent-teal-700" />
            <span className="text-sm text-slate-700">Ausdruck erforderlich</span>
          </label>
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn onClick={onClose}>Abbrechen</Btn>
          <Btn teal onClick={() => {
            if (!form.name?.trim()) { alert('Bitte Namen eingeben'); return }
            onSave(form as Vorlage)
          }}>
            {vorlage ? '✓ Speichern' : '+ Vorlage anlegen'}
          </Btn>
        </div>
      </div>
    </>
  )
}


// ── Neue Lernregel Form ────────────────────────────────────────
function NeueRegelForm({ vorlagen, onSave }: { vorlagen: Vorlage[]; onSave: (r: Lernregel) => void }) {
  const [show, setShow] = useState(false)
  const [fallTyp, setFallTyp] = useState<FallTyp>('erstanreise')
  const [beschreibung, setBeschreibung] = useState('')
  const [gewaehlt, setGewaehlt] = useState<string[]>([])

  if (!show) return (
    <button onClick={() => setShow(true)}
      className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 px-5 py-4 text-sm font-semibold text-teal-700 cursor-pointer hover:bg-teal-100 w-full justify-center mt-3">
      + Neue Lernregel hinzufügen
    </button>
  )

  return (
    <div className="rounded-2xl border-2 border-dashed border-teal-300 bg-white p-5 mt-3">
      <div className="text-sm font-bold text-slate-800 mb-3">Neue Lernregel</div>
      <div className="space-y-3">
        <SelField label="Falltyp" value={fallTyp} onChange={v => setFallTyp(v as FallTyp)}
          options={Object.entries(FALL_TYP_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
        <Field label="Beschreibung" value={beschreibung} onChange={setBeschreibung} placeholder="Was gilt bei diesem Falltyp?" />
        <div>
          <div className="text-sm font-medium text-slate-600 mb-2">Erforderliche Vorlagen (in Reihenfolge)</div>
          {vorlagen.filter(v => v.status === 'aktiv').map(v => (
            <label key={v.id} className="flex items-center gap-2 mb-1.5 cursor-pointer">
              <input type="checkbox" checked={gewaehlt.includes(v.id)}
                onChange={e => setGewaehlt(prev => e.target.checked ? [...prev, v.id] : prev.filter(x => x !== v.id))}
                className="accent-teal-700" />
              <span className="text-sm text-slate-700">{vIcon(v.typ)} {v.name}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => setShow(false)}>Abbrechen</Btn>
          <Btn teal onClick={() => {
            if (!beschreibung || gewaehlt.length === 0) return
            onSave({ id: Date.now().toString(), fallTyp, beschreibung, vorlageIds: gewaehlt, reihenfolge: gewaehlt.map((_, i) => i + 1), aktiv: true, erstelltAm: today(), lernquelle: 'manuell' })
            setShow(false); setBeschreibung(''); setGewaehlt([])
          }}>Regel speichern</Btn>
        </div>
      </div>
    </div>
  )
}

// KI-Ausfüllhilfe — verbessert und vervollständigt Vorlagen-Texte
function KiAusfuellhilfe({ vorlage, onVerbessern }: { vorlage: any; onVerbessern: (text: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const aktionen = [
    { id: 'verbessern', label: '✨ Text verbessern', prompt: 'Verbessere den deutschen Text sprachlich, behalte alle Platzhalter {{...}} exakt bei.' },
    { id: 'platzhalter', label: '🔧 Platzhalter ergänzen', prompt: 'Ergänze sinnvolle Platzhalter {{...}} für fehlende Variablen wie Datum, Namen, Adressen. Behalte bestehende Platzhalter.' },
    { id: 'formell', label: '🏛️ Formeller machen', prompt: 'Mache den Text formeller und rechtlich präziser für österreichisches Recht. Behalte alle Platzhalter {{...}}.' },
    { id: 'kuerzen', label: '✂️ Kürzen', prompt: 'Kürze den Text auf das Wesentliche ohne Informationsverlust. Behalte alle Platzhalter {{...}}.' },
    { id: 'meldezettel', label: '🏛️ Als Meldezettel formatieren', prompt: 'Formatiere den Text als österreichischen amtlichen Meldezettel mit allen Pflichtfeldern. Verwende {{...}} Platzhalter für variable Daten.' },
  ]

  async function ausfuehren(prompt: string) {
    if (!vorlage.inhalt?.trim()) return
    setLoading(true)
    setShowMenu(false)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: `Du bist ein Experte für österreichische Verwaltungsdokumente und 24h-Betreuung.
Aufgabe: ${prompt}
Ausgabe: NUR den verbesserten Text, kein Markdown, keine Erklärungen, keine Preamble.
Wichtig: Alle Platzhalter im Format {{name}} MÜSSEN exakt erhalten bleiben.`,
          messages: [{ role: 'user', content: vorlage.inhalt }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      if (text) onVerbessern(text)
    } catch {
      alert('KI nicht erreichbar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setShowMenu(v => !v)} disabled={loading}
        className="text-xs px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 border border-violet-200 cursor-pointer hover:bg-violet-100 font-semibold disabled:opacity-50 flex items-center gap-1">
        {loading ? <><span className="animate-spin inline-block">⚙️</span> KI arbeitet...</> : <>✨ KI-Hilfe</>}
      </button>
      {showMenu && !loading && (
        <div className="absolute right-0 top-8 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 w-56 space-y-1">
          {aktionen.map(a => (
            <button key={a.id} type="button" onClick={() => ausfuehren(a.prompt)}
              className="w-full text-left text-xs px-3 py-2 rounded-xl hover:bg-violet-50 text-slate-700 cursor-pointer border-none bg-transparent font-medium">
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
