// src/lib/admin.ts — Firmenstammdaten & Import-Konfiguration

export interface Firmendaten {
  // Allgemein
  firmenname: string
  rechtsform: string          // GmbH, KG, Einzelunternehmen ...
  slogan: string
  gruendungsjahr: string
  // Kontakt
  strasse: string
  hausnr: string
  plz: string
  ort: string
  land: string
  telefon: string
  fax: string
  email: string
  emailBuchhaltung: string
  emailBewerbung: string
  emailRechnungenKontrolle: string  // CC bei jedem Rechnungsversand
  website: string
  // Steuer & Behörden
  uid: string                 // UID-Nummer (ATU...)
  firmenbuchnummer: string
  firmenbuchgericht: string
  wknr: string                // Wirtschaftskammernummer
  gewerbe: string             // Gewerbeschein-Bezeichnung
  behoerde: string            // Zuständige Gewerbebehörde
  // Bankverbindungen
  bankverbindungen: FirmenBank[]
  // Logos & Bilder
  logoUrl: string             // base64 oder URL
  logoName: string
  unterschriftUrl: string     // Unterschrift GF als Bild
  stempelUrl: string          // Firmenstempel
  // Rechnungs-Defaults
  rechnungsFuss: string       // Fußzeile auf Rechnungen
  zahlungsziel: number        // Standard-Zahlungsziel Tage
  mahnfrist: number
  // System
  aktualisiertAm: string
  aktualisiertVon: string
}

export interface FirmenBank {
  id: string
  bezeichnung: string         // z.B. "Hauptkonto", "Kautionskonto"
  inhaber: string
  iban: string
  bic: string
  bank: string
  hauptkonto: boolean
}

export interface ImportKonfiguration {
  id: string
  name: string
  typ: 'klienten' | 'betreuerinnen' | 'einsaetze' | 'finanzen' | 'mitarbeiter'
  format: 'csv' | 'excel' | 'json'
  spaltenmapping: SpaltenmMapping[]
  trennzeichen: ',' | ';' | '\t'
  hatKopfzeile: boolean
  encoding: 'utf-8' | 'latin1' | 'windows-1252'
  erstelltAm: string
  letzterImport: string
  importiert: number
}

export interface SpaltenmMapping {
  quelleIndex: number         // Spalten-Index in der Datei (0-basiert)
  quelleSpalte: string        // Spaltenname aus der Datei
  zielFeld: string            // Feldname im System
  zielLabel: string           // Lesbare Bezeichnung
  pflicht: boolean
  transformation?: string     // z.B. "datum_de_zu_iso", "telefon_normalisieren"
}

export interface ImportErgebnis {
  id: string
  konfigId: string
  dateiName: string
  zeitstempel: string
  gesamt: number
  importiert: number
  uebersprungen: number
  fehler: string[]
  vorschau: Record<string, string>[]
}

// ── Zielfelder pro Datentyp ────────────────────────────────────

export const IMPORT_ZIELFELDER: Record<ImportKonfiguration['typ'], { key: string; label: string; pflicht: boolean }[]> = {
  klienten: [
    { key: 'vorname', label: 'Vorname', pflicht: true },
    { key: 'nachname', label: 'Nachname', pflicht: true },
    { key: 'geburtsdatum', label: 'Geburtsdatum', pflicht: false },
    { key: 'strasse', label: 'Straße', pflicht: false },
    { key: 'plz', label: 'PLZ', pflicht: false },
    { key: 'ort', label: 'Ort', pflicht: false },
    { key: 'telefon', label: 'Telefon', pflicht: false },
    { key: 'email', label: 'E-Mail', pflicht: false },
    { key: 'pflegestufe', label: 'Pflegestufe', pflicht: false },
    { key: 'krankenkasse', label: 'Krankenkasse', pflicht: false },
    { key: 'notfallkontakt_name', label: 'Notfallkontakt Name', pflicht: false },
    { key: 'notfallkontakt_telefon', label: 'Notfallkontakt Telefon', pflicht: false },
    { key: 'arzt_name', label: 'Hausarzt Name', pflicht: false },
    { key: 'arzt_telefon', label: 'Hausarzt Telefon', pflicht: false },
    { key: 'notizen', label: 'Notizen / Bemerkungen', pflicht: false },
  ],
  betreuerinnen: [
    { key: 'vorname', label: 'Vorname', pflicht: true },
    { key: 'nachname', label: 'Nachname', pflicht: true },
    { key: 'geburtsdatum', label: 'Geburtsdatum', pflicht: false },
    { key: 'nationalitaet', label: 'Nationalität', pflicht: false },
    { key: 'svnr', label: 'Sozialversicherungsnummer', pflicht: false },
    { key: 'strasse', label: 'Straße (Heimatadresse)', pflicht: false },
    { key: 'plz', label: 'PLZ', pflicht: false },
    { key: 'ort', label: 'Ort', pflicht: false },
    { key: 'telefon', label: 'Telefon', pflicht: false },
    { key: 'email', label: 'E-Mail', pflicht: false },
    { key: 'iban', label: 'IBAN', pflicht: false },
    { key: 'sprachen', label: 'Sprachkenntnisse', pflicht: false },
    { key: 'qualifikation', label: 'Qualifikation', pflicht: false },
  ],
  einsaetze: [
    { key: 'klient_name', label: 'Klient Name', pflicht: true },
    { key: 'betreuerin_name', label: 'Betreuerin Name', pflicht: true },
    { key: 'datum_von', label: 'Von Datum', pflicht: true },
    { key: 'datum_bis', label: 'Bis Datum', pflicht: false },
    { key: 'tagessatz', label: 'Tagessatz (€)', pflicht: false },
    { key: 'status', label: 'Status', pflicht: false },
    { key: 'notizen', label: 'Notizen', pflicht: false },
  ],
  finanzen: [
    { key: 'dokumentnummer', label: 'Rechnungsnummer', pflicht: false },
    { key: 'klient_name', label: 'Klient / Empfänger', pflicht: true },
    { key: 'betrag_netto', label: 'Betrag Netto (€)', pflicht: true },
    { key: 'betrag_brutto', label: 'Betrag Brutto (€)', pflicht: false },
    { key: 'datum', label: 'Rechnungsdatum', pflicht: true },
    { key: 'faellig_am', label: 'Fälligkeitsdatum', pflicht: false },
    { key: 'bezahlt_am', label: 'Bezahlt am', pflicht: false },
    { key: 'status', label: 'Status (offen/bezahlt)', pflicht: false },
    { key: 'beschreibung', label: 'Beschreibung / Position', pflicht: false },
  ],
  mitarbeiter: [
    { key: 'vorname', label: 'Vorname', pflicht: true },
    { key: 'nachname', label: 'Nachname', pflicht: true },
    { key: 'email', label: 'E-Mail', pflicht: true },
    { key: 'telefon', label: 'Telefon', pflicht: false },
    { key: 'rolle', label: 'Rolle (gf/koordination/...)', pflicht: false },
    { key: 'eintrittsdatum', label: 'Eintrittsdatum', pflicht: false },
    { key: 'gehalt', label: 'Gehalt (€)', pflicht: false },
    { key: 'iban', label: 'IBAN', pflicht: false },
  ],
}

// ── Storage ───────────────────────────────────────────────────

const KEY_FIRMA = 'vb_firmendaten'
const KEY_IMPORT_KONFIG = 'vb_import_konfig'
const KEY_IMPORT_LOG = 'vb_import_log'

const DEFAULT_FIRMA: Firmendaten = {
  firmenname: 'VBetreut 24h-Betreuungsagentur',
  rechtsform: 'GmbH',
  slogan: 'Professionelle 24h-Betreuung mit Herz',
  gruendungsjahr: '2020',
  strasse: 'Schweizer Straße',
  hausnr: '1',
  plz: '6845',
  ort: 'Hohenems',
  land: 'Österreich',
  telefon: '+43 5576 12345',
  fax: '',
  email: 'office@vbetreut.at',
  emailBuchhaltung: 'buchhaltung@vbetreut.at',
  emailBewerbung: 'jobs@vbetreut.at',
  emailRechnungenKontrolle: 'rechnungen@vbetreut.at',
  website: 'www.vbetreut.at',
  uid: 'ATU12345678',
  firmenbuchnummer: 'FN 123456 a',
  firmenbuchgericht: 'LG Feldkirch',
  wknr: '',
  gewerbe: 'Organisation von Personenbetreuungen',
  behoerde: 'BH Dornbirn',
  bankverbindungen: [
    {
      id: 'B1', bezeichnung: 'Hauptkonto',
      inhaber: 'VBetreut GmbH', iban: 'AT12 3456 7890 1234 5678',
      bic: 'BKAUATWW', bank: 'Bank Austria', hauptkonto: true,
    },
  ],
  logoUrl: '',
  logoName: '',
  unterschriftUrl: '',
  stempelUrl: '',
  rechnungsFuss: 'VBetreut 24h-Betreuungsagentur GmbH · Schweizer Straße 1, 6845 Hohenems · ATU12345678 · FN 123456 a LG Feldkirch',
  zahlungsziel: 14,
  mahnfrist: 30,
  aktualisiertAm: new Date().toISOString().split('T')[0],
  aktualisiertVon: 'System',
}

export function getFirmendaten(): Firmendaten {
  if (typeof window === 'undefined') return DEFAULT_FIRMA
  const raw = typeof window !== 'undefined' ? localStorage.getItem(KEY_FIRMA) : null
  if (typeof window !== 'undefined') { if (!raw) { localStorage.setItem(KEY_FIRMA, JSON.stringify(DEFAULT_FIRMA)); return DEFAULT_FIRMA } }
  return { ...DEFAULT_FIRMA, ...JSON.parse(raw) }
}

export function saveFirmendaten(f: Firmendaten) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY_FIRMA, JSON.stringify(f))
}

export function getImportKonfigurationen(): ImportKonfiguration[] {
  if (typeof window === 'undefined') return []
  if (typeof window === 'undefined') return []
  return JSON.parse((typeof window !== 'undefined' ? localStorage.getItem(KEY_IMPORT_KONFIG) : null) || '[]')
}

export function saveImportKonfigurationen(k: ImportKonfiguration[]) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY_IMPORT_KONFIG, JSON.stringify(k))
}

export function getImportLog(): ImportErgebnis[] {
  if (typeof window === 'undefined') return []
  if (typeof window === 'undefined') return []
  return JSON.parse((typeof window !== 'undefined' ? localStorage.getItem(KEY_IMPORT_LOG) : null) || '[]')
}

export function addImportLog(e: ImportErgebnis) {
  const log = getImportLog()
  if (typeof window !== 'undefined') { localStorage.setItem(KEY_IMPORT_LOG, JSON.stringify([e, ...log].slice(0, 50))) }
}

// ── CSV / Excel Parser (Browser, kein Server nötig) ──────────

export function parseCSV(text: string, trennzeichen: string, hatKopfzeile: boolean): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  const split = (line: string) => {
    const result: string[] = []
    let inQuote = false
    let current = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === trennzeichen && !inQuote) { result.push(current.trim()); current = '' }
      else { current += ch }
    }
    result.push(current.trim())
    return result
  }
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = hatKopfzeile ? split(lines[0]) : lines[0].split(trennzeichen).map((_, i) => `Spalte ${i + 1}`)
  const dataLines = hatKopfzeile ? lines.slice(1) : lines
  const rows = dataLines.map(split)
  return { headers, rows }
}

export function transformWert(wert: string, transformation?: string): string {
  if (!wert || !transformation) return wert
  switch (transformation) {
    case 'datum_de_zu_iso': {
      const m = wert.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
      return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : wert
    }
    case 'datum_us_zu_iso': {
      const m = wert.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : wert
    }
    case 'telefon_normalisieren':
      return wert.replace(/[^0-9+]/g, '').replace(/^0043/, '+43').replace(/^043/, '+43')
    case 'iban_normalisieren':
      return wert.replace(/\s/g, '').toUpperCase()
    case 'betrag_normalisieren':
      return wert.replace(/[€$\s]/g, '').replace(',', '.')
    default:
      return wert
  }
}

// ══════════════════════════════════════════════════════════════
// AUSWAHLFELDER-VERWALTUNG (konfigurierbare Dropdowns)
// ══════════════════════════════════════════════════════════════

export interface AuswahlListe {
  id: string
  name: string          // Interne Kennung z.B. "zahlungsart"
  label: string         // Anzeigename z.B. "Zahlungsart"
  modul: string         // "klienten" | "betreuerinnen" | "allgemein"
  optionen: string[]
  erstelltAm: string
  aktualisiertAm: string
}

const KEY_AUSWAHL = 'vb_auswahllisten'

const DEFAULT_AUSWAHLLISTEN: AuswahlListe[] = [
  { id: 'A1', name: 'zahlungsart_klient', label: 'Zahlungsart (Klient)', modul: 'klienten', optionen: ['Banküberweisung', 'SEPA-Lastschrift', 'Dauerauftrag', 'Bar', 'Sonstiges'], erstelltAm: new Date().toISOString().split('T')[0], aktualisiertAm: new Date().toISOString().split('T')[0] },
  { id: 'A2', name: 'familienstand', label: 'Familienstand', modul: 'allgemein', optionen: ['ledig', 'verheiratet', 'geschieden', 'verwitwet', 'in eingetragener Partnerschaft', 'getrennt lebend'], erstelltAm: new Date().toISOString().split('T')[0], aktualisiertAm: new Date().toISOString().split('T')[0] },
  { id: 'A3', name: 'beziehung_kontakt', label: 'Beziehung (Kontaktperson)', modul: 'klienten', optionen: ['Sohn', 'Tochter', 'Ehepartner/in', 'Geschwister', 'Elternteil', 'Enkel/in', 'Hausarzt', 'Betreuer/in', 'Nachbar/in', 'Vertrauensperson', 'Erwachsenenvertreter/in', 'Anwalt/Anwältin', 'Sonstiges'], erstelltAm: new Date().toISOString().split('T')[0], aktualisiertAm: new Date().toISOString().split('T')[0] },
  { id: 'A4', name: 'ernaehrung', label: 'Ernährungsbesonderheiten', modul: 'klienten', optionen: ['Keine Besonderheiten', 'Weiche Kost', 'Pürierte Kost', 'Diabetiker-Kost', 'Laktosefrei', 'Glutenfrei', 'Vegetarisch', 'Vegan', 'Kein Schweinefleisch', 'Halal', 'Koscher', 'Kalorienreduziert'], erstelltAm: new Date().toISOString().split('T')[0], aktualisiertAm: new Date().toISOString().split('T')[0] },
  { id: 'A5', name: 'qualifikation_betreuerin', label: 'Qualifikation (Betreuerin)', modul: 'betreuerinnen', optionen: ['Pflegehilfe', 'Diplomierte Pflegekraft', 'Pflegefachassistenz', 'Heimhilfe', 'Erste-Hilfe-Kurs', 'Demenz-Schulung', 'Palliativpflege', 'Wundmanagement', 'Inkontinenzversorgung', 'Seniorenbetreuung'], erstelltAm: new Date().toISOString().split('T')[0], aktualisiertAm: new Date().toISOString().split('T')[0] },
  { id: 'A6', name: 'diagnosen', label: 'Häufige Diagnosen', modul: 'klienten', optionen: ['Demenz', 'Alzheimer', 'Parkinson', 'Schlaganfall', 'Herzinsuffizienz', 'Diabetes Typ 2', 'Hypertonie', 'COPD', 'Osteoporose', 'Arthrose', 'Depression', 'Inkontinenz', 'Sehbehinderung', 'Hörbehinderung'], erstelltAm: new Date().toISOString().split('T')[0], aktualisiertAm: new Date().toISOString().split('T')[0] },
  { id: 'A7', name: 'region', label: 'Regionen', modul: 'betreuerinnen', optionen: ['Vorarlberg', 'Tirol', 'Salzburg', 'Wien', 'Niederösterreich', 'Oberösterreich', 'Steiermark', 'Kärnten', 'Burgenland', 'Österreich gesamt'], erstelltAm: new Date().toISOString().split('T')[0], aktualisiertAm: new Date().toISOString().split('T')[0] },
  { id: 'A8', name: 'krankenkasse', label: 'Krankenkassen', modul: 'klienten', optionen: ['ÖGK', 'SVS (Selbstständige)', 'BVAEB (Beamte)', 'KFA Wien', 'Keine / Privat'], erstelltAm: new Date().toISOString().split('T')[0], aktualisiertAm: new Date().toISOString().split('T')[0] },
]

export function getAuswahlListen(): AuswahlListe[] {
  if (typeof window === 'undefined') return []
  const raw = typeof window !== 'undefined' ? localStorage.getItem(KEY_AUSWAHL) : null
  if (typeof window !== 'undefined') { if (!raw) { localStorage.setItem(KEY_AUSWAHL, JSON.stringify(DEFAULT_AUSWAHLLISTEN)); return DEFAULT_AUSWAHLLISTEN } }
  return JSON.parse(raw)
}

export function saveAuswahlListen(l: AuswahlListe[]) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY_AUSWAHL, JSON.stringify(l))
}

export function getAuswahlOptionen(name: string): string[] {
  const liste = getAuswahlListen().find(l => l.name === name)
  return liste?.optionen || []
}
