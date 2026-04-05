'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react'

// ─── Typen ────────────────────────────────────────────────────────────────────

interface PlatzhalterDef {
  key: string; label: string; gruppe: string
}

interface PlatzhalterPosition {
  key: string; label: string
  x: number; y: number    // mm auf A4 (0-210 / 0-297)
  seite: number
  fontSize: number
}

interface PdfVorlage {
  id: string; name: string; beschreibung: string; typ: string
  pdf_base64: string
  positionen: PlatzhalterPosition[]   // mit Koordinaten!
  platzhalter: string[]               // nur keys (für Alfred)
  erstellt_am: string; erstellt_von: string
}

const ALLE_PLATZHALTER: PlatzhalterDef[] = [
  // ─── Betreuerin Grunddaten ───────────────────────────────────────────────
  { key: 'nachname',             label: 'Familienname',           gruppe: '👤 Betreuerin' },
  { key: 'vorname',              label: 'Vorname',                gruppe: '👤 Betreuerin' },
  { key: 'geburtsdatum',         label: 'Geburtsdatum',           gruppe: '👤 Betreuerin' },
  { key: 'geburtsort',           label: 'Geburtsort + Bundesland/Staat', gruppe: '👤 Betreuerin' },
  { key: 'staatsangehoerigkeit', label: 'Staatsangehörigkeit',    gruppe: '👤 Betreuerin' },
  { key: 'geschlecht',           label: 'Geschlecht (m/w)',       gruppe: '👤 Betreuerin' },
  { key: 'familienstand',        label: 'Familienstand',          gruppe: '👤 Betreuerin' },
  { key: 'religion',             label: 'Kirche/Religion',        gruppe: '👤 Betreuerin' },
  { key: 'frueherer_name',       label: 'Name vor 1. Ehe/EP',     gruppe: '👤 Betreuerin' },
  { key: 'sonstiger_name',       label: 'Sonstiger Name',         gruppe: '👤 Betreuerin' },
  // ─── Ausweis ──────────────────────────────────────────────────────────────
  { key: 'ausweis_typ',          label: 'Art Reisedokument',      gruppe: '📋 Ausweis' },
  { key: 'ausweis_nr',           label: 'Nummer Reisedokument',   gruppe: '📋 Ausweis' },
  { key: 'ausweis_behoerde',     label: 'Ausstellende Behörde/Staat', gruppe: '📋 Ausweis' },
  { key: 'ausweis_ausgestellt',  label: 'Ausstellungsdatum',      gruppe: '📋 Ausweis' },
  { key: 'ausweis_ablauf',       label: 'Ausweis gültig bis',     gruppe: '📋 Ausweis' },
  { key: 'gisa_nr',              label: 'GISA-Nummer',            gruppe: '📋 Ausweis' },
  // ─── Heimatadresse ────────────────────────────────────────────────────────
  { key: 'hw_strasse',           label: 'Heimat Straße + Haus-Nr.', gruppe: '🏡 Heimatadresse' },
  { key: 'hw_stiege',            label: 'Heimat Stiege',          gruppe: '🏡 Heimatadresse' },
  { key: 'hw_tuer',              label: 'Heimat Tür',             gruppe: '🏡 Heimatadresse' },
  { key: 'hw_plz',               label: 'Heimat PLZ',             gruppe: '🏡 Heimatadresse' },
  { key: 'hw_ort',               label: 'Heimat Ort/Gemeinde',    gruppe: '🏡 Heimatadresse' },
  { key: 'hw_land',              label: 'Heimat Land',            gruppe: '🏡 Heimatadresse' },
  // ─── Österreich-Adresse ───────────────────────────────────────────────────
  { key: 'oe_strasse',           label: 'Österr. Straße + Haus-Nr.', gruppe: '🇦🇹 Österreich-Adresse' },
  { key: 'oe_stiege',            label: 'Österr. Stiege',         gruppe: '🇦🇹 Österreich-Adresse' },
  { key: 'oe_tuer',              label: 'Österr. Tür',            gruppe: '🇦🇹 Österreich-Adresse' },
  { key: 'oe_plz',               label: 'Österr. PLZ',            gruppe: '🇦🇹 Österreich-Adresse' },
  { key: 'oe_ort',               label: 'Österr. Ort/Gemeinde',   gruppe: '🇦🇹 Österreich-Adresse' },
  { key: 'oe_bundesland',        label: 'Österr. Bundesland',     gruppe: '🇦🇹 Österreich-Adresse' },
  // ─── Klient (Unterkunftgeber) ─────────────────────────────────────────────
  { key: 'klient_name',          label: 'Klient Name',            gruppe: '🏠 Klient' },
  { key: 'klient_strasse',       label: 'Klient Straße',          gruppe: '🏠 Klient' },
  { key: 'klient_hausnr',        label: 'Klient Haus-Nr.',        gruppe: '🏠 Klient' },
  { key: 'klient_stiege',        label: 'Klient Stiege',          gruppe: '🏠 Klient' },
  { key: 'klient_tuer',          label: 'Klient Tür-Nr.',         gruppe: '🏠 Klient' },
  { key: 'klient_plz',           label: 'Klient PLZ',             gruppe: '🏠 Klient' },
  { key: 'klient_ort',           label: 'Klient Ort',             gruppe: '🏠 Klient' },
  { key: 'klient_bundesland',    label: 'Klient Bundesland',      gruppe: '🏠 Klient' },
  { key: 'klient_name_block',    label: 'Unterkunftgeber (Blockschrift)', gruppe: '🏠 Klient' },
  // ─── Firma ────────────────────────────────────────────────────────────────
  { key: 'firma_name',           label: 'Firmenname',             gruppe: '🏢 Firma' },
  { key: 'firma_strasse',        label: 'Firma Straße',           gruppe: '🏢 Firma' },
  { key: 'firma_ort',            label: 'Firma Ort',              gruppe: '🏢 Firma' },
  { key: 'gf_name',              label: 'Geschäftsführer',        gruppe: '🏢 Firma' },
  // ─── Datum & Sonstiges ────────────────────────────────────────────────────
  { key: 'datum_heute',          label: 'Datum heute',            gruppe: '📅 Datum' },
  { key: 'ort_datum',            label: 'Ort, Datum',             gruppe: '📅 Datum' },
  { key: 'datum_einzug',         label: 'Datum Einzug/Anmeldung', gruppe: '📅 Datum' },
  { key: 'datum_auszug',         label: 'Datum Auszug/Abmeldung', gruppe: '📅 Datum' },
  { key: 'datum_monat_jahr',     label: 'Monat Jahr',             gruppe: '📅 Datum' },
]

const GRUPPEN = ['👤 Betreuerin','📋 Ausweis','🏡 Heimatadresse','🇦🇹 Österreich-Adresse','🏠 Klient','🏢 Firma','📅 Datum']
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]

// Base64 PDF → Object-URL (funktioniert in allen Browsern inkl. Safari/Mobile)
function pdfBlobUrl(base64: string): string {
  if (!base64) return ''
  try {
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    return URL.createObjectURL(blob)
  } catch { return '' }
}

// PDF-Viewer Komponente — Blob URL + Fallback
function PdfViewer({ base64, height = '100%' }: { base64: string, height?: string }) {
  const [url, setUrl] = React.useState('')
  React.useEffect(() => {
    const u = pdfBlobUrl(base64)
    setUrl(u)
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [base64])

  if (!base64) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Kein PDF geladen</div>
  if (!url) return <div className="flex items-center justify-center h-full text-slate-400 text-sm animate-pulse">PDF wird geladen...</div>

  return (
    <object data={url} type="application/pdf" width="100%" height={height} style={{ display: 'block', minHeight: 400 }}>
      {/* Fallback für Browser ohne eingebauten PDF-Viewer */}
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500 text-sm p-6 text-center">
        <span className="text-4xl">📄</span>
        <div className="font-semibold">PDF-Vorschau nicht verfügbar</div>
        <div className="text-xs text-slate-400">Ihr Browser unterstützt keine eingebetteten PDFs.</div>
        <a href={url} download="vorlage.pdf"
          className="rounded-xl bg-teal-700 text-white text-xs font-bold px-4 py-2 no-underline hover:bg-teal-800">
          📥 PDF herunterladen
        </a>
      </div>
    </object>
  )
}


// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function autoWert(key: string, betreuerin?: any, klient?: any): string {
  const h = new Date().toLocaleDateString('de-AT')
  const heute = new Date().toISOString().split('T')[0]
  
  // Firma-Defaults
  const firma: Record<string,string> = {
    datum_heute: h,
    ort_datum: `Hohenems, ${h}`,
    datum_monat_jahr: new Date().toLocaleDateString('de-AT', { month: 'long', year: 'numeric' }),
    firma_name: 'VBetreut GmbH',
    firma_strasse: 'Krüzastraße 4',
    firma_ort: '6912 Hörbranz',
    gf_name: 'Stefan Wagner',
  }
  if (firma[key]) return firma[key]
  
  // Betreuerin-Felder — Keys aus Supabase data-Objekt
  if (betreuerin) {
    const b = betreuerin
    // Geburtsdatum formatieren
    const gd = b.geburtsdatum || b.data?.geburtsdatum || ''
    const gdFmt = gd ? (() => { try { return new Date(gd+'T12:00:00').toLocaleDateString('de-AT') } catch { return gd } })() : ''
    // Ausweis-Felder (verschiedene Schreibweisen)
    const ausweisNr = b.ausweisNummer || b.ausweisNr || b.dokumentNummer || b.ausweis_nr || b.passNummer || ''
    const ausweisTyp = b.ausweisTyp || b.dokumentTyp || b.ausweis_typ || b.passTyp || 'Reisepass'
    const ausweisBehoerde = b.ausweisBehoerde || b.ausweis_behoerde || b.passBehoerde || ''
    const ausweisAusgestellt = b.ausweisAusgestelltAm || b.ausweisAusgestellt || b.passAusgestellt || ''
    const ausweisAusgestelltFmt = ausweisAusgestellt ? (() => { try { return new Date(ausweisAusgestellt+'T12:00:00').toLocaleDateString('de-AT') } catch { return ausweisAusgestellt } })() : ''
    const bMap: Record<string,string> = {
      // Person
      nachname: b.nachname || '',
      vorname: b.vorname || '',
      akad_grad: b.akadGrad || b.akademischerGrad || '',
      geburtsdatum: gdFmt,
      geburtsort: b.geburtsort || '',
      staatsangehoerigkeit: b.nationalitaet || b.staatsangehoerigkeit || '',
      staat_name: b.nationalitaet || b.staatsangehoerigkeit || '',
      geschlecht: b.geschlecht === 'maennlich' ? 'männlich' : b.geschlecht === 'weiblich' ? 'weiblich' : '',
      familienstand: b.familienstand || '',
      religion: b.religion || '',
      frueherer_name: b.fruehererName || b.geburtsname || b.maedchenname || '',
      sonstiger_name: b.sonstigerName || b.vatersname || '',
      // Ausweis
      ausweis_typ: ausweisTyp,
      ausweis_nr: ausweisNr,
      ausweis_behoerde: ausweisBehoerde,
      ausweis_ausgestellt: ausweisAusgestelltFmt,
      ausweis_ablauf: b.ausweisAblauf || b.passGueltigBis || '',
      gisa_nr: b.gisaNummer || b.gisa || b.gisaNr || '',
      // Heimatadresse (Hauptwohnsitz = Heimat bei Betreuerinnen aus Osteuropa)
      hw_strasse: b.hauptwohnsitzStrasse || b.strasse || '',
      hw_stiege: b.hauptwohnsitzStiege || b.stiege || '',
      hw_tuer: b.hauptwohnsitzTuer || b.tuer || '',
      hw_plz: b.hauptwohnsitzPlz || b.plz || '',
      hw_ort: b.hauptwohnsitzOrt || b.ort || '',
      hw_land: b.hauptwohnsitzLand || b.nationalitaet || b.staatsangehoerigkeit || '',
      // Österreich-Adresse = Nebenwohnsitz (beim Klient)
      oe_strasse: b.nebenwohnsitzStrasse || '',
      oe_stiege: b.nebenwohnsitzStiege || '',
      oe_tuer: b.nebenwohnsitzTuer || '',
      oe_plz: b.nebenwohnsitzPlz || '',
      oe_ort: b.nebenwohnsitzOrt || '',
      oe_bundesland: b.nebenwohnsitzBundesland || 'Vorarlberg',
    }
    // Wenn Betreuerin keinen Nebenwohnsitz hat aber Klient bekannt: Klient-Adresse verwenden
    if (klient && !bMap[key]) {
      const k = klient
      const oeMap: Record<string,string> = {
        oe_strasse: b.nebenwohnsitzStrasse || k.strasse || '',
        oe_stiege: b.nebenwohnsitzStiege || k.stiege || '',
        oe_tuer: b.nebenwohnsitzTuer || k.tuer || '',
        oe_plz: b.nebenwohnsitzPlz || k.plz || '',
        oe_ort: b.nebenwohnsitzOrt || k.ort || '',
        oe_bundesland: b.nebenwohnsitzBundesland || k.bundesland || 'Vorarlberg',
        anm_strasse: k.strasse || '',
        anm_hausnr: k.hausnr || k.hausnummer || '',
        anm_stiege: k.stiege || '',
        anm_tuer: k.tuer || '',
        anm_plz: k.plz || '',
        anm_ort_gem: [k.ort, k.bundesland || 'Vorarlberg'].filter(Boolean).join(', '),
        unterkunftgeber: [k.vorname, k.nachname].filter(Boolean).join(' ').toUpperCase(),
      }
      if (oeMap[key] !== undefined && oeMap[key] !== '') return oeMap[key]
    }
    if (bMap[key] !== undefined && bMap[key] !== '') return bMap[key]
  }
  
  // Klient-Felder — Klient ist der Unterkunftgeber beim Meldezettel
  if (klient) {
    const k = klient
    const kName = [k.vorname, k.nachname].filter(Boolean).join(' ')
    const kStrasse = k.strasse || ''
    const kPlz = k.plz || ''
    const kOrt = k.ort || ''
    const kBundesland = k.bundesland || 'Vorarlberg'
    const einzugFmt = k.betreuungBeginn ? (() => { try { return new Date(k.betreuungBeginn+'T12:00:00').toLocaleDateString('de-AT') } catch { return k.betreuungBeginn } })() : h
    const auszugFmt = k.betreuungEnde ? (() => { try { return new Date(k.betreuungEnde+'T12:00:00').toLocaleDateString('de-AT') } catch { return k.betreuungEnde } })() : ''
    const kMap: Record<string,string> = {
      // Klient-Stammdaten
      klient_name: kName,
      klient_name_block: kName.toUpperCase(),
      klient_strasse: kStrasse,
      klient_hausnr: k.hausnr || k.hausnummer || '',
      klient_stiege: k.stiege || '',
      klient_tuer: k.tuer || k.tuerNr || '',
      klient_plz: kPlz,
      klient_ort: kOrt,
      klient_bundesland: kBundesland,
      // ANMELDUNG-Felder = Klient-Adresse (Betreuerin meldet sich dort an)
      anm_strasse: kStrasse,
      anm_hausnr: k.hausnr || k.hausnummer || '',
      anm_stiege: k.stiege || '',
      anm_tuer: k.tuer || '',
      anm_plz: kPlz,
      anm_ort_gem: [kOrt, kBundesland].filter(Boolean).join(', '),
      // ABMELDUNG-Felder = auch Klient-Adresse
      abm_strasse: kStrasse,
      abm_hausnr: k.hausnr || k.hausnummer || '',
      abm_stiege: k.stiege || '',
      abm_tuer: k.tuer || '',
      abm_plz: kPlz,
      abm_ort: [kOrt, kBundesland].filter(Boolean).join(', '),
      // Unterkunftgeber = Klient
      unterkunftgeber: kName.toUpperCase(),
      // Datum
      datum_einzug: einzugFmt,
      datum_auszug: auszugFmt,
    }
    if (kMap[key] !== undefined && kMap[key] !== '') return kMap[key]
  }
  
  return `[${ALLE_PLATZHALTER.find(p => p.key===key)?.label || key}]`
}

// Einfacher PDF-Hintergrund für den Editor (zIndex 1, kein Eventhandling)
function PdfBlobBackground({ base64 }: { base64: string }) {
  const [url, setUrl] = React.useState('')
  React.useEffect(() => {
    if (!base64) return
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [base64])

  if (!url) return <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>PDF wird geladen...</div>
  return (
    <object
      data={url}
      type="application/pdf"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '297mm', display: 'block', zIndex: 1, pointerEvents: 'none' }}
    >
      <div style={{ padding: 20, color: '#64748b', textAlign: 'center' }}>
        <div style={{ fontSize: 32 }}>📄</div>
        <div style={{ fontSize: 13, marginTop: 8 }}>PDF nicht anzeigbar — Platzhalter können trotzdem positioniert werden</div>
      </div>
    </object>
  )
}

// PDF-Viewer mit Overlay-Support für den Editor (Drag & Drop Platzhalter)

// ── Druck-Hilfsfunktion (außerhalb Komponente = kein Template-Literal-Problem) ──

function druckPdfMitOverlay(vorlage: PdfVorlage, vals: Record<string,string>) {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '0'
  iframe.style.left = '0'
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.style.border = 'none'
  iframe.style.zIndex = '9999'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument!

  // Blob-URL für PDF
  const bin = atob(vorlage.pdf_base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const pdfUrl = URL.createObjectURL(blob)

  // Overlay-Felder als HTML — leere Felder NICHT drucken
  const felderHTML = vorlage.positionen
    .map(p => ({ pos: p, val: (vals[p.key] || '').trim() }))
    .filter(({ val }) => val !== '' && !val.startsWith('['))
    .map(({ pos: p, val }) => {
      const el = document.createElement('div')
      el.style.position = 'absolute'
      el.style.left = p.x + 'mm'
      el.style.top = p.y + 'mm'
      el.style.fontSize = p.fontSize + 'pt'
      el.style.fontWeight = 'bold'
      el.style.color = '#000'
      el.style.whiteSpace = 'nowrap'
      el.style.transform = 'translateY(-50%)'
      el.style.pointerEvents = 'none'
      el.textContent = val
      return el
    })

  doc.open()
  doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + vorlage.name + '</title></head><body style="margin:0;padding:0;background:white"></body></html>')
  doc.close()

  const container = doc.createElement('div')
  container.style.position = 'relative'
  container.style.width = '210mm'
  container.style.minHeight = '297mm'
  doc.body.appendChild(container)

  // PDF als object einbetten
  const obj = doc.createElement('object')
  obj.data = pdfUrl
  obj.type = 'application/pdf'
  obj.style.position = 'absolute'
  obj.style.top = '0'
  obj.style.left = '0'
  obj.style.width = '100%'
  obj.style.height = '297mm'
  container.appendChild(obj)

  // Overlay-Felder
  const overlay = doc.createElement('div')
  overlay.style.position = 'absolute'
  overlay.style.top = '0'
  overlay.style.left = '0'
  overlay.style.width = '100%'
  overlay.style.height = '100%'
  overlay.style.pointerEvents = 'none'
  overlay.style.zIndex = '10'
  felderHTML.forEach(el => overlay.appendChild(el))
  container.appendChild(overlay)

  // Schließen-Button
  const btn = doc.createElement('button')
  btn.textContent = '✕ Schließen'
  btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;padding:8px 16px;background:#1e293b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold'
  btn.onclick = () => { URL.revokeObjectURL(pdfUrl); document.body.removeChild(iframe) }
  doc.body.appendChild(btn)

  setTimeout(() => iframe.contentWindow?.print(), 700)
}

function PdfEditorViewer({ base64, children, onDragOver, onDrop, innerRef }: { 
  base64: string
  children?: React.ReactNode
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void
  innerRef?: React.RefObject<HTMLDivElement>
}) {
  const [url, setUrl] = React.useState('')
  React.useEffect(() => {
    const u = pdfBlobUrl(base64)
    setUrl(u)
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [base64])

  return (
    <div style={{ position: 'relative', width: '210mm', minHeight: '297mm', background: 'white' }}>
      {/* PDF als Hintergrund */}
      {url ? (
        <object
          data={url}
          type="application/pdf"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '297mm', display: 'block', zIndex: 1 }}
        >
          <div style={{ padding: 20, color: '#64748b', fontSize: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📄</div>
            <div>PDF-Vorschau nicht verfügbar</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Platzhalter können trotzdem positioniert werden</div>
          </div>
        </object>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '297mm', color: '#94a3b8', fontSize: 14 }}>
          PDF wird geladen...
        </div>
      )}
      {/* Drop-Zone + Platzhalter-Overlay — über dem PDF, empfängt alle Events */}
      <div
        ref={innerRef}
        onDragOver={onDragOver}
        onDrop={onDrop}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          zIndex: 20,
          // Transparent — man sieht das PDF darunter
          background: 'transparent',
        }}
      >
        {children}
      </div>
    </div>
  )
}


interface Props { onClose: () => void }

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function PdfVorlagenEditor({ onClose }: Props) {
  const [phase, setPhase] = useState<'liste'|'editor'|'ausfuellen'>('liste')
  const [vorlagen, setVorlagen] = useState<PdfVorlage[]>([])
  const [aktuelle, setAktuelle] = useState<PdfVorlage|null>(null)
  const [felder, setFelder] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fehler, setFehler] = useState('')
  const [dragKey, setDragKey] = useState<string|null>(null)
  // Personen für KI-Ausfüllhilfe
  const [betreuerinnen, setBetreuerinnen] = useState<any[]>([])
  const [klienten, setKlienten] = useState<any[]>([])
  const [selectedBetreuerin, setSelectedBetreuerin] = useState<any>(null)
  const [selectedKlient, setSelectedKlient] = useState<any>(null)
  const [kiLaden, setKiLaden] = useState(false)
  const [selectedPos, setSelectedPos] = useState<string|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLDivElement>(null)

  useEffect(() => { laden() }, [])

  // ── Laden ──────────────────────────────────────────────────────────────────

  // ── Personen laden ─────────────────────────────────────────────────────────

  React.useEffect(() => {
    fetch('/api/db/betreuerinnen').then(r => r.ok ? r.json() : []).then((list: any[]) =>
      setBetreuerinnen(list.map((b: any) => ({ ...b, ...(b.data || {}) })))
    ).catch(() => {})
    fetch('/api/db/klienten').then(r => r.ok ? r.json() : []).then((list: any[]) =>
      setKlienten(list.map((k: any) => ({ ...k, ...(k.data || {}) })))
    ).catch(() => {})
  }, [])

  // ── KI-Ausfüllhilfe ────────────────────────────────────────────────────────

  function kiAusfuellen() {
    if (!aktuelle) return
    setKiLaden(true)
    const neuFelder: Record<string,string> = {}
    aktuelle.platzhalter.forEach(key => {
      const wert = autoWert(key, selectedBetreuerin, selectedKlient)
      if (wert && !wert.startsWith('[')) neuFelder[key] = wert
    })
    setFelder(prev => ({ ...prev, ...neuFelder }))
    setKiLaden(false)
  }

  async function laden() {
    setLoading(true)
    try {
      const res = await fetch('/api/pdf-vorlagen')
      if (res.ok) {
        const data = await res.json()
        setVorlagen(data.map((v: any) => ({
          ...v,
          positionen: Array.isArray(v.positionen) ? v.positionen : [],
          platzhalter: Array.isArray(v.platzhalter) ? v.platzhalter : [],
        })))
      }
    } catch {}
    setLoading(false)
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) { setFehler('Nur PDF'); return }
    setFehler(''); setLoading(true)
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      const base64 = dataUrl.split(',')[1]
      setAktuelle({
        id: uid(), name: file.name.replace(/\.pdf$/i,'').replace(/_/g,' '),
        beschreibung: '', typ: 'sonstiges', pdf_base64: base64,
        positionen: [], platzhalter: [], erstellt_am: today(), erstellt_von: '',
      })
      setPhase('editor'); setLoading(false)
    }
    reader.readAsDataURL(file)
  }

  // ── Drag & Drop auf PDF ────────────────────────────────────────────────────

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    // dragKey aus State ODER aus dataTransfer (Fallback falls State-Update zu langsam)
    const key = dragKey || e.dataTransfer.getData('text/plain')
    if (!key || !pdfRef.current || !aktuelle) return
    const rect = pdfRef.current.getBoundingClientRect()
    // Pixel → mm (A4: 210mm × 297mm)
    const x = ((e.clientX - rect.left) / rect.width) * 210
    const y = ((e.clientY - rect.top) / rect.height) * 297
    const xMm = Math.max(0, Math.min(200, x))  // 0-200mm
    const yMm = Math.max(0, Math.min(290, y))  // 0-290mm
    const def = ALLE_PLATZHALTER.find(p => p.key === key)
    if (!def) return
    // dragKey überschreiben für weitere Verwendung
    const dragKey = key
    const neuePos: PlatzhalterPosition = {
      key: dragKey, label: def.label, x: xMm, y: yMm, seite: 1, fontSize: 10
    }
    // Entferne evtl. bestehende Position für diesen Key
    const bereinigte = aktuelle.positionen.filter(p => p.key !== dragKey)
    const platzhalterKeys = [...new Set([...aktuelle.platzhalter, dragKey])]
    setAktuelle(prev => prev ? {
      ...prev,
      positionen: [...bereinigte, neuePos],
      platzhalter: platzhalterKeys,
    } : null)
    setDragKey(null)
  }

  // Platzhalter verschieben (bereits platzierte)
  function handlePlatzhalterDragStart(e: React.DragEvent, key: string) {
    e.dataTransfer.setData('move-key', key)
  }
  function handlePlatzhalterDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const moveKey = e.dataTransfer.getData('move-key')
    const newKey = e.dataTransfer.getData('text/plain')

    if (moveKey && pdfRef.current && aktuelle) {
      // Bereits platzierten Platzhalter verschieben
      const rect = pdfRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(200, ((e.clientX - rect.left) / rect.width) * 210))
      const y = Math.max(0, Math.min(290, ((e.clientY - rect.top) / rect.height) * 297))
      setAktuelle(prev => prev ? {
        ...prev,
        positionen: prev.positionen.map(p => p.key === moveKey ? { ...p, x, y } : p)
      } : null)
    } else if ((newKey || dragKey) && pdfRef.current && aktuelle) {
      // Neuen Platzhalter aus der Liste droppen
      const key = newKey || dragKey!
      const def = ALLE_PLATZHALTER.find(p => p.key === key)
      if (!def) return
      const rect = pdfRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(200, ((e.clientX - rect.left) / rect.width) * 210))
      const y = Math.max(0, Math.min(290, ((e.clientY - rect.top) / rect.height) * 297))
      const neuePos: PlatzhalterPosition = { key, label: def.label, x, y, seite: 1, fontSize: 10 }
      const bereinigte = aktuelle.positionen.filter(p => p.key !== key)
      const platzhalterKeys = [...new Set([...aktuelle.platzhalter, key])]
      setAktuelle(prev => prev ? {
        ...prev,
        positionen: [...bereinigte, neuePos],
        platzhalter: platzhalterKeys,
      } : null)
      setDragKey(null)
    }
  }

  function entfernePlatzhalter(key: string) {
    if (!aktuelle) return
    setAktuelle(prev => prev ? {
      ...prev,
      positionen: prev.positionen.filter(p => p.key !== key),
      platzhalter: prev.platzhalter.filter(k => k !== key),
    } : null)
    if (selectedPos === key) setSelectedPos(null)
  }

  function aendereFontSize(key: string, size: number) {
    setAktuelle(prev => prev ? {
      ...prev, positionen: prev.positionen.map(p => p.key === key ? { ...p, fontSize: size } : p)
    } : null)
  }

  // ── Speichern ──────────────────────────────────────────────────────────────

  async function speichern() {
    if (!aktuelle?.name.trim()) { setFehler('Name eingeben'); return }
    setSaving(true); setFehler('')
    try {
      const exists = vorlagen.find(v => v.id === aktuelle.id)
      
      if (!exists) {
        // NEU: POST mit allem (PDF + Metadaten + Positionen)
        const res = await fetch('/api/pdf-vorlagen', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            id: aktuelle.id,
            name: aktuelle.name,
            beschreibung: aktuelle.beschreibung,
            typ: aktuelle.typ,
            pdf_base64: aktuelle.pdf_base64,
            positionen: aktuelle.positionen,
            platzhalter: aktuelle.platzhalter,
            erstellt_am: aktuelle.erstellt_am,
            erstellt_von: aktuelle.erstellt_von,
          })
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Speichern fehlgeschlagen (HTTP ${res.status})`)
        }
      } else {
        // UPDATE: nur Metadaten + Positionen (kein PDF nochmal)
        const res = await fetch(`/api/pdf-vorlagen?id=${aktuelle.id}`, {
          method: 'PATCH',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            name: aktuelle.name,
            beschreibung: aktuelle.beschreibung,
            typ: aktuelle.typ,
            positionen: aktuelle.positionen,
            platzhalter: aktuelle.platzhalter,
          })
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Update fehlgeschlagen (HTTP ${res.status})`)
        }
      }
      
      await laden()
      setPhase('liste')
      setFehler('')
    } catch (e: any) { 
      setFehler(`Fehler: ${e.message}`)
      console.error('[Speichern]', e)
    }
    setSaving(false)
  }

  // ── Vollständige Vorlage laden (mit PDF) ───────────────────────────────────

  async function ladeVoll(id: string): Promise<PdfVorlage|null> {
    const res = await fetch(`/api/pdf-vorlagen?id=${id}`)
    if (!res.ok) return null
    const d = await res.json()
    return { ...d, positionen: Array.isArray(d.positionen) ? d.positionen : [], platzhalter: Array.isArray(d.platzhalter) ? d.platzhalter : [] }
  }

  // ── Drucken ────────────────────────────────────────────────────────────────

  function druck(muster = false) {
    if (!aktuelle) return
    const vals: Record<string,string> = {}
    aktuelle.platzhalter.forEach(k => {
      const gespeichert = felder[k]
      if (muster) {
        vals[k] = autoWert(k)
      } else {
        vals[k] = (gespeichert !== undefined && gespeichert !== '')
          ? gespeichert
          : autoWert(k, selectedBetreuerin, selectedKlient)
      }
    })
    druckPdfMitOverlay(aktuelle, vals)
  }

  // ── Löschen ────────────────────────────────────────────────────────────────

  async function loeschen(id: string) {
    if (!confirm('Löschen?')) return
    await fetch(`/api/pdf-vorlagen?id=${id}`, { method: 'DELETE' })
    await laden()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex" onClick={onClose}>
      <div className="w-full max-w-[1500px] mx-auto my-2 bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-teal-800 px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl bg-transparent border-none cursor-pointer">✕</button>
          {phase !== 'liste' && (
            <button onClick={() => setPhase('liste')} className="text-white/70 hover:text-white text-sm bg-white/10 rounded-xl px-3 py-1 border-none cursor-pointer">← zurück</button>
          )}
          <div className="flex-1">
            <div className="text-xs text-white/50 uppercase tracking-widest">PDF-Vorlagen</div>
            <div className="font-bold text-white text-sm">
              {phase==='liste' && '📄 Meine PDF-Vorlagen'}
              {phase==='editor' && `✏️ ${aktuelle?.name} — Platzhalter per Drag & Drop platzieren`}
              {phase==='ausfuellen' && `📝 ${aktuelle?.name} ausfüllen`}
            </div>
          </div>
          {phase==='editor' && (
            <button onClick={speichern} disabled={saving}
              className="rounded-xl bg-white text-teal-800 font-bold text-sm px-5 py-2 cursor-pointer border-none hover:bg-teal-50 disabled:opacity-50">
              {saving ? '⏳ Speichert...' : `💾 Speichern (${aktuelle?.positionen.length || 0} Felder)`}
            </button>
          )}
          {phase==='ausfuellen' && (
            <div className="flex gap-2">
              <button onClick={() => druck(true)} className="rounded-xl border border-white/30 text-white text-sm px-4 py-2 cursor-pointer hover:bg-white/10">🖨️ Musterdruck</button>
              <button onClick={() => druck(false)} className="rounded-xl bg-white text-teal-800 font-bold text-sm px-5 py-2 cursor-pointer border-none hover:bg-teal-50">🖨️ Drucken</button>
            </div>
          )}
        </div>

        {fehler && (
          <div className="bg-rose-100 border-b border-rose-300 text-rose-800 text-sm px-6 py-3 flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <span className="font-semibold">{fehler}</span>
            <button onClick={() => setFehler('')} className="ml-auto text-rose-500 hover:text-rose-700 bg-transparent border-none cursor-pointer text-lg">✕</button>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex">

          {/* ══ LISTE ══ */}
          {phase === 'liste' && (
            <div className="flex-1 overflow-auto p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">PDF-Vorlagen mit Platzhaltern</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Original-PDF hochladen → Platzhalter per Drag & Drop positionieren → Alfred füllt automatisch aus</p>
                </div>
                <label className="rounded-2xl bg-teal-700 text-white font-bold px-5 py-2.5 cursor-pointer hover:bg-teal-800 flex items-center gap-2">
                  📤 PDF hochladen
                  <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f) }} />
                </label>
              </div>

              {loading && <div className="text-center py-10 text-slate-400">Lädt...</div>}

              {!loading && vorlagen.length === 0 && (
                <label className="flex flex-col items-center py-16 border-2 border-dashed border-slate-200 rounded-3xl cursor-pointer hover:border-teal-300 hover:bg-teal-50 transition-all">
                  <div className="text-5xl mb-3">📄</div>
                  <div className="font-bold text-slate-700 mb-1">Noch keine Vorlagen</div>
                  <div className="text-sm text-slate-400 mb-4">z.B. amtlichen Meldezettel von oesterreich.gv.at hochladen</div>
                  <div className="rounded-2xl bg-teal-700 text-white font-bold px-5 py-2.5">📤 PDF hochladen</div>
                  <input type="file" accept=".pdf" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f) }} />
                </label>
              )}

              <div className="grid grid-cols-2 gap-4">
                {vorlagen.map(v => (
                  <div key={v.id} className="rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-teal-200 transition-all">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl">📄</span>
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{v.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {v.positionen?.length || 0} positionierte Felder · {v.erstellt_am}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-4 min-h-[20px]">
                      {(v.positionen||[]).slice(0,4).map(p => (
                        <span key={p.key} className="text-[10px] bg-teal-50 border border-teal-200 text-teal-700 rounded-full px-2 py-0.5 font-mono">
                          {'{{'}{p.key}{'}}'}
                        </span>
                      ))}
                      {(v.positionen||[]).length > 4 && <span className="text-[10px] text-slate-400">+{v.positionen.length-4}</span>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={async () => { const voll=await ladeVoll(v.id); if(voll){setAktuelle(voll);const f:Record<string,string>={};voll.platzhalter.forEach(k=>{const w=autoWert(k,selectedBetreuerin,selectedKlient);if(w&&!w.startsWith('['))f[k]=w});setFelder(f);setPhase('ausfuellen')} }}
                        className="flex-1 rounded-xl bg-teal-700 text-white text-xs font-bold px-3 py-2 cursor-pointer border-none hover:bg-teal-800">
                        📝 Ausfüllen & Drucken
                      </button>
                      <button onClick={async () => { const voll=await ladeVoll(v.id); if(voll){setAktuelle(voll);setPhase('editor')} }}
                        className="rounded-xl border border-slate-200 text-slate-600 text-xs px-3 py-2 cursor-pointer hover:bg-slate-50">✏️</button>
                      <button onClick={() => loeschen(v.id)}
                        className="rounded-xl border border-rose-200 text-rose-500 text-xs px-3 py-2 cursor-pointer hover:bg-rose-50">🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ EDITOR mit Drag & Drop ══ */}
          {phase === 'editor' && aktuelle && (
            <div className="flex-1 flex overflow-hidden">

              {/* Links: Platzhalter-Liste zum Ziehen */}
              <div className="w-64 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50 p-4">
                <div className="mb-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Name</div>
                  <input value={aktuelle.name} onChange={e => setAktuelle(p => p ? {...p, name: e.target.value} : null)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400 bg-white" />
                </div>
                <div className="mb-4">
                  <label className="text-xs text-slate-500 block mb-1">Typ</label>
                  <select value={aktuelle.typ} onChange={e => setAktuelle(p => p ? {...p, typ: e.target.value} : null)}
                    className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs bg-white outline-none">
                    {[['meldezettel','Meldezettel'],['vertrag','Vertrag'],['vollmacht','Vollmacht'],['foerderantrag','Förderantrag'],['sonstiges','Sonstiges']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>

                <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-xs text-teal-700 mb-4">
                  <div className="font-bold mb-1">🖱️ Drag & Drop</div>
                  <div>Felder von hier auf das PDF ziehen um sie zu positionieren.</div>
                </div>

                {GRUPPEN.map(g => {
                  const liste = ALLE_PLATZHALTER.filter(p => p.gruppe === g)
                  return (
                    <div key={g} className="mb-4">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{g}</div>
                      <div className="space-y-1">
                        {liste.map(p => {
                          const platziert = aktuelle.positionen.some(pos => pos.key === p.key)
                          return (
                            <div key={p.key}
                              draggable
                              onDragStart={e => { e.dataTransfer.setData('text/plain', p.key); setDragKey(p.key) }}
                              className={`rounded-lg px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing border transition-all select-none ${
                                platziert
                                  ? 'border-teal-400 bg-teal-50 text-teal-800 font-semibold'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50/50'
                              }`}>
                              {platziert && <span className="mr-1">✓</span>}
                              <span className="font-mono text-[9px] text-slate-400 mr-1">{'{{'}{p.key}{'}}'}</span>
                              {p.label}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Mitte: PDF mit Platzhalter-Overlay */}
              <div className="flex-1 overflow-auto bg-slate-300 flex flex-col">
                <div className="bg-slate-600 text-white text-xs px-4 py-2 flex items-center gap-2 flex-shrink-0">
                  <span>📄 PDF — Platzhalter hinziehen, dann verschieben und Schriftgröße anpassen</span>
                  <span className="ml-auto text-slate-400">{aktuelle.positionen.length} Felder platziert</span>
                </div>
                <div className="flex-1 overflow-auto p-4 flex justify-center">
                  <div className="shadow-xl" style={{ width: '210mm', minHeight: '297mm', position: 'relative', background: 'white' }}>
                    {/* PDF als Hintergrund via BlobURL */}
                    <PdfBlobBackground base64={aktuelle.pdf_base64} />
                    {/* Drop-Overlay: transparent, über PDF, empfängt alle Events */}
                    <div
                      ref={pdfRef}
                      onDragOver={e => e.preventDefault()}
                      onDrop={handlePlatzhalterDrop}
                      style={{
                        position: 'absolute', top: 0, left: 0,
                        width: '100%', height: '100%',
                        zIndex: 20, background: 'transparent',
                      }}
                    >
                    {/* Platzhalter-Chips */}
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    {aktuelle.positionen.map(pos => (
                      <div
                        key={pos.key}
                        draggable
                        onDragStart={e => handlePlatzhalterDragStart(e, pos.key)}
                        onClick={e => { e.stopPropagation(); setSelectedPos(selectedPos===pos.key ? null : pos.key) }}
                        style={{
                          position: 'absolute',
                          left: `${(pos.x / 210) * 100}%`,
                          top: `${(pos.y / 297) * 100}%`,
                          transform: 'translateY(-50%)',
                          fontSize: `${pos.fontSize}pt`,
                          cursor: 'move',
                          userSelect: 'none',
                          zIndex: 10,
                        }}
                        className={`group ${selectedPos===pos.key ? 'ring-2 ring-teal-500' : ''}`}
                      >
                        <span className={`rounded px-1 font-bold whitespace-nowrap ${
                          selectedPos===pos.key
                            ? 'bg-teal-500 text-white'
                            : 'bg-teal-100/80 text-teal-800 border border-teal-300'
                        }`}>
                          {'{{'}{pos.key}{'}}'}
                        </span>
                        {selectedPos===pos.key && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 flex items-center gap-2 z-20 whitespace-nowrap">
                            <span className="text-xs text-slate-400">X:</span>
                            <input type="number" value={Math.round(pos.x * 10) / 10} step={0.5} min={0} max={200}
                              onChange={e => setAktuelle(prev => prev ? {...prev, positionen: prev.positionen.map(p => p.key === pos.key ? {...p, x: Number(e.target.value)} : p)} : null)}
                              className="w-14 rounded border border-slate-200 px-1 py-0.5 text-xs outline-none" />
                            <span className="text-xs text-slate-400">Y:</span>
                            <input type="number" value={Math.round(pos.y * 10) / 10} step={0.5} min={0} max={290}
                              onChange={e => setAktuelle(prev => prev ? {...prev, positionen: prev.positionen.map(p => p.key === pos.key ? {...p, y: Number(e.target.value)} : p)} : null)}
                              className="w-14 rounded border border-slate-200 px-1 py-0.5 text-xs outline-none" />
                            <span className="text-xs text-slate-400">mm · Pt:</span>
                            <input type="number" value={pos.fontSize} min={6} max={18}
                              onChange={e => aendereFontSize(pos.key, Number(e.target.value))}
                              className="w-12 rounded border border-slate-200 px-1 py-0.5 text-xs outline-none" />
                            <button onClick={e => { e.stopPropagation(); entfernePlatzhalter(pos.key) }}
                              className="rounded bg-rose-500 text-white text-xs px-2 py-0.5 cursor-pointer border-none hover:bg-rose-600">✕</button>
                          </div>
                        )}
                      </div>
                    ))}
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ AUSFÜLLEN ══ */}
          {phase === 'ausfuellen' && aktuelle && (
            <div className="flex-1 flex overflow-hidden">

              {/* Links: Felder */}
              <div className="w-80 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50">
                {/* KI-Ausfüllhilfe Panel */}
                <div className="p-4 border-b border-slate-200 bg-white">
                  <div className="text-sm font-bold text-slate-900 mb-3">✨ KI-Ausfüllhilfe</div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Betreuerin</div>
                      <select
                        value={selectedBetreuerin?.id || ''}
                        onChange={e => {
                          const b = betreuerinnen.find((x: any) => x.id === e.target.value)
                          setSelectedBetreuerin(b || null)
                        }}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none bg-white">
                        <option value="">– Betreuerin wählen –</option>
                        {betreuerinnen.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.nachname} {b.vorname}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Klient</div>
                      <select
                        value={selectedKlient?.id || ''}
                        onChange={e => {
                          const k = klienten.find((x: any) => x.id === e.target.value)
                          setSelectedKlient(k || null)
                        }}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none bg-white">
                        <option value="">– Klient wählen –</option>
                        {klienten.map((k: any) => (
                          <option key={k.id} value={k.id}>{k.nachname} {k.vorname}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={kiAusfuellen}
                      disabled={kiLaden || (!selectedBetreuerin && !selectedKlient)}
                      className="w-full rounded-xl bg-violet-600 text-white text-xs font-bold py-2 cursor-pointer border-none hover:bg-violet-700 disabled:opacity-40">
                      {kiLaden ? '⏳ Wird befüllt...' : '✨ Automatisch ausfüllen'}
                    </button>
                    {(selectedBetreuerin || selectedKlient) && (
                      <div className="text-xs text-violet-600 bg-violet-50 rounded-lg p-2">
                        {selectedBetreuerin && <div>👤 {selectedBetreuerin.nachname} {selectedBetreuerin.vorname}</div>}
                        {selectedKlient && <div>🏠 {selectedKlient.nachname} {selectedKlient.vorname}</div>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Felder */}
                <div className="p-4">
                  <div className="text-xs text-slate-400 mb-3">Felder bei Bedarf manuell anpassen:</div>
                <div className="space-y-2">
                  {aktuelle.platzhalter.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      Keine Felder definiert.<br/>
                      <button onClick={() => setPhase('editor')} className="text-teal-600 underline cursor-pointer bg-transparent border-none mt-1">Vorlage bearbeiten →</button>
                    </div>
                  ) : aktuelle.platzhalter.map(k => {
                    const def = ALLE_PLATZHALTER.find(p => p.key === k)
                    const gespeichert = felder[k]
                    const val = (gespeichert !== undefined && gespeichert !== '')
                      ? gespeichert
                      : autoWert(k, selectedBetreuerin, selectedKlient)
                    return (
                      <div key={k} className={`rounded-xl border px-3 py-2 bg-white focus-within:border-teal-400 transition-all ${val && !val.startsWith('[') ? 'border-teal-200' : 'border-slate-200'}`}>
                        <div className="text-[9px] font-mono text-slate-300 leading-none">{'{{'}{k}{'}}'}</div>
                        <div className="text-[10px] text-slate-400">{def?.label || k}</div>
                        <input value={val.startsWith('[') ? '' : val} onChange={e => setFelder(prev => ({...prev,[k]:e.target.value}))}
                          className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none border-none mt-0.5" />
                      </div>
                    )
                  })}
                </div>
                </div>
              </div>

              {/* Rechts: PDF-Vorschau */}
              <div className="flex-1 overflow-hidden flex flex-col bg-slate-200">
                <div className="bg-slate-600 text-white text-xs px-4 py-2 flex-shrink-0">
                  📄 Original-PDF — beim Drucken werden die Felder exakt auf das PDF gedruckt
                </div>
                <div className="flex-1 overflow-hidden">
                  <PdfViewer base64={aktuelle.pdf_base64} height="100%" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
