// src/lib/betreuerinnen.ts — Erweitertes Datenmodell mit Dokumenten, Bankdaten, Doris-Agent

export type BGStatus = 'aktiv' | 'verfuegbar' | 'im_einsatz' | 'pause' | 'inaktiv'
export type BGRolle = 'betreuerin' | 'springerin' | 'teamleitung'
export type Turnus = '14' | '28' | 'flexibel' | 'dauerhaft'
export type Deutschkenntnisse = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'Muttersprache' | 'keine'
export type DokumentKat = 'ausweis' | 'fuehrerschein' | 'reisepass' | 'vollmacht' | 'vertrag' | 'meldebestaetigung' | 'gewerbeschein' | 'sv_karte' | 'qualifikation' | 'sonstiges'

// ── Dokument-Typ ────────────────────────────────────────────────
export interface BetreuerinDokument {
  id: string
  kategorie: DokumentKat
  bezeichnung: string
  dateiName: string
  dateiBase64?: string        // kleines Bild z.B. Ausweisscan
  hochgeladenAm: string
  ablaufdatum: string
  ausgestellt: string         // Austellungsdatum
  ausstellendeBehörde: string
  dokumentNummer: string      // Passnummer, Ausweisnummer etc.
  // Aus Ausweis-Doris ausgelesen
  dorisAusgelesen: boolean
  notizen: string
  vertraulich: boolean
}

// ── Bankverbindung ───────────────────────────────────────────────
export interface BetreuerinBank {
  id: string
  inhaberName: string
  iban: string
  bic: string
  bank: string
  land: string
  hauptkonto: boolean
  verifiziert: boolean
}

// ── Qualifikation ────────────────────────────────────────────────
export interface Qualifikation {
  id: string
  bezeichnung: string
  ausstellungsdatum: string
  ablaufdatum: string
  ausstellendeStelle: string
  zertifikatNummer: string
}

// ── Einsatzhistorie ──────────────────────────────────────────────
export interface Einsatzhistorie {
  id: string
  klientId: string
  klientName: string
  ort: string
  adresse: string
  von: string
  bis: string
  status: 'aktiv' | 'beendet' | 'abgebrochen'
  tagessatz: number
  gesamtbetrag: number
  notiz: string
  bewertungKlient: number   // 1-5 Sterne vom Klienten
}

// ── Gewerbe-Check (GISA) ─────────────────────────────────────────
export interface GewerbeCheck {
  geprueftAm: string
  gisaNummer: string
  gewerbeBezeichnung: string
  status: 'aufrecht' | 'ruhend' | 'erloschen' | 'nicht_gefunden' | 'unbekannt'
  quelle: string
  naechstePruefung: string
  notizen: string
}

// ── Doris Nachricht ──────────────────────────────────────────────
export interface DorisNachricht {
  id: string
  von: 'doris' | 'user'
  text: string
  zeitstempel: string
  typ?: 'info' | 'warnung' | 'erfolg' | 'aktion'
  extraktion?: Record<string, string>   // Ausgelesene Felder
}

// ── Compliance-Checkliste ────────────────────────────────────────
export interface ComplianceItem {
  key: string
  label: string
  erfuellt: boolean
  pflicht: boolean
  hinweis: string
}

// ── Hauptobjekt Betreuerin ───────────────────────────────────────
export interface Betreuerin {
  id: string
  // Stammdaten
  vorname: string
  nachname: string
  geburtsdatum: string
  geburtsort: string
  geburtsland: string
  svnr: string
  nationalitaet: string
  staatsangehoerigkeit: string    // für Meldezettel
  familienstand: string
  religion: string
  geschlecht: 'weiblich' | 'maennlich' | 'divers' | ''
  // Aus Ausweis
  ausweisNummer: string
  ausweisAblauf: string
  passNummer: string
  passAblauf: string
  fuehrerscheinNummer: string
  fuehrerscheinKlasse: string
  fuehrerscheinAblauf: string
  fuehrerscheinAussteller: string
  // Status & Rolle
  status: BGStatus
  rolle: BGRolle
  turnus: Turnus
  verfuegbarAb: string
  aktuellerEinsatzKlient: string   // Name des aktuellen Klienten (auto)
  aktuellerEinsatzOrt: string
  aktuellerEinsatzBis: string
  // Kontakt
  telefon: string
  telefonWhatsapp: boolean
  telefonAlternativ: string
  email: string
  // Adressen
  hauptwohnsitzStrasse: string
  hauptwohnsitzPlz: string
  hauptwohnsitzOrt: string
  hauptwohnsitzLand: string
  nebenwohnsitzStrasse: string
  nebenwohnsitzPlz: string
  nebenwohnsitzOrt: string
  nebenwohnsitzLand: string
  // Österreich-Adresse (temporär, für Meldezettel)
  oesterreichStrasse: string
  oesterreichPlz: string
  oesterreichOrt: string
  // Gewerbe
  gewerbeStatus: 'aktiv' | 'nicht_angemeldet' | 'erloschen' | 'unbekannt'
  gewerbeName: string
  gisaNummer: string
  gewerbeAblauf: string
  gewerbeCheck?: GewerbeCheck
  // Qualifikationen & Skills
  deutschkenntnisse: Deutschkenntnisse
  weitereSprachenDE: string
  qualifikationen: Qualifikation[]
  fuehrerschein: boolean
  raucher: boolean
  haustierErfahrung: boolean
  demenzErfahrung: boolean
  erfahrungJahre: number
  // Dokumente
  dokumente: BetreuerinDokument[]
  // Bankverbindungen
  bankverbindungen: BetreuerinBank[]
  // Doris-Chat
  dorisChat: DorisNachricht[]
  // Einsätze
  einsaetze: Einsatzhistorie[]
  // Bewerbung / Interna
  bewerbungsdatum: string
  bewertung: string
  region: string
  zustaendig: string
  notizen: string
  internNotizen: string
  notizEintraege: any[]
  betreuerinId: string     // "B-1024" etc.
  // Meta
  erstelltAm: string
  aktualisiertAm: string
}

// ══════════════════════════════════════════════════════════════
// COMPLIANCE CHECK
// ══════════════════════════════════════════════════════════════

// Sicheres Array aus Supabase-Wert (kann String oder Array sein)
function safeArr(val: any): any[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return [] } }
  return []
}

export function getComplianceItems(b: Betreuerin): ComplianceItem[] {
  const dokumente = safeArr(b.dokumente)
  const bankverbindungen = safeArr(b.bankverbindungen)
  const qualifikationen = safeArr(b.qualifikationen)
  const today = new Date().toISOString().split('T')[0]
  const hatDok = (kat: DokumentKat) => dokumente.some((d: any) => d.kategorie === kat && !isAbgelaufen(d))
  return [
    { key: 'ausweis', label: 'Gültiger Ausweis / Reisepass', pflicht: true, erfuellt: hatDok('ausweis') || hatDok('reisepass'), hinweis: 'Ausweis oder Reisepass hochladen und Ablaufdatum prüfen' },
    { key: 'svnr', label: 'Sozialversicherungsnummer hinterlegt', pflicht: true, erfuellt: !!b.svnr, hinweis: 'SVNR in den Stammdaten eintragen' },
    { key: 'vollmacht', label: 'Vollmacht vorhanden', pflicht: true, erfuellt: hatDok('vollmacht'), hinweis: 'Vollmacht ausstellen und hier hochladen' },
    { key: 'gewerbe', label: 'Gewerbe aktiv (GISA)', pflicht: true, erfuellt: b.gewerbeStatus === 'aktiv' || b.gewerbeCheck?.status === 'aufrecht', hinweis: 'Gewerbeanmeldung prüfen oder veranlassen' },
    { key: 'meldebestaetigung', label: 'Aktuelle Meldebestätigung', pflicht: true, erfuellt: hatDok('meldebestaetigung'), hinweis: 'Meldebestätigung vom letzten Einsatz hochladen' },
    { key: 'iban', label: 'Bankverbindung hinterlegt', pflicht: true, erfuellt: bankverbindungen.length > 0, hinweis: 'IBAN für Auszahlungen eintragen' },
    { key: 'email', label: 'E-Mail-Adresse vorhanden', pflicht: true, erfuellt: !!b.email, hinweis: 'E-Mail für Dokumentenversand erforderlich' },
    { key: 'fuehrerschein', label: 'Führerschein (falls vorhanden)', pflicht: false, erfuellt: !b.fuehrerschein || hatDok('fuehrerschein'), hinweis: 'Führerschein-Kopie hochladen' },
    { key: 'sv_karte', label: 'e-card / SV-Karte', pflicht: false, erfuellt: hatDok('sv_karte'), hinweis: 'e-card kopieren und hochladen' },
    { key: 'erste_hilfe', label: 'Erste-Hilfe-Kurs aktuell', pflicht: false, erfuellt: qualifikationen.some((q: any) => q.bezeichnung?.toLowerCase().includes('erste') && (!q.ablaufdatum || q.ablaufdatum >= today)), hinweis: 'Erste-Hilfe-Kurs muss alle 2-3 Jahre erneuert werden' },
  ]
}

export function isAbgelaufen(dok: BetreuerinDokument): boolean {
  if (!dok.ablaufdatum) return false
  return dok.ablaufdatum < new Date().toISOString().split('T')[0]
}

export function laueftBaldAb(dok: BetreuerinDokument, tage = 90): boolean {
  if (!dok.ablaufdatum) return false
  const grenze = new Date(Date.now() + tage * 86400000).toISOString().split('T')[0]
  return dok.ablaufdatum <= grenze && dok.ablaufdatum >= new Date().toISOString().split('T')[0]
}

// ══════════════════════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════════════════════

const KEY = 'vb_betreuerinnen'

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }
function today() { return new Date().toISOString().split('T')[0] }

function seed(): Betreuerin[] {
  return [
    {
      id: '1', betreuerinId: 'B-1024',
      vorname: 'Mirjana', nachname: 'Licina',
      geburtsdatum: '1960-06-22', geburtsort: 'Apatin', geburtsland: 'Serbien',
      svnr: '6875 220660', nationalitaet: 'Serbien', staatsangehoerigkeit: 'Serbien',
      familienstand: 'verheiratet', religion: 'ohne Bekenntnis', geschlecht: 'weiblich',
      ausweisNummer: 'SRB-12345678', ausweisAblauf: '2028-06-21',
      passNummer: 'PS1234567', passAblauf: '2027-03-10',
      fuehrerscheinNummer: '', fuehrerscheinKlasse: '', fuehrerscheinAblauf: '', fuehrerscheinAussteller: '',
      status: 'im_einsatz', rolle: 'betreuerin', turnus: '28', verfuegbarAb: '2026-04-15',
      aktuellerEinsatzKlient: 'Irene Baumgartl', aktuellerEinsatzOrt: 'Bregenz', aktuellerEinsatzBis: '2026-03-25',
      telefon: '+381 617867485', telefonWhatsapp: true, telefonAlternativ: '',
      email: 'mirjanalicina60@gmail.com',
      hauptwohnsitzStrasse: 'Slavise Vajnera Cice 21', hauptwohnsitzPlz: '25101', hauptwohnsitzOrt: 'Sombor', hauptwohnsitzLand: 'Serbien',
      nebenwohnsitzStrasse: 'Lipburgerstraße 5 / Top 30', nebenwohnsitzPlz: '6900', nebenwohnsitzOrt: 'Bregenz', nebenwohnsitzLand: 'Österreich',
      oesterreichStrasse: 'Lipburgerstraße 5 / Top 30', oesterreichPlz: '6900', oesterreichOrt: 'Bregenz',
      gewerbeStatus: 'aktiv', gewerbeName: 'Personenbetreuung', gisaNummer: 'GISA-AT-123456', gewerbeAblauf: '',
      gewerbeCheck: { geprueftAm: today(), gisaNummer: 'GISA-AT-123456', gewerbeBezeichnung: 'Organisation von Personenbetreuungen', status: 'aufrecht', quelle: 'GISA-Abfrage (Demo)', naechstePruefung: '2026-09-27', notizen: '' },
      deutschkenntnisse: 'B1', weitereSprachenDE: 'Serbisch (Muttersprache)',
      qualifikationen: [
        { id: uid(), bezeichnung: 'Pflegehilfeausbildung', ausstellungsdatum: '2012-03-01', ablaufdatum: '', ausstellendeStelle: 'Rotes Kreuz Serbien', zertifikatNummer: 'RKS-2012-4567' },
        { id: uid(), bezeichnung: 'Erste-Hilfe-Kurs', ausstellungsdatum: '2024-06-15', ablaufdatum: '2027-06-15', ausstellendeStelle: 'Rotes Kreuz Österreich', zertifikatNummer: 'EH-2024-1122' },
      ],
      fuehrerschein: false, raucher: false, haustierErfahrung: true, demenzErfahrung: true, erfahrungJahre: 11,
      dokumente: [
        { id: uid(), kategorie: 'reisepass', bezeichnung: 'Reisepass', dateiName: 'pass_licina.pdf', hochgeladenAm: '2024-03-10', ablaufdatum: '2027-03-10', ausgestellt: '2017-03-11', ausstellendeBehörde: 'Policija Sombor', dokumentNummer: 'PS1234567', dorisAusgelesen: true, notizen: '', vertraulich: false },
        { id: uid(), kategorie: 'vollmacht', bezeichnung: 'Vollmacht WKO', dateiName: 'vollmacht_licina.pdf', hochgeladenAm: '2026-02-01', ablaufdatum: '', ausgestellt: '2026-02-01', ausstellendeBehörde: 'VBetreut', dokumentNummer: '', dorisAusgelesen: false, notizen: 'Gültig bis Widerruf', vertraulich: false },
        { id: uid(), kategorie: 'meldebestaetigung', bezeichnung: 'Meldebestätigung Bregenz', dateiName: 'melde_licina_bregenz.pdf', hochgeladenAm: '2026-02-11', ablaufdatum: '', ausgestellt: '2026-02-11', ausstellendeBehörde: 'Gemeinde Bregenz', dokumentNummer: '', dorisAusgelesen: false, notizen: '', vertraulich: false },
      ],
      bankverbindungen: [
        { id: uid(), inhaberName: 'Mirjana Licina', iban: 'RS35105008123123456789', bic: 'AIKBRS22', bank: 'AIK Banka Serbien', land: 'Serbien', hauptkonto: true, verifiziert: true },
      ],
      dorisChat: [],
      einsaetze: [
        { id: uid(), klientId: '1', klientName: 'Irene Baumgartl', ort: 'Bregenz', adresse: 'Schillerstraße 4, 6900 Bregenz', von: '2026-02-11', bis: '2026-03-25', status: 'aktiv', tagessatz: 80, gesamtbetrag: 2720, notiz: 'Sehr gute Beziehung zur Klientin', bewertungKlient: 5 },
        { id: uid(), klientId: '', klientName: 'Elisabeth Rüdisser', ort: 'Graz', adresse: 'Grazerstraße 12, 8010 Graz', von: '2025-08-01', bis: '2026-01-31', status: 'beendet', tagessatz: 80, gesamtbetrag: 13760, notiz: '', bewertungKlient: 4 },
        { id: uid(), klientId: '', klientName: 'Hans Müller', ort: 'Salzburg', adresse: 'Mozartplatz 3, 5020 Salzburg', von: '2025-01-15', bis: '2025-07-31', status: 'beendet', tagessatz: 75, gesamtbetrag: 14625, notiz: 'Kurze Unterbrechung wegen Urlaub', bewertungKlient: 4 },
      ],
      bewerbungsdatum: '2015-01-10', bewertung: '4', region: 'Vorarlberg', zustaendig: 'Stefan Wagner',
      notizen: '11 Jahre Erfahrung. Sehr zuverlässig. Bevorzugt Bregenz/Dornbirn.',
      internNotizen: 'Hat Gehaltserhöhung angesprochen — GF informiert.',
      erstelltAm: '2015-01-10', aktualisiertAm: today(),
    },
    {
      id: '2', betreuerinId: 'B-1025',
      vorname: 'Andrea', nachname: 'Leitner',
      geburtsdatum: '1975-04-18', geburtsort: 'Budapest', geburtsland: 'Ungarn',
      svnr: '7234 180475', nationalitaet: 'Ungarn', staatsangehoerigkeit: 'Ungarn',
      familienstand: 'geschieden', religion: '', geschlecht: 'weiblich',
      ausweisNummer: 'HU-87654321', ausweisAblauf: '2030-04-17',
      passNummer: '', passAblauf: '',
      fuehrerscheinNummer: 'HU-F-12345', fuehrerscheinKlasse: 'B', fuehrerscheinAblauf: '2030-04-17', fuehrerscheinAussteller: 'Budapest Közlekedési',
      status: 'im_einsatz', rolle: 'betreuerin', turnus: '28', verfuegbarAb: '2026-04-01',
      aktuellerEinsatzKlient: 'Maria Huber', aktuellerEinsatzOrt: 'Wien', aktuellerEinsatzBis: '2026-03-29',
      telefon: '+36 30 1234567', telefonWhatsapp: true, telefonAlternativ: '',
      email: 'andrea.leitner@gmail.com',
      hauptwohnsitzStrasse: 'Fő utca 12', hauptwohnsitzPlz: '1011', hauptwohnsitzOrt: 'Budapest', hauptwohnsitzLand: 'Ungarn',
      nebenwohnsitzStrasse: 'Mariahilfer Straße 44 / Top 8', nebenwohnsitzPlz: '1060', nebenwohnsitzOrt: 'Wien', nebenwohnsitzLand: 'Österreich',
      oesterreichStrasse: 'Mariahilfer Straße 44 / Top 8', oesterreichPlz: '1060', oesterreichOrt: 'Wien',
      gewerbeStatus: 'aktiv', gewerbeName: 'Personenbetreuung', gisaNummer: 'GISA-AT-789012', gewerbeAblauf: '',
      deutschkenntnisse: 'B2', weitereSprachenDE: 'Ungarisch (Muttersprache), Englisch (A2)',
      qualifikationen: [{ id: uid(), bezeichnung: 'Diplomierte Pflegekraft', ausstellungsdatum: '2003-06-01', ablaufdatum: '', ausstellendeStelle: 'Semmelweis Universität Budapest', zertifikatNummer: 'SU-2003-9876' }],
      fuehrerschein: true, raucher: false, haustierErfahrung: false, demenzErfahrung: true, erfahrungJahre: 18,
      dokumente: [
        { id: uid(), kategorie: 'ausweis', bezeichnung: 'Personalausweis', dateiName: 'pa_leitner.pdf', hochgeladenAm: '2024-05-15', ablaufdatum: '2030-04-17', ausgestellt: '2020-04-18', ausstellendeBehörde: 'Önkormányzat Budapest', dokumentNummer: 'HU-87654321', dorisAusgelesen: true, notizen: '', vertraulich: false },
        { id: uid(), kategorie: 'fuehrerschein', bezeichnung: 'Führerschein Klasse B', dateiName: 'fs_leitner.pdf', hochgeladenAm: '2024-05-15', ablaufdatum: '2030-04-17', ausgestellt: '2010-04-18', ausstellendeBehörde: 'Budapest Közlekedési', dokumentNummer: 'HU-F-12345', dorisAusgelesen: true, notizen: '', vertraulich: false },
        { id: uid(), kategorie: 'vollmacht', bezeichnung: 'Vollmacht WKO', dateiName: 'vollmacht_leitner.pdf', hochgeladenAm: '2024-05-20', ablaufdatum: '', ausgestellt: '2024-05-20', ausstellendeBehörde: 'VBetreut', dokumentNummer: '', dorisAusgelesen: false, notizen: '', vertraulich: false },
      ],
      bankverbindungen: [{ id: uid(), inhaberName: 'Andrea Leitner', iban: 'HU42117730161111101800000000', bic: 'OTPVHUHB', bank: 'OTP Bank Ungarn', land: 'Ungarn', hauptkonto: true, verifiziert: true }],
      dorisChat: [],
      einsaetze: [{ id: uid(), klientId: '2', klientName: 'Maria Huber', ort: 'Wien', adresse: 'Ringstraße 22, 1010 Wien', von: '2026-03-01', bis: '2026-03-29', status: 'aktiv', tagessatz: 80, gesamtbetrag: 2240, notiz: '', bewertungKlient: 5 }],
      bewerbungsdatum: '2020-05-15', bewertung: '5', region: 'Wien', zustaendig: 'Lisa Koller',
      notizen: 'Sehr hohe Qualifikation. Bevorzugt Wien und Umgebung.', internNotizen: '',
      erstelltAm: '2020-05-15', aktualisiertAm: today(),
    },
    {
      id: '3', betreuerinId: 'B-1026',
      vorname: 'Michaela', nachname: 'Stern',
      geburtsdatum: '1982-11-30', geburtsort: 'Timișoara', geburtsland: 'Rumänien',
      svnr: '', nationalitaet: 'Rumänien', staatsangehoerigkeit: 'Rumänien',
      familienstand: 'ledig', religion: '', geschlecht: 'weiblich',
      ausweisNummer: '', ausweisAblauf: '', passNummer: '', passAblauf: '',
      fuehrerscheinNummer: '', fuehrerscheinKlasse: '', fuehrerscheinAblauf: '', fuehrerscheinAussteller: '',
      status: 'verfuegbar', rolle: 'betreuerin', turnus: '28', verfuegbarAb: '2026-03-20',
      aktuellerEinsatzKlient: '', aktuellerEinsatzOrt: '', aktuellerEinsatzBis: '',
      telefon: '+40 722 345678', telefonWhatsapp: true, telefonAlternativ: '',
      email: 'michaela.stern@yahoo.com',
      hauptwohnsitzStrasse: 'Str. Florilor 5', hauptwohnsitzPlz: '300001', hauptwohnsitzOrt: 'Timișoara', hauptwohnsitzLand: 'Rumänien',
      nebenwohnsitzStrasse: '', nebenwohnsitzPlz: '', nebenwohnsitzOrt: '', nebenwohnsitzLand: '',
      oesterreichStrasse: '', oesterreichPlz: '', oesterreichOrt: '',
      gewerbeStatus: 'nicht_angemeldet', gewerbeName: '', gisaNummer: '', gewerbeAblauf: '',
      deutschkenntnisse: 'A2', weitereSprachenDE: 'Rumänisch (Muttersprache)',
      qualifikationen: [],
      fuehrerschein: false, raucher: false, haustierErfahrung: true, demenzErfahrung: false, erfahrungJahre: 3,
      dokumente: [],
      bankverbindungen: [],
      dorisChat: [],
      einsaetze: [],
      bewerbungsdatum: '2023-09-01', bewertung: '3', region: 'Niederösterreich', zustaendig: 'Lisa Koller',
      notizen: 'Deutschkenntnisse noch ausbaufähig. Engagiert.', internNotizen: '',
      erstelltAm: '2023-09-01', aktualisiertAm: today(),
    },
  ]
}

export function getBetreuerinnen(): Betreuerin[] {
  if (typeof window === 'undefined') return []
  const raw = (typeof window!=='undefined' ? localStorage.getItem(KEY) : null)
  if (typeof window !== 'undefined') { if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s } }
  // Merge: bestehende Einträge mit neuen Feldern ergänzen
  const list = JSON.parse(raw) as Betreuerin[]
  return list.map(b => ({
    betreuerinId: '', geschlecht: '' as const, geburtsland: '', staatsangehoerigkeit: b.nationalitaet || '',
    ausweisNummer: '', ausweisAblauf: '', passNummer: '', passAblauf: '',
    fuehrerscheinNummer: '', fuehrerscheinKlasse: '', fuehrerscheinAblauf: '', fuehrerscheinAussteller: '',
    aktuellerEinsatzKlient: '', aktuellerEinsatzOrt: '', aktuellerEinsatzBis: '',
    telefonAlternativ: '', nebenwohnsitzLand: '', oesterreichStrasse: '', oesterreichPlz: '', oesterreichOrt: '',
    gewerbeStatus: 'unbekannt' as const, gewerbeName: '', gisaNummer: '', gewerbeAblauf: '',
    dokumente: [], bankverbindungen: [], dorisChat: [], internNotizen: '', notizEintraege: [], erfahrungJahre: 0,
    ...b,
    einsaetze: (b.einsaetze || []).map((e: any) => ({ id: uid(), adresse: '', tagessatz: 0, gesamtbetrag: 0, bewertungKlient: 0, ...e })),
    qualifikationen: (b.qualifikationen || []).map((q: any) => ({ id: uid(), ausstellendeStelle: '', zertifikatNummer: '', ...q })),
  }))
}

export function saveBetreuerinnen(list: Betreuerin[]) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list))
}

export function addBetreuerin(b: Omit<Betreuerin, 'id' | 'erstelltAm' | 'aktualisiertAm'>): Betreuerin {
  const list = getBetreuerinnen()
  const lastId = list.reduce((max, x) => {
    const n = parseInt(x.betreuerinId?.replace('B-', '') || '1023')
    return n > max ? n : max
  }, 1023)
  const neu: Betreuerin = { ...b, id: uid(), betreuerinId: `B-${lastId + 1}`, erstelltAm: today(), aktualisiertAm: today() }
  saveBetreuerinnen([...list, neu])
  return neu
}

export function updateBetreuerin(id: string, data: Partial<Betreuerin>) {
  saveBetreuerinnen(getBetreuerinnen().map(b => b.id === id ? { ...b, ...data, aktualisiertAm: today() } : b))
}

export function deleteBetreuerin(id: string) {
  saveBetreuerinnen(getBetreuerinnen().filter(b => b.id !== id))
}

// ══════════════════════════════════════════════════════════════
// LABELS & FARBEN
// ══════════════════════════════════════════════════════════════

export const STATUS_LABELS: Record<BGStatus, string> = {
  aktiv: 'Aktiv', verfuegbar: 'Verfügbar', im_einsatz: 'Im Einsatz', pause: 'Pause', inaktiv: 'Inaktiv',
}
export const STATUS_COLORS: Record<BGStatus, string> = {
  aktiv: 'bg-teal-50 text-teal-700 border-teal-200',
  verfuegbar: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  im_einsatz: 'bg-sky-50 text-sky-700 border-sky-200',
  pause: 'bg-amber-50 text-amber-700 border-amber-200',
  inaktiv: 'bg-slate-100 text-slate-500 border-slate-200',
}
export const ROLLE_LABELS: Record<BGRolle, string> = { betreuerin: 'Betreuerin', springerin: 'Springerin', teamleitung: 'Teamleitung' }
export const TURNUS_LABELS: Record<Turnus, string> = { '14': '14 Tage', '28': '28 Tage', 'flexibel': 'Flexibel', 'dauerhaft': 'Dauerhaft' }
export const DEUTSCH_LABELS: Record<Deutschkenntnisse, string> = {
  'keine': 'Keine', 'A1': 'A1 – Anfänger', 'A2': 'A2 – Grundlagen',
  'B1': 'B1 – Mittelstufe', 'B2': 'B2 – Gute Kenntnisse', 'C1': 'C1 – Sehr gut', 'Muttersprache': 'Muttersprache',
}
export const DOK_KAT_LABELS: Record<DokumentKat, string> = {
  ausweis: 'Personalausweis', fuehrerschein: 'Führerschein', reisepass: 'Reisepass',
  vollmacht: 'Vollmacht', vertrag: 'Vertrag', meldebestaetigung: 'Meldebestätigung',
  gewerbeschein: 'Gewerbeschein', sv_karte: 'e-card / SV-Karte',
  qualifikation: 'Qualifikationszertifikat', sonstiges: 'Sonstiges',
}
export const DOK_KAT_ICONS: Record<DokumentKat, string> = {
  ausweis: '🪪', fuehrerschein: '🚗', reisepass: '📘', vollmacht: '✍️', vertrag: '📝',
  meldebestaetigung: '🏛️', gewerbeschein: '🏢', sv_karte: '💳', qualifikation: '🎓', sonstiges: '📁',
}
export const GEWERBE_COLORS: Record<string, string> = {
  aufrecht: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  aktiv: 'bg-emerald-50 text-emerald-700 border-emerald-200',   // legacy
  nicht_angemeldet: 'bg-rose-50 text-rose-700 border-rose-200',
  erloschen: 'bg-rose-100 text-rose-800 border-rose-300',
  unbekannt: 'bg-slate-100 text-slate-500 border-slate-200',
}
