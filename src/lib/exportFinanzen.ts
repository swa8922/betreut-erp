// src/lib/exportFinanzen.ts
import type { Dokument, BGAuszahlung } from './finanzen'
import { TYP_LABELS, STATUS_LABELS, VERSANDART_LABELS, ZAHLUNGSART_LABELS } from './finanzen'

const TEAL = [15, 118, 110] as const
const fmt = (n: number) => n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('de-AT') : '–'

export async function exportDokumentPDF(dok: Dokument): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 20

  // ── Header ──
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 32, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('VBetreut', M, 13)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('24h-Betreuungsagentur · Musterstraße 1 · 6900 Bregenz', M, 20)
  doc.text('office@vbetreut.at · +43 5574 12345', M, 26)

  // Typ + Nummer oben rechts
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(TYP_LABELS[dok.typ].toUpperCase(), W - M, 14, { align: 'right' })
  doc.setFontSize(11)
  doc.text(dok.dokumentNr, W - M, 21, { align: 'right' })
  if (dok.bezugDokumentNr) {
    doc.setFontSize(9)
    doc.text(`Bezug: ${dok.bezugDokumentNr}`, W - M, 28, { align: 'right' })
  }

  doc.setTextColor(0, 0, 0)
  let y = 45

  // ── Empfänger + Metadaten ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(dok.klientName, M, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  if (dok.klientAdresse) doc.text(dok.klientAdresse, M, y + 6)

  // Rechte Spalte: Rechnungsdetails
  const rX = W - M - 65
  const meta = [
    ['Datum:', fmtDate(dok.rechnungsDatum)],
    ['Zahlungsziel:', fmtDate(dok.zahlungsziel)],
    ['Zahlungsart:', ZAHLUNGSART_LABELS[dok.zahlungsart] || '–'],
    ['Status:', STATUS_LABELS[dok.status]],
    ...(dok.zeitraumVon ? [['Zeitraum:', `${fmtDate(dok.zeitraumVon)} – ${fmtDate(dok.zeitraumBis)}`]] : []),
    ...(dok.betreuerinName ? [['Betreuerin:', dok.betreuerinName]] : []),
  ]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  meta.forEach(([label, val], i) => {
    doc.text(String(label), rX, y + i * 5.5)
    doc.setFont('helvetica', 'normal')
    doc.text(String(val), rX + 28, y + i * 5.5)
    doc.setFont('helvetica', 'bold')
  })

  y += Math.max(25, meta.length * 5.5 + 5)

  // ── Betreff ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  const betreff = dok.typ === 'storno'
    ? `Storno zu ${dok.bezugDokumentNr} – ${dok.klientName}`
    : dok.typ === 'gutschrift'
    ? `Gutschrift zu ${dok.bezugDokumentNr} – ${dok.klientName}`
    : dok.typ === 'angebot'
    ? `Angebot für ${dok.klientName}`
    : `${TYP_LABELS[dok.typ]} – ${dok.klientName}`
  doc.text(betreff, M, y)
  y += 10

  // ── Positionen ──
  autoTable(doc, {
    startY: y,
    head: [['Pos.', 'Bezeichnung', 'Menge', 'Einheit', 'Einzelpreis', 'MwSt.', 'Netto', 'Brutto']],
    body: dok.positionen.map((p, i) => [
      String(i + 1),
      p.bezeichnung + (p.beschreibung ? `\n${p.beschreibung}` : ''),
      String(p.menge),
      p.einheit,
      fmt(p.einzelpreis),
      `${p.steuersatz} %`,
      fmt(p.nettoBetrag),
      fmt(p.bruttoBetrag),
    ]),
    headStyles: { fillColor: [...TEAL], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 60 },
      2: { halign: 'right', cellWidth: 14 },
      3: { cellWidth: 16 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'right', cellWidth: 24 },
      7: { halign: 'right', cellWidth: 24 },
    },
  })

  const afterTable = (doc as any).lastAutoTable.finalY + 5

  // ── Summentabelle ──
  const steuerzeilen = Object.entries(dok.summeSteuern).map(([satz, betrag]) => [
    '', '', '', '', '', `MwSt. ${satz} %`, '', fmt(betrag)
  ])

  autoTable(doc, {
    startY: afterTable,
    body: [
      ...steuerzeilen,
      [{ content: 'Gesamtbetrag (Brutto)', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 253, 249] } },
       { content: fmt(dok.summeBrutto), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 253, 249], textColor: [...TEAL] } }],
    ],
    bodyStyles: { fontSize: 9 },
    columnStyles: { 7: { halign: 'right', cellWidth: 24 } },
    showHead: false,
    margin: { left: M },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 10

  // ── Zahlungsinfos / Angebot-Hinweise ──
  if (dok.typ === 'rechnung' || dok.typ === 'gutschrift') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Zahlungsinformationen:', M, finalY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Bitte überweisen Sie ${fmt(dok.summeBrutto)} bis ${fmtDate(dok.zahlungsziel)}`, M, finalY + 6)
    doc.text('IBAN: AT12 3456 7890 1234 5678 · BIC: BKAUATWW', M, finalY + 12)
    doc.text(`Verwendungszweck: ${dok.dokumentNr}`, M, finalY + 18)
  } else if (dok.typ === 'angebot') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`Dieses Angebot ist gültig bis: ${fmtDate(dok.angebotGueltigBis)}`, M, finalY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Bei Annahme bitten wir um schriftliche Bestätigung.', M, finalY + 6)
  }

  if (dok.notizen) {
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`Anmerkungen: ${dok.notizen}`, M, finalY + 28)
  }

  // ── Footer ──
  doc.setFontSize(7.5)
  doc.setTextColor(150, 150, 150)
  doc.text('VBetreut GmbH · Musterstraße 1 · 6900 Bregenz · UID: ATU12345678 · Firmenbuch: FN 123456a', W / 2, 287, { align: 'center' })

  doc.save(`${dok.dokumentNr}-${dok.klientName.replace(/\s+/g, '-')}.pdf`)
}

// ── Alle Dokumente als Excel ──────────────────────────────────────────────────

export async function exportDokumenteExcel(dokumente: Dokument[]): Promise<void> {
  const XLSX = await import('xlsx')

  const rows = dokumente.map(d => ({
    'Nr.': d.dokumentNr,
    'Typ': TYP_LABELS[d.typ],
    'Klient:in': d.klientName,
    'Betreuerin': d.betreuerinName,
    'Datum': fmtDate(d.rechnungsDatum),
    'Von': fmtDate(d.zeitraumVon),
    'Bis': fmtDate(d.zeitraumBis),
    'Netto (€)': d.summeNetto,
    'MwSt. 0% (€)': d.summeSteuern?.['0'] || 0,
    'MwSt. 10% (€)': d.summeSteuern?.['10'] || 0,
    'MwSt. 20% (€)': d.summeSteuern?.['20'] || 0,
    'Brutto (€)': d.summeBrutto,
    'Status': STATUS_LABELS[d.status],
    'Zahlungsart': ZAHLUNGSART_LABELS[d.zahlungsart] || '',
    'Zahlungsziel': fmtDate(d.zahlungsziel),
    'Bezahlt am': fmtDate(d.zahlungseingangAm),
    'Offen (€)': d.offenerBetrag,
    'Versandart': VERSANDART_LABELS[d.versandart] || '',
    'Versendet an': d.versendetAn?.join(', ') || '',
    'Bezug auf': d.bezugDokumentNr || '',
    'Erstellt von': d.erstelltVon,
    'Erstellt am': fmtDate(d.erstelltAm),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dokumente')
  ws['!cols'] = Array(22).fill({ wch: 18 })
  XLSX.writeFile(wb, `vbetreut-finanzen-${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ── Auszahlungsbeleg PDF ──────────────────────────────────────────────────────

export async function exportAuszahlungPDF(az: BGAuszahlung): Promise<void> {
  const { default: jsPDF } = await import('jspdf')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 20

  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('VBetreut', M, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Auszahlungsbeleg', M, 20)
  doc.setFont('helvetica', 'bold')
  doc.text(`AZ-${az.id}`, W - M, 18, { align: 'right' })

  doc.setTextColor(0, 0, 0)
  let y = 40

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(az.betreuerinName, M, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`IBAN: ${az.betreuerinIban}`, M, y + 7)

  y += 22
  const details = [
    ['Zeitraum:', `${fmtDate(az.zeitraumVon)} – ${fmtDate(az.zeitraumBis)}`],
    ['Bruttobetrag:', fmt(az.bruttoBetrag)],
    ['Abzüge:', fmt(az.abzuege)],
    ['Nettobetrag:', fmt(az.nettoBetrag)],
    ['Status:', az.status],
  ]
  details.forEach(([l, v]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(l, M, y)
    doc.setFont('helvetica', 'normal')
    doc.text(v, M + 45, y)
    y += 8
  })

  doc.setFont('helvetica', 7.5 as any)
  doc.setFontSize(7.5)
  doc.setTextColor(150, 150, 150)
  doc.text('VBetreut GmbH · Musterstraße 1 · 6900 Bregenz', W / 2, 287, { align: 'center' })

  doc.save(`Auszahlung-${az.betreuerinName.replace(/\s+/g, '-')}-${az.zeitraumVon}.pdf`)
}

// ── Kunden-Rechnungsliste PDF ──────────────────────────────────────────────
export async function exportKundenlisteRechnungenPDF(
  klientName: string,
  dokumente: Dokument[]
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 16
  const TEAL = [15, 118, 110] as const

  // Header
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 32, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Rechnungsübersicht', M, 13)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Klient:in: ${klientName}`, M, 21)
  doc.text(`Stand: ${new Date().toLocaleDateString('de-AT')}`, W - M, 21, { align: 'right' })

  // Kennzahlen
  const gesamt = dokumente.reduce((s, d) => s + d.summeBrutto, 0)
  const bezahlt = dokumente.filter(d => d.status === 'bezahlt').reduce((s, d) => s + d.summeBrutto, 0)
  const offen = dokumente.filter(d => !['bezahlt', 'storniert'].includes(d.status)).reduce((s, d) => s + d.offenerBetrag, 0)

  const kacheln = [
    ['Rechnungen', String(dokumente.length)],
    ['Gesamt', fmt(gesamt)],
    ['Bezahlt', fmt(bezahlt)],
    ['Offen', fmt(offen)],
  ]
  let kx = M
  const ky = 36
  kacheln.forEach(([label, val]) => {
    doc.setFillColor(240, 253, 250)
    doc.roundedRect(kx, ky, 42, 14, 2, 2, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEAL)
    doc.text(label, kx + 2, ky + 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(val, kx + 2, ky + 11)
    kx += 46
  })

  // Tabelle
  autoTable(doc, {
    startY: 56,
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 2.5, font: 'helvetica' },
    headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 30 },
      4: { cellWidth: 30 },
      5: { cellWidth: 28 },
    },
    head: [['Rechnungs-Nr.', 'Typ', 'Datum', 'Fällig', 'Betrag', 'Status']],
    body: dokumente.map(d => [
      d.dokumentNr,
      TYP_LABELS[d.typ] || d.typ,
      d.rechnungsDatum ? new Date(d.rechnungsDatum).toLocaleDateString('de-AT') : '–',
      d.zahlungsziel ? new Date(d.zahlungsziel).toLocaleDateString('de-AT') : '–',
      fmt(d.summeBrutto),
      STATUS_LABELS[d.status] || d.status,
    ]),
    foot: [[
      '', '', '', 'Gesamt:',
      fmt(gesamt),
      `${dokumente.filter(d => d.status === 'bezahlt').length} bezahlt`,
    ]],
    footStyles: { fillColor: [240, 253, 250], textColor: TEAL, fontStyle: 'bold' },
  })

  // Notizen / offene Posten
  const offeneDoks = dokumente.filter(d => !['bezahlt', 'storniert'].includes(d.status) && d.offenerBetrag > 0)
  if (offeneDoks.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...TEAL)
    doc.text('Offene Posten:', M, finalY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    offeneDoks.forEach((d, i) => {
      doc.text(
        `${d.dokumentNr}  →  ${fmt(d.offenerBetrag)} offen  (fällig ${d.zahlungsziel ? new Date(d.zahlungsziel).toLocaleDateString('de-AT') : '–'})`,
        M + 2,
        finalY + 7 + i * 6
      )
    })
  }

  // Footer
  const pages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('VBetreut 24h-Betreuungsagentur · vertraulich', M, 290)
    doc.text(`Seite ${i} / ${pages}`, W - M, 290, { align: 'right' })
  }

  doc.save(`Rechnungen-${klientName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`)
}

// ── Kunden-Rechnungsliste Excel ────────────────────────────────────────────
export async function exportKundenlisteRechnungenExcel(
  klientName: string,
  dokumente: Dokument[]
): Promise<void> {
  const XLSX = await import('xlsx')

  const rows = dokumente.map(d => ({
    'Rechnungs-Nr.': d.dokumentNr,
    'Typ': TYP_LABELS[d.typ] || d.typ,
    'Rechnungsdatum': d.rechnungsDatum ? new Date(d.rechnungsDatum).toLocaleDateString('de-AT') : '–',
    'Fällig am': d.zahlungsziel ? new Date(d.zahlungsziel).toLocaleDateString('de-AT') : '–',
    'Betrag brutto': d.summeBrutto,
    'Offener Betrag': d.offenerBetrag,
    'Status': STATUS_LABELS[d.status] || d.status,
    'Betreuerin': d.betreuerinName,
    'Zeitraum von': d.zeitraumVon ? new Date(d.zeitraumVon).toLocaleDateString('de-AT') : '–',
    'Zeitraum bis': d.zeitraumBis ? new Date(d.zeitraumBis).toLocaleDateString('de-AT') : '–',
    'Notizen': d.notizen || '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
    { wch: 14 }, { wch: 14 }, { wch: 30 },
  ]

  // Summen-Zeile
  const sumRow = {
    'Rechnungs-Nr.': 'SUMME',
    'Typ': '',
    'Rechnungsdatum': '',
    'Fällig am': '',
    'Betrag brutto': dokumente.reduce((s, d) => s + d.summeBrutto, 0),
    'Offener Betrag': dokumente.reduce((s, d) => s + d.offenerBetrag, 0),
    'Status': `${dokumente.filter(d => d.status === 'bezahlt').length} / ${dokumente.length} bezahlt`,
    'Betreuerin': '',
    'Zeitraum von': '',
    'Zeitraum bis': '',
    'Notizen': '',
  }
  XLSX.utils.sheet_add_json(ws, [sumRow], { origin: -1, skipHeader: true })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, klientName.slice(0, 31))

  XLSX.writeFile(wb, `Rechnungen-${klientName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`)
}
