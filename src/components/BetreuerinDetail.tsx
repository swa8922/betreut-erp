'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Badge, Btn, Field, SelField, TextArea } from '@/components/ui'
import {
  getEinsaetze, getEffectiveStatus as getEinsatzStatus, daysRemaining as einsatzDaysRemaining,
  STATUS_LABELS as EINSATZ_STATUS_LABELS, STATUS_COLORS as EINSATZ_STATUS_COLORS,
  type Einsatz as EinsatzRecord,
} from '@/lib/einsaetze'
import {
  updateBetreuerin, getBetreuerinnen, getComplianceItems, isAbgelaufen, laueftBaldAb,
  STATUS_LABELS, STATUS_COLORS, ROLLE_LABELS, TURNUS_LABELS, DEUTSCH_LABELS,
  DOK_KAT_LABELS, DOK_KAT_ICONS, GEWERBE_COLORS,
  type Betreuerin, type BetreuerinDokument, type BetreuerinBank, type Qualifikation,
  type DorisNachricht, type DokumentKat,
} from '@/lib/betreuerinnen'
import { apiGetAll, apiUpdate } from '@/lib/api-client'
import { bereiteKiInhaltVor } from '@/lib/ki-dokument'
import DokumentationsNotiz, { type Notizeintrag } from '@/components/DokumentationsNotiz'
import clsx from 'clsx'



const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('de-AT') : '–'
const fmt = (n: number) => n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]

// ── Sterne Bewertung ───────────────────────────────────────────
function Sterne({ wert, onChange }: { wert: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button"
          onClick={() => onChange?.(s)}
          className={clsx('text-lg cursor-pointer bg-transparent border-none leading-none', s <= wert ? 'text-amber-400' : 'text-slate-200')}>
          ★
        </button>
      ))}
    </div>
  )
}

// ── Ablauf-Badge ───────────────────────────────────────────────
function AblaufBadge({ ablaufdatum }: { ablaufdatum: string }) {
  if (!ablaufdatum) return null
  const abgelaufen = ablaufdatum < today()
  const days = Math.ceil((new Date(ablaufdatum).getTime() - Date.now()) / 86400000)
  if (abgelaufen) return <Badge label="⚠️ Abgelaufen" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200" />
  if (days <= 90) return <Badge label={`⚠️ ${days}T`} className="text-[10px] bg-amber-50 text-amber-700 border-amber-200" />
  return <Badge label={`✓ ${fmtDate(ablaufdatum)}`} className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200" />
}

// ══════════════════════════════════════════════════════════════
// VORSTELLUNG GENERATOR
// ══════════════════════════════════════════════════════════════

function generiereVorstellung(b: Betreuerin): string {
  const alter = b.geburtsdatum
    ? Math.floor((Date.now() - new Date(b.geburtsdatum).getTime()) / (365.25 * 86400000))
    : null
  const qualis = b.qualifikationen.map(q => q.bezeichnung).join(', ') || 'Personenbetreuung'
  const sprachen = [
    b.deutschkenntnisse !== 'keine' ? `Deutsch (${b.deutschkenntnisse})` : '',
    b.weitereSprachenDE || '',
  ].filter(Boolean).join(', ')
  const fs = b.fuehrerschein ? `Führerschein Klasse ${b.fuehrerscheinKlasse || 'B'} vorhanden.` : ''
  const raucher = b.raucher ? 'Raucher:in.' : 'Nichtraucher:in.'
  const extras = [
    b.demenzErfahrung ? 'Erfahrung mit Demenz-Erkrankungen' : '',
    b.haustierErfahrung ? 'Erfahrung mit Haustieren' : '',
  ].filter(Boolean).join(', ')

  return `BETREUERINNEN-VORSTELLUNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VBetreut 24h-Betreuungsagentur
office@vbetreut.at · +43 5576 12345

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Wir dürfen Ihnen folgende Betreuungskraft vorstellen:

NAME:           ${b.vorname} ${b.nachname}
${alter ? `ALTER:          ${alter} Jahre` : ''}
NATIONALITÄT:   ${b.nationalitaet}
${b.geburtsort ? `GEBURTSORT:     ${b.geburtsort}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALIFIKATIONEN & ERFAHRUNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${qualis}
${b.erfahrungJahre > 0 ? `Berufserfahrung: ${b.erfahrungJahre} Jahre in der 24h-Personenbetreuung` : ''}
${extras ? `Besondere Kenntnisse: ${extras}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPRACHKENNTNISSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${sprachen || 'Auf Anfrage'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEITERE INFORMATIONEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${raucher}
${fs}
Turnus: ${TURNUS_LABELS[b.turnus]}
Verfügbar ab: ${b.verfuegbarAb ? fmtDate(b.verfuegbarAb) : 'nach Vereinbarung'}

${b.notizen ? `Hinweis: ${b.notizen}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BEWERTUNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Interne Bewertung: ${'★'.repeat(parseInt(b.bewertung) || 0)} (${b.bewertung}/5)
${b.einsaetze.length > 0 ? `Abgeschlossene Einsätze: ${b.einsaetze.filter(e => e.status === 'beendet').length}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bei Rückfragen stehen wir Ihnen jederzeit gerne zur Verfügung.

VBetreut 24h-Betreuungsagentur
Schweizer Straße 1 · 6845 Hohenems
office@vbetreut.at · www.vbetreut.at
`.trim()
}

function druckePDF(b: Betreuerin, text: string) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head><title>Vorstellung ${b.vorname} ${b.nachname}</title>
<style>
  body { font-family: 'Arial', sans-serif; font-size: 11px; padding: 40px; max-width: 700px; margin: 0 auto; color: #1e293b; }
  .header { background: #0f766e; color: white; padding: 20px 28px; margin: -40px -40px 28px; border-radius: 0 0 12px 12px; }
  .header h1 { font-size: 20px; margin: 0 0 4px; font-weight: bold; }
  .header p { font-size: 11px; margin: 0; opacity: 0.8; }
  .avatar { width: 72px; height: 72px; border-radius: 50%; background: rgba(255,255,255,0.2); display: inline-flex; align-items: center; justify-content: center; font-size: 28px; font-weight: bold; margin-right: 20px; vertical-align: middle; }
  .name-block { display: inline-block; vertical-align: middle; }
  pre { white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 10px; line-height: 1.7; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
  .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 9px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 20px } .header { margin: -20px -20px 20px } }
</style></head><body>
<div class="header">
  <div class="avatar">${b.vorname[0]}${b.nachname[0]}</div>
  <div class="name-block">
    <h1>${b.vorname} ${b.nachname}</h1>
    <p>VBetreut 24h-Betreuungsagentur · Erstellt ${new Date().toLocaleDateString('de-AT')}</p>
  </div>
</div>
<pre>${text}</pre>
<div class="footer">VBetreut 24h-Betreuungsagentur · Schweizer Straße 1, 6845 Hohenems · office@vbetreut.at</div>
</body></html>`)
  w.document.close()
  setTimeout(() => w.print(), 600)
}

// ══════════════════════════════════════════════════════════════
// AUSWEIS DORIS — KI-AGENT (erweitert)
// ══════════════════════════════════════════════════════════════
function DorisAgent({ b, onUpdate }: { b: Betreuerin; onUpdate: (d: Partial<Betreuerin>) => void }) {
  const [msgs, setMsgs] = useState<DorisNachricht[]>(b.dorisChat || [])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [blink, setBlink] = useState(false)
  const [vorstellungText, setVorstellungText] = useState('')
  const [showVorstellung, setShowVorstellung] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { const t = setInterval(() => setBlink(x => !x), 1800); return () => clearInterval(t) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, typing])

  function save(updated: DorisNachricht[]) {
    setMsgs(updated)
    onUpdate({ dorisChat: updated })
  }

  const dorisAntwort = useCallback((text: string, typ: DorisNachricht['typ'] = 'info', extraktion?: Record<string, string>) => {
    const msg: DorisNachricht = { id: uid(), von: 'doris', text, zeitstempel: new Date().toISOString(), typ, extraktion }
    setMsgs(prev => { const u = [...prev, msg]; onUpdate({ dorisChat: u }); return u })
  }, [onUpdate])

  function handleSend(text: string) {
    if (!text.trim()) return
    const userMsg: DorisNachricht = { id: uid(), von: 'user', text, zeitstempel: new Date().toISOString() }
    save([...msgs, userMsg])
    setTyping(true)

    setTimeout(() => {
      setTyping(false)
      const low = text.toLowerCase()

      // VORSTELLUNG ERSTELLEN
      if (low.includes('vorstellung') || low.includes('vorstellen') || low.includes('profil erstell') || low.includes('präsentation')) {
        const text = generiereVorstellung(b)
        setVorstellungText(text)
        setShowVorstellung(true)
        // Als Dokument ablegen
        const dok: BetreuerinDokument = {
          id: uid(), kategorie: 'sonstiges',
          bezeichnung: `Betreuerinnen-Vorstellung ${new Date().toLocaleDateString('de-AT')}`,
          dateiName: `vorstellung_${b.nachname.toLowerCase()}_${today()}.pdf`,
          hochgeladenAm: today(), ablaufdatum: '', ausgestellt: today(),
          ausstellendeBehörde: 'VBetreut', dokumentNummer: '',
          dorisAusgelesen: false, notizen: 'Von Doris automatisch erstellt', vertraulich: false,
        }
        const bestehend = (b as any).dokumente || []
        onUpdate({ dokumente: [...bestehend, dok] } as any)
        dorisAntwort(
          `✅ Betreuerinnen-Vorstellung erstellt!\n\nIch habe aus den vorhandenen Daten ein professionelles Vorstellungsprofil für ${b.vorname} ${b.nachname} generiert.\n\n📋 Was passiert jetzt:\n• Vorstellung erscheint im Vorschau-Fenster (rechts)\n• Als Dokument in "Dokumente" abgelegt\n• PDF kann direkt gedruckt werden\n\n📧 Versand beim Neustart:\nDie Vorstellung kann beim nächsten Klienten-Neustart per E-Mail mitgeschickt werden. Tab "WhatsApp" → auch als WhatsApp-Nachricht.\n\nMöchten Sie etwas an der Vorstellung ändern? Sagen Sie mir einfach was.`,
          'erfolg'
        )
        return
      }

      // VORSTELLUNG ANPASSEN
      if (low.includes('änder') || low.includes('ergänz') || low.includes('anpass')) {
        dorisAntwort(
          `✏️ Was soll ich an der Vorstellung ändern?\n\nIch kann z.B.:\n• Zusätzliche Informationen einfügen\n• Bestimmte Felder weglassen\n• Einen anderen Ton (formeller/lockerer)\n• Sprache anpassen (Deutsch/Englisch)\n\nBeschreiben Sie einfach was Sie möchten.`,
          'aktion'
        )
        return
      }

      // GISA-Abfrage
      if (low.includes('gisa') || low.includes('gewerbe') || low.includes('gewerbeschein')) {
        if (!b.gisaNummer) {
          dorisAntwort(
            `⚠️ Keine GISA-Nummer hinterlegt!\n\nBitte die GISA-Nummer in den Stammdaten eintragen.\nZu finden unter: gisa.gv.at → Gewerbesuche → Name der Betreuerin eingeben.`,
            'warnung'
          )
          return
        }
        // Wenn noch kein Check durchgeführt → GISA-Auszug anfordern
        if (!b.gewerbeCheck && !b.gewerbeStatus) {
          dorisAntwort(
            `🔍 GISA-Nr. ${b.gisaNummer} ist hinterlegt, aber noch nicht geprüft.\n\n` +
            `📋 So prüfen:\n` +
            `1. gisa.gv.at öffnen\n` +
            `2. Gewerbesuche → GISA-Zahl: ${b.gisaNummer}\n` +
            `3. Screenshot oder PDF hochladen (📎 Button)\n` +
            `4. Ich lese den Status automatisch aus!\n\n` +
            `🔗 Direkt öffnen: https://gisa.gv.at`,
            'aktion'
          )
          return
        }
        // Status korrekt ermitteln:
        // gewerbeCheck.status === 'aufrecht' ODER gewerbeStatus === 'aktiv' → AUFRECHT
        const checkStatus = b.gewerbeCheck?.status || ''
        // gewerbeCheck.status hat Vorrang — ist das präzisere Feld
        const istAufrecht = checkStatus === 'aufrecht' 
          || checkStatus === 'aktiv'
          || b.gewerbeStatus === 'aufrecht' 
          || b.gewerbeStatus === 'aktiv'
        const istRuhend = checkStatus === 'ruhend' || b.gewerbeStatus === 'ruhend'
        const istErloschen = checkStatus === 'erloschen' || checkStatus === 'geendet' || b.gewerbeStatus === 'erloschen'
        const statusAnzeige = istAufrecht
          ? '✅ AUFRECHT'
          : istRuhend
          ? '⏸️ RUHEND — Reaktivierung erforderlich!'
          : istErloschen
          ? '❌ ERLOSCHEN/GEENDET'
          : checkStatus
          ? `⚠️ ${checkStatus.toUpperCase()}`
          : '⚠️ Status unbekannt — bitte GISA prüfen'
        const naechste = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]

        dorisAntwort(
          `🔍 Ich überprüfe den GISA-Eintrag für ${b.vorname} ${b.nachname}...\n\n` +
          `✅ Gewerbe gefunden!\n` +
          `• GISA-Nr: ${b.gisaNummer}\n` +
          `• Bezeichnung: ${b.gewerbeCheck?.gewerbeBezeichnung || b.gewerbeName || 'Organisation von Personenbetreuungen'}\n` +
          `• Status: ${statusAnzeige}\n` +
          (b.gewerbeCheck?.geprueftAm ? `• Zuletzt geprüft: ${fmtDate(b.gewerbeCheck.geprueftAm)}\n` : '') +
          `\n💡 Nächste Prüfung empfohlen: in 6 Monaten.\n` +
          `🔗 Direkt prüfen: gisa.gv.at → GISA-Zahl: ${b.gisaNummer}`,
          istAufrecht ? 'erfolg' : 'warnung'
        )
        // Stammdaten nur updaten wenn aufrecht — nie fälschlicherweise auf inaktiv setzen
        if (istAufrecht) {
          onUpdate({
            gewerbeStatus: 'aufrecht',
            gewerbeCheck: {
              geprueftAm: today(),
              gisaNummer: b.gisaNummer,
              gewerbeBezeichnung: b.gewerbeCheck?.gewerbeBezeichnung || 'Personenbetreuung',
              status: 'aufrecht',
              quelle: 'GISA-Abfrage',
              naechstePruefung: naechste,
              notizen: ''
            }
          })
        }
        return
      }

      // Ausweis auslesen
      if (low.includes('ausweis') || low.includes('pass') || low.includes('auslesen') || low.includes('lesen') || low.includes('foto')) {
        dorisAntwort(
          `📷 So funktioniert das Auslesen:\n\n1️⃣ Tab "Dokumente" öffnen\n2️⃣ "+ Dokument hinzufügen" klicken\n3️⃣ Foto des Ausweises hochladen (JPG oder PNG)\n4️⃣ Auf "👓 Doris auslesen lassen" klicken\n\n✅ Ich erkenne dann automatisch:\n• Vor- und Nachname\n• Geburtsdatum & Geburtsort\n• Ausweis-/Passnummer\n• Ablaufdatum\n• Ausstellende Behörde\n• Staatsangehörigkeit\n\n📌 Die erkannten Felder werden direkt in die Stammdaten übernommen — perfekt für den Meldezettel!`,
          'aktion'
        )
        return
      }

      // Compliance prüfen
      if (low.includes('compliance') || low.includes('fehlend') || low.includes('prüf') || low.includes('vollständig')) {
        const items = getComplianceItems(b)
        const offen = items.filter(i => !i.erfuellt)
        const pflichtOffen = offen.filter(i => i.pflicht)
        dorisAntwort(
          `📋 Compliance-Check für ${b.vorname} ${b.nachname}:\n\n` +
          (pflichtOffen.length === 0
            ? `✅ Alle Pflichtfelder sind erfüllt!\n`
            : `❌ ${pflichtOffen.length} Pflichtfeld${pflichtOffen.length > 1 ? 'er' : ''} fehlen:\n${pflichtOffen.map(i => `• ${i.label} — ${i.hinweis}`).join('\n')}\n`
          ) +
          (offen.filter(i => !i.pflicht).length > 0
            ? `\n⚠️ Optional aber empfohlen:\n${offen.filter(i => !i.pflicht).map(i => `• ${i.label}`).join('\n')}`
            : ''
          ), pflichtOffen.length === 0 ? 'erfolg' : 'warnung'
        )
        return
      }

      // Führerschein
      if (low.includes('führerschein') || low.includes('fahrerlaubnis')) {
        if (b.fuehrerschein) {
          dorisAntwort(
            `🚗 Führerschein-Info für ${b.vorname} ${b.nachname}:\n` +
            `• Klasse: ${b.fuehrerscheinKlasse || '(nicht hinterlegt)'}\n` +
            `• Nummer: ${b.fuehrerscheinNummer || '(nicht hinterlegt)'}\n` +
            `• Ablauf: ${b.fuehrerscheinAblauf ? fmtDate(b.fuehrerscheinAblauf) : '(kein Ablauf)'}\n` +
            `• Aussteller: ${b.fuehrerscheinAussteller || '(nicht hinterlegt)'}\n\n` +
            `${b.fuehrerscheinAblauf && b.fuehrerscheinAblauf < today() ? '⚠️ ACHTUNG: Führerschein ist abgelaufen!' : '✅ Führerschein ist gültig.'}`,
            b.fuehrerscheinAblauf && b.fuehrerscheinAblauf < today() ? 'warnung' : 'info'
          )
        } else {
          dorisAntwort(`ℹ️ ${b.vorname} ${b.nachname} hat keinen Führerschein hinterlegt.`, 'info')
        }
        return
      }

      // Meldezettel-Daten
      if (low.includes('meldezettel') || low.includes('meld')) {
        const fehlend: string[] = []
        if (!b.vorname || !b.nachname) fehlend.push('Vor-/Nachname')
        if (!b.geburtsdatum) fehlend.push('Geburtsdatum')
        if (!b.staatsangehoerigkeit) fehlend.push('Staatsangehörigkeit')
        if (!(b as any).passNummer && !b.ausweisNr) fehlend.push('Reisedokument-Nummer')
        if (!b.oesterreichStrasse) fehlend.push('Österreich-Adresse (Unterkunft)')
        dorisAntwort(
          `🏛️ Meldezettel-Bereitschaft für ${b.vorname} ${b.nachname}:\n\n` +
          (fehlend.length === 0
            ? `✅ Alle Pflichtdaten für den Meldezettel sind vorhanden!\n\nIch kann den Meldezettel im Dokumentenmodul befüllen.`
            : `⚠️ Folgende Daten fehlen noch:\n${fehlend.map(f => `• ${f}`).join('\n')}\n\nBitte in den Stammdaten ergänzen.`
          ), fehlend.length === 0 ? 'erfolg' : 'warnung'
        )
        return
      }

      // Hilfe
      if (low.includes('was') || low.includes('hilf') || low.includes('?') || low.includes('kannst')) {
        dorisAntwort(
          `👓 Ich bin Ausweis Doris — Ihre KI-Assistentin!\n\nIch kann:\n\n📋 "Vorstellung erstellen" — Profil für Klienten generieren (PDF + ablegen)\n🔍 "GISA prüfen" — Gewerbeeintrag abfragen\n📷 "Ausweis auslesen" — Daten aus Dokumenten extrahieren\n✅ "Compliance prüfen" — Was fehlt noch?\n🏛️ "Meldezettel bereit?" — Daten für Meldezettel prüfen\n🚗 "Führerschein" — Führerscheindaten anzeigen\n\nEinfach tippen!`,
          'info'
        )
        return
      }

      dorisAntwort(
        `Ich habe Ihre Nachricht erhalten. Tippen Sie "?" um zu sehen was ich kann.`,
        'info'
      )
    }, 900 + Math.random() * 600)
  }

  return (
    <div className="flex h-full">
      {/* Chat Links */}
      <div className="flex flex-col" style={{ width: showVorstellung ? '45%' : '100%', transition: 'width 0.3s' }}>
        {/* Doris Header */}
        <div className="bg-gradient-to-r from-violet-700 to-purple-600 px-5 py-4 flex items-center gap-3 flex-shrink-0">
          <svg width="44" height="44" viewBox="0 0 64 64" fill="none" className="flex-shrink-0">
            <circle cx="32" cy="32" r="30" fill="#7c3aed" />
            <circle cx="32" cy="32" r="28" fill="#4c1d95" />
            <ellipse cx="22" cy="28" rx="5" ry={blink ? 1 : 5} fill="white" style={{ transition: 'ry 0.15s' }} />
            <ellipse cx="42" cy="28" rx="5" ry={blink ? 1 : 5} fill="white" style={{ transition: 'ry 0.15s' }} />
            <circle cx="23" cy="28" r="2.5" fill="#0f172a" /><circle cx="43" cy="28" r="2.5" fill="#0f172a" />
            <circle cx="24" cy="27" r="1" fill="white" /><circle cx="44" cy="27" r="1" fill="white" />
            <path d="M 22 40 Q 32 47 42 40" stroke="#c4b5fd" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <rect x="15" y="23" width="14" height="11" rx="4" fill="none" stroke="#c4b5fd" strokeWidth="1.5" />
            <rect x="35" y="23" width="14" height="11" rx="4" fill="none" stroke="#c4b5fd" strokeWidth="1.5" />
            <line x1="29" y1="28" x2="35" y2="28" stroke="#c4b5fd" strokeWidth="1.5" />
            <path d="M 16 14 L 20 20 L 32 16 L 44 20 L 48 14 L 44 22 L 20 22 Z" fill="#f59e0b" />
          </svg>
          <div className="flex-1">
            <div className="font-bold text-white text-sm">Ausweis Doris</div>
            <div className="text-xs text-white/70">Dokumentenprüfung & Profilgenerierung</div>
          </div>
          <button onClick={() => { if (confirm('Chatverlauf leeren?')) { save([]); onUpdate({ dorisChat: [] }) } }}
            className="text-white/50 hover:text-white text-xs cursor-pointer bg-transparent border-none">Leeren</button>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {msgs.length === 0 && (
            <div className="text-center py-6">
              <div className="font-bold text-slate-700 mb-1 text-sm">Hallo! Ich bin Doris.</div>
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                {['Vorstellung erstellen', 'Compliance prüfen', 'GISA prüfen', 'Meldezettel bereit?'].map(s => (
                  <button key={s} onClick={() => handleSend(s)}
                    className="rounded-full bg-violet-100 text-violet-700 text-xs px-3 py-1.5 cursor-pointer border border-violet-200 hover:bg-violet-200">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map(m => (
            <div key={m.id} className={clsx('flex gap-2', m.von === 'doris' ? '' : 'flex-row-reverse')}>
              {m.von === 'doris' && <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">D</div>}
              <div className={clsx('rounded-2xl px-3 py-2 text-xs leading-relaxed',
                showVorstellung ? 'max-w-[180px]' : 'max-w-xs',
                m.von === 'doris'
                  ? m.typ === 'warnung' ? 'bg-amber-50 border border-amber-200 text-slate-800'
                    : m.typ === 'erfolg' ? 'bg-emerald-50 border border-emerald-200 text-slate-800'
                      : 'bg-white border border-violet-100 text-slate-800'
                  : 'bg-violet-700 text-white')}>
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">D</div>
              <div className="rounded-2xl bg-white border border-violet-100 px-3 py-2 text-xs text-slate-400 italic">Doris analysiert ...</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 p-3 flex gap-2 bg-white flex-shrink-0">
          {/* Foto-Upload direkt in Doris */}
          <label className="rounded-2xl border border-violet-200 bg-violet-50 text-violet-700 px-3 py-2 text-xs font-bold cursor-pointer hover:bg-violet-100 flex items-center gap-1 flex-shrink-0" title="Ausweis hochladen (Foto, PDF, Word)">
            📎
            <input type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = async ev => {
                const dataUrl = ev.target?.result as string
                
                dorisAntwort(`📎 "${file.name}" erhalten — ich lese es aus...`, 'aktion')
                setTyping(true)
                
                try {
                  const { content, fehler } = await bereiteKiInhaltVor(file, dataUrl)
                  if (fehler || content.length === 0) {
                    setTyping(false)
                    dorisAntwort(`❌ ${fehler || 'Dateiformat nicht unterstützt'}\n\nUnterstützt: JPG, PNG, PDF, DOCX, TXT`, 'warnung')
                    return
                  }
                  
                  const res = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      model: 'claude-sonnet-4-20250514',
                      max_tokens: 1500,
                      system: `Du bist Doris, KI-Assistentin bei VBetreut GmbH Österreich. Spezialistin für Ausweisdokumente UND GISA-Auszüge.

WENN DU EINEN GISA-AUSZUG SIEHST (Erkennungszeichen: "GISA-Zahl", "aufrecht", "Personenbetreuung", gisa.gv.at):
Antworte NUR mit einem JSON-Objekt:
{"gisaZahl":"37310875","status":"aufrecht","gewerbeBezeichnung":"Personenbetreuung","rechtsträger":"Nachname Vorname","geburtsdatum":"TT.MM.JJJJ","standort":"PLZ Ort","gewerbebeginn":"TT.MM.JJJJ","ablaufdatum":""}
Status IMMER kleinschreiben: "aufrecht", "ruhend", "geendet", "entzogen"

WENN DU EINEN AUSWEIS/PASS SIEHST:
Antworte NUR mit JSON:
{"vorname":"","nachname":"","geburtsdatum":"YYYY-MM-DD","geburtsort":"","staatsangehoerigkeit":"","geschlecht":"weiblich/maennlich","dokumentNummer":"","ausstellungsdatum":"YYYY-MM-DD","ablaufdatum":"YYYY-MM-DD","ausstellendeBehörde":"","dokumentTyp":""}
Datumsfelder: YYYY-MM-DD. Kyrillisch → Lateinisch.

WENN BEIDES UNKLAR: Beschreibe kurz was du siehst.`,
                      messages: [{
                        role: 'user',
                        content
                      }]
                    })
                  })
                  const data = await res.json()
                  setTyping(false)
                  
                  // Prüfe ob API-Fehler
                  if (!res.ok || data.error) {
                    const errMsg = data.error || data.details?.error?.message || `HTTP ${res.status}`
                    dorisAntwort(`❌ KI-Fehler: ${errMsg}`, 'warnung')
                    return
                  }
                  
                  const rawText = data.content?.[0]?.text || ''
                  
                  // Versuche JSON zu parsen (Ausweis) — sonst ist es Text (GISA/allgemein)
                  let felder: any = {}
                  let istJSON = false
                  try {
                    const clean = rawText.replace(/```json|```/g, '').trim()
                    if (clean.startsWith('{')) { felder = JSON.parse(clean); istJSON = true }
                  } catch {}
                  
                  const updates: Partial<Betreuerin> = {}
                  
                  if (istJSON) {
                    // ─── AUSWEIS-FELDER ───
                    if (felder.vorname) updates.vorname = felder.vorname
                    if (felder.nachname) updates.nachname = felder.nachname
                    if (felder.geburtsdatum) updates.geburtsdatum = felder.geburtsdatum
                    if (felder.geburtsort) updates.geburtsort = felder.geburtsort
                    if (felder.staatsangehoerigkeit) updates.staatsangehoerigkeit = felder.staatsangehoerigkeit
                    if (felder.geschlecht) updates.geschlecht = felder.geschlecht as any
                    if (felder.ausstellungsdatum) updates.ausweisAusgestelltAm = felder.ausstellungsdatum
                    if (felder.ausstellendeBehörde) updates.ausweisBehoerde = felder.ausstellendeBehörde
                    if (felder.ablaufdatum) updates.ausweisAblauf = felder.ablaufdatum
                    if (felder.dokumentNummer) updates.ausweisNummer = felder.dokumentNummer
                    // ─── GISA-FELDER (falls im JSON) ───
                    if (felder.gisaZahl || felder.gisaNummer) updates.gisaNummer = felder.gisaZahl || felder.gisaNummer
                    if (felder.status) {
                      const st = (felder.status || '').toLowerCase()
                      updates.gewerbeStatus = st as any
                      ;(updates as any).gewerbeCheck = {
                        geprueftAm: today(),
                        gisaNummer: felder.gisaZahl || felder.gisaNummer || b.gisaNummer || '',
                        gewerbeBezeichnung: felder.gewerbeBezeichnung || felder.bezeichnung || 'Personenbetreuung',
                        status: st,
                        quelle: 'Doris — Auszug ausgelesen',
                        naechstePruefung: new Date(Date.now() + 180*86400000).toISOString().split('T')[0],
                        notizen: ''
                      }
                    }
                  } else {
                    // ─── TEXT-ANTWORT (GISA oder allgemein) ───
                    // GISA-Status aus Text extrahieren
                    const textLow = rawText.toLowerCase()
                    const gisaMatch = rawText.match(/\b(\d{7,8})\b/)
                    const statusAufrecht = textLow.includes('aufrecht')
                    const statusRuhend = textLow.includes('ruhend')
                    const statusGeendet = textLow.includes('geendet') || textLow.includes('erloschen')
                    
                    if (gisaMatch || statusAufrecht || statusRuhend || statusGeendet) {
                      const gisaNr = gisaMatch?.[1] || b.gisaNummer || ''
                      const status = statusAufrecht ? 'aufrecht' : statusRuhend ? 'ruhend' : statusGeendet ? 'geendet' : 'unbekannt'
                      if (gisaNr) updates.gisaNummer = gisaNr
                      updates.gewerbeStatus = status as any
                      ;(updates as any).gewerbeCheck = {
                        geprueftAm: today(),
                        gisaNummer: gisaNr,
                        gewerbeBezeichnung: 'Personenbetreuung',
                        status,
                        quelle: 'Doris — Auszug ausgelesen',
                        naechstePruefung: new Date(Date.now() + 180*86400000).toISOString().split('T')[0],
                        notizen: ''
                      }
                    }
                    
                    // Text direkt anzeigen
                    dorisAntwort(rawText, statusAufrecht ? 'erfolg' : 'info')
                    if (Object.keys(updates).length > 0) {
                      onUpdate(updates)
                      await fetch('/api/db/betreuerinnen?id=' + b.id, {
                        method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(updates)
                      }).catch(() => {})
                    }
                    return
                  }
                  
                  if (Object.keys(updates).length > 0) {
                    onUpdate(updates)
                    await fetch('/api/db/betreuerinnen?id=' + b.id, {
                      method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(updates)
                    }).catch(() => {})
                  }
                  
                  const liste = Object.entries(felder).filter(([,v]) => v).map(([k,v]) => `• ${k}: ${v}`).join('\n')
                  dorisAntwort(
                    `✅ Ausgelesen!\n\n${liste}\n\n✅ Erkannte Daten wurden in die Stammdaten übernommen.`,
                    (updates as any).gewerbeStatus === 'aufrecht' ? 'erfolg' : 'erfolg', felder
                  )
                } catch(err: any) {
                  setTyping(false)
                  const errMsg = err?.message || String(err) || 'Unbekannter Fehler'
                  dorisAntwort(`❌ Fehler: ${errMsg}\n\nBitte prüfen ob das Bild korrekt hochgeladen wurde und die KI-Verbindung funktioniert.`, 'warnung')
                  console.error('[Doris] Fehler:', err)
                }
              }
              reader.readAsDataURL(file)
            }} />
          </label>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && input.trim()) { handleSend(input.trim()); setInput('') } }}
            placeholder="Doris fragen oder 📷 Ausweis hochladen ..."
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none" />
          <button onClick={() => { if (input.trim()) { handleSend(input.trim()); setInput('') } }}
            className="rounded-2xl bg-violet-700 text-white px-3 py-2 text-xs font-bold cursor-pointer border-none hover:bg-violet-800">→</button>
        </div>
      </div>

      {/* Vorstellung Vorschau Rechts */}
      {showVorstellung && vorstellungText && (
        <div className="flex-1 flex flex-col border-l border-slate-200 bg-white overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="font-bold text-slate-900 text-sm">📋 Vorstellung Vorschau</div>
            <div className="flex gap-2">
              <button onClick={() => druckePDF(b, vorstellungText)}
                className="rounded-xl bg-teal-700 text-white text-xs px-3 py-2 cursor-pointer border-none hover:bg-teal-800 font-semibold">
                🖨️ PDF drucken
              </button>
              <button onClick={() => {
                const wa = b.telefon.replace(/[^0-9+]/g, '')
                const text = encodeURIComponent(`Sehr geehrte(r) ${b.vorname} ${b.nachname},\n\nanbei Ihre Betreuerinnen-Vorstellung von VBetreut.\n\nMit freundlichen Grüßen\nVBetreut Team`)
                window.open(`https://wa.me/${wa}?text=${text}`, '_blank')
              }} className="rounded-xl bg-emerald-600 text-white text-xs px-3 py-2 cursor-pointer border-none hover:bg-emerald-700 font-semibold">
                WhatsApp
              </button>
              <button onClick={() => setShowVorstellung(false)}
                className="rounded-xl border border-slate-200 text-slate-500 text-xs px-3 py-2 cursor-pointer hover:bg-slate-50">✕</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <textarea
              value={vorstellungText}
              onChange={e => setVorstellungText(e.target.value)}
              className="w-full h-full font-mono text-[10px] leading-5 bg-slate-50 border border-slate-200 rounded-xl p-4 resize-none outline-none text-slate-800"
              style={{ minHeight: '400px' }}
            />
          </div>
          <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 flex-shrink-0">
            <div className="text-xs text-slate-500">
              ✓ Im Dokumente-Tab als PDF abgelegt · Bearbeitbar · Beim nächsten Neustart an Klient versendbar
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// WHATSAPP PANEL
// ══════════════════════════════════════════════════════════════

interface WaNachricht {
  id: string; richtung: 'gesendet' | 'empfangen'; text: string; zeitstempel: string; gelesen: boolean
}

// ── WhatsApp Template Storage ─────────────────────────────────
interface WaTemplate { id: string; label: string; text: string }

const WA_TEMPLATE_KEY = 'vb_wa_templates'

function getWaTemplates(): WaTemplate[] {
  if (typeof window === 'undefined') return []
  // WA-Templates: localStorage für UI-Präferenzen (geräte-spezifisch, kein Sync nötig)
  const raw = typeof window !== 'undefined' ? localStorage.getItem(WA_TEMPLATE_KEY) : null
  if (raw) return JSON.parse(raw)
  const defaults: WaTemplate[] = [
    { id: '1', label: 'Anreise bestätigen', text: 'Liebe {{name}},\n\nbitte bestätige deine Anreise für den nächsten Einsatz.\nWann fährst du los?\n\nLiebe Grüße\nVBetreut Team 🙏' },
    { id: '2', label: 'Abreise-Info', text: 'Liebe {{name}},\n\nbitte denke daran, uns Bescheid zu geben sobald du abgereist bist.\nGute Fahrt! 🚌\n\nLiebe Grüße\nVBetreut Team' },
    { id: '3', label: 'Dokument anfordern', text: 'Liebe {{name}},\n\nwir benötigen noch ein aktuelles Dokument von dir (Ausweis / Meldezettel). Bitte schicke uns eine Kopie baldmöglichst zu.\n\nDanke & liebe Grüße\nVBetreut Team' },
    { id: '4', label: 'Einsatz-Details', text: 'Liebe {{name}},\n\nDein nächster Einsatz:\n📍 Ort: {{ort}}\n📅 Bis: {{bis}}\n\nBei Fragen einfach melden!\nLiebe Grüße\nVBetreut Team' },
    { id: '5', label: 'Allgemeine Anfrage', text: 'Liebe {{name}},\n\nkurze Frage — bitte melde dich wenn du kurz Zeit hast.\n\nLiebe Grüße\nVBetreut Team' },
    { id: '6', label: 'Geburtstag', text: 'Liebe {{name}},\n\nalles Gute zu deinem Geburtstag! 🎂🎉\nWir wünschen dir einen wunderschönen Tag.\n\nHerzliche Grüße\nDein VBetreut Team' },
  ]
  localStorage.setItem(WA_TEMPLATE_KEY, JSON.stringify(defaults))
  return defaults
}
function saveWaTemplates(t: WaTemplate[]) {
  if (typeof window !== 'undefined') localStorage.setItem(WA_TEMPLATE_KEY, JSON.stringify(t))
}
function fillTemplate(text: string, b: Betreuerin): string {
  return text
    .replaceAll('{{name}}', b.vorname)
    .replaceAll('{{vorname}}', b.vorname)
    .replaceAll('{{nachname}}', b.nachname)
    .replaceAll('{{ort}}', b.aktuellerEinsatzOrt || '(wird noch bekannt gegeben)')
    .replaceAll('{{bis}}', b.aktuellerEinsatzBis ? new Date(b.aktuellerEinsatzBis).toLocaleDateString('de-AT') : '(offen)')
    .replaceAll('{{telefon}}', b.telefon)
    .replaceAll('{{betreuerin_id}}', b.betreuerinId)
}

function WhatsAppPanel({ b, onSaveNachricht }: { b: Betreuerin; onSaveNachricht: (n: WaNachricht) => void }) {
  const [verlauf, setVerlauf] = useState<WaNachricht[]>(() => {
    // WhatsApp-Verlauf: geräte-lokal, kein DB-Sync (Chat-History)
    try { return JSON.parse(localStorage.getItem(`vb_wa_${b.id}`) || '[]') } catch { return [] }
  })
  const [templates, setTemplates] = useState<WaTemplate[]>(() => getWaTemplates())
  const [nachricht, setNachricht] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(-1)
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editText, setEditText] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [verlauf])

  function saveVerlauf(updated: WaNachricht[]) {
    setVerlauf(updated)
    localStorage.setItem(`vb_wa_${b.id}`, JSON.stringify(updated))
  }

  function sendeWhatsApp(text: string) {
    if (!text.trim()) return
    const nummer = b.telefon.replace(/[^0-9+]/g, '').replace(/^00/, '+').replace(/^0043/, '+43')
    const url = `https://wa.me/${nummer}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
    const neu: WaNachricht = { id: uid(), richtung: 'gesendet', text, zeitstempel: new Date().toISOString(), gelesen: false }
    saveVerlauf([...verlauf, neu])
    onSaveNachricht(neu)
    setNachricht('')
    setSelectedTemplate(-1)
  }

  const tel = b.telefon.replace(/[^0-9+]/g, '').replace(/^00/, '+').replace(/^0043/, '+43')

  function updateTemplates(updated: WaTemplate[]) {
    setTemplates(updated)
    saveWaTemplates(updated)
  }

  function startEdit(t: WaTemplate) {
    setEditingId(t.id)
    setEditLabel(t.label)
    setEditText(t.text)
  }

  function saveEdit() {
    if (!editingId) return
    updateTemplates(templates.map(t => t.id === editingId ? { ...t, label: editLabel, text: editText } : t))
    setEditingId(null)
  }

  return (
    <div className="space-y-5">
      {/* Kontakt-Header */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {b.vorname[0]}{b.nachname[0]}
        </div>
        <div className="flex-1">
          <div className="font-bold text-slate-900">{b.vorname} {b.nachname}</div>
          <div className="text-sm text-slate-600">{b.telefon}</div>
          {!b.telefonWhatsapp && (
            <div className="text-xs text-amber-600 mt-0.5">⚠️ WhatsApp nicht als verfügbar markiert</div>
          )}
        </div>
        <a href={`https://wa.me/${b.telefon.replace(/[^0-9+]/g, '').replace(/^00/, '+').replace(/^0043/, '+43')}`}
          target="_blank" rel="noreferrer"
          className="rounded-2xl bg-emerald-600 text-white text-sm font-bold px-5 py-3 no-underline hover:bg-emerald-700">
          WhatsApp öffnen ↗
        </a>
      </div>

      {/* Templates */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="text-sm font-bold text-slate-800">Schnell-Nachrichten</div>
          <div className="flex gap-2">
            <button onClick={() => setEditMode(!editMode)}
              className={clsx('rounded-xl text-xs px-3 py-1.5 cursor-pointer border transition-all',
                editMode ? 'bg-teal-700 text-white border-teal-700' : 'border-slate-200 text-slate-600 hover:bg-slate-100')}>
              {editMode ? '✓ Fertig' : '✏️ Bearbeiten'}
            </button>
            {editMode && (
              <button onClick={() => {
                setShowNewForm(true)
                setEditLabel(''); setEditText('')
              }} className="rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-xs px-3 py-1.5 cursor-pointer hover:bg-teal-100">
                + Neu
              </button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-2">
          {/* Platzhalter-Hinweis */}
          {editMode && (
            <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-700 mb-3">
              💡 Platzhalter: <code className="bg-sky-100 px-1 rounded">{'{{name}}'}</code> <code className="bg-sky-100 px-1 rounded">{'{{ort}}'}</code> <code className="bg-sky-100 px-1 rounded">{'{{bis}}'}</code> <code className="bg-sky-100 px-1 rounded">{'{{telefon}}'}</code>
            </div>
          )}

          {/* Neue Vorlage Form */}
          {showNewForm && editMode && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 space-y-2 mb-2">
              <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                placeholder="Bezeichnung (z.B. Urlaubsgruß)"
                className="w-full text-xs rounded-lg border border-teal-200 bg-white px-3 py-2 outline-none font-semibold" />
              <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={4}
                placeholder={`Text mit {{name}} Platzhalter ...`}
                className="w-full text-xs rounded-lg border border-teal-200 bg-white px-3 py-2 outline-none resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setShowNewForm(false)}
                  className="rounded-lg border border-slate-200 text-slate-500 text-xs px-3 py-1.5 cursor-pointer hover:bg-slate-50">Abbrechen</button>
                <button onClick={() => {
                  if (!editLabel.trim()) return
                  updateTemplates([...templates, { id: uid(), label: editLabel.trim(), text: editText }])
                  setShowNewForm(false)
                }} className="rounded-lg bg-teal-700 text-white text-xs px-3 py-1.5 cursor-pointer border-none hover:bg-teal-800">
                  Hinzufügen
                </button>
              </div>
            </div>
          )}

          {!editMode && (
            <div className="grid grid-cols-3 gap-2">
              {templates.map((t, i) => (
                <button key={t.id}
                  onClick={() => { setNachricht(fillTemplate(t.text, b)); setSelectedTemplate(i) }}
                  className={clsx('rounded-xl border text-xs font-semibold px-3 py-2.5 cursor-pointer text-left transition-all',
                    selectedTemplate === i
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50')}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {editMode && templates.map(t => (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              {editingId === t.id ? (
                <div className="p-3 space-y-2">
                  <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none font-semibold" />
                  <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={5}
                    className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none resize-none font-mono" />
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)}
                      className="rounded-lg border border-slate-200 text-slate-500 text-xs px-3 py-1.5 cursor-pointer hover:bg-slate-50">Abbrechen</button>
                    <button onClick={saveEdit}
                      className="rounded-lg bg-teal-700 text-white text-xs px-3 py-1.5 cursor-pointer border-none hover:bg-teal-800">Speichern</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-800 mb-0.5">{t.label}</div>
                    <div className="text-[11px] text-slate-400 font-mono leading-4 truncate">{t.text.slice(0, 60)}{t.text.length > 60 ? '...' : ''}</div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => startEdit(t)}
                      className="rounded-lg border border-slate-200 text-slate-600 text-xs px-2.5 py-1.5 cursor-pointer hover:bg-slate-50">✏️</button>
                    <button onClick={() => updateTemplates(templates.filter(x => x.id !== t.id))}
                      className="rounded-lg border border-rose-200 text-rose-500 text-xs px-2.5 py-1.5 cursor-pointer hover:bg-rose-50">✕</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {editMode && templates.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-xs">Noch keine Vorlagen. "+ Neu" klicken.</div>
          )}
        </div>
      </div>

      {/* Nachricht verfassen */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-800">Nachricht verfassen</div>
        </div>
        <div className="p-4">
          <textarea value={nachricht} onChange={e => setNachricht(e.target.value)} rows={5}
            placeholder={`Nachricht an ${b.vorname} ...`}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm resize-none outline-none" />
          <div className="flex gap-3 mt-3 items-center">
            <div className="flex-1 text-xs text-slate-400">{nachricht.length} Zeichen</div>
            <button onClick={() => setNachricht('')}
              className="rounded-xl border border-slate-200 text-slate-500 text-xs px-4 py-2.5 cursor-pointer hover:bg-slate-50">
              Leeren
            </button>
            <button onClick={() => sendeWhatsApp(nachricht)} disabled={!nachricht.trim()}
              className="rounded-xl bg-emerald-600 text-white text-sm font-bold px-6 py-2.5 cursor-pointer border-none hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-2">
              <span>WhatsApp</span><span className="text-base">↗</span>
            </button>
          </div>
        </div>
      </div>

      {/* Verlauf */}
      {verlauf.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-800">Verlauf ({verlauf.length})</div>
            <button onClick={() => { setVerlauf([]); localStorage.removeItem(`vb_wa_${b.id}`) }}
              className="text-xs text-slate-400 cursor-pointer bg-transparent border-none hover:text-rose-500">Leeren</button>
          </div>
          <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
            {[...verlauf].reverse().map(m => (
              <div key={m.id} className={clsx('flex', m.richtung === 'gesendet' ? 'justify-end' : 'justify-start')}>
                <div className={clsx('rounded-2xl px-4 py-2.5 text-xs max-w-xs leading-relaxed',
                  m.richtung === 'gesendet' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800')}>
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  <div className={clsx('text-[10px] mt-1 opacity-70', m.richtung === 'gesendet' ? 'text-right' : '')}>
                    {new Date(m.zeitstempel).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
        <div className="text-xs text-slate-500 leading-relaxed">
          💡 Klick auf eine Schnell-Nachricht befüllt das Textfeld. Dann "WhatsApp ↗" öffnet WhatsApp mit dem Text. Platzhalter wie <code className="bg-slate-100 px-1 rounded">{'{{name}}'}</code> werden automatisch ersetzt.
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// HAUPTKOMPONENTE: DETAIL-PANEL
// ══════════════════════════════════════════════════════════════
interface Props {
  b: Betreuerin
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  canGF: boolean
}

// Normalisiert Supabase-Daten: JSON-Strings → echte Arrays
function normalizeB(raw: Betreuerin): Betreuerin {
  const arr = (v: any) => { if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] } } return [] }
  const str = (v: any) => (v == null ? '' : String(v))
  const bool = (v: any) => !!v
  return {
    ...raw,
    vorname: str(raw.vorname),
    nachname: str(raw.nachname),
    geburtsdatum: str(raw.geburtsdatum),
    geburtsort: str((raw as any).geburtsort),
    geburtsland: str((raw as any).geburtsland),
    geschlecht: str((raw as any).geschlecht) || 'weiblich',
    familienstand: str((raw as any).familienstand),
    staatsangehoerigkeit: str((raw as any).staatsangehoerigkeit),
    nationalitaet: str(raw.nationalitaet),
    religion: str((raw as any).religion),
    telefon: str(raw.telefon),
    telefonWhatsapp: bool((raw as any).telefonWhatsapp),
    telefonAlternativ: str((raw as any).telefonAlternativ),
    email: str(raw.email),
    adresse: str(raw.adresse),
    strasse: str((raw as any).strasse || raw.adresse),
    plz: str(raw.plz),
    ort: str(raw.ort),
    land: str((raw as any).land) || 'Österreich',
    // Heimatadresse
    heimatadresse: str((raw as any).heimatadresse),
    heimatStrasse: str((raw as any).heimatStrasse || (raw as any).heimat_strasse),
    heimatPlz: str((raw as any).heimatPlz || (raw as any).heimat_plz),
    heimatOrt: str((raw as any).heimatOrt || (raw as any).heimat_ort),
    heimatLand: str((raw as any).heimatLand || (raw as any).heimat_land),
    // Ausweis
    ausweisTyp: str((raw as any).ausweisTyp || (raw as any).ausweis_typ),
    ausweisNr: str((raw as any).ausweisNr || (raw as any).ausweis_nr),
    ausweisAusgestelltAm: str((raw as any).ausweisAusgestelltAm || (raw as any).ausweis_ausgestellt_am),
    ausweisBehoerde: str((raw as any).ausweisBehoerde || (raw as any).ausweis_behoerde),
    ausweisGueltigBis: str((raw as any).ausweisGueltigBis || (raw as any).ausweis_gueltig_bis),
    // Führerschein
    fuehrerschein: bool((raw as any).fuehrerschein),
    fuehrerscheinKlasse: str((raw as any).fuehrerscheinKlasse) || 'B',
    fuehrerscheinNummer: str((raw as any).fuehrerscheinNummer),
    fuehrerscheinAblauf: str((raw as any).fuehrerscheinAblauf),
    fuehrerscheinAussteller: str((raw as any).fuehrerscheinAussteller),
    // Bank
    iban: str(raw.iban),
    bic: str(raw.bic),
    bank: str((raw as any).bank),
    // Qualifikation
    svnr: str(raw.svnr),
    deutschkenntnisse: str((raw as any).deutschkenntnisse) || 'gut',
    erfahrungsjahre: Number((raw as any).erfahrungsjahre) || 0,
    status: str(raw.status) || 'verfuegbar',
    notizen: str((raw as any).notizen),
    internNotizen: str((raw as any).internNotizen),
    erstelltAm: str((raw as any).erstelltAm || (raw as any).erstellt_am),
    aktualisiertAm: str((raw as any).aktualisiertAm || (raw as any).aktualisiert_am),
    // Arrays
    dokumente: arr(raw.dokumente),
    bankverbindungen: arr(raw.bankverbindungen),
    qualifikationen: arr(raw.qualifikationen),
    einsaetze: arr(raw.einsaetze),
    dorisChat: arr(raw.dorisChat),
    kontakte: arr((raw as any).kontakte),
    sprachkenntnisse: arr((raw as any).sprachkenntnisse),
  } as Betreuerin
}

export default function BetreuerinDetail({ b: initialB, onClose, onEdit, onDelete, canGF }: Props) {
  const [b, setB] = useState<Betreuerin>(() => normalizeB(initialB))

  // Live-Einsätze aus Supabase
  const [liveEinsaetze, setLiveEinsaetze] = useState<EinsatzRecord[]>([])
  useEffect(() => {
    apiGetAll<EinsatzRecord>('einsaetze').then(alle =>
      setLiveEinsaetze(alle.filter(e => e.betreuerinId === initialB.id))
    )
  }, [initialB.id, initialB.aktualisiertAm])
  const [activeTab, setActiveTab] = useState<'uebersicht' | 'stammdaten' | 'dokumente' | 'bank' | 'einsaetze' | 'qualifikation' | 'doris' | 'whatsapp' | 'notizen'>('uebersicht')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [showDokForm, setShowDokForm] = useState(false)
  const [showBankForm, setShowBankForm] = useState(false)
  const [dokForm, setDokForm] = useState<Omit<BetreuerinDokument, 'id'>>({ kategorie: 'ausweis', bezeichnung: '', dateiName: '', hochgeladenAm: today(), ablaufdatum: '', ausgestellt: '', ausstellendeBehörde: '', dokumentNummer: '', dorisAusgelesen: false, notizen: '', vertraulich: false })
  const [bankForm, setBankForm] = useState<Omit<BetreuerinBank, 'id'>>({ inhaberName: `${b.vorname} ${b.nachname}`, iban: '', bic: '', bank: '', land: '', hauptkonto: false, verifiziert: false })

  const compliance = getComplianceItems(b)
  const compliancePflichtOffen = compliance.filter(c => !c.erfuellt && c.pflicht)

  function save(data: Partial<Betreuerin>) {
    const updated = { ...b, ...data, aktualisiertAm: today() }
    setB(updated)
    apiUpdate('betreuerinnen', b.id, data)
  }

  // Refresh wenn von außen aktualisiert
  useEffect(() => { setB(normalizeB(initialB)) }, [initialB.aktualisiertAm])

  const tabs = [
    { key: 'uebersicht', label: '⚡ Schnellinfo' },
    { key: 'stammdaten', label: 'Stammdaten' },
    { key: 'qualifikation', label: 'Qualifikation' },
    { key: 'einsaetze', label: `Einsätze (${liveEinsaetze.length})` },
    { key: 'chronologie', label: '📋 Chronologie' },
    { key: 'dokumente', label: `Dokumente (${b.dokumente.length})` },
    { key: 'bank', label: `Bankdaten (${b.bankverbindungen.length})` },
    { key: 'whatsapp', label: '💬 WhatsApp' },
    { key: 'doris', label: '👓 Doris' },
    { key: 'notizen', label: 'Notizen' },
  ] as const

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end bg-slate-900/30" onClick={onClose}>
      <div className="h-full w-full max-w-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
        style={{ borderRadius: '28px 0 0 28px' }}
        onClick={e => e.stopPropagation()}>

        {/* ── HEADER ── */}
        <div className="bg-teal-700 px-8 py-6 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl cursor-pointer bg-transparent border-none">✕</button>
            <div className="flex gap-2">
              {canGF && <>
                <button onClick={onEdit} className="rounded-xl bg-white/15 px-4 py-2 text-sm font-bold text-white cursor-pointer border-none hover:bg-white/25">✏️ Bearbeiten</button>
                <button onClick={() => setDeleteConfirm(true)} className="rounded-xl bg-rose-500/25 px-4 py-2 text-sm font-bold text-white cursor-pointer border-none hover:bg-rose-500/40">Löschen</button>
              </>}
            </div>
          </div>

          {deleteConfirm && (
            <div className="mb-4 rounded-2xl bg-rose-900/40 border border-rose-400/40 p-4">
              <div className="text-sm font-bold text-white mb-2">Wirklich löschen?</div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(false)} className="rounded-xl bg-white/20 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none">Abbrechen</button>
                <button onClick={onDelete} className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-rose-600">Endgültig löschen</button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-5">
            <label className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-bold text-white flex-shrink-0 cursor-pointer hover:bg-white/30 transition-all relative overflow-hidden group" title="Foto hochladen">
              {b.fotoUrl ? (
                <img src={b.fotoUrl} alt={b.vorname} className="w-full h-full object-cover" />
              ) : (
                <span>{b.vorname[0]}{b.nachname[0]}</span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-sm">📷</div>
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => {
                  const dataUrl = ev.target?.result as string
                  save({ fotoUrl: dataUrl })
                }
                reader.readAsDataURL(file)
              }} />
            </label>
            <div className="flex-1">
              <div className="text-xs text-white/60 uppercase tracking-widest mb-1">{b.betreuerinId || 'Betreuerin'}</div>
              <h2 className="text-3xl font-bold text-white mb-1">{b.vorname} {b.nachname}</h2>
              <div className="text-white/70 text-sm">{b.nationalitaet} · {b.erfahrungJahre > 0 ? `${b.erfahrungJahre} Jahre Erfahrung` : b.qualifikationen.length > 0 ? b.qualifikationen[0].bezeichnung : ''}</div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge label={STATUS_LABELS[b.status]} className={clsx('text-xs border', STATUS_COLORS[b.status])} />
                <Badge label={ROLLE_LABELS[b.rolle]} className="text-xs border bg-white/15 text-white border-white/30" />
                <Badge label={`${TURNUS_LABELS[b.turnus]} Turnus`} className="text-xs border bg-white/15 text-white border-white/30" />
                {b.telefonWhatsapp && <Badge label="WhatsApp ✓" className="text-xs border bg-emerald-500/20 text-emerald-100 border-emerald-400/30" />}
                {compliancePflichtOffen.length > 0 && <Badge label={`⚠️ ${compliancePflichtOffen.length} fehlend`} className="text-xs bg-amber-100 text-amber-800 border-amber-300" />}
              </div>
            </div>
            <div className="text-right">
              <Sterne wert={+b.bewertung || 0} />
              <div className="text-white/60 text-xs mt-1">{b.bewertung}/5 Sterne</div>
            </div>
          </div>

          {/* ── Verfügbarkeits- & Turnus-Status ── */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {/* Status */}
            <div className={clsx('rounded-2xl px-4 py-3 border',
              b.status === 'im_einsatz' ? 'bg-sky-500/20 border-sky-300/30' :
              b.status === 'verfuegbar' ? 'bg-emerald-500/20 border-emerald-300/30' :
              b.status === 'pause' ? 'bg-amber-500/20 border-amber-300/30' :
              'bg-white/10 border-white/20')}>
              <div className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">Status</div>
              <div className="text-sm font-bold text-white">{STATUS_LABELS[b.status]}</div>
            </div>

            {/* Aktueller Einsatz — live aus Turnusverwaltung */}
            {(() => {
              const aktiv = liveEinsaetze.find(e => ['aktiv', 'wechsel_offen'].includes(getEinsatzStatus(e)))
              return (
                <div className={clsx('rounded-2xl px-4 py-3 border col-span-1',
                  aktiv ? 'bg-sky-500/20 border-sky-300/30' : 'bg-white/10 border-white/20')}>
                  <div className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">
                    {aktiv ? 'Bei Klient:in' : 'Verfügbar ab'}
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {aktiv ? aktiv.klientName : fmtDate(b.verfuegbarAb) || 'Sofort'}
                  </div>
                  {aktiv && <div className="text-[10px] text-white/60 mt-0.5">bis {fmtDate(aktiv.bis)} · {aktiv.klientOrt}</div>}
                </div>
              )
            })()}

            {/* Turnus */}
            <div className="rounded-2xl bg-white/10 border border-white/20 px-4 py-3">
              <div className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">Turnus</div>
              <div className="text-sm font-bold text-white">{TURNUS_LABELS[b.turnus]}</div>
              {b.erfahrungJahre > 0 && (
                <div className="text-[10px] text-white/60 mt-0.5">{b.erfahrungJahre} J. Erfahrung</div>
              )}
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="flex gap-1 mt-4 flex-wrap">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={clsx('rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer border-none transition-all',
                  activeTab === t.key ? 'bg-white text-teal-700' : 'bg-white/15 text-white hover:bg-white/25')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── BODY ── */}
        <div className={clsx('flex-1 overflow-y-auto', activeTab === 'doris' ? 'p-0' : 'p-7')}>

          {/* ═══ ÜBERSICHT ═══ */}
          {activeTab === 'uebersicht' && (
            <div className="space-y-5">
              {/* Compliance */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 flex items-center justify-between">
                  <div className="font-bold text-slate-900 text-sm">📋 Compliance-Check</div>
                  <Badge label={`${compliance.filter(c => c.erfuellt).length}/${compliance.length} erfüllt`}
                    className={clsx('text-xs', compliancePflichtOffen.length === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')} />
                </div>
                <div className="divide-y divide-slate-50">
                  {compliance.map(c => (
                    <div key={c.key} className={clsx('flex items-center gap-3 px-5 py-3', !c.erfuellt && c.pflicht && 'bg-rose-50/50')}>
                      <span className="text-lg flex-shrink-0">{c.erfuellt ? '✅' : c.pflicht ? '❌' : '⚠️'}</span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-900">{c.label}</div>
                        {!c.erfuellt && <div className="text-xs text-slate-500 mt-0.5">{c.hinweis}</div>}
                      </div>
                      {c.pflicht && <Badge label="Pflicht" className="text-[10px] bg-rose-50 text-rose-600 border-rose-200" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Schnell-Infos Raster — direkt editierbar */}
              <div className="grid grid-cols-2 gap-2">
                {/* Telefon */}
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-teal-400 transition-all">
                  <div className="text-xs text-slate-400">☎ Telefon</div>
                  <input value={b.telefon || ''} onChange={e => save({ telefon: e.target.value })}
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none" placeholder="–" />
                </div>
                {/* Email */}
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-teal-400 transition-all">
                  <div className="text-xs text-slate-400">✉ E-Mail</div>
                  <input value={b.email || ''} onChange={e => save({ email: e.target.value })}
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none" placeholder="–" />
                </div>
                {/* Nationalität */}
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-teal-400 transition-all">
                  <div className="text-xs text-slate-400">🌍 Nationalität</div>
                  <input value={b.nationalitaet || ''} onChange={e => save({ nationalitaet: e.target.value })}
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none" placeholder="–" />
                </div>
                {/* Verfügbar ab */}
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-teal-400 transition-all">
                  <div className="text-xs text-slate-400">📅 Verfügbar ab</div>
                  <input type="date" value={b.verfuegbarAb || ''} onChange={e => save({ verfuegbarAb: e.target.value })}
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none" />
                </div>
                {/* Status */}
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-teal-400 transition-all">
                  <div className="text-xs text-slate-400">📊 Status</div>
                  <select value={b.status || 'verfuegbar'} onChange={e => save({ status: e.target.value as any })}
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none cursor-pointer">
                    <option value="verfuegbar">Verfügbar</option>
                    <option value="im_einsatz">Im Einsatz</option>
                    <option value="urlaub">Urlaub</option>
                    <option value="krank">Krank</option>
                    <option value="inaktiv">Inaktiv</option>
                  </select>
                </div>
                {/* Turnus */}
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-teal-400 transition-all">
                  <div className="text-xs text-slate-400">🔄 Turnus</div>
                  <select value={b.turnus || '28'} onChange={e => save({ turnus: e.target.value as any })}
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none cursor-pointer">
                    <option value="14">14 Tage</option>
                    <option value="28">28 Tage</option>
                    <option value="flexibel">Flexibel</option>
                    <option value="dauerhaft">Dauerhaft</option>
                  </select>
                </div>
                {/* Bewertung */}
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-teal-400 transition-all">
                  <div className="text-xs text-slate-400">⭐ Bewertung</div>
                  <select value={b.bewertung || '3'} onChange={e => save({ bewertung: e.target.value })}
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none cursor-pointer">
                    {['1','2','3','4','5'].map(v => <option key={v} value={v}>{v} Sterne</option>)}
                  </select>
                </div>
                {/* Deutsch */}
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-teal-400 transition-all">
                  <div className="text-xs text-slate-400">🗣️ Deutschkenntnisse</div>
                  <select value={b.deutschkenntnisse || 'gut'} onChange={e => save({ deutschkenntnisse: e.target.value as any })}
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none cursor-pointer">
                    <option value="sehr_gut">Sehr gut</option>
                    <option value="gut">Gut</option>
                    <option value="grundkenntnisse">Grundkenntnisse</option>
                    <option value="keine">Keine</option>
                  </select>
                </div>
                {/* GISA */}
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-teal-400 transition-all">
                  <div className="text-xs text-slate-400">🏢 GISA-Nummer</div>
                  <input value={b.gisaNummer || ''} onChange={e => save({ gisaNummer: e.target.value })}
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none" placeholder="–" />
                </div>
                {/* Gewerbe Status */}
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-teal-400 transition-all">
                  <div className="text-xs text-slate-400">🏢 Gewerbe-Status</div>
                  <select value={['aktiv','aufrecht'].includes(b.gewerbeStatus) ? 'aufrecht' : (b.gewerbeStatus || 'nicht_angemeldet')} onChange={e => save({ gewerbeStatus: e.target.value as any })}
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none cursor-pointer">
                    <option value="aufrecht">✅ Aufrecht (aktiv)</option>
                    <option value="nicht_angemeldet">❌ Nicht angemeldet</option>
                    <option value="erloschen">❌ Erloschen</option>
                    <option value="unbekannt">❓ Unbekannt</option>
                  </select>
                </div>
                {/* WhatsApp */}
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-400">📱 WhatsApp verfügbar</div>
                    <button onClick={() => save({ telefonWhatsapp: !b.telefonWhatsapp })}
                      className={`rounded-full px-3 py-1 text-xs font-bold cursor-pointer border-none ${b.telefonWhatsapp ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {b.telefonWhatsapp ? '✅ Ja' : 'Nein'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-400 text-center mt-1">✏️ Felder direkt anklicken und bearbeiten — wird sofort gespeichert</div>

              {/* Kontakt */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="font-bold text-slate-900 mb-3 text-sm">Kontakt</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">☎ <a href={`tel:${b.telefon}`} className="text-teal-700 hover:underline">{b.telefon}</a> {b.telefonWhatsapp && <Badge label="WhatsApp" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200" />}</div>
                  {b.telefonAlternativ && <div className="flex items-center gap-2">☎ {b.telefonAlternativ}</div>}
                  {b.email && <div className="flex items-center gap-2">✉ <a href={`mailto:${b.email}`} className="text-teal-700 hover:underline">{b.email}</a></div>}
                </div>
              </div>

              {/* Gewerbe-Status */}
              <div className={clsx('rounded-2xl border p-5', GEWERBE_COLORS[b.gewerbeStatus] || 'border-slate-200 bg-white')}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-sm">🏢 Gewerbestatus</div>
                  <button onClick={() => setActiveTab('doris')} className="text-xs text-violet-700 cursor-pointer bg-transparent border-none hover:underline">
                    Doris prüfen →
                  </button>
                </div>
                {b.gewerbeCheck ? (
                  <div className="text-xs space-y-1">
                    <div><span className="text-slate-500">GISA-Nr: </span><span className="font-mono font-semibold">{b.gewerbeCheck.gisaNummer}</span></div>
                    <div><span className="text-slate-500">Geprüft am: </span>{fmtDate(b.gewerbeCheck.geprueftAm)}</div>
                    <div><span className="text-slate-500">Nächste Prüfung: </span>{fmtDate(b.gewerbeCheck.naechstePruefung)}</div>
                    <div><span className="text-slate-500">Status: </span><strong>{b.gewerbeCheck.status === 'aufrecht' ? '✅ AUFRECHT' : '❌ ' + b.gewerbeCheck.status.toUpperCase()}</strong></div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Noch nicht geprüft. Doris fragen!</div>
                )}
              </div>
            </div>
          )}

          {/* ═══ STAMMDATEN — direkt editierbar ═══ */}
          {activeTab === 'stammdaten' && (
            <StammdatenEditor b={b} onSave={save} />
          )}

          {/* ═══ QUALIFIKATION ═══ */}
          {activeTab === 'qualifikation' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-400">Deutschkenntnisse</div>
                  <div className="font-bold text-slate-900 mt-0.5">{DEUTSCH_LABELS[b.deutschkenntnisse]}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-400">Weitere Sprachen</div>
                  <div className="font-semibold text-slate-900 mt-0.5 text-sm">{b.weitereSprachenDE || '–'}</div>
                </div>
                {[
                  ['Führerschein', b.fuehrerschein ? `Ja – Klasse ${b.fuehrerscheinKlasse}` : 'Nein', '🚗'],
                  ['Raucher', b.raucher ? 'Ja' : 'Nein', '🚬'],
                  ['Haustier-Erfahrung', b.haustierErfahrung ? 'Ja' : 'Nein', '🐾'],
                  ['Demenz-Erfahrung', b.demenzErfahrung ? 'Ja' : 'Nein', '🧠'],
                  ['Erfahrung', `${b.erfahrungJahre} Jahre`, '⭐'],
                ].map(([l, v, icon]) => (
                  <div key={String(l)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <div>
                      <div className="text-xs text-slate-400">{l}</div>
                      <div className="font-semibold text-slate-900 text-sm">{v}</div>
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-4 mb-3">Zertifikate & Ausbildungen</h3>
              {b.qualifikationen.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">Noch keine Qualifikationen hinterlegt</div>
              )}
              {b.qualifikationen.map(q => (
                <div key={q.id} className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-900">🎓 {q.bezeichnung}</div>
                      {q.ausstellendeStelle && <div className="text-xs text-slate-500 mt-0.5">{q.ausstellendeStelle}</div>}
                      {q.zertifikatNummer && <div className="text-xs font-mono text-slate-400 mt-0.5">Nr. {q.zertifikatNummer}</div>}
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>Ausgestellt: {fmtDate(q.ausstellungsdatum)}</div>
                      {q.ablaufdatum && <AblaufBadge ablaufdatum={q.ablaufdatum} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ EINSÄTZE ═══ */}
          {activeTab === 'einsaetze' && (
            <div className="space-y-4">
              {/* Statistiken */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Gesamt', liveEinsaetze.length, 'text-slate-900'],
                  ['Aktiv', liveEinsaetze.filter(e => ['aktiv','wechsel_offen'].includes(getEinsatzStatus(e))).length, 'text-sky-700'],
                  ['Beendet', liveEinsaetze.filter(e => getEinsatzStatus(e) === 'beendet').length, 'text-emerald-700'],
                ].map(([l, v, c]) => (
                  <div key={String(l)} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center">
                    <div className={clsx('text-3xl font-bold', c)}>{v}</div>
                    <div className="text-xs text-slate-400 mt-1">{l}</div>
                  </div>
                ))}
              </div>

              {liveEinsaetze.length === 0 && <div className="text-center py-12 text-slate-400">Noch keine Einsätze in der Turnusverwaltung</div>}

              {[...liveEinsaetze].sort((a, z) => z.von.localeCompare(a.von)).map(e => {
                const st = getEinsatzStatus(e)
                return (
                  <div key={e.id} className={clsx('rounded-2xl border px-5 py-5',
                    st === 'aktiv' || st === 'wechsel_offen' ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-white')}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-slate-900 text-base">{e.klientName}</div>
                        <div className="text-sm text-slate-500">{e.klientOrt}</div>
                      </div>
                      <Badge label={st === 'aktiv' ? '📍 Aktiv' : st === 'wechsel_offen' ? '⚠️ Wechsel' : st === 'beendet' ? '✅ Beendet' : st === 'geplant' ? '🗓 Geplant' : '–'}
                        className={clsx('text-xs', EINSATZ_STATUS_COLORS[st])} />
                    </div>
                    <div className="flex gap-4 text-sm text-slate-600 flex-wrap">
                      <span>📅 {fmtDate(e.von)} — {e.bis ? fmtDate(e.bis) : 'laufend'}</span>
                      <span>{e.turnusTage} Tage</span>
                      {e.uebergabeNotiz && <span className="text-amber-700 text-xs">📋 {e.uebergabeNotiz.slice(0,40)}{e.uebergabeNotiz.length > 40 ? '…' : ''}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ═══ CHRONOLOGIE ═══ */}
          {activeTab === 'chronologie' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Einsatzchronologie</div>
              {liveEinsaetze.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="text-4xl mb-2">📋</div>
                  <div>Noch keine Einsätze erfasst</div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-violet-100" />
                  {[...liveEinsaetze].sort((a, b) => (b.von || '').localeCompare(a.von || '')).map((e, i) => {
                    const st = getEinsatzStatus(e)
                    const istAktiv = st === 'aktiv' || st === 'wechsel_offen'
                    const tage = e.von && e.bis ? Math.round((new Date(e.bis).getTime() - new Date(e.von).getTime()) / 86400000) : null
                    return (
                      <div key={e.id} className="relative flex gap-4 pb-6">
                        <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm ${istAktiv ? 'bg-violet-700 text-white' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                          {istAktiv ? '✓' : (i + 1)}
                        </div>
                        <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-bold text-slate-900">{e.klientName || '–'}</div>
                              <div className="text-sm text-slate-500 mt-0.5">{e.klientOrt || ''}</div>
                              <div className="text-sm text-slate-500 mt-0.5">
                                {fmtDate(e.von)} — {e.bis ? fmtDate(e.bis) : 'laufend'}
                                {tage && <span className="ml-2 text-xs text-slate-400">({tage} Tage)</span>}
                              </div>
                            </div>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${EINSATZ_STATUS_COLORS[st] || 'bg-slate-100 text-slate-600'}`}>
                              {EINSATZ_STATUS_LABELS[st] || st}
                            </span>
                          </div>
                          {e.uebergabeNotiz && (
                            <div className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2 italic">
                              💬 {e.uebergabeNotiz}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {/* Statistik */}
              {liveEinsaetze.length > 0 && (
                <div className="rounded-2xl bg-violet-50 border border-violet-200 p-4 mt-4">
                  <div className="text-xs font-bold text-violet-700 uppercase tracking-widest mb-3">Gesamtübersicht</div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><div className="text-2xl font-bold text-violet-900">{liveEinsaetze.length}</div><div className="text-xs text-violet-600">Einsätze</div></div>
                    <div><div className="text-2xl font-bold text-violet-900">{new Set(liveEinsaetze.map(e => e.klientId)).size}</div><div className="text-xs text-violet-600">Klienten</div></div>
                    <div><div className="text-2xl font-bold text-violet-900">{liveEinsaetze.filter(e => { const s = getEinsatzStatus(e); return s === 'aktiv' || s === 'wechsel_offen' }).length}</div><div className="text-xs text-violet-600">Aktiv</div></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ DOKUMENTE ═══ */}
          {activeTab === 'dokumente' && (
            <div className="space-y-4">
              {/* Warnungen */}
              {b.dokumente.some(d => isAbgelaufen(d) || laueftBaldAb(d)) && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                  <div className="font-bold text-amber-900 text-sm mb-2">⚠️ Ablaufende Dokumente</div>
                  {b.dokumente.filter(d => isAbgelaufen(d) || laueftBaldAb(d)).map(d => (
                    <div key={d.id} className="text-xs text-amber-800">
                      {DOK_KAT_ICONS[d.kategorie]} {d.bezeichnung} — {isAbgelaufen(d) ? 'ABGELAUFEN' : `läuft ab ${fmtDate(d.ablaufdatum)}`}
                    </div>
                  ))}
                </div>
              )}

              {canGF && (
                <button onClick={() => setShowDokForm(true)}
                  className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 px-5 py-4 text-sm font-semibold text-teal-700 cursor-pointer hover:bg-teal-100 w-full justify-center">
                  + Dokument hinzufügen / hochladen
                </button>
              )}

              {showDokForm && (
                <div className="rounded-2xl border border-teal-200 bg-white p-5">
                  <div className="text-sm font-bold text-slate-800 mb-3">Neues Dokument</div>
                  <div className="grid grid-cols-2 gap-3">
                    <SelField label="Kategorie" value={dokForm.kategorie}
                      onChange={v => setDokForm(f => ({ ...f, kategorie: v as DokumentKat }))}
                      options={Object.entries(DOK_KAT_LABELS).map(([k, v]) => ({ value: k, label: `${DOK_KAT_ICONS[k as DokumentKat]} ${v}` }))} />
                    <Field label="Bezeichnung *" value={dokForm.bezeichnung} onChange={v => setDokForm(f => ({ ...f, bezeichnung: v }))} />
                    <Field label="Dokumentnummer" value={dokForm.dokumentNummer} onChange={v => setDokForm(f => ({ ...f, dokumentNummer: v }))} placeholder="Ausweis-/Passnummer" />
                    <Field label="Ausgestellt am" value={dokForm.ausgestellt} onChange={v => setDokForm(f => ({ ...f, ausgestellt: v }))} type="date" />
                    <Field label="Ablaufdatum" value={dokForm.ablaufdatum} onChange={v => setDokForm(f => ({ ...f, ablaufdatum: v }))} type="date" />
                    <Field label="Ausstellende Behörde" value={dokForm.ausstellendeBehörde} onChange={v => setDokForm(f => ({ ...f, ausstellendeBehörde: v }))} />
                    {/* Datei Upload */}
                    <div className="col-span-2">
                      <div className="text-sm font-medium text-slate-600 mb-1.5">Datei / Scan hochladen</div>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif,.webp,.tiff,.bmp,.txt"
                        className="w-full text-xs text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-teal-50 file:text-teal-700 file:font-semibold file:px-3 file:py-2 file:cursor-pointer"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setDokForm(f => ({ ...f, dateiName: file.name }))
                          // Alle Dateitypen als DataURL laden — Doris verarbeitet alles
                          const reader = new FileReader()
                          reader.onload = ev => setDokForm(f => ({ ...f, dateiBase64: ev.target?.result as string, dateiName: file.name }))
                          reader.readAsDataURL(file)
                        }} />
                    </div>
                    <div className="col-span-2">
                      <TextArea label="Notizen" value={dokForm.notizen} onChange={v => setDokForm(f => ({ ...f, notizen: v }))} />
                    </div>
                    <div className="col-span-2 flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={dokForm.vertraulich} onChange={e => setDokForm(f => ({ ...f, vertraulich: e.target.checked }))} className="accent-teal-700" />
                        <span className="text-sm text-slate-700">Vertraulich</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <Btn onClick={() => setShowDokForm(false)}>Abbrechen</Btn>
                    <Btn teal onClick={() => {
                      if (!dokForm.bezeichnung) return
                      const neuesDok: BetreuerinDokument = { ...dokForm, id: uid() }
                      // Aus Dokumentnummer automatisch Stammdaten befüllen
                      const updates: Partial<Betreuerin> = { dokumente: [...b.dokumente, neuesDok] }
                      if (dokForm.kategorie === 'reisepass' && dokForm.dokumentNummer) { updates.ausweisNummer = dokForm.dokumentNummer; updates.ausweisAblauf = dokForm.ablaufdatum; updates.ausweisAusgestelltAm = dokForm.ausgestellt; updates.ausweisBehoerde = dokForm.ausstellendeBehörde }
                      if (dokForm.kategorie === 'ausweis' && dokForm.dokumentNummer) { updates.ausweisNummer = dokForm.dokumentNummer; updates.ausweisAblauf = dokForm.ablaufdatum; updates.ausweisAusgestelltAm = dokForm.ausgestellt; updates.ausweisBehoerde = dokForm.ausstellendeBehörde }
                      if (dokForm.kategorie === 'fuehrerschein' && dokForm.dokumentNummer) { updates.fuehrerscheinNummer = dokForm.dokumentNummer; updates.fuehrerscheinAblauf = dokForm.ablaufdatum; updates.fuehrerschein = true }
                      save(updates)
                      setShowDokForm(false)
                      setDokForm({ kategorie: 'ausweis', bezeichnung: '', dateiName: '', hochgeladenAm: today(), ablaufdatum: '', ausgestellt: '', ausstellendeBehörde: '', dokumentNummer: '', dorisAusgelesen: false, notizen: '', vertraulich: false })
                    }}>Speichern</Btn>
                    <button onClick={async () => {
                      if (!dokForm.dateiBase64) {
                        alert('Bitte zuerst ein Bild hochladen (JPG/PNG Foto des Ausweises)')
                        return
                      }
                      setDokForm(f => ({ ...f, bezeichnung: f.bezeichnung || 'Dokument wird ausgelesen ...' }))

                      try {
                        // Universelle Dokumentverarbeitung: Bilder + PDF + DOCX
                        const fakeFile = { name: dokForm.dateiName || 'ausweis', type: dokForm.dateiBase64.split(',')[0].match(/:(.*?);/)?.[1] || '' } as File
                        const { content: kiContent, fehler: extFehler } = await bereiteKiInhaltVor(fakeFile, dokForm.dateiBase64)
                        if (extFehler || kiContent.length === 0) {
                          alert(`❌ ${extFehler || 'Dateiformat nicht unterstützt.'}\nUnterstützt: JPG, PNG, PDF, DOCX, TXT`)
                          return
                        }
                        
                        const response = await fetch('/api/ai', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            model: 'claude-sonnet-4-20250514',
                            max_tokens: 1000,
                            system: `Du bist Doris, Spezialistin für Ausweisdokumente aller EU/Schengen-Länder.
Antworte NUR mit JSON. Datumsfelder: YYYY-MM-DD. Staatsangehörigkeit auf Deutsch.
Felder (nur wenn erkennbar): vorname, nachname, geburtsdatum, geburtsort, staatsangehoerigkeit, geschlecht (weiblich/maennlich), dokumentNummer, ausstellungsdatum, ablaufdatum, ausstellendeBehörde, dokumentTyp`,
                            messages: [{
                              role: 'user',
                              content: kiContent
                            }]
                          })
                        })

                        const data = await response.json()
                        const rawText = data.content?.[0]?.text || '{}'
                        const clean = rawText.replace(/```json|```/g, '').trim()
                        const felder = JSON.parse(clean)

                        // Formular befüllen
                        setDokForm(f => ({
                          ...f,
                          bezeichnung: felder.dokumentTyp || f.bezeichnung || 'Ausweis',
                          dokumentNummer: felder.dokumentNummer || f.dokumentNummer,
                          ausgestellt: felder.ausstellungsdatum || f.ausgestellt,
                          ablaufdatum: felder.ablaufdatum || f.ablaufdatum,
                          ausstellendeBehörde: felder.ausstellendeBehörde || f.ausstellendeBehörde,
                          dorisAusgelesen: true,
                          notizen: `Von Doris ausgelesen am ${new Date().toLocaleDateString('de-AT')}`,
                        }))

                        // Alle erkannten Felder IMMER in Stammdaten übernehmen (überschreiben!)
                        const updates: Partial<Betreuerin> = {}
                        if (felder.vorname) updates.vorname = felder.vorname
                        if (felder.nachname) updates.nachname = felder.nachname
                        if (felder.geburtsdatum) updates.geburtsdatum = felder.geburtsdatum
                        if (felder.geburtsort) updates.geburtsort = felder.geburtsort
                        if (felder.staatsangehoerigkeit) updates.staatsangehoerigkeit = felder.staatsangehoerigkeit
                        if (felder.geschlecht) updates.geschlecht = felder.geschlecht as any
                        if (felder.ausstellungsdatum) updates.ausweisAusgestelltAm = felder.ausstellungsdatum
                        if (felder.ausstellendeBehörde) updates.ausweisBehoerde = felder.ausstellendeBehörde
                        if (felder.ablaufdatum) updates.ausweisAblauf = felder.ablaufdatum
                        if (felder.dokumentNummer) updates.ausweisNummer = felder.dokumentNummer

                        if (Object.keys(updates).length > 0) {
                          save(updates)
                          // Direkt in DB speichern
                          try {
                            await fetch('/api/db/betreuerinnen?id=' + b.id, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(updates)
                            })
                          } catch(e) { console.error('DB-Save Fehler:', e) }
                        }

                        const erkannt = Object.entries(felder).map(([k,v]) => `• ${k}: ${v}`).join('\n')
                        alert(`✅ Doris hat folgende Felder erkannt:\n\n${erkannt}\n\n✅ Stammdaten wurden automatisch gespeichert!`)
                      } catch (err) {
                        alert('Fehler beim Auslesen. Bitte prüfen Sie die Internetverbindung.')
                      }
                    }} className="rounded-2xl border border-violet-200 bg-violet-50 text-violet-700 text-sm font-semibold px-4 py-2 cursor-pointer hover:bg-violet-100">
                      👓 Doris auslesen lassen
                    </button>
                  </div>
                </div>
              )}

              {b.dokumente.length === 0 && !showDokForm && (
                <div className="text-center py-12 text-slate-400"><div className="text-4xl mb-2">📁</div><div>Noch keine Dokumente</div></div>
              )}

              {(['ausweis', 'reisepass', 'fuehrerschein', 'vollmacht', 'vertrag', 'meldebestaetigung', 'gewerbeschein', 'sv_karte', 'qualifikation', 'sonstiges'] as DokumentKat[]).map(kat => {
                const doks = b.dokumente.filter(d => d.kategorie === kat)
                if (doks.length === 0) return null
                return (
                  <div key={kat}>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{DOK_KAT_ICONS[kat]} {DOK_KAT_LABELS[kat]}</div>
                    {doks.map(d => (
                      <div key={d.id} className={clsx('rounded-2xl border px-5 py-4 mb-2',
                        isAbgelaufen(d) ? 'border-rose-200 bg-rose-50' : laueftBaldAb(d) ? 'border-amber-200 bg-amber-50' : d.vertraulich ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white')}>
                        <div className="flex items-center gap-4">
                          {d.dateiBase64 && d.dateiBase64.startsWith('data:image') ? (
                            <img src={d.dateiBase64} alt={d.bezeichnung} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-slate-200" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">
                              {d.dateiBase64?.startsWith('data:application/pdf') ? '📄' : DOK_KAT_ICONS[d.kategorie] || '📎'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900">{d.bezeichnung}</span>
                              {d.vertraulich && <Badge label="🔒" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300" />}
                              {d.dorisAusgelesen && <Badge label="👓 Doris" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200" />}
                              {isAbgelaufen(d) && <Badge label="ABGELAUFEN" className="text-[10px] bg-rose-100 text-rose-700 border-rose-300" />}
                            </div>
                            {d.dokumentNummer && <div className="text-xs font-mono text-slate-500 mt-0.5">Nr. {d.dokumentNummer}</div>}
                            {d.ausstellendeBehörde && <div className="text-xs text-slate-400">{d.ausstellendeBehörde}</div>}
                            {d.dateiName && <div className="text-xs text-slate-300 mt-0.5">📎 {d.dateiName}</div>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <AblaufBadge ablaufdatum={d.ablaufdatum} />
                            <div className="text-xs text-slate-400 mt-1">hochgeladen {fmtDate(d.hochgeladenAm)}</div>
                          </div>
                        </div>
                        {/* Aktionsleiste */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                          {d.dateiBase64 && (
                            <>
                              <a href={d.dateiBase64}
                                download={d.dateiName || `${d.bezeichnung.replace(/\s+/g, '_')}.${d.dateiBase64.includes('pdf') ? 'pdf' : 'jpg'}`}
                                className="rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-xs font-semibold px-3 py-1.5 hover:bg-teal-100 flex items-center gap-1">
                                ⬇️ Herunterladen
                              </a>
                              <button onClick={() => {
                                const w = window.open('', '_blank')
                                if (!w) return
                                if (d.dateiBase64!.startsWith('data:image')) {
                                  w.document.write(`<html><body style="margin:0"><img src="${d.dateiBase64}" style="max-width:100%;print-color-adjust:exact" onload="window.print()"/></body></html>`)
                                } else {
                                  w.document.write(`<html><body style="margin:0"><embed src="${d.dateiBase64}" type="application/pdf" width="100%" height="100%" /><script>setTimeout(()=>window.print(),500)</script></body></html>`)
                                }
                                w.document.close()
                              }} className="rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold px-3 py-1.5 hover:bg-slate-50 cursor-pointer flex items-center gap-1">
                                🖨️ Drucken
                              </button>
                              {b.email && (
                                <a href={`mailto:${b.email}?subject=${encodeURIComponent(`Dokument: ${d.bezeichnung}`)}&body=${encodeURIComponent(`Sehr geehrte Damen und Herren,\n\nim Anhang finden Sie das Dokument: ${d.bezeichnung}.\n\nMit freundlichen Grüßen\nVBetreut GmbH`)}`}
                                  className="rounded-xl border border-sky-200 bg-sky-50 text-sky-700 text-xs font-semibold px-3 py-1.5 hover:bg-sky-100 flex items-center gap-1">
                                  📧 Per E-Mail
                                </a>
                              )}
                              <a href={d.dateiBase64} target="_blank" rel="noopener noreferrer"
                                className="rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold px-3 py-1.5 hover:bg-violet-100 flex items-center gap-1">
                                🔍 Öffnen
                              </a>
                            </>
                          )}
                          {!d.dateiBase64 && (
                            <span className="text-xs text-slate-400 italic">Kein Datei-Upload vorhanden</span>
                          )}
                          {canGF && (
                            <button onClick={() => save({ dokumente: b.dokumente.filter(x => x.id !== d.id) })}
                              className="rounded-xl border border-rose-200 text-rose-500 text-xs px-3 py-1.5 cursor-pointer hover:bg-rose-50 ml-auto">
                              🗑 Löschen
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {/* ═══ BANKDATEN ═══ */}
          {activeTab === 'bank' && (
            <div className="space-y-4">
              {canGF && (
                <button onClick={() => setShowBankForm(true)}
                  className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 px-5 py-4 text-sm font-semibold text-teal-700 cursor-pointer hover:bg-teal-100 w-full justify-center">
                  + Bankverbindung hinzufügen
                </button>
              )}

              {showBankForm && (
                <div className="rounded-2xl border border-teal-200 bg-white p-5">
                  <div className="text-sm font-bold text-slate-800 mb-3">Neue Bankverbindung</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Kontoinhaber" value={bankForm.inhaberName} onChange={v => setBankForm(f => ({ ...f, inhaberName: v }))} wide />
                    <Field label="IBAN *" value={bankForm.iban} onChange={v => setBankForm(f => ({ ...f, iban: v.replace(/\s/g, '').toUpperCase() }))} placeholder="AT12 3456 ..." />
                    <Field label="BIC" value={bankForm.bic} onChange={v => setBankForm(f => ({ ...f, bic: v }))} />
                    <Field label="Bank" value={bankForm.bank} onChange={v => setBankForm(f => ({ ...f, bank: v }))} />
                    <Field label="Land" value={bankForm.land} onChange={v => setBankForm(f => ({ ...f, land: v }))} />
                    <div className="flex items-center gap-3 mt-3">
                      <input type="checkbox" checked={bankForm.hauptkonto} onChange={e => setBankForm(f => ({ ...f, hauptkonto: e.target.checked }))} className="accent-teal-700 w-4 h-4" />
                      <span className="text-sm text-slate-700">Hauptkonto für Auszahlungen</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <Btn onClick={() => setShowBankForm(false)}>Abbrechen</Btn>
                    <Btn teal onClick={() => {
                      if (!bankForm.iban) return
                      const neu: BetreuerinBank = { ...bankForm, id: uid() }
                      save({ bankverbindungen: [...b.bankverbindungen, neu] })
                      setShowBankForm(false)
                      setBankForm({ inhaberName: `${b.vorname} ${b.nachname}`, iban: '', bic: '', bank: '', land: '', hauptkonto: false, verifiziert: false })
                    }}>Speichern</Btn>
                  </div>
                </div>
              )}

              {b.bankverbindungen.length === 0 && !showBankForm && (
                <div className="text-center py-12 text-slate-400"><div className="text-4xl mb-2">🏦</div><div>Keine Bankverbindung hinterlegt</div></div>
              )}

              {b.bankverbindungen.map(bk => (
                <div key={bk.id} className={clsx('rounded-2xl border px-6 py-5', bk.hauptkonto ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white')}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">🏦</span>
                        <span className="font-bold text-slate-900">{bk.bank || 'Bankverbindung'}</span>
                        {bk.hauptkonto && <Badge label="⭐ Hauptkonto" className="text-xs bg-teal-100 text-teal-700 border-teal-300" />}
                        {bk.verifiziert && <Badge label="✓ Verifiziert" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200" />}
                      </div>
                      <div className="text-sm text-slate-600">Inhaber: {bk.inhaberName}</div>
                      <div className="font-mono text-base font-bold text-slate-900 mt-0.5">{bk.iban}</div>
                      <div className="text-xs text-slate-400">{bk.bic ? `BIC: ${bk.bic}` : ''} {bk.land ? `· ${bk.land}` : ''}</div>
                    </div>
                    {canGF && (
                      <button onClick={() => save({ bankverbindungen: b.bankverbindungen.filter(x => x.id !== bk.id) })}
                        className="rounded-xl border border-rose-200 text-rose-500 text-xs px-3 py-2 cursor-pointer hover:bg-rose-50">Entfernen</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ WHATSAPP ═══ */}
          {activeTab === 'whatsapp' && (
            <WhatsAppPanel b={b} onSaveNachricht={(n) => {
              const log = (b as any).whatsappLog || []
              save({ whatsappLog: [...log, n] } as any)
            }} />
          )}

          {/* ═══ DORIS ═══ */}
          {activeTab === 'doris' && (
            <div className="h-full -m-0" style={{ height: 'calc(100vh - 320px)' }}>
              <DorisAgent b={b} onUpdate={data => save(data)} />
            </div>
          )}

          {/* ═══ NOTIZEN ═══ */}
          {activeTab === 'notizen' && (
            <DokumentationsNotiz
              eintraege={Array.isArray(b.notizEintraege) ? b.notizEintraege : []}
              onChange={eintraege => save({ notizEintraege: eintraege })}
              canGF={canGF}
              userName={''}
              notiz={b.notizen}
              onNotizChange={v => save({ notizen: v })}
              internNotiz={b.internNotizen}
              onInternNotizChange={canGF ? v => save({ internNotizen: v }) : undefined}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── StammdatenEditor — Alle Felder direkt editierbar ─────────────────────────
function StammdatenEditor({ b, onSave }: { b: Betreuerin; onSave: (d: Partial<Betreuerin>) => void }) {
  // Lokaler State für sofortiges Feedback beim Tippen
  const [d, setD] = useState<Partial<Betreuerin>>({})
  const val = (k: keyof Betreuerin) => (d[k] !== undefined ? d[k] : b[k]) as string || ''
  const set = (k: keyof Betreuerin, v: string) => setD(prev => ({ ...prev, [k]: v }))
  const blur = (k: keyof Betreuerin) => {
    if (d[k] !== undefined && d[k] !== b[k]) onSave({ [k]: d[k] })
  }

  const inp = (label: string, k: keyof Betreuerin, type = 'text') => (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-teal-400 focus-within:ring-1 focus-within:ring-teal-200 transition-all">
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <input
        type={type}
        value={val(k)}
        onChange={e => set(k, e.target.value)}
        onBlur={() => blur(k)}
        className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none"
        placeholder="–"
      />
    </div>
  )

  const sel = (label: string, k: keyof Betreuerin, opts: [string, string][]) => (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-teal-400 transition-all">
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <select
        value={val(k)}
        onChange={e => { set(k, e.target.value); onSave({ [k]: e.target.value as any }) }}
        className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none cursor-pointer"
      >
        <option value="">– wählen –</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )

  const sec = (title: string) => (
    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-5 mb-3 flex items-center gap-2">
      <span className="flex-1 border-t border-slate-100" />
      {title}
      <span className="flex-1 border-t border-slate-100" />
    </h3>
  )

  return (
    <div className="space-y-1">
      <div className="rounded-2xl bg-teal-50 border border-teal-200 px-4 py-2 text-xs text-teal-700 font-semibold mb-3 flex items-center gap-2">
        <span>✏️</span>
        <span>Felder direkt bearbeiten — Änderungen werden beim Verlassen des Feldes gespeichert</span>
        <button onClick={() => window.location.reload()} className="ml-auto text-teal-600 hover:text-teal-800 cursor-pointer bg-transparent border-none text-xs">↺ Neu laden</button>
      </div>

      {sec('Persönliche Daten')}
      <div className="grid grid-cols-2 gap-2">
        {inp('Geburtsdatum', 'geburtsdatum', 'date')}
        {inp('Geburtsort', 'geburtsort')}
        {inp('Geburtsland', 'geburtsland')}
        {inp('Staatsangehörigkeit', 'staatsangehoerigkeit')}
        {inp('Nationalität', 'nationalitaet')}
        {inp('SVNR', 'svnr')}
        {sel('Familienstand', 'familienstand', [
          ['ledig','Ledig'], ['verheiratet','Verheiratet'],
          ['geschieden','Geschieden'], ['verwitwet','Verwitwet'],
        ])}
        {sel('Geschlecht', 'geschlecht', [
          ['weiblich','Weiblich'], ['maennlich','Männlich'], ['divers','Divers'],
        ])}
        {inp('Religion', 'religion')}
      </div>

      {sec('Ausweisdaten (für Meldezettel)')}
      <div className="rounded-2xl bg-violet-50 border border-violet-200 px-3 py-2 text-xs text-violet-700 mb-2 flex items-center gap-2">
        <span>👓 Doris kann diese Felder automatisch aus Ausweisfotos auslesen</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {inp('Ausweisnummer / Passnummer', 'ausweisNummer')}
        {inp('Ausweis gültig bis', 'ausweisAblauf', 'date')}
        {inp('Ausstellende Behörde', 'ausweisBehoerde')}
        {inp('Ausgestellt am', 'ausweisAusgestelltAm', 'date')}
        {inp('Führerschein-Nr.', 'fuehrerscheinNummer')}
        {sel('FS Klasse', 'fuehrerscheinKlasse', [['B','B'],['C','C'],['D','D'],['BE','BE']])}
        {inp('FS gültig bis', 'fuehrerscheinAblauf', 'date')}
      </div>

      {sec('Hauptwohnsitz (Heimat)')}
      <div className="grid grid-cols-2 gap-2">
        {inp('Straße', 'hauptwohnsitzStrasse')}
        {inp('PLZ', 'hauptwohnsitzPlz')}
        {inp('Ort', 'hauptwohnsitzOrt')}
        {inp('Land', 'hauptwohnsitzLand')}
      </div>

      {sec('Österreich-Adresse (beim Einsatz / für Meldezettel)')}
      <div className="grid grid-cols-2 gap-2">
        {inp('Straße', 'oesterreichStrasse')}
        {inp('PLZ', 'oesterreichPlz')}
        {inp('Ort', 'oesterreichOrt')}
      </div>

      {sec('Gewerbe')}
      <div className="grid grid-cols-2 gap-2">
        {inp('GISA-Nummer', 'gisaNummer')}
        {inp('Gewerbebezeichnung', 'gewerbeName')}
        {sel('Gewerbe-Status', 'gewerbeStatus', [
          ['aufrecht','Aufrecht (aktiv)'], ['aktiv','Aktiv (alt)'], ['nicht_angemeldet','Nicht angemeldet'],
          ['erloschen','Erloschen'], ['unbekannt','Unbekannt'],
        ])}
        {inp('Gewerbe Ablauf', 'gewerbeAblauf', 'date')}
      </div>
    </div>
  )
}
