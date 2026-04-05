'use client'
import EmailModal from './EmailModal'
import React, { useState } from 'react'
import type { Vorlage } from '@/lib/dokumente'
import type { Klient } from '@/lib/klienten'
import type { Betreuerin } from '@/lib/betreuerinnen'
import { useSignaturmappen, type Signaturmappe, type SignaturDokument } from '@/hooks/useSignaturmappe'
import KiVorlagenAuswahl from './KiVorlagenAuswahl'

interface Props {
  vorlagen: Vorlage[]
  klienten: Klient[]
  betreuerinnen: Betreuerin[]
  aktuellerUser?: string
}

const STATUS_FARBE: Record<string, string> = {
  offen: 'bg-amber-50 text-amber-700 border-amber-200',
  teilweise: 'bg-blue-50 text-blue-700 border-blue-200',
  abgeschlossen: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  archiviert: 'bg-slate-100 text-slate-500 border-slate-200',
  ausstehend: 'bg-amber-50 text-amber-700 border-amber-200',
  unterschrieben: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  abgelehnt: 'bg-rose-50 text-rose-700 border-rose-200',
}
const STATUS_ICON: Record<string, string> = {
  offen: '📂', teilweise: '📝', abgeschlossen: '✅', archiviert: '📁',
  ausstehend: '⏳', unterschrieben: '✍️', abgelehnt: '❌',
}

function fmtDatum(iso: string) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('de-AT') } catch { return iso }
}

async function druckeSignaturDok(dok: SignaturDokument, mappeTitel: string) {
  // window.open MUSS synchron aufgerufen werden (vor jedem await)
  // sonst blockiert der Browser-Popup-Blocker das Fenster
  const w = window.open('', '_blank')
  if (!w) {
    alert('Popup wurde blockiert. Bitte Popup-Blocker für diese Seite deaktivieren.')
    return
  }

  // Zeige Ladeanzeige sofort
  w.document.write('<html><body style="font-family:Arial;padding:40px;color:#333"><h2>⏳ Dokument wird vorbereitet...</h2></body></html>')

  try {
    const res = await fetch('/api/pdf-vorlagen')
    if (res.ok) {
      const pdfVorlagen = await res.json()
      const dokTitelLow = (dok.titel || '').toLowerCase()
      const match = pdfVorlagen.find((v: any) => {
        const vNameLow = (v.name || '').toLowerCase()
        if (v.id === dok.vorlageId) return true
        if (dokTitelLow.includes('meldezettel') && vNameLow.includes('meldezettel')) {
          const istAnmeldung = dokTitelLow.includes('anmeld') || !dokTitelLow.includes('abmeld')
          const vorlagenIstAnmeldung = vNameLow.includes('anmeld') || !vNameLow.includes('abmeld')
          return istAnmeldung === vorlagenIstAnmeldung
        }
        return false
      }) || pdfVorlagen.find((v: any) => (v.name || '').toLowerCase().includes('meldezettel') && dokTitelLow.includes('meldezettel'))
      if (match?.id) {
        const detailRes = await fetch(`/api/pdf-vorlagen?id=${match.id}`)
        if (detailRes.ok) {
          const detail = await detailRes.json()
          if (detail.pdf_base64) {
            const bin = atob(detail.pdf_base64)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            const blob = new Blob([bytes], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            w.location.href = url
            setTimeout(() => URL.revokeObjectURL(url), 30000)
            return
          }
        }
      }
    }
  } catch {}

  // Fallback: HTML-Ausdruck für Text-Vorlagen (Fenster bereits offen)
  if (!w) return
  const inhalt = (dok.inhalt || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${dok.titel}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; background: white; margin: 0; padding: 0; }
  .header { border-bottom: 2px solid #0f766e; padding-bottom: 8mm; margin-bottom: 8mm; }
  .header h1 { font-size: 16pt; color: #0f766e; margin: 0 0 2mm 0; }
  .header p { font-size: 9pt; color: #666; margin: 0; }
  .inhalt { white-space: pre-wrap; font-size: 10.5pt; line-height: 1.7; min-height: 100mm; }
  .unterschriften { margin-top: 20mm; display: flex; gap: 20mm; }
  .unterschrift-linie { border-top: 1px solid #000; margin-top: 20mm; padding-top: 3mm; font-size: 9pt; }
  .footer { margin-top: 15mm; border-top: 1px solid #ddd; padding-top: 5mm; font-size: 8pt; color: #888; }
  @media screen { body { padding: 20mm; max-width: 210mm; margin: 0 auto; } }
</style></head>
<body>
<div class="header">
  <h1>${dok.titel}</h1>
  <p>Klient: ${dok.klientName} · ${mappeTitel} · ${fmtDatum(dok.erstelltAm)}</p>
</div>
<div class="inhalt">${inhalt || '(Kein Inhalt)'}</div>
<div class="unterschriften">
  <div style="flex:1"><div class="unterschrift-linie">Klient:in / Unterkunftgeber:in · Datum</div></div>
  <div style="flex:1"><div class="unterschrift-linie">Betreuerin · Datum</div></div>
</div>
<div class="footer">VBetreut GmbH · Krüzastraße 4 · 6912 Hörbranz</div>
<script>window.onload = () => setTimeout(() => window.print(), 400);</script>
</body></html>`)
  w.document.close()
}

export default function SignaturOrdner({ vorlagen, klienten, betreuerinnen, aktuellerUser = 'Stefan Wagner' }: Props) {
  const { mappen, loading, erstelleMappe, dokumentUnterschreiben, archivieren } = useSignaturmappen()
  const [showNeu, setShowNeu] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('alle')
  const [showKiAuswahl, setShowKiAuswahl] = useState(false)
  const [neuForm, setNeuForm] = useState({
    klientId: '', betreuerinId: '', titel: '', ereignis: '', ausgewaehlteVorlagen: [] as string[]
  })
  const [erstelling, setErstelling] = useState(false)

  const gefilterteMappen = (mappen || []).filter(m => filterStatus === 'alle' || m.status === filterStatus)

  async function mappeErstellen() {
    if (!neuForm.klientId || neuForm.ausgewaehlteVorlagen.length === 0) return
    setErstelling(true)
    const klient = (klienten || []).find(k => k.id === neuForm.klientId)
    const betreuerin = (betreuerinnen || []).find(b => b.id === neuForm.betreuerinId)
    const dokumente = (neuForm.ausgewaehlteVorlagen || []).map(vid => {
      const v = (vorlagen || []).find(x => x.id === vid)
      if (!v) return null
      const unterzeichner = (v.typ === 'meldezettel' || (v as any).vorlageTyp === 'meldezettel')
        ? 'alle' as const : (v.typ === 'rechnung' || v.typ === 'honorarnote') ? 'klient' as const : 'betreuerin' as const
      return {
        klientId: klient?.id || '', klientName: klient ? `${klient.vorname} ${klient.nachname}` : '',
        vorlageId: v.id, vorlageName: v.name, vorlageTyp: v.typ || (v as any).vorlageTyp || '',
        titel: v.name, inhalt: (v as any).textvorlage || (v as any).inhalt || '', unterzeichner, notizen: '',
      }
    }).filter(Boolean) as any[]

    await erstelleMappe({
      klientId: klient?.id || '',
      klientName: klient ? `${klient.vorname} ${klient.nachname}` : '',
      betreuerinId: betreuerin?.id || '',
      betreuerinName: betreuerin ? `${betreuerin.vorname} ${betreuerin.nachname}` : '',
      titel: neuForm.titel || `${klient ? `${klient.nachname} ${klient.vorname}` : ''} — ${new Date().toLocaleDateString('de-AT')}`,
      erstelltVon: aktuellerUser, dokumente,
    })
    setNeuForm({ klientId: '', betreuerinId: '', titel: '', ereignis: '', ausgewaehlteVorlagen: [] })
    setShowNeu(false)
    setErstelling(false)
  }

  const gewaehlterKlient = (klienten || []).find(k => k.id === neuForm.klientId)
  const gewaehlteBetreuerin = (betreuerinnen || []).find(b => b.id === neuForm.betreuerinId)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">📁 Signatur-Ordner</h2>
            <p className="text-sm text-slate-500 mt-1">Dokumente zur Unterschrift — pro Klient ein Ordner</p>
          </div>
          <button onClick={() => setShowNeu(true)}
            className="rounded-2xl bg-teal-600 text-white font-bold text-sm px-5 py-2.5 cursor-pointer border-none hover:bg-teal-700">
            + Neue Signaturmappe
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            ['alle', `Alle (${(mappen||[]).length})`],
            ['offen', `📂 Offen (${(mappen||[]).filter(m => m.status === 'offen').length})`],
            ['teilweise', `📝 Teilweise (${(mappen||[]).filter(m => m.status === 'teilweise').length})`],
            ['abgeschlossen', `✅ Abgeschlossen (${(mappen||[]).filter(m => m.status === 'abgeschlossen').length})`],
            ['archiviert', `📁 Archiviert (${(mappen||[]).filter(m => m.status === 'archiviert').length})`],
          ].map(([s, l]) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`rounded-full text-xs px-4 py-1.5 cursor-pointer border font-medium transition-all ${filterStatus === s ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Mappen */}
      {loading ? (
        <div className="text-center py-10 text-slate-400">Lade Signaturmappen...</div>
      ) : gefilterteMappen.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <div className="text-4xl mb-3">📁</div>
          <div className="font-semibold text-slate-600">Keine Signaturmappen</div>
          <div className="text-sm text-slate-400 mt-1">Neue Mappe anlegen um Dokumente zur Unterschrift vorzubereiten</div>
        </div>
      ) : (
        <div className="space-y-4">
          {gefilterteMappen.map(mappe => {
            const dokumente = mappe.dokumente || []
            const unterschrieben = dokumente.filter(d => d.status === 'unterschrieben').length
            const prozent = dokumente.length > 0 ? Math.round((unterschrieben / dokumente.length) * 100) : 0
            return (
              <div key={mappe.id} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                {/* Kopf */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{STATUS_ICON[mappe.status] || '📂'}</span>
                    <div>
                      <div className="font-bold text-slate-900">{mappe.titel}</div>
                      <div className="text-sm text-slate-500">{mappe.klientName}{mappe.betreuerinName ? ` · ${mappe.betreuerinName}` : ''}</div>
                      <div className="text-xs text-slate-400">{fmtDatum(mappe.erstelltAm)} · {mappe.erstelltVon}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {dokumente.length > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-slate-500 mb-1">{unterschrieben}/{dokumente.length} unterschrieben</div>
                        <div className="w-24 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full rounded-full bg-teal-500" style={{ width: `${prozent}%` }} />
                        </div>
                      </div>
                    )}
                    <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${STATUS_FARBE[mappe.status]}`}>
                      {mappe.status}
                    </span>
                    {mappe.status === 'abgeschlossen' && (
                      <button onClick={() => archivieren(mappe.id)}
                        className="text-xs px-3 py-1.5 rounded-xl bg-slate-600 text-white cursor-pointer border-none font-semibold hover:bg-slate-700">
                        📁 Archivieren
                      </button>
                    )}
                  </div>
                </div>
                {/* Dokumente direkt sichtbar */}
                <div className="divide-y divide-slate-50">
                  {dokumente.map(dok => (
                    <DokumentZeile
                      key={dok.id}
                      dok={dok}
                      mappe={mappe}
                      onUnterschreiben={(von) => dokumentUnterschreiben(mappe.id, dok.id, von)}
                      onLoeschen={async () => {
                        if (!confirm(`"${dok.titel}" löschen?`)) return
                        await fetch(`/api/db/signatur_dokumente?id=${dok.id}`, { method: 'DELETE' })
                      }}
                    />
                  ))}
                  {dokumente.length === 0 && (
                    <div className="px-6 py-4 text-xs text-slate-400">Keine Dokumente in dieser Mappe</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Neue Mappe Modal */}
      {showNeu && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center" onClick={() => setShowNeu(false)}>
          <div className="w-full max-w-2xl mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="bg-teal-700 px-6 py-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-white/60 uppercase tracking-widest mb-1">Neue Signaturmappe</div>
                <div className="text-xl font-bold text-white">📁 Ordner erstellen</div>
              </div>
              <button onClick={() => setShowNeu(false)} className="text-white/60 hover:text-white text-2xl bg-transparent border-none cursor-pointer">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2">Klient:in *</label>
                <select value={neuForm.klientId} onChange={e => setNeuForm(f => ({ ...f, klientId: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none">
                  <option value="">– Klient:in wählen –</option>
                  {(klienten||[]).map(k => <option key={k.id} value={k.id}>{k.nachname} {k.vorname} {k.ort ? `(${k.ort})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2">Betreuerin</label>
                <select value={neuForm.betreuerinId} onChange={e => setNeuForm(f => ({ ...f, betreuerinId: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none">
                  <option value="">– optional –</option>
                  {(betreuerinnen||[]).map(b => <option key={b.id} value={b.id}>{b.nachname} {b.vorname}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2">Titel (optional)</label>
                <input value={neuForm.titel} onChange={e => setNeuForm(f => ({ ...f, titel: e.target.value }))}
                  placeholder={gewaehlterKlient ? `${gewaehlterKlient.nachname} ${gewaehlterKlient.vorname} — ${new Date().toLocaleDateString('de-AT')}` : ''}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-slate-700">Dokumente *</label>
                  <button onClick={() => setShowKiAuswahl(true)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 border border-violet-200 cursor-pointer hover:bg-violet-100 font-semibold">
                    ✨ KI-Auswahl
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-2xl border border-slate-200 p-3">
                  {(vorlagen||[]).filter(v => v.status === 'aktiv' || (v as any).aktiv !== false).map(v => {
                    const aktiv = neuForm.ausgewaehlteVorlagen.includes(v.id)
                    return (
                      <label key={v.id} className={`flex items-center gap-3 rounded-xl p-2.5 cursor-pointer transition-all ${aktiv ? 'bg-teal-50 border border-teal-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                        <input type="checkbox" checked={aktiv}
                          onChange={e => setNeuForm(f => ({
                            ...f,
                            ausgewaehlteVorlagen: e.target.checked ? [...f.ausgewaehlteVorlagen, v.id] : f.ausgewaehlteVorlagen.filter(x => x !== v.id)
                          }))} className="accent-teal-600 w-4 h-4" />
                        <div>
                          <div className="text-sm font-medium text-slate-800">{v.name}</div>
                          <div className="text-xs text-slate-500">{v.typ || (v as any).vorlageTyp}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
                {neuForm.ausgewaehlteVorlagen.length > 0 && (
                  <div className="text-xs text-teal-700 mt-1 font-semibold">✓ {neuForm.ausgewaehlteVorlagen.length} Dokument(e) ausgewählt</div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNeu(false)}
                  className="flex-1 rounded-2xl border border-slate-200 text-slate-600 text-sm py-3 cursor-pointer hover:bg-slate-50">
                  Abbrechen
                </button>
                <button onClick={mappeErstellen}
                  disabled={!neuForm.klientId || neuForm.ausgewaehlteVorlagen.length === 0 || erstelling}
                  className="flex-1 rounded-2xl bg-teal-600 text-white font-bold text-sm py-3 cursor-pointer border-none hover:bg-teal-700 disabled:opacity-50">
                  {erstelling ? '⏳ Wird erstellt...' : '📁 Signaturmappe erstellen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showKiAuswahl && (
        <KiVorlagenAuswahl
          vorlagen={vorlagen}
          klient={gewaehlterKlient}
          betreuerin={gewaehlteBetreuerin}
          ereignis={neuForm.ereignis}
          onAuswahl={ids => { setNeuForm(f => ({ ...f, ausgewaehlteVorlagen: [...new Set([...f.ausgewaehlteVorlagen, ...ids])] })); setShowKiAuswahl(false) }}
          onClose={() => setShowKiAuswahl(false)}
        />
      )}
    </div>
  )
}


// ── Digitales Unterschriftspad ──────────────────────────────────────────────
function SignaturPadModal({ dokTitel, klientName, onSave, onClose }: {
  dokTitel: string
  klientName: string
  onSave: (name: string, dataUrl: string) => Promise<void>
  onClose: () => void
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [zeichnen, setZeichnen] = useState(false)
  const [name, setName] = useState('')
  const [hatUnterschrift, setHatUnterschrift] = useState(false)
  const [saving, setSaving] = useState(false)
  const [letzterPunkt, setLetzterPunkt] = useState<{x:number,y:number}|null>(null)

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startZeichnen(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const pos = getPos(e)
    setZeichnen(true)
    setLetzterPunkt(pos)
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2)
    ctx.fillStyle = '#1e293b'
    ctx.fill()
  }

  function zeigeStrich(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!zeichnen || !letzterPunkt) return
    const pos = getPos(e)
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(letzterPunkt.x, letzterPunkt.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    setLetzterPunkt(pos)
    setHatUnterschrift(true)
  }

  function stopZeichnen(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    setZeichnen(false)
    setLetzterPunkt(null)
  }

  function loeschen() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHatUnterschrift(false)
  }

  async function speichern() {
    if (!hatUnterschrift) return
    setSaving(true)
    const dataUrl = canvasRef.current!.toDataURL('image/png')
    await onSave(name || klientName, dataUrl)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/80 flex items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-white rounded-3xl shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="bg-teal-700 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-white/60 uppercase tracking-widest mb-0.5">Digitale Unterschrift</div>
            <div className="text-lg font-bold text-white">{dokTitel}</div>
            <div className="text-xs text-white/70">{klientName}</div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl bg-transparent border-none cursor-pointer">✕</button>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500 mb-2 font-medium">Name der unterzeichnenden Person</div>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder={klientName || 'Name eingeben...'}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400 mb-4" />

          <div className="text-xs text-slate-500 mb-2 font-medium">Hier unterschreiben (mit Finger oder Stift)</div>
          <div className="relative rounded-2xl border-2 border-slate-300 overflow-hidden bg-white" style={{ height: 200 }}>
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full h-full touch-none cursor-crosshair"
              onMouseDown={startZeichnen}
              onMouseMove={zeigeStrich}
              onMouseUp={stopZeichnen}
              onMouseLeave={stopZeichnen}
              onTouchStart={startZeichnen}
              onTouchMove={zeigeStrich}
              onTouchEnd={stopZeichnen}
            />
            {!hatUnterschrift && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-slate-300 text-sm select-none">✍️ Hier unterschreiben</div>
              </div>
            )}
            {/* Unterschriftslinie */}
            <div className="absolute bottom-8 left-6 right-6 border-t border-slate-300 pointer-events-none" />
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={loeschen}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm cursor-pointer hover:bg-slate-50">
              🔄 Löschen
            </button>
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm cursor-pointer hover:bg-slate-50">
              Abbrechen
            </button>
            <button onClick={speichern} disabled={!hatUnterschrift || saving}
              className="flex-1 rounded-xl bg-teal-600 text-white font-bold text-sm py-2 cursor-pointer border-none hover:bg-teal-700 disabled:opacity-50">
              {saving ? '⏳ Wird gespeichert...' : '✅ Unterschrift bestätigen'}
            </button>
          </div>
        </div>
      </div>
    {showEmail && (
      <EmailModal
        anEmail=""
        anName={dok.klientName}
        betreff={`${dok.titel} – VBetreut GmbH`}
        inhalt={inhalt || `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie das Dokument "${dok.titel}".\n\nMit freundlichen Grüßen\nVBetreut GmbH`}
        typ={dok.vorlageTyp || 'sonstiges'}
        klientName={dok.klientName}
        dokumentId={dok.id}
        dokumentTyp={dok.titel}
        onClose={() => setShowEmail(false)}
      />
    )}
    </div>
  )
}

// ── Dokument-Zeile ──────────────────────────────────────────────────────────────
function DokumentZeile({ dok, mappe, onUnterschreiben, onLoeschen }: {
  dok: SignaturDokument
  mappe: Signaturmappe
  onUnterschreiben: (von: string) => Promise<void>
  onLoeschen: () => Promise<void>
}) {
  const [showBearbeiten, setShowBearbeiten] = useState(false)
  const [showSignaturPad, setShowSignaturPad] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inhalt, setInhalt] = useState(dok.inhalt || '')
  const istUnterschrieben = dok.status === 'unterschrieben'



  async function handleBearbeitenSpeichern() {
    await fetch(`/api/db/signatur_dokumente?id=${dok.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inhalt }),
    })
    setShowBearbeiten(false)
  }

  return (
    <div className="px-6 py-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-lg mt-0.5">{istUnterschrieben ? '✍️' : '⏳'}</span>
          <div>
            <div className="font-semibold text-slate-900 text-sm">{dok.titel}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {dok.klientName}{dok.vorlageName ? ` · ${dok.vorlageName}` : ''} · {fmtDatum(dok.erstelltAm)}
            </div>
            {istUnterschrieben && (
              <div className="text-xs text-emerald-700 mt-1 font-semibold">✓ Unterschrieben von {dok.unterschriftVon}</div>
            )}
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ml-2 flex-shrink-0 ${
          istUnterschrieben ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>{dok.status || 'zur_unterschrift'}</span>
      </div>

      {!istUnterschrieben && (
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={() => setShowBearbeiten(!showBearbeiten)}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 cursor-pointer hover:bg-slate-50 font-medium">
            ✏️ Bearbeiten
          </button>
          <button onClick={() => druckeSignaturDok({ ...dok, inhalt }, mappe.titel).catch(console.error)}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 cursor-pointer hover:bg-slate-50 font-medium">
            🖨️ Ausdruck
          </button>
          <button onClick={() => setShowEmail(true)}
            className="text-xs px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 cursor-pointer hover:bg-sky-100 font-medium">
            📧 E-Mail
          </button>
          <button onClick={() => setShowSignaturPad(true)}
            className="text-xs px-4 py-1.5 rounded-xl bg-teal-600 text-white cursor-pointer border-none font-bold hover:bg-teal-700">
            ✍️ Unterschreiben
          </button>
          <button onClick={onLoeschen}
            className="text-xs px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 cursor-pointer hover:bg-rose-100 font-medium">
            🗑️ Löschen
          </button>
        </div>
      )}

      {showSignaturPad && (
        <SignaturPadModal
          dokTitel={dok.titel}
          klientName={dok.klientName}
          onSave={async (name, dataUrl) => {
            setLoading(true)
            // Unterschrift als Bild in Supabase speichern
            await fetch(`/api/db/signatur_dokumente?id=${dok.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'unterschrieben',
                unterschrift_von: name,
                unterschrift_am: new Date().toISOString(),
                signatur_data_url: dataUrl,
              }),
            })
            await onUnterschreiben(name)
            setLoading(false)
            setShowSignaturPad(false)
          }}
          onClose={() => setShowSignaturPad(false)}
        />
      )}

      {showBearbeiten && (
        <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
          <div className="text-xs font-bold text-slate-600 mb-2">📝 Inhalt bearbeiten</div>
          <textarea value={inhalt} onChange={e => setInhalt(e.target.value)}
            rows={8} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono resize-y outline-none focus:border-teal-400" />
          <div className="flex gap-2 mt-2">
            <button onClick={handleBearbeitenSpeichern}
              className="text-xs px-4 py-1.5 rounded-xl bg-teal-600 text-white cursor-pointer border-none font-bold hover:bg-teal-700">
              💾 Speichern
            </button>
            <button onClick={() => { setShowBearbeiten(false); setInhalt(dok.inhalt || '') }}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 cursor-pointer hover:bg-slate-50">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    {showEmail && (
      <EmailModal
        anEmail=""
        anName={dok.klientName}
        betreff={`${dok.titel} – VBetreut GmbH`}
        inhalt={inhalt || `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie das Dokument "${dok.titel}".\n\nMit freundlichen Grüßen\nVBetreut GmbH`}
        typ={dok.vorlageTyp || 'sonstiges'}
        klientName={dok.klientName}
        dokumentId={dok.id}
        dokumentTyp={dok.titel}
        onClose={() => setShowEmail(false)}
      />
    )}
    </div>
  )
}
