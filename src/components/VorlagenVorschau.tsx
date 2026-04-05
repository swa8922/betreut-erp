'use client'
/**
 * VorlagenVorschau — Vorschau und PDF-Druck für Dokumentvorlagen
 * 
 * Zeigt die Vorlage formatiert an und ermöglicht:
 * - Vorschau mit befüllten Platzhaltern
 * - PDF-Druck (Browser-Print A4)
 * - Design-Anpassung (Farbe, Logo, Schrift)
 */

import { useState, useRef } from 'react'
import type { Vorlage } from '@/lib/dokumente'
import type { FirmaData } from '@/hooks/useFirma'

interface Props {
  vorlage: Vorlage
  firma: FirmaData
  testDaten?: Record<string, string>
  onClose: () => void
}

// Design-Optionen
const DESIGNS = [
  { id: 'vbetreut', label: 'VBetreut Standard', primary: '#0f766e', accent: '#134e4a', font: 'Arial, sans-serif' },
  { id: 'klassisch', label: 'Klassisch Schwarz', primary: '#1e293b', accent: '#334155', font: 'Georgia, serif' },
  { id: 'modern', label: 'Modern Blau', primary: '#1d4ed8', accent: '#1e3a8a', font: 'Arial, sans-serif' },
  { id: 'schlicht', label: 'Schlicht', primary: '#374151', accent: '#111827', font: 'Arial, sans-serif' },
]

// Füllt Platzhalter im Text
function fuellePlatzhalter(text: string, daten: Record<string, string>, firma: FirmaData): string {
  const heute = new Date().toLocaleDateString('de-AT')
  let result = text
    // Firma
    .replace(/\{\{firma_name\}\}/g, firma.name)
    .replace(/\{\{firma_strasse\}\}/g, firma.strasse)
    .replace(/\{\{firma_plz\}\}/g, firma.plz)
    .replace(/\{\{firma_ort\}\}/g, firma.ort)
    .replace(/\{\{firma_telefon\}\}/g, firma.telefon)
    .replace(/\{\{firma_email\}\}/g, firma.email)
    .replace(/\{\{firma_web\}\}/g, firma.web)
    .replace(/\{\{firma_iban\}\}/g, firma.iban)
    .replace(/\{\{firma_bic\}\}/g, firma.bic)
    .replace(/\{\{firma_ust_id\}\}/g, firma.ustId)
    .replace(/\{\{firma_gericht\}\}/g, firma.gericht)
    .replace(/\{\{firma_gf\}\}/g, firma.gf)
    // Datum
    .replace(/\{\{datum_heute\}\}/g, heute)
    .replace(/\{\{heute\}\}/g, heute)
  
  // Felder aus daten
  Object.entries(daten).forEach(([key, val]) => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `[${key}]`)
  })
  
  // Restliche Platzhalter mit Leerzeichen ersetzen (für Druckversion)
  result = result.replace(/\{\{[^}]+\}\}/g, '_______________')
  
  return result
}

export default function VorlagenVorschau({ vorlage, firma, testDaten = {}, onClose }: Props) {
  const [designId, setDesignId] = useState('vbetreut')
  const [showFelder, setShowFelder] = useState(false)
  const [felderWerte, setFelderWerte] = useState<Record<string, string>>(testDaten)
  const druckRef = useRef<HTMLDivElement>(null)

  const design = DESIGNS.find(d => d.id === designId) || DESIGNS[0]

  // Alle Felder mit Standardwerten vorausfüllen
  const alleFelder = vorlage.felder || []
  const initialFelder: Record<string, string> = {}
  alleFelder.forEach(f => {
    if (!felderWerte[f.key]) {
      initialFelder[f.key] = f.platzhalter?.startsWith('{{') ? '' : (f.platzhalter || '')
    }
  })
  const daten = { ...initialFelder, ...felderWerte }

  const text = fuellePlatzhalter(vorlage.textvorlage || vorlage.inhalt || '', daten, firma)
  const istMeldezettel = vorlage.typ === 'meldezettel' || vorlage.vorlageTyp === 'meldezettel'
  const istRechnung = ['rechnung', 'rechnung_klient', 'honorarnote'].includes(vorlage.typ || '')
  const istEmail = vorlage.typ === 'email' || vorlage.vorlageTyp === 'email'

  function drucken() {
    const existingFrame = document.getElementById('vv-print-frame')
    if (existingFrame) existingFrame.remove()
    const iframe = document.createElement('iframe')
    iframe.id = 'vv-print-frame'
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9999;background:white'
    document.body.appendChild(iframe)
    const w = iframe.contentDocument || iframe.contentWindow?.document
    if (!w) return

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${vorlage.name}</title>
  <style>
    @page { size: A4; margin: 18mm 18mm 22mm 18mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${design.font}; font-size: 11pt; color: #1a1a1a; background: white; }
    
    .header { border-bottom: 3px solid ${design.primary}; padding-bottom: 8mm; margin-bottom: 8mm; display: flex; justify-content: space-between; align-items: flex-start; }
    .header-left { }
    .firma-name { font-size: 18pt; font-weight: bold; color: ${design.primary}; margin-bottom: 2mm; }
    .firma-details { font-size: 8pt; color: #666; line-height: 1.6; }
    .header-right { text-align: right; font-size: 8pt; color: #666; line-height: 1.6; }
    
    .dokument-titel { font-size: 16pt; font-weight: bold; color: ${design.accent}; margin: 8mm 0 4mm 0; border-left: 4px solid ${design.primary}; padding-left: 4mm; }
    
    .inhalt { white-space: pre-wrap; font-size: 10.5pt; line-height: 1.7; color: #1a1a1a; }
    
    .footer { margin-top: 15mm; padding-top: 4mm; border-top: 1px solid #ddd; font-size: 7.5pt; color: #888; display: flex; justify-content: space-between; }

    /* Meldezettel-spezifisch */
    .meldezettel-header { text-align: center; font-size: 20pt; font-weight: bold; margin-bottom: 6mm; }
    .meldezettel-sub { text-align: center; font-size: 9pt; color: #666; margin-bottom: 6mm; }
    .feld-zeile { display: flex; margin-bottom: 6mm; align-items: flex-end; }
    .feld-label { font-size: 8pt; color: #444; min-width: 55mm; }
    .feld-linie { flex: 1; border-bottom: 1px solid #333; margin-left: 3mm; min-height: 6mm; padding-bottom: 1mm; font-size: 10pt; }
    .feld-linie.gefuellt { border-bottom: 2px solid ${design.primary}; color: ${design.primary}; font-weight: bold; }
    .sektion { margin: 5mm 0 2mm 0; font-size: 9pt; font-weight: bold; text-transform: uppercase; color: #666; border-bottom: 0.5pt solid #ccc; padding-bottom: 1mm; }
    .checkbox-zeile { display: flex; gap: 8mm; flex-wrap: wrap; font-size: 9.5pt; align-items: center; }
    .checkbox { display: inline-block; width: 4mm; height: 4mm; border: 1pt solid #333; margin-right: 2mm; vertical-align: middle; }
    
    /* Rechnung-spezifisch */
    .rechnungs-kopf { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-bottom: 8mm; }
    .empfaenger { font-size: 10pt; line-height: 1.8; }
    .rechnungs-info { text-align: right; font-size: 9.5pt; }
    .rechnungs-info table { width: 100%; }
    .rechnungs-info td { padding: 1mm 0; }
    .rechnungs-info td:first-child { color: #666; }
    .rechnungs-info td:last-child { font-weight: bold; text-align: right; }
    .positionen { width: 100%; border-collapse: collapse; margin: 6mm 0; font-size: 10pt; }
    .positionen thead { background: ${design.primary}; color: white; }
    .positionen th { padding: 3mm 4mm; text-align: left; font-size: 9pt; }
    .positionen th:last-child, .positionen td:last-child { text-align: right; }
    .positionen td { padding: 2.5mm 4mm; border-bottom: 0.5pt solid #eee; }
    .positionen tr.sub td { font-size: 8.5pt; color: #666; padding-top: 0.5mm; padding-bottom: 2.5mm; }
    .summen { margin-top: 4mm; border-top: 1pt solid #ccc; padding-top: 3mm; text-align: right; }
    .summen table { margin-left: auto; width: 80mm; }
    .summen td { padding: 1mm 0; font-size: 10pt; }
    .summen td:first-child { color: #666; padding-right: 6mm; }
    .summen tr.total td { font-weight: bold; font-size: 12pt; color: ${design.primary}; border-top: 1.5pt solid ${design.primary}; padding-top: 2mm; }
    
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  ${generatePrintHTML(vorlage, daten, firma, design, text, istMeldezettel, istRechnung, istEmail)}
  <script>window.onload = () => { setTimeout(() => window.print(), 300) }</script>
</body>
</html>`

    w.open(); w.write(html); w.close()
    const closeBtn = w.createElement('button')
    closeBtn.textContent = '✕ Schließen'
    closeBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;padding:8px 16px;background:#1e293b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold'
    closeBtn.onclick = () => { document.getElementById('vv-print-frame')?.remove() }
    w.body?.appendChild(closeBtn)
    setTimeout(() => iframe.contentWindow?.print(), 600)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex" onClick={onClose}>
      <div className="w-full max-w-6xl mx-auto my-4 bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Toolbar */}
        <div className="bg-teal-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl bg-transparent border-none cursor-pointer">✕</button>
            <div>
              <div className="text-xs text-white/60 uppercase tracking-widest">Vorschau & Druck</div>
              <div className="font-bold text-white">{vorlage.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Design wählen */}
            <select value={designId} onChange={e => setDesignId(e.target.value)}
              className="rounded-xl border border-white/20 bg-white/10 text-white text-sm px-3 py-2 outline-none cursor-pointer">
              {DESIGNS.map(d => <option key={d.id} value={d.id} className="text-slate-900">{d.label}</option>)}
            </select>
            {/* Felder bearbeiten */}
            <button onClick={() => setShowFelder(v => !v)}
              className={`rounded-xl border text-sm px-4 py-2 cursor-pointer font-medium ${showFelder ? 'bg-white text-teal-700 border-white' : 'border-white/30 text-white hover:bg-white/10'}`}>
              ✏️ Felder
            </button>
            {/* PDF drucken */}
            <button onClick={drucken}
              className="rounded-xl bg-white text-teal-700 font-bold text-sm px-5 py-2 cursor-pointer border-none hover:bg-teal-50 flex items-center gap-2">
              🖨️ PDF drucken
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Felder-Panel */}
          {showFelder && (
            <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto p-5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Testdaten eingeben</div>
              <div className="text-xs text-slate-400 mb-4">Felder mit Werten füllen um die Vorschau zu testen.</div>
              {alleFelder.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4">Keine Felder definiert</div>
              ) : (
                <div className="space-y-3">
                  {alleFelder.map(f => (
                    <div key={f.key}>
                      <label className="text-xs font-medium text-slate-600 block mb-1">
                        {f.label} {f.pflicht && <span className="text-rose-500">*</span>}
                      </label>
                      {f.typ === 'select' ? (
                        <select value={felderWerte[f.key] || ''}
                          onChange={e => setFelderWerte(v => ({ ...v, [f.key]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none">
                          <option value="">– wählen –</option>
                          {(f.optionen || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={f.typ === 'date' ? 'date' : 'text'}
                          value={felderWerte[f.key] || ''}
                          onChange={e => setFelderWerte(v => ({ ...v, [f.key]: e.target.value }))}
                          placeholder={f.platzhalter?.startsWith('{{') ? `z.B. ${f.label}` : (f.platzhalter || '')}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Vorschau A4 */}
          <div className="flex-1 overflow-auto bg-slate-200 p-8 flex justify-center">
            <div ref={druckRef}
              className="bg-white shadow-xl"
              style={{
                width: '210mm',
                minHeight: '297mm',
                padding: '18mm',
                fontFamily: design.font,
                fontSize: '11pt',
                lineHeight: '1.6',
                color: '#1a1a1a',
              }}>

              {/* Header */}
              <div style={{ borderBottom: `3px solid ${design.primary}`, paddingBottom: '8mm', marginBottom: '8mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '18pt', fontWeight: 'bold', color: design.primary, marginBottom: '2mm' }}>{firma.name}</div>
                  <div style={{ fontSize: '8pt', color: '#666', lineHeight: '1.6' }}>
                    {firma.strasse} · {firma.plz} {firma.ort}<br />
                    Tel.: {firma.telefon} · {firma.email}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '8pt', color: '#666', lineHeight: '1.6' }}>
                  {firma.gericht}<br />
                  USt-ID: {firma.ustId}<br />
                  {firma.bank}<br />
                  IBAN: {firma.iban}
                </div>
              </div>

              {/* Dokumenttitel */}
              <div style={{ fontSize: '16pt', fontWeight: 'bold', color: design.accent, margin: '8mm 0 6mm 0', borderLeft: `4px solid ${design.primary}`, paddingLeft: '4mm' }}>
                {vorlage.name}
              </div>

              {/* Inhalt */}
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '10.5pt', lineHeight: '1.7', color: '#1a1a1a', fontFamily: design.font }}>
                {text}
              </div>

              {/* Footer */}
              <div style={{ marginTop: '20mm', paddingTop: '4mm', borderTop: '1px solid #ddd', fontSize: '7.5pt', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
                <span>{firma.name} · {firma.strasse} · {firma.plz} {firma.ort}</span>
                <span>Geschäftsführung: {firma.gf}</span>
                <span>{new Date().toLocaleDateString('de-AT')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Generiert den vollständigen HTML-Inhalt für den Druck
function generatePrintHTML(
  vorlage: Vorlage,
  daten: Record<string, string>,
  firma: FirmaData,
  design: typeof DESIGNS[0],
  text: string,
  istMeldezettel: boolean,
  istRechnung: boolean,
  istEmail: boolean
): string {
  return `
  <div class="header">
    <div class="header-left">
      <div class="firma-name">${firma.name}</div>
      <div class="firma-details">
        ${firma.strasse} · ${firma.plz} ${firma.ort}<br>
        Tel.: ${firma.telefon} · ${firma.email} · ${firma.web}
      </div>
    </div>
    <div class="header-right">
      ${firma.gericht}<br>
      USt-ID: ${firma.ustId}<br>
      Steuer-Nr.: ${firma.steuerNr}<br>
      ${firma.bank}<br>
      IBAN: ${firma.iban}
    </div>
  </div>

  <div class="dokument-titel">${vorlage.name}</div>

  <div class="inhalt">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>

  <div class="footer">
    <span>${firma.name} · ${firma.strasse} · ${firma.plz} ${firma.ort}</span>
    <span>Geschäftsführung: ${firma.gf}</span>
    <span>${new Date().toLocaleDateString('de-AT')}</span>
  </div>
`
}
