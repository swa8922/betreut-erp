// src/lib/exportWechselliste.ts
import type { WechselEintrag } from './wechselliste'

const TEAL = [15, 118, 110] as const
const TEAL_LIGHT = [240, 253, 250] as const
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('de-AT') : '–'

// ── Excel Export ───────────────────────────────────────────────

export async function exportWechsellisteExcel(
  eintraege: WechselEintrag[],
  titel: string = 'Wechselliste'
): Promise<void> {
  const XLSX = await import('xlsx')

  const rows = eintraege.map(w => ({
    'Wechseldatum': fmtDate(w.wechselDatum),
    'Klient:in': w.klientName,
    'Ort': w.klientOrt,
    'Adresse': `${w.klientStrasse || ''} ${w.klientPlz || ''}`.trim(),
    'Typ': w.typ,
    'Turnus (Tage)': w.turnusTage,
    'Geht ab': w.gehtBetreuerinName || '–',
    'Abreise': fmtDate(w.abreiseDatum),
    'Taxi Abreise': w.taxiRueck || '–',
    'Kommt an': w.kommtBetreuerinName || '⚠️ OFFEN',
    'Anreise': fmtDate(w.anreiseDatum),
    'Taxi Anreise': w.taxiHin || '–',
    'Status': w.status === 'vorbereitung' ? 'In Vorbereitung' : w.status === 'bestaetigt' ? 'Bestätigt' : w.status === 'durchgefuehrt' ? 'Durchgeführt' : w.status,
    'Zuständig': w.zustaendig || '–',
    'Übergabenotiz': w.uebergabeNotiz || '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)

  // Spaltenbreiten
  ws['!cols'] = [
    { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 14 },
    { wch: 8 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 22 },
    { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 40 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Wechselliste')

  // Zusammenfassung-Sheet
  const offene = eintraege.filter(w => w.status === 'vorbereitung' && !w.kommtBetreuerinName)
  const summaryRows = [
    { 'Kennzahl': 'Wechsel gesamt', 'Wert': eintraege.length },
    { 'Kennzahl': 'In Vorbereitung', 'Wert': eintraege.filter(w => w.status === 'vorbereitung').length },
    { 'Kennzahl': 'Bestätigt', 'Wert': eintraege.filter(w => w.status === 'bestaetigt').length },
    { 'Kennzahl': 'Durchgeführt', 'Wert': eintraege.filter(w => w.status === 'durchgefuehrt').length },
    { 'Kennzahl': 'Noch ohne Nachfolge', 'Wert': offene.length },
    { 'Kennzahl': 'Exportiert am', 'Wert': new Date().toLocaleDateString('de-AT') },
  ]
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Übersicht')

  const dateiname = `wechselliste-${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(wb, dateiname)
}

// ── Taxi-gefilterte Excel (für Partner) ───────────────────────

export async function exportWechsellisteTaxiExcel(
  eintraege: WechselEintrag[],
  taxiName: string
): Promise<void> {
  const XLSX = await import('xlsx')

  const taxiWechsel = eintraege.filter(w =>
    w.taxiHin?.includes(taxiName) || w.taxiRueck?.includes(taxiName)
  )

  const rows = taxiWechsel.map(w => {
    const isHin = w.taxiHin?.includes(taxiName)
    const isRueck = w.taxiRueck?.includes(taxiName)
    return {
      'Datum': fmtDate(w.wechselDatum),
      'Klient:in': w.klientName,
      'Adresse': `${w.klientStrasse || ''}, ${w.klientPlz || ''} ${w.klientOrt}`.trim().replace(/^,\s*/, ''),
      'Telefon': w.klientTelefon || '–',
      'Ansprechpartner': w.ansprechpartner || '–',
      'Fahrt Anreise': isHin ? `${w.kommtBetreuerinName || '–'} → ${w.klientOrt}` : '–',
      'Fahrt Abreise': isRueck ? `${w.gehtBetreuerinName || '–'} ← ${w.klientOrt}` : '–',
      'Typ': w.typ,
      'Notizen': w.uebergabeNotiz || '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 40 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Fahrten ${taxiName}`)
  XLSX.writeFile(wb, `taxi-${taxiName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ── PDF Export ─────────────────────────────────────────────────

export async function exportWechsellistePDF(
  eintraege: WechselEintrag[],
  options: {
    titel?: string
    filterLabel?: string
    nurOffene?: boolean
    mitUebergabe?: boolean
    querformat?: boolean
  } = {}
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const {
    titel = 'Wechselliste',
    filterLabel = 'Alle Wechsel',
    nurOffene = false,
    mitUebergabe = true,
    querformat = true,
  } = options

  const liste = nurOffene ? eintraege.filter(w => !w.kommtBetreuerinName) : eintraege
  const doc = new jsPDF({ orientation: querformat ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const W = querformat ? 297 : 210
  const M = 14

  // ── Header-Block ──
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(titel, M, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`VBetreut 24h-Betreuungsagentur · ${filterLabel} · ${liste.length} Einträge · Stand: ${new Date().toLocaleDateString('de-AT')}`, M, 18)
  doc.text(`Seite`, W - M - 20, 18)

  // ── Kennzahlen-Leiste ──
  const offene = liste.filter(w => !w.kommtBetreuerinName && w.status !== 'durchgefuehrt')
  const bestaetigt = liste.filter(w => w.status === 'bestaetigt')
  const kacheln = [
    ['Wechsel gesamt', liste.length],
    ['Noch offen', offene.length],
    ['Bestätigt', bestaetigt.length],
    ['Exportiert', new Date().toLocaleDateString('de-AT')],
  ]
  doc.setTextColor(0, 0, 0)
  let kX = M
  const kY = 32
  kacheln.forEach(([label, val]) => {
    doc.setFillColor(...TEAL_LIGHT)
    doc.roundedRect(kX, kY, 52, 10, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEAL)
    doc.text(String(label), kX + 3, kY + 4)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(String(val), kX + 3, kY + 9)
    kX += 56
  })

  // ── Haupttabelle ──
  autoTable(doc, {
    startY: 48,
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 2.5, font: 'helvetica' },
    headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22 },   // Datum
      1: { cellWidth: 36 },   // Klient
      2: { cellWidth: 28 },   // Ort
      3: { cellWidth: 36 },   // Geht ab
      4: { cellWidth: 36 },   // Kommt an
      5: { cellWidth: 22 },   // Taxi Hin
      6: { cellWidth: 22 },   // Taxi Rück
      7: { cellWidth: 18 },   // Typ
      8: { cellWidth: 20 },   // Status
    },
    head: [['Datum', 'Klient:in / Ort', 'Adresse', 'Geht ab', 'Kommt an', 'Taxi Anreise', 'Taxi Abreise', 'Typ', 'Status']],
    body: liste.map(w => [
      fmtDate(w.wechselDatum),
      `${w.klientName}\n${w.klientOrt}`,
      w.klientStrasse ? `${w.klientStrasse}\n${w.klientPlz} ${w.klientOrt}` : w.klientOrt,
      w.gehtBetreuerinName ? `${w.gehtBetreuerinName}\n${fmtDate(w.abreiseDatum)}` : '–',
      w.kommtBetreuerinName ? `${w.kommtBetreuerinName}\n${fmtDate(w.anreiseDatum)}` : '⚠️ OFFEN',
      w.taxiHin || '–',
      w.taxiRueck || '–',
      w.typ,
      w.status === 'vorbereitung' ? 'Vorbereitung' : w.status === 'bestaetigt' ? 'Bestätigt' : 'Erledigt',
    ]),
    didDrawCell: (data) => {
      // Offene Nachfolge rot markieren
      if (data.column.index === 4 && data.cell.raw === '⚠️ OFFEN') {
        doc.setTextColor(220, 38, 38)
      }
    },
  })

  // ── Übergabenotizen (optional, neue Seite) ──
  if (mitUebergabe && liste.some(w => w.uebergabeNotiz)) {
    doc.addPage()
    doc.setFillColor(...TEAL)
    doc.rect(0, 0, W, 20, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('Übergabenotizen', M, 13)

    let y = 28
    liste.filter(w => w.uebergabeNotiz).forEach(w => {
      if (y > (querformat ? 180 : 260)) { doc.addPage(); y = 20 }

      doc.setFillColor(...TEAL_LIGHT)
      doc.roundedRect(M, y, W - 2 * M, 6, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...TEAL)
      doc.text(`${w.klientName} · ${w.klientOrt} · ${fmtDate(w.wechselDatum)}`, M + 2, y + 4.5)

      y += 8
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(60, 60, 60)
      const lines = doc.splitTextToSize(w.uebergabeNotiz || '', W - 2 * M)
      doc.text(lines, M + 2, y)
      y += lines.length * 4 + 5
    })
  }

  // ── Seitennummern ──
  const pages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(`Seite ${i} von ${pages}`, W - M - 20, querformat ? 205 : 292)
    doc.text('VBetreut 24h-Betreuungsagentur · vertraulich', M, querformat ? 205 : 292)
  }

  const dateiname = `wechselliste-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(dateiname)
}

// ── Taxi-Auftragsliste PDF ─────────────────────────────────────

export async function exportTaxiListePDF(
  eintraege: WechselEintrag[],
  taxiName: string
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const taxiWechsel = eintraege.filter(w =>
    w.taxiHin?.includes(taxiName) || w.taxiRueck?.includes(taxiName)
  )

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 14

  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(`Fahrtenauftrag: ${taxiName}`, M, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`${taxiWechsel.length} Fahrten · Erstellt: ${new Date().toLocaleDateString('de-AT')} ${new Date().toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`, M, 20)
  doc.text('VBetreut 24h-Betreuungsagentur', W - M - 60, 20)

  autoTable(doc, {
    startY: 34,
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 3, font: 'helvetica' },
    headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 253, 250] },
    head: [['Datum', 'Klient:in', 'Adresse', 'Fahrgast', 'Fahrtrichtung', 'Notizen']],
    body: taxiWechsel.map(w => {
      const isHin = w.taxiHin?.includes(taxiName)
      const isRueck = w.taxiRueck?.includes(taxiName)
      const fahrten = []
      if (isHin) fahrten.push(`→ Anreise: ${w.kommtBetreuerinName || '?'}`)
      if (isRueck) fahrten.push(`← Abreise: ${w.gehtBetreuerinName || '?'}`)
      return [
        fmtDate(w.wechselDatum),
        w.klientName,
        `${w.klientStrasse || ''}\n${w.klientPlz || ''} ${w.klientOrt}`.trim(),
        fahrten.join('\n'),
        isHin && isRueck ? 'Hin & Rück' : isHin ? 'Anreise' : 'Abreise',
        w.uebergabeNotiz ? w.uebergabeNotiz.slice(0, 60) + (w.uebergabeNotiz.length > 60 ? '…' : '') : '',
      ]
    }),
  })

  // Unterschriftsfeld
  const finalY = (doc as any).lastAutoTable.finalY + 15
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('Bestätigung / Unterschrift Fahrer:', M, finalY)
  doc.line(M, finalY + 8, M + 70, finalY + 8)
  doc.text('Datum:', M + 90, finalY)
  doc.line(M + 90, finalY + 8, M + 130, finalY + 8)

  doc.save(`taxi-auftrag-${taxiName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`)
}

// ── Browser-Druckliste ─────────────────────────────────────────

export function druckeWechselliste(eintraege: WechselEintrag[], titel: string = 'Wechselliste') {
  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>${titel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; }
    header { background: #0f766e; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; }
    header h1 { font-size: 18px; font-weight: bold; }
    header .meta { font-size: 10px; opacity: 0.8; text-align: right; }
    .kacheln { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px 20px; background: #f0fdf4; border-bottom: 1px solid #d1fae5; }
    .kachel { background: white; border: 1px solid #d1fae5; border-radius: 6px; padding: 8px 12px; }
    .kachel .label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .kachel .val { font-size: 18px; font-weight: bold; color: #0f766e; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 0; }
    thead tr { background: #0f766e; color: white; }
    thead th { padding: 7px 10px; text-align: left; font-size: 10px; font-weight: bold; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr.offen { background: #fffbeb; }
    td { padding: 7px 10px; vertical-align: top; }
    .datum { font-weight: bold; white-space: nowrap; }
    .name { font-weight: bold; }
    .sub { color: #64748b; font-size: 10px; margin-top: 2px; }
    .offen-badge { color: #b45309; font-weight: bold; }
    .taxi { color: #0f766e; font-size: 10px; }
    .uebergabe { margin-top: 24px; padding: 0 20px; page-break-before: always; }
    .uebergabe h2 { font-size: 14px; font-weight: bold; color: #0f766e; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #0f766e; }
    .notiz-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; }
    .notiz-card .notiz-header { font-weight: bold; color: #92400e; margin-bottom: 4px; display: flex; justify-content: space-between; }
    .notiz-text { color: #451a03; font-size: 10px; white-space: pre-wrap; }
    footer { margin-top: 20px; padding: 8px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
    @media print {
      @page { margin: 10mm; size: A4 landscape; }
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>${titel}</h1>
      <div style="font-size:11px;opacity:0.85;margin-top:2px">VBetreut 24h-Betreuungsagentur</div>
    </div>
    <div class="meta">
      <div>${eintraege.length} Einträge</div>
      <div>Stand: ${new Date().toLocaleDateString('de-AT')} ${new Date().toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </header>

  <div class="kacheln">
    <div class="kachel"><div class="label">Gesamt</div><div class="val">${eintraege.length}</div></div>
    <div class="kachel"><div class="label">In Vorbereitung</div><div class="val">${eintraege.filter(w => w.status === 'vorbereitung').length}</div></div>
    <div class="kachel"><div class="label">Bestätigt</div><div class="val">${eintraege.filter(w => w.status === 'bestaetigt').length}</div></div>
    <div class="kachel"><div class="label">Noch offen</div><div class="val" style="color:#b45309">${eintraege.filter(w => !w.kommtBetreuerinName && w.status !== 'durchgefuehrt').length}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Datum</th>
        <th>Klient:in</th>
        <th>Adresse</th>
        <th>Reist ab</th>
        <th>Reist an</th>
        <th>Partner Anreise</th>
        <th>Partner Abreise</th>
        <th>Typ</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${eintraege.map(w => `
        <tr class="${!w.kommtBetreuerinName && w.status !== 'durchgefuehrt' ? 'offen' : ''}">
          <td class="datum">${fmtDate(w.wechselDatum)}</td>
          <td><div class="name">${w.klientName}</div><div class="sub">${w.klientOrt}</div></td>
          <td><div>${w.klientStrasse || '–'}</div><div class="sub">${w.klientPlz || ''} ${w.klientOrt}</div></td>
          <td>
            <div>${w.gehtBetreuerinName || '–'}</div>
            <div class="sub">Abreise: ${fmtDate(w.abreiseDatum)}</div>
          </td>
          <td>
            ${w.kommtBetreuerinName
              ? `<div>${w.kommtBetreuerinName}</div><div class="sub">Anreise: ${fmtDate(w.anreiseDatum)}</div>`
              : `<div class="offen-badge">⚠️ OFFEN</div>`}
          </td>
          <td class="taxi">${w.taxiHin || '–'}</td>
          <td class="taxi">${w.taxiRueck || '–'}</td>
          <td>${w.typ}</td>
          <td>${w.status === 'vorbereitung' ? 'Vorbereitung' : w.status === 'bestaetigt' ? 'Bestätigt' : 'Erledigt'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${eintraege.some(w => w.uebergabeNotiz) ? `
  <div class="uebergabe">
    <h2>Übergabenotizen</h2>
    ${eintraege.filter(w => w.uebergabeNotiz).map(w => `
      <div class="notiz-card">
        <div class="notiz-header">
          <span>${w.klientName} · ${w.klientOrt}</span>
          <span>${fmtDate(w.wechselDatum)}</span>
        </div>
        <div class="notiz-text">${w.uebergabeNotiz}</div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <footer>
    <span>VBetreut 24h-Betreuungsagentur · Vertraulich</span>
    <span>Exportiert am ${new Date().toLocaleDateString('de-AT')}</span>
  </footer>

  <script>window.onload = () => window.print()</script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1200,height=800')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
