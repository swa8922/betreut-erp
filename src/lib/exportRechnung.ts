// src/lib/exportRechnung.ts
import type { Rechnung } from './abrechnung'
import { STATUS_LABELS, ZAHLUNGSART_LABELS } from './abrechnung'

export async function exportRechnungPDF(r: Rechnung) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const MARGIN = 20

  // ── Header Balken ──
  doc.setFillColor(15, 118, 110)
  doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('VBetreut', MARGIN, 13)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('24h-Betreuungsagentur', MARGIN, 20)
  doc.text('RECHNUNG', W - MARGIN, 13, { align: 'right' })
  doc.setFontSize(9)
  doc.text(r.rechnungsNr, W - MARGIN, 20, { align: 'right' })

  doc.setTextColor(0, 0, 0)
  let y = 45

  // ── Empfänger + Rechnungsinfos ──
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('An:', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(r.klientName, MARGIN + 10, y)
  doc.text(r.klientAdresse, MARGIN + 10, y + 6)

  // Rechts: Rechnungsinfos
  const infoX = W - MARGIN - 70
  const infoData = [
    ['Rechnungsnr.:', r.rechnungsNr],
    ['Datum:', new Date(r.rechnungsDatum).toLocaleDateString('de-AT')],
    ['Zahlungsziel:', new Date(r.zahlungsziel).toLocaleDateString('de-AT')],
    ['Zahlungsart:', ZAHLUNGSART_LABELS[r.zahlungsart]],
    ['Status:', STATUS_LABELS[r.status]],
  ]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  infoData.forEach(([label, val], i) => {
    doc.text(label, infoX, y + i * 6)
    doc.setFont('helvetica', 'normal')
    doc.text(val, infoX + 30, y + i * 6)
    doc.setFont('helvetica', 'bold')
  })

  y += 40

  // ── Betreff ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`Betreuungsleistung für ${r.klientName}`, MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Zeitraum: ${new Date(r.zeitraumVon).toLocaleDateString('de-AT')} – ${new Date(r.zeitraumBis).toLocaleDateString('de-AT')}`, MARGIN, y + 7)
  if (r.betreuerinName) {
    doc.text(`Betreuerin: ${r.betreuerinName}`, MARGIN, y + 14)
  }
  y += 30

  // ── Positionen ──
  autoTable(doc, {
    startY: y,
    head: [['Bezeichnung', 'Tage', 'Tagessatz', 'Betrag']],
    body: r.positionen.map(p => [
      p.bezeichnung,
      p.tage > 1 ? String(p.tage) : '–',
      p.tage > 1 ? p.tagessatz.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' }) : '–',
      p.betrag.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' }),
    ]),
    foot: [[
      { content: 'Gesamtbetrag', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: r.gesamtBetrag.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' }), styles: { fontStyle: 'bold' } },
    ]],
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    footStyles: { fillColor: [240, 253, 249], textColor: [15, 118, 110], fontSize: 11 },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 },
    },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 15

  // ── Zahlungsinfos ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Bitte überweisen Sie den Betrag bis zum:', MARGIN, finalY)
  doc.setTextColor(15, 118, 110)
  doc.text(new Date(r.zahlungsziel).toLocaleDateString('de-AT'), MARGIN + 75, finalY)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.text('IBAN: AT12 3456 7890 1234 5678', MARGIN, finalY + 7)
  doc.text('BIC: BKAUATWW', MARGIN, finalY + 13)

  if (r.notizen) {
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('Anmerkungen: ' + r.notizen, MARGIN, finalY + 25)
  }

  // ── Footer ──
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('VBetreut GmbH · Musterstraße 1 · 6900 Bregenz · office@vbetreut.at · +43 5574 12345', W / 2, 285, { align: 'center' })

  doc.save(`${r.rechnungsNr}-${r.klientName.replace(/\s/g, '-')}.pdf`)
}

export async function exportRechnungenExcel(rechnungen: Rechnung[]) {
  const XLSX = await import('xlsx')
  const rows = rechnungen.map(r => ({
    'Rechnungs-Nr.': r.rechnungsNr,
    'Klient:in': r.klientName,
    'Betreuerin': r.betreuerinName,
    'Zeitraum von': r.zeitraumVon ? new Date(r.zeitraumVon).toLocaleDateString('de-AT') : '',
    'Zeitraum bis': r.zeitraumBis ? new Date(r.zeitraumBis).toLocaleDateString('de-AT') : '',
    'Nettobetrag (€)': r.nettoBetrag,
    'Taxikosten (€)': r.taxiKosten,
    'Gesamt (€)': r.gesamtBetrag,
    'Status': STATUS_LABELS[r.status],
    'Zahlungsart': ZAHLUNGSART_LABELS[r.zahlungsart],
    'Rechnungsdatum': r.rechnungsDatum ? new Date(r.rechnungsDatum).toLocaleDateString('de-AT') : '',
    'Zahlungsziel': r.zahlungsziel ? new Date(r.zahlungsziel).toLocaleDateString('de-AT') : '',
    'Zahlung eingegangen': r.zahlungseingangAm ? new Date(r.zahlungseingangAm).toLocaleDateString('de-AT') : '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Rechnungen')
  ws['!cols'] = Array(14).fill({ wch: 20 })
  XLSX.writeFile(wb, `vbetreut-rechnungen-${new Date().toISOString().split('T')[0]}.xlsx`)
}
