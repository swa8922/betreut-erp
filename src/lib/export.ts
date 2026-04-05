// src/lib/export.ts
import type { Klient } from './klienten'
import { STATUS_LABELS, FOERDERUNG_LABELS } from './klienten'

function age(dob: string): string {
  if (!dob) return '–'
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + ' Jahre'
}

export async function exportPDF(klienten: Klient[], title = 'Klient:innen') {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Header
  doc.setFillColor(15, 118, 110)
  doc.rect(0, 0, 297, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('VBetreut · ERP', 14, 10)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 17)
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-AT')}`, 283, 17, { align: 'right' })

  doc.setTextColor(0, 0, 0)

  autoTable(doc, {
    startY: 28,
    head: [[
      'Name', 'Geburtsdatum', 'Alter', 'Pflegestufe', 'Status',
      'Förderung', 'Ort', 'Telefon', 'Zuständig'
    ]],
    body: klienten.map(k => [
      `${k.nachname} ${k.vorname}`,
      k.geburtsdatum ? new Date(k.geburtsdatum).toLocaleDateString('de-AT') : '–',
      age(k.geburtsdatum),
      k.pflegestufe === '0' ? '–' : `Stufe ${k.pflegestufe}`,
      STATUS_LABELS[k.status],
      FOERDERUNG_LABELS[k.foerderung],
      `${k.plz} ${k.ort}`,
      k.telefon || '–',
      k.zustaendig,
    ]),
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { cellPadding: 3 },
  })

  doc.save(`vbetreut-klienten-${new Date().toISOString().split('T')[0]}.pdf`)
}

export async function exportExcel(klienten: Klient[]) {
  const XLSX = await import('xlsx')

  const rows = klienten.map(k => ({
    'Nachname': k.nachname,
    'Vorname': k.vorname,
    'Geburtsdatum': k.geburtsdatum ? new Date(k.geburtsdatum).toLocaleDateString('de-AT') : '',
    'SVNR': k.svnr,
    'Status': STATUS_LABELS[k.status],
    'Pflegestufe': k.pflegestufe === '0' ? '' : k.pflegestufe,
    'Förderung': FOERDERUNG_LABELS[k.foerderung],
    'Telefon': k.telefon,
    'E-Mail': k.email,
    'Straße': k.strasse,
    'PLZ': k.plz,
    'Ort': k.ort,
    'Hausarzt': k.hausarzt,
    'Zuständig': k.zustaendig,
    'Besonderheiten': k.besonderheiten,
    'Erstellt am': k.erstelltAm,
    'Aktualisiert am': k.aktualisiertAm,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Klient:innen')

  // Column widths
  ws['!cols'] = [
    { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
    { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 24 },
    { wch: 8 },  { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 30 },
    { wch: 14 }, { wch: 14 },
  ]

  XLSX.writeFile(wb, `vbetreut-klienten-${new Date().toISOString().split('T')[0]}.xlsx`)
}
