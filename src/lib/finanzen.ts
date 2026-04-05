// src/lib/finanzen.ts
// Vollständiges Rechnungs-, Verrechnungs- und Auszahlungsmodul
// Gemäß Lasten-/Pflichtenheft VBetreut
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// TYPEN
// ══════════════════════════════════════════════════════════════════════════════

export type DokumentTyp =
  | 'rechnung'         // Kundenrechnung
  | 'gutschrift'       // Gutschrift zu einer Rechnung
  | 'storno'           // Stornorechnung
  | 'angebot'          // Angebot an Kunden
  | 'bg_abrechnung'    // Betreuerin-Abrechnung an VBetreut
  | 'auszahlung'       // Auszahlungsbeleg Betreuerin
  | 'taxi_rechnung'    // Taxi-Rechnung

export type DokumentStatus =
  | 'entwurf'
  | 'erstellt'
  | 'versendet'
  | 'bezahlt'
  | 'teilbezahlt'
  | 'mahnung'
  | 'storniert'
  | 'abgelehnt'        // bei Angeboten
  | 'angenommen'       // bei Angeboten
  | 'abgelaufen'       // bei Angeboten

export type Versandart = 'email' | 'post' | 'email_post' | 'intern'
export type Zahlungsart = 'ueberweisung' | 'lastschrift' | 'bar' | 'sepa'
export type Steuersatz = 0 | 10 | 20

export type ZahlungsabgleichStatus =
  | 'offen'
  | 'abgeglichen'
  | 'teilweise'
  | 'klaerung'         // Klärungsbedarf
  | 'ueberzahlung'
  | 'fehlbetrag'

// ── Artikel / Leistungskatalog ────────────────────────────────────────────────

export interface Artikel {
  id: string
  code: string           // z.B. "BEW-28", "TAXI", "AGENTUR"
  bezeichnung: string
  beschreibung: string
  einheit: string        // "Tag", "Pauschale", "km"
  preis: number          // Standardpreis
  steuersatz: Steuersatz
  kategorie: 'betreuung' | 'taxi' | 'agentur' | 'sonstiges'
  aktiv: boolean
  erstelltAm: string
}

// ── Rechnungsposition ─────────────────────────────────────────────────────────

export interface Position {
  id: string
  artikelId: string
  bezeichnung: string
  beschreibung: string
  menge: number
  einheit: string
  einzelpreis: number
  steuersatz: Steuersatz
  nettoBetrag: number     // menge × einzelpreis
  steuerBetrag: number    // nettoBetrag × steuersatz/100
  bruttoBetrag: number    // nettoBetrag + steuerBetrag
  manuellGeaendert: boolean
}

// ── Audit-Log Eintrag ─────────────────────────────────────────────────────────

export interface AuditLogEintrag {
  zeitpunkt: string
  benutzer: string
  aktion: string
  altWert?: string
  neuWert?: string
  feld?: string
}

// ── Hauptdokument ─────────────────────────────────────────────────────────────

export interface Dokument {
  id: string
  typ: DokumentTyp
  status: DokumentStatus

  // Nummernkreise (lückenlos, getrennt pro Typ)
  dokumentNr: string     // RE-2026-001 / GS-2026-001 / ST-2026-001 / AN-2026-001

  // Verknüpfungen
  einsatzId: string
  klientId: string
  klientName: string
  klientAdresse: string
  klientEmail: string
  klientEmail2: string   // 2. E-Mail-Adresse
  betreuerinId: string
  betreuerinName: string
  betreuerinIban: string

  // Storno / Gutschrift Verknüpfung
  bezugDokumentId: string   // bei Storno/Gutschrift: ID der Ursprungsrechnung
  bezugDokumentNr: string
  stornoDokumentId: string  // bei Rechnung: ID des zugehörigen Stornos (falls vorhanden)
  gutschriftIds: string[]   // bei Rechnung: IDs aller Gutschriften

  // Zeitraum & Berechnung
  zeitraumVon: string
  zeitraumBis: string
  berechneteTageLaut: number      // Tage laut Turnusberechnung (halber erster/letzter Tag)
  berechneteTageManuell: number   // falls manuell überschrieben

  // Positionen
  positionen: Position[]

  // Summen (automatisch berechnet)
  summeNetto: number
  summeSteuern: Record<string, number>  // { "20": 120.00, "10": 50.00 }
  summeBrutto: number

  // Zahlung & Fälligkeit
  zahlungsart: Zahlungsart
  zahlungsziel: string
  zahlungseingangAm: string
  gezahltBetrag: number
  offenerBetrag: number
  zahlungsabgleichStatus: ZahlungsabgleichStatus
  bankrReferenz: string      // Referenz aus Bankimport

  // Versand
  versandart: Versandart
  versendetAm: string
  versendetAn: string[]      // E-Mail-Adressen oder "Post"

  // Angebot-spezifisch
  angebotGueltigBis: string
  angebotAngenommenAm: string

  // Betreuerin-Abrechnung spezifisch
  bgAbrechnungszeitraum: string
  bgGrundlohnBetrag: number
  bgZuschlaege: number
  bgAbzuege: number

  // Taxi-spezifisch
  taxiUnternehmen: string
  taxiFahrten: TaxiFahrt[]

  // Meta
  notizen: string
  internNotizen: string      // nur für Mitarbeiter sichtbar
  anhangDateien: string[]
  versandart2: Versandart    // falls kombinierter Versand
  rechnungsDatum: string
  erstelltVon: string
  erstelltAm: string
  aktualisiertAm: string
  auditLog: AuditLogEintrag[]
  archiviert: boolean
}

// ── Taxi-Fahrt ────────────────────────────────────────────────────────────────

export interface TaxiFahrt {
  id: string
  datum: string
  klientName: string
  betreuerinName: string
  von: string
  nach: string
  km: number
  preis: number
  typ: 'anreise' | 'abreise'
}

// ── Zahlung (Bankimport) ──────────────────────────────────────────────────────

export interface BankZahlung {
  id: string
  importDatum: string
  buchungsDatum: string
  betrag: number
  auftraggeber: string
  verwendungszweck: string
  iban: string
  status: ZahlungsabgleichStatus
  zugeordnetDokumentId: string
  zugeordnetDokumentNr: string
  abweichungBetrag: number   // Differenz wenn nicht exakt
  klaerungsHinweis: string
  abgeschlossenAm: string
  abgeschlossenVon: string
}

// ── Auszahlung Betreuerin ─────────────────────────────────────────────────────

export interface BGAuszahlung {
  id: string
  betreuerinId: string
  betreuerinName: string
  betreuerinIban: string
  einsatzId: string
  zeitraumVon: string
  zeitraumBis: string
  bruttoBetrag: number
  abzuege: number
  nettoBetrag: number
  status: 'vorbereitet' | 'exportiert' | 'bezahlt'
  exportDatum: string
  zahlungsDatum: string
  sepaXml: string     // generiertes SEPA-XML
  archivDokumentId: string
}

// ══════════════════════════════════════════════════════════════════════════════
// TURNUSBERECHNUNG (Pflichtenheft §3.1)
// Erster und letzter Tag = 0,5 — volle Tage dazwischen = 1,0
// Beispiel: 25.03.–22.04. = 28 Tage (nicht 29)
// ══════════════════════════════════════════════════════════════════════════════

export function berechneTurnusTage(von: string, bis: string): {
  tage: number
  detail: string
  starttag: number
  endtag: number
  volleTage: number
} {
  if (!von || !bis) return { tage: 0, detail: '', starttag: 0.5, endtag: 0.5, volleTage: 0 }

  const start = new Date(von)
  const end = new Date(bis)
  const diffMs = end.getTime() - start.getTime()
  const diffTage = Math.round(diffMs / 86400000) // Kalendertage zwischen Von und Bis

  // Regel: erster Tag = 0,5 · letzter Tag = 0,5 · volle Tage = diffTage - 1
  const volleTage = Math.max(0, diffTage - 1)
  const tage = 0.5 + volleTage + 0.5 // = diffTage (aber klar aufgeschlüsselt)

  const detail = `Anreisetag (${start.toLocaleDateString('de-AT')}) = 0,5 Tage + ` +
    `${volleTage} volle Tage + ` +
    `Abreisetag (${end.toLocaleDateString('de-AT')}) = 0,5 Tage = ` +
    `${tage} Tage gesamt`

  return { tage, detail, starttag: 0.5, endtag: 0.5, volleTage }
}

// ══════════════════════════════════════════════════════════════════════════════
// SUMMENBERECHNUNG
// ══════════════════════════════════════════════════════════════════════════════

export function berechnePositionSummen(pos: Omit<Position, 'nettoBetrag' | 'steuerBetrag' | 'bruttoBetrag'>): Position {
  const nettoBetrag = Math.round(pos.menge * pos.einzelpreis * 100) / 100
  const steuerBetrag = Math.round(nettoBetrag * pos.steuersatz / 100 * 100) / 100
  const bruttoBetrag = Math.round((nettoBetrag + steuerBetrag) * 100) / 100
  return { ...pos, nettoBetrag, steuerBetrag, bruttoBetrag }
}

export function berechneDokumentSummen(positionen: Position[]): {
  summeNetto: number
  summeSteuern: Record<string, number>
  summeBrutto: number
} {
  const pos = Array.isArray(positionen) ? positionen : []
  const summeNetto = Math.round(pos.reduce((s, p) => s + (p.nettoBetrag || 0), 0) * 100) / 100
  const summeSteuern: Record<string, number> = {}
  for (const p of pos) {
    const key = String(p.steuersatz || 0)
    summeSteuern[key] = Math.round(((summeSteuern[key] || 0) + (p.steuerBetrag || 0)) * 100) / 100
  }
  const summeBrutto = Math.round(pos.reduce((s, p) => s + (p.bruttoBetrag || 0), 0) * 100) / 100
  return { summeNetto, summeSteuern, summeBrutto }
}

// ══════════════════════════════════════════════════════════════════════════════
// NUMMERNKREISE (lückenlos, getrennt pro Typ)
// ══════════════════════════════════════════════════════════════════════════════

const NR_KEYS: Record<string, string> = {
  rechnung:      'vb_nr_re',
  gutschrift:    'vb_nr_gs',
  storno:        'vb_nr_st',
  angebot:       'vb_nr_an',
  bg_abrechnung: 'vb_nr_bg',
  auszahlung:    'vb_nr_az',
  taxi_rechnung: 'vb_nr_tx',
}

const NR_PREFIXES: Record<string, string> = {
  rechnung:      'RE',
  gutschrift:    'GS',
  storno:        'ST',
  angebot:       'AN',
  bg_abrechnung: 'BG',
  auszahlung:    'AZ',
  taxi_rechnung: 'TX',
}

export function getNextDokumentNr(typ: DokumentTyp): string {
  if (typeof window === 'undefined') return `${NR_PREFIXES[typ]}-2026-001`
  const key = NR_KEYS[typ]
  const year = new Date().getFullYear()
  const yearKey = `${key}_${year}`
  const n = parseInt((typeof window !== 'undefined' ? localStorage.getItem(yearKey) : null) || '0') + 1
  if (typeof window !== 'undefined') localStorage.setItem(yearKey, String(n))
  return `${NR_PREFIXES[typ]}-${year}-${String(n).padStart(3, '0')}`
}

// ══════════════════════════════════════════════════════════════════════════════
// STANDARD-ARTIKEL
// ══════════════════════════════════════════════════════════════════════════════

function seedArtikel(): Artikel[] {
  return [
    { id: 'A1', code: 'BEW-28', bezeichnung: '24h-Betreuung 28 Tage', beschreibung: 'Vollzeit-Betreuung im Haushalt', einheit: 'Tag', preis: 80, steuersatz: 0, kategorie: 'betreuung', aktiv: true, erstelltAm: '2026-01-01' },
    { id: 'A2', code: 'BEW-14', bezeichnung: '24h-Betreuung 14 Tage', beschreibung: 'Vollzeit-Betreuung im Haushalt', einheit: 'Tag', preis: 80, steuersatz: 0, kategorie: 'betreuung', aktiv: true, erstelltAm: '2026-01-01' },
    { id: 'A3', code: 'AGT-PSC', bezeichnung: 'Agenturpauschale', beschreibung: 'Vermittlungs- und Betreuungspauschale', einheit: 'Pauschale', preis: 250, steuersatz: 20, kategorie: 'agentur', aktiv: true, erstelltAm: '2026-01-01' },
    { id: 'A4', code: 'TAXI-HIN', bezeichnung: 'Taxi Anreise', beschreibung: 'Taxikosten für Anreise der Betreuerin', einheit: 'Fahrt', preis: 45, steuersatz: 10, kategorie: 'taxi', aktiv: true, erstelltAm: '2026-01-01' },
    { id: 'A5', code: 'TAXI-RUECK', bezeichnung: 'Taxi Abreise', beschreibung: 'Taxikosten für Abreise der Betreuerin', einheit: 'Fahrt', preis: 45, steuersatz: 10, kategorie: 'taxi', aktiv: true, erstelltAm: '2026-01-01' },
    { id: 'A6', code: 'ZUSATZ', bezeichnung: 'Zusatzleistung', beschreibung: 'Sonderleistung nach Vereinbarung', einheit: 'Einheit', preis: 0, steuersatz: 20, kategorie: 'sonstiges', aktiv: true, erstelltAm: '2026-01-01' },
  ]
}

// ══════════════════════════════════════════════════════════════════════════════
// STORAGE LAYER
// ══════════════════════════════════════════════════════════════════════════════

const KEYS = {
  dokumente:  'vb_fin_dokumente',
  artikel:    'vb_fin_artikel',
  zahlungen:  'vb_fin_zahlungen',
  auszahlungen: 'vb_fin_auszahlungen',
}

function store<T>(key: string, data: T[]) {
  if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(data))
}

function load<T>(key: string, seed?: () => T[]): T[] {
  if (typeof window === 'undefined') return []
  const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null
  if (!raw && seed) {
    const initial = seed()
    if (typeof window !== 'undefined') { localStorage.setItem(key, JSON.stringify(initial)) }
    return initial
  }
  return raw ? JSON.parse(raw) : []
}

// ── Dokumente ─────────────────────────────────────────────────────────────────

export function getDokumente(): Dokument[] { return load(KEYS.dokumente) }
export function saveDokumente(list: Dokument[]) { store(KEYS.dokumente, list) }

export function createDokument(data: Omit<Dokument, 'id' | 'dokumentNr' | 'erstelltAm' | 'aktualisiertAm' | 'auditLog'>): Dokument {
  const today = new Date().toISOString().split('T')[0]
  const dok: Dokument = {
    ...data,
    id: Date.now().toString(),
    dokumentNr: getNextDokumentNr(data.typ),
    erstelltAm: today,
    aktualisiertAm: today,
    auditLog: [{ zeitpunkt: new Date().toISOString(), benutzer: 'System', aktion: `${data.typ} erstellt` }],
  }
  saveDokumente([...getDokumente(), dok])
  return dok
}

export function updateDokument(id: string, data: Partial<Dokument>, benutzer = 'System', aktion = 'Aktualisiert') {
  const list = getDokumente()
  saveDokumente(list.map(d => {
    if (d.id !== id) return d
    const logEntry: AuditLogEintrag = {
      zeitpunkt: new Date().toISOString(),
      benutzer,
      aktion,
    }
    return { ...d, ...data, aktualisiertAm: new Date().toISOString().split('T')[0], auditLog: [...(d.auditLog || []), logEntry] }
  }))
}

export function deleteDokument(id: string) {
  saveDokumente(getDokumente().filter(d => d.id !== id))
}

// ── Storno erstellen ──────────────────────────────────────────────────────────

export function createStorno(originalId: string, benutzer: string): Dokument | null {
  const list = getDokumente()
  const original = list.find(d => d.id === originalId)
  if (!original) return null

  const storno = createDokument({
    ...original,
    typ: 'storno',
    status: 'erstellt',
    bezugDokumentId: original.id,
    bezugDokumentNr: original.dokumentNr,
    stornoDokumentId: '',
    gutschriftIds: [],
    positionen: original.positionen.map(p => ({ ...p, einzelpreis: -p.einzelpreis, nettoBetrag: -p.nettoBetrag, steuerBetrag: -p.steuerBetrag, bruttoBetrag: -p.bruttoBetrag })),
    summeNetto: -original.summeNetto,
    summeSteuern: Object.fromEntries(Object.entries(original.summeSteuern).map(([k, v]) => [k, -v])),
    summeBrutto: -original.summeBrutto,
    rechnungsDatum: new Date().toISOString().split('T')[0],
    notizen: `Storno zu ${original.dokumentNr}`,
    archiviert: false,
  })

  // Original mit Storno verknüpfen
  updateDokument(originalId, { status: 'storniert', stornoDokumentId: storno.id }, benutzer, `Storniert durch ${storno.dokumentNr}`)
  return storno
}

// ── Gutschrift erstellen ──────────────────────────────────────────────────────

export function createGutschrift(originalId: string, positionen: Position[], benutzer: string): Dokument | null {
  const list = getDokumente()
  const original = list.find(d => d.id === originalId)
  if (!original) return null

  const summen = berechneDokumentSummen(positionen)
  const gutschrift = createDokument({
    ...original,
    typ: 'gutschrift',
    status: 'erstellt',
    bezugDokumentId: original.id,
    bezugDokumentNr: original.dokumentNr,
    positionen: positionen.map(p => ({ ...p, einzelpreis: -Math.abs(p.einzelpreis), nettoBetrag: -Math.abs(p.nettoBetrag), steuerBetrag: -Math.abs(p.steuerBetrag), bruttoBetrag: -Math.abs(p.bruttoBetrag) })),
    ...summen,
    summeNetto: -summen.summeNetto,
    summeBrutto: -summen.summeBrutto,
    rechnungsDatum: new Date().toISOString().split('T')[0],
    notizen: `Gutschrift zu ${original.dokumentNr}`,
    archiviert: false,
    stornoDokumentId: '',
    gutschriftIds: [],
  })

  // Original mit Gutschrift verknüpfen
  updateDokument(originalId, { gutschriftIds: [...(original.gutschriftIds || []), gutschrift.id] }, benutzer, `Gutschrift ${gutschrift.dokumentNr} erstellt`)
  return gutschrift
}

// ── Artikel ───────────────────────────────────────────────────────────────────

export function getArtikel(): Artikel[] { return load(KEYS.artikel, seedArtikel) }
export function saveArtikel(list: Artikel[]) { store(KEYS.artikel, list) }

// ── Bankzahlungen ─────────────────────────────────────────────────────────────

export function getBankZahlungen(): BankZahlung[] { return load(KEYS.zahlungen) }
export function saveBankZahlungen(list: BankZahlung[]) { store(KEYS.zahlungen, list) }

// ── Zahlungsabgleich (§10) ────────────────────────────────────────────────────

export function zahlungsabgleich(zahlung: BankZahlung): {
  match: 'eindeutig' | 'mehrere' | 'keines' | 'abweichung' | 'teilzahlung' | 'ueberzahlung'
  kandidaten: Dokument[]
  hinweis: string
} {
  const dokumente = getDokumente().filter(d =>
    d.typ === 'rechnung' &&
    d.status !== 'bezahlt' &&
    d.status !== 'storniert'
  )

  // Suche nach Rechnungsnummer im Verwendungszweck
  const byNr = dokumente.filter(d =>
    zahlung.verwendungszweck.includes(d.dokumentNr)
  )

  if (byNr.length === 1) {
    const d = byNr[0]
    const diff = Math.abs(zahlung.betrag - d.offenerBetrag)
    if (diff < 0.01) return { match: 'eindeutig', kandidaten: [d], hinweis: `Eindeutige Zuordnung zu ${d.dokumentNr}` }
    if (zahlung.betrag < d.offenerBetrag) return { match: 'teilzahlung', kandidaten: [d], hinweis: `Teilzahlung: ${zahlung.betrag} € von ${d.offenerBetrag} € offen` }
    return { match: 'ueberzahlung', kandidaten: [d], hinweis: `Überzahlung um ${(zahlung.betrag - d.offenerBetrag).toFixed(2)} €` }
  }

  if (byNr.length > 1) return { match: 'mehrere', kandidaten: byNr, hinweis: 'Mehrere passende Rechnungen gefunden' }

  // Suche nach Betrag
  const byBetrag = dokumente.filter(d => Math.abs(zahlung.betrag - d.offenerBetrag) < 0.01)
  if (byBetrag.length === 1) return { match: 'eindeutig', kandidaten: byBetrag, hinweis: `Zuordnung über Betrag ${zahlung.betrag} €` }
  if (byBetrag.length > 1) return { match: 'mehrere', kandidaten: byBetrag, hinweis: `${byBetrag.length} Rechnungen mit gleichem Betrag` }

  return { match: 'keines', kandidaten: [], hinweis: 'Keine passende Rechnung gefunden — manuelle Zuordnung nötig' }
}

// ── Auszahlungen ──────────────────────────────────────────────────────────────

export function getAuszahlungen(): BGAuszahlung[] { return load(KEYS.auszahlungen) }
export function saveAuszahlungen(list: BGAuszahlung[]) { store(KEYS.auszahlungen, list) }

export function createAuszahlung(data: Omit<BGAuszahlung, 'id' | 'exportDatum' | 'zahlungsDatum' | 'sepaXml' | 'archivDokumentId'>): BGAuszahlung {
  const az: BGAuszahlung = {
    ...data,
    id: Date.now().toString(),
    exportDatum: '',
    zahlungsDatum: '',
    sepaXml: '',
    archivDokumentId: '',
  }
  saveAuszahlungen([...getAuszahlungen(), az])
  return az
}

// ── SEPA-XML Export ───────────────────────────────────────────────────────────

export function generateSepaXml(auszahlungen: BGAuszahlung[]): string {
  const today = new Date().toISOString().split('T')[0]
  const msgId = `VBETREUT-${Date.now()}`
  const total = auszahlungen.reduce((s, a) => s + a.nettoBetrag, 0).toFixed(2)

  const transactions = auszahlungen.map(a => `
    <CdtTrfTxInf>
      <PmtId><EndToEndId>AZ-${a.id}</EndToEndId></PmtId>
      <Amt><InstdAmt Ccy="EUR">${a.nettoBetrag.toFixed(2)}</InstdAmt></Amt>
      <CdtrAgt><FinInstnId><BICFI>BKAUATWW</BICFI></FinInstnId></CdtrAgt>
      <Cdtr><Nm>${a.betreuerinName}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${a.betreuerinIban.replace(/\s/g, '')}</IBAN></Id></CdtrAcct>
      <RmtInf><Ustrd>VBetreut Auszahlung ${a.zeitraumVon} bis ${a.zeitraumBis}</Ustrd></RmtInf>
    </CdtTrfTxInf>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <NbOfTxs>${auszahlungen.length}</NbOfTxs>
      <CtrlSum>${total}</CtrlSum>
      <InitgPty><Nm>VBetreut GmbH</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-${msgId}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>${today}</ReqdExctnDt>
      <Dbtr><Nm>VBetreut GmbH</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>AT12345678901234567890</IBAN></Id></DbtrAcct>
      ${transactions}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`
}

// ── Rechnung aus Einsatz erstellen ────────────────────────────────────────────

export function createRechnungAusEinsatz(params: {
  einsatz: { id: string; klientId: string; klientName: string; klientOrt: string; betreuerinId: string; betreuerinName: string; von: string; bis: string; tagessatz: number; taxiKosten: number }
  klientEmail?: string
  versandart?: Versandart
  erstelltVon?: string
}): Dokument {
  const { einsatz, klientEmail = '', versandart = 'email', erstelltVon = 'System' } = params
  const turnus = berechneTurnusTage(einsatz.von, einsatz.bis)
  const heute = new Date().toISOString().split('T')[0]
  const zahlungsziel = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]

  const hauptPos = berechnePositionSummen({
    id: 'p1',
    artikelId: 'A1',
    bezeichnung: `24h-Betreuung ${new Date(einsatz.von).toLocaleDateString('de-AT')} – ${new Date(einsatz.bis).toLocaleDateString('de-AT')}`,
    beschreibung: turnus.detail,
    menge: turnus.tage,
    einheit: 'Tage',
    einzelpreis: einsatz.tagessatz,
    steuersatz: 0,
    manuellGeaendert: false,
  })

  const agenturPos = berechnePositionSummen({
    id: 'p2',
    artikelId: 'A3',
    bezeichnung: 'Agenturpauschale',
    beschreibung: 'Vermittlungs- und Betreuungspauschale (inkl. 20% MwSt.)',
    menge: 1,
    einheit: 'Pauschale',
    einzelpreis: 250,
    steuersatz: 20,
    manuellGeaendert: false,
  })

  const taxiPositionen: Position[] = einsatz.taxiKosten > 0 ? [
    berechnePositionSummen({
      id: 'p3',
      artikelId: 'A4',
      bezeichnung: 'Taxikosten Anreise/Abreise',
      beschreibung: 'Transport der Betreuerin',
      menge: 1,
      einheit: 'Pauschale',
      einzelpreis: einsatz.taxiKosten,
      steuersatz: 10,
      manuellGeaendert: false,
    })
  ] : []

  const positionen = [hauptPos, agenturPos, ...taxiPositionen]
  const summen = berechneDokumentSummen(positionen)

  return createDokument({
    typ: 'rechnung',
    status: 'erstellt',
    einsatzId: einsatz.id,
    klientId: einsatz.klientId,
    klientName: einsatz.klientName,
    klientAdresse: einsatz.klientOrt,
    klientEmail,
    klientEmail2: '',
    betreuerinId: einsatz.betreuerinId,
    betreuerinName: einsatz.betreuerinName,
    betreuerinIban: '',
    bezugDokumentId: '',
    bezugDokumentNr: '',
    stornoDokumentId: '',
    gutschriftIds: [],
    zeitraumVon: einsatz.von,
    zeitraumBis: einsatz.bis,
    berechneteTageLaut: turnus.tage,
    berechneteTageManuell: 0,
    positionen,
    ...summen,
    zahlungsart: 'ueberweisung',
    zahlungsziel,
    zahlungseingangAm: '',
    gezahltBetrag: 0,
    offenerBetrag: summen.summeBrutto,
    zahlungsabgleichStatus: 'offen',
    bankrReferenz: '',
    versandart,
    versendetAm: '',
    versendetAn: klientEmail ? [klientEmail] : [],
    angebotGueltigBis: '',
    angebotAngenommenAm: '',
    bgAbrechnungszeitraum: '',
    bgGrundlohnBetrag: 0,
    bgZuschlaege: 0,
    bgAbzuege: 0,
    taxiUnternehmen: '',
    taxiFahrten: [],
    notizen: '',
    internNotizen: '',
    anhangDateien: [],
    versandart2: 'intern',
    rechnungsDatum: heute,
    erstelltVon,
    archiviert: false,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// LABELS & FARBEN
// ══════════════════════════════════════════════════════════════════════════════

export const TYP_LABELS: Record<DokumentTyp, string> = {
  rechnung:      'Rechnung',
  gutschrift:    'Gutschrift',
  storno:        'Storno',
  angebot:       'Angebot',
  bg_abrechnung: 'BG-Abrechnung',
  auszahlung:    'Auszahlung',
  taxi_rechnung: 'Taxi-Rechnung',
}

export const TYP_COLORS: Record<DokumentTyp, string> = {
  rechnung:      'bg-teal-50 text-teal-700 border-teal-200',
  gutschrift:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  storno:        'bg-rose-50 text-rose-600 border-rose-200',
  angebot:       'bg-violet-50 text-violet-700 border-violet-200',
  bg_abrechnung: 'bg-amber-50 text-amber-700 border-amber-200',
  auszahlung:    'bg-sky-50 text-sky-700 border-sky-200',
  taxi_rechnung: 'bg-orange-50 text-orange-700 border-orange-200',
}

export const STATUS_LABELS: Record<DokumentStatus, string> = {
  entwurf:    'Entwurf',
  erstellt:   'Erstellt',
  versendet:  'Versendet',
  bezahlt:    'Bezahlt',
  teilbezahlt:'Teilbezahlt',
  mahnung:    'Mahnung',
  storniert:  'Storniert',
  abgelehnt:  'Abgelehnt',
  angenommen: 'Angenommen',
  abgelaufen: 'Abgelaufen',
}

export const STATUS_COLORS: Record<DokumentStatus, string> = {
  entwurf:    'bg-slate-100 text-slate-500 border-slate-200',
  erstellt:   'bg-sky-50 text-sky-700 border-sky-200',
  versendet:  'bg-blue-50 text-blue-700 border-blue-200',
  bezahlt:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  teilbezahlt:'bg-teal-50 text-teal-600 border-teal-200',
  mahnung:    'bg-rose-50 text-rose-700 border-rose-200',
  storniert:  'bg-slate-100 text-slate-400 border-slate-200',
  abgelehnt:  'bg-rose-50 text-rose-600 border-rose-200',
  angenommen: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  abgelaufen: 'bg-amber-50 text-amber-600 border-amber-200',
}

export const VERSANDART_LABELS: Record<Versandart, string> = {
  email:      'E-Mail',
  post:       'Post',
  email_post: 'E-Mail + Post',
  intern:     'Intern',
}

export const ZAHLUNGSART_LABELS: Record<Zahlungsart, string> = {
  ueberweisung: 'Banküberweisung',
  lastschrift:  'Lastschrift',
  bar:          'Barzahlung',
  sepa:         'SEPA',
}
