// src/lib/exportBetreuerinnen.ts
import type { Betreuerin } from './betreuerinnen'
import { STATUS_LABELS, ROLLE_LABELS, TURNUS_LABELS, DEUTSCH_LABELS } from './betreuerinnen'

function age(dob: string): string {
  if (!dob) return '–'
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + ' Jahre'
}

export async function exportBetreuerinnenPDF(list: Betreuerin[], title = 'Betreuerinnen') {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

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
      'Name', 'Geburtsdatum', 'Alter', 'Nationalität', 'Status',
      'Rolle', 'Turnus', 'Deutsch', 'Führerschein',
      'Region', 'Verfügbar ab', 'Bewertung'
    ]],
    body: list.map(b => [
      `${b.nachname} ${b.vorname}`,
      b.geburtsdatum ? new Date(b.geburtsdatum).toLocaleDateString('de-AT') : '–',
      age(b.geburtsdatum),
      b.nationalitaet || '–',
      STATUS_LABELS[b.status],
      ROLLE_LABELS[b.rolle],
      TURNUS_LABELS[b.turnus],
      DEUTSCH_LABELS[b.deutschkenntnisse],
      b.fuehrerschein ? `Ja (${b.fuehrerscheinKlasse})` : 'Nein',
      b.region || '–',
      b.verfuegbarAb ? new Date(b.verfuegbarAb).toLocaleDateString('de-AT') : '–',
      `${b.bewertung}/5`,
    ]),
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { cellPadding: 2.5 },
  })

  doc.save(`vbetreut-betreuerinnen-${new Date().toISOString().split('T')[0]}.pdf`)
}

export async function exportBetreuerinnenExcel(list: Betreuerin[]) {
  const XLSX = await import('xlsx')

  const rows = list.map(b => ({
    'Nachname': b.nachname,
    'Vorname': b.vorname,
    'Geburtsdatum': b.geburtsdatum ? new Date(b.geburtsdatum).toLocaleDateString('de-AT') : '',
    'Geburtsort': b.geburtsort,
    'SVNR': b.svnr,
    'Nationalität': b.nationalitaet,
    'Familienstand': b.familienstand,
    'Status': STATUS_LABELS[b.status],
    'Rolle': ROLLE_LABELS[b.rolle],
    'Turnus': TURNUS_LABELS[b.turnus],
    'Verfügbar ab': b.verfuegbarAb ? new Date(b.verfuegbarAb).toLocaleDateString('de-AT') : '',
    'Telefon': b.telefon,
    'WhatsApp': b.telefonWhatsapp ? 'Ja' : 'Nein',
    'E-Mail': b.email,
    'Hauptwohnsitz': `${b.hauptwohnsitzStrasse}, ${b.hauptwohnsitzPlz} ${b.hauptwohnsitzOrt}, ${b.hauptwohnsitzLand}`,
    'Nebenwohnsitz AT': b.nebenwohnsitzStrasse ? `${b.nebenwohnsitzStrasse}, ${b.nebenwohnsitzPlz} ${b.nebenwohnsitzOrt}` : '',
    'Deutschkenntnisse': DEUTSCH_LABELS[b.deutschkenntnisse],
    'Weitere Sprachen': b.weitereSprachenDE,
    'Führerschein': b.fuehrerschein ? `Ja (${b.fuehrerscheinKlasse})` : 'Nein',
    'Raucher:in': b.raucher ? 'Ja' : 'Nein',
    'Haustier-Erfahrung': b.haustierErfahrung ? 'Ja' : 'Nein',
    'Demenz-Erfahrung': b.demenzErfahrung ? 'Ja' : 'Nein',
    'Region': b.region,
    'Zuständig': b.zustaendig,
    'Bewertung': b.bewertung,
    'Aktive Einsätze': b.einsaetze.filter(e => e.status === 'aktiv').length,
    'Einsätze gesamt': b.einsaetze.length,
    'Notizen': b.notizen,
    'Erstellt am': b.erstelltAm,
    'Aktualisiert am': b.aktualisiertAm,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Betreuerinnen')

  ws['!cols'] = Array(30).fill({ wch: 18 })

  XLSX.writeFile(wb, `vbetreut-betreuerinnen-${new Date().toISOString().split('T')[0]}.xlsx`)
}
