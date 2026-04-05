'use client'
/**
 * KI-Vorlagenauswahl — Intelligente Vorschläge welche Vorlagen für einen Fall benötigt werden
 * Nutzt Claude API um basierend auf Klient/Betreuerin/Ereignis die richtigen Vorlagen zu empfehlen
 */

import { useState } from 'react'
import type { Vorlage } from '@/lib/dokumente'
import type { Klient } from '@/lib/klienten'
import type { Betreuerin } from '@/lib/betreuerinnen'

interface KiVorlagenAuswahlProps {
  vorlagen: Vorlage[]
  klient?: Klient | null
  betreuerin?: Betreuerin | null
  ereignis?: string  // z.B. "Neueintritt", "Wechsel", "Einsatzende"
  onAuswahl: (ids: string[]) => void
  onClose: () => void
}

const EREIGNISSE = [
  { id: 'neueintritt', label: '🆕 Neueintritt Klient', desc: 'Erstmalige Aufnahme eines neuen Klienten' },
  { id: 'betreuerwechsel', label: '🔄 Betreuerwechsel', desc: 'Eine Betreuerin wechselt zu einem anderen Klienten' },
  { id: 'neue_betreuerin', label: '👩 Neue Betreuerin', desc: 'Neue Betreuerin beginnt beim bestehenden Klienten' },
  { id: 'einsatzende', label: '🏁 Einsatzende', desc: 'Betreuungsverhältnis wird beendet' },
  { id: 'monatsabrechnung', label: '💶 Monatsabrechnung', desc: 'Monatliche Rechnungsstellung' },
  { id: 'wiederanreise', label: '🚌 Wiederanreise', desc: 'Betreuerin kommt nach Urlaub zurück' },
  { id: 'sonstiges', label: '📋 Sonstiges', desc: 'Eigene Beschreibung eingeben' },
]

export default function KiVorlagenAuswahl({ vorlagen, klient, betreuerin, ereignis: initEreignis, onAuswahl, onClose }: KiVorlagenAuswahlProps) {
  const [ereignis, setEreignis] = useState(initEreignis || '')
  const [eigeneBeschreibung, setEigeneBeschreibung] = useState('')
  const [loading, setLoading] = useState(false)
  const [vorschlaege, setVorschlaege] = useState<{id: string, grund: string, prioritaet: 'hoch'|'mittel'|'optional'}[]>([])
  const [ausgewaehlt, setAusgewaehlt] = useState<string[]>([])
  const [fehler, setFehler] = useState('')

  async function analysiereKI() {
    if (!ereignis) return
    setLoading(true)
    setFehler('')
    setVorschlaege([])

    const vorlagenListe = (vorlagen||[]).map(v => `- ${v.id}: "${v.name}" (Typ: ${v.typ})`).join('\n')
    const kontext = [
      klient ? `Klient: ${klient.vorname} ${klient.nachname}, Pflegestufe ${klient.pflegestufe}, ${klient.ort}` : '',
      betreuerin ? `Betreuerin: ${betreuerin.vorname} ${betreuerin.nachname}, ${betreuerin.nationalitaet || betreuerin.staatsangehoerigkeit}` : '',
      `Ereignis: ${EREIGNISSE.find(e => e.id === ereignis)?.label || ereignis}`,
      eigeneBeschreibung ? `Beschreibung: ${eigeneBeschreibung}` : '',
    ].filter(Boolean).join('\n')

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `Du bist ein Experte für österreichische 24h-Betreuung. 
Deine Aufgabe: Analysiere den Fall und empfehle welche Dokumentvorlagen benötigt werden.
Antworte NUR mit einem JSON-Array ohne Markdown, Erklärungen oder Preamble.
Format: [{"id": "vorlage_id", "grund": "kurze Begründung (max 60 Zeichen)", "prioritaet": "hoch|mittel|optional"}]
Nur IDs aus der bereitgestellten Liste verwenden.`,
          messages: [{
            role: 'user',
            content: `Kontext:\n${kontext}\n\nVerfügbare Vorlagen:\n${vorlagenListe}\n\nWelche Vorlagen werden für diesen Fall benötigt?`
          }]
        })
      })

      const data = await res.json()
      const text = data.content?.[0]?.text || '[]'
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      
      if (Array.isArray(parsed)) {
        setVorschlaege(parsed)
        // Hohe Priorität automatisch vorauswählen
        setAusgewaehlt(parsed.filter((v: any) => v.prioritaet === 'hoch').map((v: any) => v.id))
      }
    } catch (e) {
      // Fallback: regelbasierte Auswahl
      const fallback = regelbasierteAuswahl(ereignis, vorlagen)
      setVorschlaege(fallback)
      setAusgewaehlt(fallback.filter(v => v.prioritaet === 'hoch').map(v => v.id))
      setFehler('KI nicht verfügbar — regelbasierte Auswahl verwendet')
    } finally {
      setLoading(false)
    }
  }

  function toggleVorlage(id: string) {
    setAusgewaehlt(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const prioritaetFarbe = (p: string) => ({
    hoch: 'bg-rose-50 border-rose-200 text-rose-700',
    mittel: 'bg-amber-50 border-amber-200 text-amber-700',
    optional: 'bg-slate-50 border-slate-200 text-slate-500',
  }[p] || 'bg-slate-50 border-slate-200 text-slate-500')

  const prioritaetLabel = (p: string) => ({ hoch: '🔴 Pflicht', mittel: '🟡 Empfohlen', optional: '⚪ Optional' }[p] || p)

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-2xl mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-teal-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-white/60 uppercase tracking-widest mb-1">KI-Assistent</div>
              <div className="text-xl font-bold text-white">✨ Intelligente Vorlagenauswahl</div>
              {klient && <div className="text-sm text-white/70 mt-1">für {klient.vorname} {klient.nachname}</div>}
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white text-2xl bg-transparent border-none cursor-pointer">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Ereignis wählen */}
          <div>
            <div className="text-sm font-bold text-slate-700 mb-3">Was ist der Anlass?</div>
            <div className="grid grid-cols-2 gap-2">
              {EREIGNISSE.map(e => (
                <button key={e.id} onClick={() => setEreignis(e.id)}
                  className={`text-left rounded-2xl border p-3 cursor-pointer transition-all ${ereignis === e.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div className="text-sm font-semibold text-slate-800">{e.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{e.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {ereignis === 'sonstiges' && (
            <textarea value={eigeneBeschreibung} onChange={e => setEigeneBeschreibung(e.target.value)}
              placeholder="Beschreiben Sie den Fall genau..."
              className="w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none resize-none h-20" />
          )}

          {/* KI analysieren */}
          {ereignis && !vorschlaege.length && (
            <button onClick={analysiereKI} disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-teal-600 text-white font-bold py-3 cursor-pointer border-none hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? (
                <><span className="animate-spin">⚙️</span> KI analysiert den Fall...</>
              ) : (
                <><span>✨</span> KI-Analyse starten</>
              )}
            </button>
          )}

          {fehler && <div className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3">⚠️ {fehler}</div>}

          {/* Vorschläge */}
          {vorschlaege.length > 0 && (
            <div>
              <div className="text-sm font-bold text-slate-700 mb-3">
                KI-Empfehlungen — {ausgewaehlt.length} ausgewählt
              </div>
              <div className="space-y-2">
                {['hoch', 'mittel', 'optional'].map(prio => {
                  const gruppe = vorschlaege.filter(v => v.prioritaet === prio)
                  if (!gruppe.length) return null
                  return (
                    <div key={prio}>
                      <div className="text-xs text-slate-400 uppercase tracking-widest mb-1.5">{prioritaetLabel(prio)}</div>
                      {gruppe.map(vorschlag => {
                        const vorlage = (vorlagen||[]).find(v => v.id === vorschlag.id)
                        if (!vorlage) return null
                        const aktiv = ausgewaehlt.includes(vorschlag.id)
                        return (
                          <div key={vorschlag.id} onClick={() => toggleVorlage(vorschlag.id)}
                            className={`rounded-2xl border p-3 cursor-pointer transition-all flex items-start gap-3 ${aktiv ? 'border-teal-400 bg-teal-50' : prioritaetFarbe(prio)}`}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${aktiv ? 'border-teal-500 bg-teal-500' : 'border-slate-300'}`}>
                              {aktiv && <span className="text-white text-xs">✓</span>}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{vorlage.name}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{vorschlag.grund}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => { setVorschlaege([]); setAusgewaehlt([]) }}
                  className="flex-1 rounded-2xl border border-slate-200 text-slate-600 text-sm py-2.5 cursor-pointer hover:bg-slate-50">
                  ↺ Neu analysieren
                </button>
                <button onClick={() => onAuswahl(ausgewaehlt)} disabled={ausgewaehlt.length === 0}
                  className="flex-1 rounded-2xl bg-teal-600 text-white font-bold text-sm py-2.5 cursor-pointer border-none hover:bg-teal-700 disabled:opacity-50">
                  ✓ {ausgewaehlt.length} Vorlagen übernehmen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Regelbasierte Fallback-Auswahl
function regelbasierteAuswahl(ereignis: string, vorlagen: Vorlage[]) {
  const regeln: Record<string, {ids: string[], prioritaet: 'hoch'|'mittel'|'optional', grund: string}[]> = {
    neueintritt: [
      { ids: ['vorlage_meldezettel_anmeldung'], prioritaet: 'hoch', grund: 'Pflicht bei Einzug' },
      { ids: ['vorlage_email_vorstellung_betreuerin'], prioritaet: 'hoch', grund: 'Betreuerin vorstellen' },
      { ids: ['vorlage_rechnung_klient'], prioritaet: 'mittel', grund: 'Erste Rechnung' },
    ],
    betreuerwechsel: [
      { ids: ['vorlage_meldezettel_ummeldung'], prioritaet: 'hoch', grund: 'Um- und Anmeldung nötig' },
      { ids: ['vorlage_meldezettel_abmeldung'], prioritaet: 'hoch', grund: 'Abmeldung alte Betreuerin' },
      { ids: ['vorlage_email_vorstellung_betreuerin'], prioritaet: 'mittel', grund: 'Neue Betreuerin vorstellen' },
    ],
    neue_betreuerin: [
      { ids: ['vorlage_meldezettel_anmeldung'], prioritaet: 'hoch', grund: 'Anmeldung neue Betreuerin' },
      { ids: ['vorlage_email_vorstellung_betreuerin'], prioritaet: 'hoch', grund: 'Vorstellung ans Klient' },
    ],
    einsatzende: [
      { ids: ['vorlage_meldezettel_abmeldung'], prioritaet: 'hoch', grund: 'Abmeldung erforderlich' },
    ],
    monatsabrechnung: [
      { ids: ['vorlage_rechnung_klient'], prioritaet: 'hoch', grund: 'Monatsrechnung' },
      { ids: ['vorlage_honorarnote_betreuerin'], prioritaet: 'hoch', grund: 'Honorarnote Betreuerin' },
      { ids: ['vorlage_email_rechnung'], prioritaet: 'mittel', grund: 'Per E-Mail versenden' },
    ],
  }

  const zuordnungen = regeln[ereignis] || []
  const result: {id: string, grund: string, prioritaet: 'hoch'|'mittel'|'optional'}[] = []

  zuordnungen.forEach(regel => {
    regel.ids.forEach(id => {
      if ((vorlagen||[]).find(v => v.id === id)) {
        result.push({ id, grund: regel.grund, prioritaet: regel.prioritaet })
      }
    })
  })

  return result
}
