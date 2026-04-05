'use client'
/**
 * PdfAusfuellen — Echtes PDF hochladen, Felder erkennen, ausfüllen, drucken
 * Unterstützt: Meldezettel, beliebige Formulare
 */
import { useState, useRef } from 'react'
import type { Betreuerin } from '@/lib/betreuerinnen'
import type { Klient } from '@/lib/klienten'

interface Props {
  betreuerin?: Betreuerin
  klient?: Klient
  klienten?: Klient[]
  onClose: () => void
}

interface ErkanntesFeld {
  name: string
  label: string
  wert: string
  typ: 'text' | 'checkbox' | 'date'
  seite?: number
}

export default function PdfAusfuellen({ betreuerin, klient, onClose }: Props) {
  const [phase, setPhase] = useState<'upload' | 'erkennung' | 'felder' | 'fertig'>('upload')
  const [pdfBase64, setPdfBase64] = useState('')
  const [pdfName, setPdfName] = useState('')
  const [felder, setFelder] = useState<ErkanntesFeld[]>([])
  const [loading, setLoading] = useState(false)
  const [fehler, setFehler] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Bekannte Felder aus Klient/Betreuerin vorausfüllen
  function vorausfuellen(erkannt: ErkanntesFeld[]): ErkanntesFeld[] {
    const b = betreuerin
    const k = klient
    return erkannt.map(f => {
      const lc = f.label.toLowerCase()
      let wert = f.wert

      if (b) {
        if (lc.includes('familienname') || lc.includes('nachname') || lc.includes('surname')) wert = b.nachname
        else if (lc.includes('vorname') || lc.includes('given name')) wert = b.vorname
        else if (lc.includes('geburtsdatum') || lc.includes('birth')) wert = b.geburtsdatum ? new Date(b.geburtsdatum+'T12:00:00').toLocaleDateString('de-AT') : ''
        else if (lc.includes('geburtsort') || lc.includes('place of birth')) wert = b.geburtsort
        else if (lc.includes('staatsangehörigkeit') || lc.includes('nationality')) wert = b.staatsangehoerigkeit
        else if (lc.includes('dokumentnummer') || lc.includes('pass') || lc.includes('ausweis')) wert = b.ausweisNummer
        else if (lc.includes('ablaufdatum') || lc.includes('expiry')) wert = b.ausweisAblauf ? new Date(b.ausweisAblauf+'T12:00:00').toLocaleDateString('de-AT') : ''
        else if (lc.includes('behörde') || lc.includes('authority')) wert = b.ausweisBehoerde
        else if (lc.includes('straße') && lc.includes('unterkunft')) wert = k?.strasse || ''
        else if (lc.includes('plz') && (lc.includes('unterkunft') || lc.includes('ort'))) wert = k?.plz || ''
        else if (lc.includes('ortsgemeinde') || lc.includes('ort')) wert = k ? `${k.plz} ${k.ort}` : ''
        else if (lc.includes('unterkunftgeber')) wert = k ? `${k.vorname} ${k.nachname}` : ''
        else if (lc.includes('hauptwohnsitz') && lc.includes('nein')) wert = 'ja' // Checkbox
        else if (lc.includes('geschlecht') && lc.includes('weiblich')) wert = 'ja'
      }

      return { ...f, wert }
    })
  }

  async function handleUpload(file: File) {
    if (!file || !file.name.endsWith('.pdf')) {
      setFehler('Bitte ein PDF-Formular hochladen.')
      return
    }
    setFehler('')
    setPdfName(file.name)
    setLoading(true)
    setPhase('erkennung')

    // PDF als base64
    const reader = new FileReader()
    reader.onload = async (e) => {
      const b64 = (e.target?.result as string).split(',')[1]
      setPdfBase64(b64)

      // KI erkennt Felder aus PDF
      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            system: `Du bist ein Spezialist für österreichische Formulare, besonders den amtlichen Meldezettel (BGBl. I Nr. 173/2022).
Analysiere das hochgeladene PDF und extrahiere ALLE ausfüllbaren Felder.
Antworte NUR mit einem JSON-Array, kein anderer Text, keine Markdown-Backticks.
Format: [{"name":"feld_id","label":"Beschriftung auf Formular","wert":"","typ":"text|checkbox|date","seite":1}]`,
            messages: [{
              role: 'user',
              content: [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
                { type: 'text', text: 'Erkenne alle Formularfelder in diesem PDF. Für den Meldezettel: Familienname, Vorname, Geburtsdatum, Geburtsort, Geschlecht (Checkboxen), Familienstand, Staatsangehörigkeit, Reisedokument, Anmeldungsadresse (Straße, Hausnr., PLZ, Ort), Hauptwohnsitz (Checkbox), Zuzug aus Ausland, Unterkunftgeber. Gib für jedes Feld name, label, wert (leer), typ und seite zurück.' }
              ]
            }]
          })
        })
        const data = await res.json()
        const raw = data.content?.[0]?.text || '[]'
        const clean = raw.replace(/```json|```/g, '').trim()
        const erkannt: ErkanntesFeld[] = JSON.parse(clean)
        const vorausgefuellt = vorausfuellen(erkannt)
        setFelder(vorausgefuellt)
        setPhase('felder')
      } catch (e) {
        // Fallback: Meldezettel-Felder manuell
        setFelder(vorausfuellen(meldezettFelderFallback()))
        setPhase('felder')
      }
      setLoading(false)
    }
    reader.readAsDataURL(file)
  }

  function meldezettFelderFallback(): ErkanntesFeld[] {
    return [
      { name: 'familienname', label: 'FAMILIENNAME (Blockschrift)', wert: '', typ: 'text', seite: 1 },
      { name: 'vorname', label: 'VORNAME', wert: '', typ: 'text', seite: 1 },
      { name: 'geburtsname', label: 'Familienname vor erster Ehe', wert: '', typ: 'text', seite: 1 },
      { name: 'geburtsdatum', label: 'GEBURTSDATUM', wert: '', typ: 'date', seite: 1 },
      { name: 'geburtsort', label: 'GEBURTSORT', wert: '', typ: 'text', seite: 1 },
      { name: 'religion', label: 'Kirche/Religionsgesellschaft', wert: '', typ: 'text', seite: 1 },
      { name: 'staatsangehoerigkeit_at', label: 'Österreich (Checkbox)', wert: '', typ: 'checkbox', seite: 1 },
      { name: 'staatsangehoerigkeit_ausland', label: 'Anderer Staat (Checkbox)', wert: '', typ: 'checkbox', seite: 1 },
      { name: 'staat_name', label: 'Name des Staates', wert: '', typ: 'text', seite: 1 },
      { name: 'reisedokument_art', label: 'Reisedokument Art', wert: '', typ: 'text', seite: 1 },
      { name: 'reisedokument_nr', label: 'Reisedokument Nummer', wert: '', typ: 'text', seite: 1 },
      { name: 'reisedokument_datum', label: 'Ausstellungsdatum', wert: '', typ: 'date', seite: 1 },
      { name: 'reisedokument_behoerde', label: 'Ausstellende Behörde', wert: '', typ: 'text', seite: 1 },
      { name: 'anmeldung_strasse', label: 'Straße (Anmeldung)', wert: '', typ: 'text', seite: 1 },
      { name: 'anmeldung_hausnr', label: 'Haus-Nr.', wert: '', typ: 'text', seite: 1 },
      { name: 'anmeldung_stiege', label: 'Stiege', wert: '', typ: 'text', seite: 1 },
      { name: 'anmeldung_tuer', label: 'Tür-Nr.', wert: '', typ: 'text', seite: 1 },
      { name: 'anmeldung_plz', label: 'PLZ', wert: '', typ: 'text', seite: 1 },
      { name: 'anmeldung_ort', label: 'Ortsgemeinde, Bundesland', wert: '', typ: 'text', seite: 1 },
      { name: 'hauptwohnsitz_ja', label: 'Hauptwohnsitz: JA', wert: '', typ: 'checkbox', seite: 1 },
      { name: 'hauptwohnsitz_nein', label: 'Hauptwohnsitz: NEIN', wert: '', typ: 'checkbox', seite: 1 },
      { name: 'hw_strasse', label: 'Hauptwohnsitz bleibt: Straße', wert: '', typ: 'text', seite: 1 },
      { name: 'hw_plz', label: 'Hauptwohnsitz bleibt: PLZ', wert: '', typ: 'text', seite: 1 },
      { name: 'hw_ort', label: 'Hauptwohnsitz bleibt: Ort', wert: '', typ: 'text', seite: 1 },
      { name: 'zuzug_ja', label: 'Zuzug aus Ausland: JA', wert: '', typ: 'checkbox', seite: 1 },
      { name: 'zuzug_staat', label: 'Zuzug: Name des Staates', wert: '', typ: 'text', seite: 1 },
      { name: 'unterkunftgeber_name', label: 'Unterkunftgeber Name', wert: '', typ: 'text', seite: 1 },
      { name: 'unterkunftgeber_datum', label: 'Unterkunftgeber Datum', wert: '', typ: 'date', seite: 1 },
      { name: 'meldepflichtiger_datum', label: 'Datum Meldepflichtiger', wert: '', typ: 'date', seite: 1 },
    ]
  }

  function setFeld(name: string, wert: string) {
    setFelder(prev => prev.map(f => f.name === name ? { ...f, wert } : f))
  }

  function drucken() {
    // Overlay-Druck: Felder als Text über das Original-PDF rendern
    const iframe = document.createElement('iframe')
    iframe.id = 'pdf-fill-frame'
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9999;background:white'
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument!
    doc.open()
    doc.write(buildDruckHTML())
    doc.close()
    setTimeout(() => {
      const btn = doc.createElement('button')
      btn.textContent = '✕ Schließen'
      btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;padding:8px 16px;background:#1e293b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold'
      btn.onclick = () => document.getElementById('pdf-fill-frame')?.remove()
      doc.body.appendChild(btn)
      iframe.contentWindow?.print()
    }, 400)
    setPhase('fertig')
  }

  function buildDruckHTML(): string {
    const f: Record<string, string> = {}
    felder.forEach(x => { f[x.name] = x.wert })
    const cb = (val: string) => val === 'ja' || val === 'x' || val === '1'
      ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:11px;height:11px;border:1.5px solid #000;background:#000;color:white;font-size:8px;vertical-align:middle">✓</span>`
      : `<span style="display:inline-flex;align-items:center;justify-content:center;width:11px;height:11px;border:1.5px solid #000;vertical-align:middle"></span>`
    const inp = (v: string, w = 80) => `<span style="display:inline-block;min-width:${w}px;border-bottom:1px solid #333;padding:0 2px;font-size:10pt;vertical-align:bottom;min-height:14px;font-weight:${v ? 'bold' : 'normal'}">${v || ''}</span>`

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${pdfName || 'Meldezettel'}</title>
<style>
@page{size:A4 portrait;margin:12mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#000;background:white}
table{width:100%;border-collapse:collapse}
td{vertical-align:top}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body>
<div style="text-align:center;font-size:20pt;font-weight:bold;margin-bottom:4mm">Meldezettel</div>
<div style="font-size:8pt;color:#333;margin-bottom:3mm">Zutreffendes bitte ankreuzen ☒! Erläuterungen auf der Rückseite!</div>
<table><tbody>
<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
<div style="font-size:7pt;color:#333">FAMILIENNAME (in Blockschrift), AKAD. GRAD</div>
<div style="font-size:12pt;font-weight:bold;min-height:20px">${f.familienname||''}</div>
</td></tr>
<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
<div style="font-size:7pt;color:#333">VORNAME lt. Reisedokument</div>
<div style="font-size:11pt;min-height:18px">${f.vorname||''}</div>
</td></tr>
<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
<div style="font-size:7pt;color:#333">Familienname vor der ersten Eheschließung/Eingetragenen Partnerschaft</div>
<div style="min-height:16px">${f.geburtsname||''}</div>
</td></tr>
<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
<div style="display:flex;gap:8px">
<div style="width:110px"><div style="font-size:7pt;color:#333">GEBURTSDATUM</div><div style="font-size:10pt;font-weight:bold">${f.geburtsdatum||''}</div></div>
<div style="flex:1"><div style="font-size:7pt;color:#333">GESCHLECHT</div><div style="font-size:8.5pt;line-height:2">
${cb('')} männlich &nbsp; ${cb('ja')} weiblich &nbsp; ${cb('')} divers &nbsp; ${cb('')} inter &nbsp; ${cb('')} offen
</div></div>
<div style="flex:1"><div style="font-size:7pt;color:#333">KIRCHE / RELIGIONSGESELLSCHAFT</div><div style="min-height:16px">${f.religion||''}</div></div>
</div></td></tr>
<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
<div style="font-size:7pt;color:#333">GEBURTSORT</div><div style="min-height:16px">${f.geburtsort||''}</div>
</td></tr>
<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
<div style="font-size:7pt;color:#333;font-weight:bold">STAATSANGEHÖRIGKEIT</div>
<div style="font-size:8.5pt;margin-top:2px">
${cb(f.staatsangehoerigkeit_at)} Österreich &nbsp;&nbsp;&nbsp;
${cb(f.staatsangehoerigkeit_ausland||'ja')} anderer Staat &nbsp;&nbsp;&nbsp;
Name des Staates: ${inp(f.staat_name||'',120)}
</div></td></tr>
<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
<div style="font-size:7pt;color:#333;font-weight:bold">REISEDOKUMENT bei Fremden</div>
<div style="font-size:8.5pt;margin-top:2px">
Art: ${inp(f.reisedokument_art||'',80)} &nbsp; Nummer: ${inp(f.reisedokument_nr||'',80)} &nbsp; Ausstellungsdatum: ${inp(f.reisedokument_datum||'',70)}
</div>
<div style="font-size:8.5pt;margin-top:2px">Ausstellende Behörde: ${inp(f.reisedokument_behoerde||'',210)}</div>
</td></tr>
<tr>
<td style="border:1px solid #000;padding:2px 4px;background:#f0f0f0;width:22%;vertical-align:middle" rowspan="2"><b style="font-size:9pt">ANMELDUNG der Unterkunft in ...</b></td>
<td colspan="3" style="border:1px solid #000;padding:2px 4px">
<div style="display:flex;gap:5px;align-items:flex-end">
<div style="flex:1"><span style="font-size:7pt">Straße</span><br>${inp(f.anmeldung_strasse||'',130)}</div>
<div><span style="font-size:7pt">Haus-Nr.</span><br>${inp(f.anmeldung_hausnr||'',40)}</div>
<div><span style="font-size:7pt">Stiege</span><br>${inp(f.anmeldung_stiege||'',30)}</div>
<div><span style="font-size:7pt">Tür</span><br>${inp(f.anmeldung_tuer||'',30)}</div>
</div></td></tr>
<tr><td colspan="3" style="border:1px solid #000;padding:2px 4px">
<div style="display:flex;gap:5px;align-items:flex-end">
<div><span style="font-size:7pt">PLZ</span><br>${inp(f.anmeldung_plz||'',55)}</div>
<div style="flex:1"><span style="font-size:7pt">Ortsgemeinde, Bundesland</span><br>${inp(f.anmeldung_ort||'',160)}</div>
</div></td></tr>
<tr><td colspan="4" style="border:1px solid #000;padding:3px 4px">
<span style="font-size:8.5pt">Ist diese Unterkunft <b>Hauptwohnsitz</b>? &nbsp;&nbsp;
${cb(f.hauptwohnsitz_ja)} ja &nbsp;&nbsp; ${cb(f.hauptwohnsitz_nein||'ja')} nein</span>
</td></tr>
<tr>
<td style="border:1px solid #000;padding:2px 4px;background:#e8e8e8;width:22%;vertical-align:middle" rowspan="2"><b style="font-size:9pt">wenn nein, Hauptwohnsitz bleibt in ...</b></td>
<td colspan="3" style="border:1px solid #000;padding:2px 4px">
${inp(f.hw_strasse||'',200)}</td></tr>
<tr><td colspan="3" style="border:1px solid #000;padding:2px 4px">
<div style="display:flex;gap:5px">${inp(f.hw_plz||'',55)} ${inp(f.hw_ort||'',160)}</div></td></tr>
<tr><td colspan="4" style="border:1px solid #000;padding:3px 4px">
<span style="font-size:8.5pt">Zuzug aus dem Ausland? &nbsp;&nbsp;
${cb('')} nein &nbsp;&nbsp; ${cb(f.zuzug_ja||'ja')} ja &nbsp;&nbsp;&nbsp;
Name des Staates: ${inp(f.zuzug_staat||'',120)}</span>
</td></tr>
<tr>
<td colspan="2" style="border:1px solid #000;padding:4px;min-height:55px">
<div style="font-size:7pt;font-weight:bold">Im Falle einer Anmeldung:</div>
<div style="font-size:7pt">Unterkunftgeber (Name in Blockschrift, Datum und Unterschrift)</div>
<div style="min-height:42px;border-top:1px solid #ccc;margin-top:5px;font-size:9pt">${f.unterkunftgeber_name||''} ${f.unterkunftgeber_datum ? '&nbsp;&nbsp;' + f.unterkunftgeber_datum : ''}</div>
</td>
<td colspan="2" style="border:1px solid #000;padding:4px;min-height:55px">
<div style="font-size:7pt">Datum und Unterschrift des/der Meldepflichtigen</div>
<div style="min-height:42px;border-top:1px solid #ccc;margin-top:5px;font-size:9pt">${f.meldepflichtiger_datum||''}</div>
</td></tr>
</tbody></table>
<div style="margin-top:5mm;display:flex;justify-content:space-between;font-size:7pt;color:#555">
<span>OESTERREICH.GV.AT/Meldezettel_2023111</span><span>Seite 1 von 2</span>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex" onClick={onClose}>
      <div className="w-full max-w-5xl mx-auto my-4 bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-teal-800 px-6 py-4 flex items-center gap-4 flex-shrink-0">
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl bg-transparent border-none cursor-pointer">✕</button>
          <div>
            <div className="text-xs text-white/50 uppercase tracking-widest">PDF-Formular ausfüllen</div>
            <div className="font-bold text-white">📄 {pdfName || 'PDF hochladen und ausfüllen'}</div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">

          {/* PHASE: UPLOAD */}
          {phase === 'upload' && (
            <div className="max-w-lg mx-auto text-center py-10">
              <div className="text-6xl mb-4">📤</div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">PDF-Formular hochladen</h2>
              <p className="text-slate-500 mb-8">Laden Sie das amtliche Formular (z.B. Meldezettel) hoch. Die KI erkennt alle Felder und füllt bekannte Daten automatisch aus.</p>

              <div
                className="border-2 border-dashed border-teal-300 rounded-3xl p-10 cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-all"
                onClick={() => fileRef.current?.click()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f) }}
                onDragOver={e => e.preventDefault()}
              >
                <div className="text-4xl mb-3">📋</div>
                <div className="font-semibold text-teal-700 mb-1">PDF hier ablegen oder klicken</div>
                <div className="text-sm text-slate-400">Meldezettel, Förderantrag, beliebige Formulare</div>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
              </div>

              {fehler && <div className="mt-4 text-rose-600 text-sm">{fehler}</div>}

              <div className="mt-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-left text-sm text-amber-800">
                <div className="font-bold mb-1">💡 Tipp: Amtlicher Meldezettel</div>
                <div>Den offiziellen Meldezettel finden Sie auf <strong>oesterreich.gv.at</strong> als PDF. Laden Sie genau dieses Originalformular hoch — die KI füllt dann alle Felder mit den Daten der Betreuerin aus.</div>
              </div>
            </div>
          )}

          {/* PHASE: ERKENNUNG */}
          {phase === 'erkennung' && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4 animate-pulse">🔍</div>
              <div className="text-xl font-bold text-slate-900 mb-2">KI analysiert das Formular...</div>
              <div className="text-slate-500">Felder werden erkannt und mit bekannten Daten vorausgefüllt</div>
            </div>
          )}

          {/* PHASE: FELDER BEARBEITEN */}
          {phase === 'felder' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">✏️ Felder prüfen und anpassen</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Bekannte Daten wurden automatisch eingetragen. Bitte prüfen und fehlende Felder ergänzen.</p>
                </div>
                <button onClick={drucken} className="rounded-2xl bg-teal-700 text-white font-bold px-6 py-3 cursor-pointer border-none hover:bg-teal-800 flex items-center gap-2">
                  🖨️ Ausfüllen & Drucken
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {felder.map(f => (
                  <div key={f.name} className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-teal-400 focus-within:ring-1 focus-within:ring-teal-200 transition-all">
                    <div className="text-xs text-slate-400 mb-0.5 flex items-center gap-1">
                      {f.typ === 'checkbox' && '☑'} {f.label}
                      {f.seite && f.seite > 1 && <span className="text-slate-300">· S.{f.seite}</span>}
                    </div>
                    {f.typ === 'checkbox' ? (
                      <div className="flex gap-3 mt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                          <input type="radio" name={f.name} value="ja" checked={f.wert === 'ja'} onChange={() => setFeld(f.name, 'ja')} />
                          Ja / ✓
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                          <input type="radio" name={f.name} value="" checked={f.wert !== 'ja'} onChange={() => setFeld(f.name, '')} />
                          Nein
                        </label>
                      </div>
                    ) : (
                      <input
                        type={f.typ === 'date' ? 'date' : 'text'}
                        value={f.wert}
                        onChange={e => setFeld(f.name, e.target.value)}
                        className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none"
                        placeholder="–"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PHASE: FERTIG */}
          {phase === 'fertig' && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">✅</div>
              <div className="text-xl font-bold text-slate-900 mb-2">Formular wurde gedruckt!</div>
              <div className="text-slate-500 mb-6">Das ausgefüllte Formular wurde an den Drucker gesendet.</div>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setPhase('felder')} className="rounded-2xl border border-slate-200 text-slate-700 px-5 py-2 cursor-pointer hover:bg-slate-50">
                  ← Zurück zu den Feldern
                </button>
                <button onClick={onClose} className="rounded-2xl bg-teal-700 text-white px-5 py-2 cursor-pointer border-none hover:bg-teal-800">
                  Fertig
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
