// src/lib/mitarbeiter.ts
// Mitarbeiterverwaltung — Stammdaten, Zugriffsrechte, Dokumente

// ══════════════════════════════════════════════════════════════
// TYPEN
// ══════════════════════════════════════════════════════════════

export type MitarbeiterRolle =
  | 'gf'           // Geschäftsführung
  | 'koordination' // Koordination / Büro
  | 'buchhaltung'  // Buchhaltung
  | 'mitarbeiter'  // Allgemeiner Mitarbeiter
  | 'extern'       // Externer / Freelancer

export type MitarbeiterStatus = 'aktiv' | 'karenz' | 'gekuendigt' | 'inaktiv'

export type DokumentKategorie =
  | 'ausweis'
  | 'fuehrerschein'
  | 'vertrag'
  | 'zeugnis'
  | 'sozialversicherung'
  | 'bankdaten'
  | 'steuerdaten'
  | 'sonstiges'

// ── Zugriffsrecht pro Modul ────────────────────────────────────

export interface ModulRecht {
  modul: string
  lesen: boolean
  bearbeiten: boolean
  erstellen: boolean
  loeschen: boolean
  exportieren: boolean
  adminFunktionen: boolean  // Freigabe, Storno, GF-Aktionen
}

const ALLE_MODULE = [
  'klienten',
  'betreuerinnen',
  'einsatzplanung',
  'wechselliste',
  'finanzen',
  'dokumente',
  'mitarbeiter',
  'berichte',
]

export function defaultRechte(rolle: MitarbeiterRolle): ModulRecht[] {
  return ALLE_MODULE.map(modul => {
    switch (rolle) {
      case 'gf':
        return { modul, lesen: true, bearbeiten: true, erstellen: true, loeschen: true, exportieren: true, adminFunktionen: true }
      case 'koordination':
        return {
          modul, lesen: true, exportieren: true,
          bearbeiten: !['mitarbeiter', 'finanzen'].includes(modul),
          erstellen: !['mitarbeiter'].includes(modul),
          loeschen: false,
          adminFunktionen: false,
        }
      case 'buchhaltung':
        return {
          modul,
          lesen: ['finanzen', 'berichte', 'klienten'].includes(modul),
          bearbeiten: modul === 'finanzen',
          erstellen: modul === 'finanzen',
          loeschen: false,
          exportieren: ['finanzen', 'berichte'].includes(modul),
          adminFunktionen: false,
        }
      case 'mitarbeiter':
        return {
          modul, lesen: !['mitarbeiter', 'finanzen'].includes(modul),
          bearbeiten: false, erstellen: false, loeschen: false, exportieren: false, adminFunktionen: false,
        }
      default: // extern
        return { modul, lesen: modul === 'klienten', bearbeiten: false, erstellen: false, loeschen: false, exportieren: false, adminFunktionen: false }
    }
  })
}

// ── Mitarbeiter-Dokument ───────────────────────────────────────

export interface MitarbeiterDokument {
  id: string
  kategorie: DokumentKategorie
  bezeichnung: string
  dateiName: string
  hochgeladenAm: string
  ablaufdatum: string      // für Ausweis, Führerschein
  notizen: string
  vertraulich: boolean     // nur GF sichtbar
}

// ── Bankverbindung ─────────────────────────────────────────────

export interface Bankverbindung {
  inhaberName: string
  iban: string
  bic: string
  bank: string
  hauptkonto: boolean
}

// ── Hauptobjekt Mitarbeiter ────────────────────────────────────

export interface Mitarbeiter {
  id: string
  // Stammdaten
  vorname: string
  nachname: string
  geburtsdatum: string
  svnr: string
  nationalitaet: string
  geschlecht: 'maennlich' | 'weiblich' | 'divers' | ''
  // Kontakt
  email: string
  emailPrivat: string
  telefon: string
  telefonPrivat: string
  // Adresse
  strasse: string
  plz: string
  ort: string
  land: string
  // Beschäftigung
  status: MitarbeiterStatus
  rolle: MitarbeiterRolle
  abteilung: string
  position: string          // Berufsbezeichnung
  eintrittsdatum: string
  austrittsdatum: string
  wochenstunden: number
  urlaubstage: number
  gehalt: number
  gehaltsart: 'monatlich' | 'stuendlich' | 'pauschal'
  // Zugriffsrechte
  rechte: ModulRecht[]
  // Bankverbindungen
  bankverbindungen: Bankverbindung[]
  // Dokumente (Metadaten, kein echter Datei-Upload in dieser Version)
  dokumente: MitarbeiterDokument[]
  // Notfallkontakt
  notfallName: string
  notfallTelefon: string
  notfallBeziehung: string
  // Zugangsdaten (nur Metadaten — echtes Passwort über Auth-System)
  loginEmail: string
  loginAktiv: boolean
  letzterLogin: string
  temporaeresPw: string    // wird nach erstem Login gelöscht
  // Notizen
  notizen: string
  internNotizen: string
  // Meta
  erstelltAm: string
  aktualisiertAm: string
  erstelltVon: string
  profilBild: string       // initials-basiert
}

// ══════════════════════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════════════════════

const KEY = 'vb_mitarbeiter'

function today() { return new Date().toISOString().split('T')[0] }

function seedMitarbeiter(): Mitarbeiter[] {
  return [
    {
      id: 'M1',
      vorname: 'Stefan', nachname: 'Wagner',
      geburtsdatum: '1978-05-12', svnr: '1234 120578',
      nationalitaet: 'Österreich', geschlecht: 'maennlich',
      email: 'stefan@vbetreut.at', emailPrivat: 's.wagner@gmail.com',
      telefon: '+43 664 1234567', telefonPrivat: '',
      strasse: 'Hauptstraße 5', plz: '6900', ort: 'Bregenz', land: 'Österreich',
      status: 'aktiv', rolle: 'gf',
      abteilung: 'Geschäftsführung', position: 'Geschäftsführer',
      eintrittsdatum: '2020-01-01', austrittsdatum: '',
      wochenstunden: 40, urlaubstage: 30, gehalt: 5500, gehaltsart: 'monatlich',
      rechte: defaultRechte('gf'),
      bankverbindungen: [{ inhaberName: 'Stefan Wagner', iban: 'AT12 3456 7890 1234 5678', bic: 'BKAUATWW', bank: 'Bank Austria', hauptkonto: true }],
      dokumente: [
        { id: 'D1', kategorie: 'ausweis', bezeichnung: 'Reisepass', dateiName: 'pass_wagner.pdf', hochgeladenAm: '2024-01-15', ablaufdatum: '2029-01-14', notizen: '', vertraulich: false },
        { id: 'D2', kategorie: 'fuehrerschein', bezeichnung: 'Führerschein Klasse B', dateiName: 'fs_wagner.pdf', hochgeladenAm: '2024-01-15', ablaufdatum: '2030-05-11', notizen: '', vertraulich: false },
        { id: 'D3', kategorie: 'vertrag', bezeichnung: 'Geschäftsführervertrag', dateiName: 'gf_vertrag.pdf', hochgeladenAm: '2020-01-01', ablaufdatum: '', notizen: '', vertraulich: true },
      ],
      notfallName: 'Maria Wagner', notfallTelefon: '+43 664 9876543', notfallBeziehung: 'Ehefrau',
      loginEmail: 'stefan@vbetreut.at', loginAktiv: true, letzterLogin: today(), temporaeresPw: '',
      notizen: '', internNotizen: '',
      erstelltAm: '2020-01-01', aktualisiertAm: today(), erstelltVon: 'System', profilBild: 'SW',
    },
    {
      id: 'M2',
      vorname: 'Lisa', nachname: 'Koller',
      geburtsdatum: '1990-03-22', svnr: '5678 220390',
      nationalitaet: 'Österreich', geschlecht: 'weiblich',
      email: 'lisa@vbetreut.at', emailPrivat: 'lisa.koller@web.at',
      telefon: '+43 699 2345678', telefonPrivat: '+43 699 8765432',
      strasse: 'Kirchgasse 12', plz: '6900', ort: 'Bregenz', land: 'Österreich',
      status: 'aktiv', rolle: 'koordination',
      abteilung: 'Koordination', position: 'Teamkoordinatorin',
      eintrittsdatum: '2021-03-01', austrittsdatum: '',
      wochenstunden: 38, urlaubstage: 25, gehalt: 2800, gehaltsart: 'monatlich',
      rechte: defaultRechte('koordination'),
      bankverbindungen: [{ inhaberName: 'Lisa Koller', iban: 'AT98 7654 3210 9876 5432', bic: 'BKAUATWW', bank: 'Raiffeisenbank', hauptkonto: true }],
      dokumente: [
        { id: 'D4', kategorie: 'ausweis', bezeichnung: 'Personalausweis', dateiName: 'pa_koller.pdf', hochgeladenAm: '2021-03-01', ablaufdatum: '2028-03-21', notizen: '', vertraulich: false },
        { id: 'D5', kategorie: 'vertrag', bezeichnung: 'Dienstvertrag', dateiName: 'dv_koller.pdf', hochgeladenAm: '2021-03-01', ablaufdatum: '', notizen: '', vertraulich: true },
      ],
      notfallName: 'Thomas Koller', notfallTelefon: '+43 699 1111222', notfallBeziehung: 'Bruder',
      loginEmail: 'lisa@vbetreut.at', loginAktiv: true, letzterLogin: today(), temporaeresPw: '',
      notizen: '', internNotizen: '',
      erstelltAm: '2021-03-01', aktualisiertAm: today(), erstelltVon: 'Stefan Wagner', profilBild: 'LK',
    },
    {
      id: 'M3',
      vorname: 'Michaela', nachname: 'Stern',
      geburtsdatum: '1995-11-08', svnr: '9012 081195',
      nationalitaet: 'Österreich', geschlecht: 'weiblich',
      email: 'michaela@vbetreut.at', emailPrivat: '',
      telefon: '+43 676 3456789', telefonPrivat: '',
      strasse: 'Seestraße 3', plz: '6900', ort: 'Bregenz', land: 'Österreich',
      status: 'aktiv', rolle: 'mitarbeiter',
      abteilung: 'Büro', position: 'Büromitarbeiterin',
      eintrittsdatum: '2023-01-15', austrittsdatum: '',
      wochenstunden: 20, urlaubstage: 20, gehalt: 1400, gehaltsart: 'monatlich',
      rechte: defaultRechte('mitarbeiter'),
      bankverbindungen: [{ inhaberName: 'Michaela Stern', iban: 'AT11 2233 4455 6677 8899', bic: 'SPSKAT2B', bank: 'Sparkasse', hauptkonto: true }],
      dokumente: [
        { id: 'D6', kategorie: 'ausweis', bezeichnung: 'Personalausweis', dateiName: 'pa_stern.pdf', hochgeladenAm: '2023-01-15', ablaufdatum: '2027-11-07', notizen: '', vertraulich: false },
      ],
      notfallName: 'Gerhard Stern', notfallTelefon: '+43 676 9999888', notfallBeziehung: 'Vater',
      loginEmail: 'michaela@vbetreut.at', loginAktiv: true, letzterLogin: '', temporaeresPw: '',
      notizen: '', internNotizen: '',
      erstelltAm: '2023-01-15', aktualisiertAm: today(), erstelltVon: 'Stefan Wagner', profilBild: 'MS',
    },
  ]
}

export function getMitarbeiter(): Mitarbeiter[] {
  if (typeof window === 'undefined') return []
  const raw = (typeof window!=='undefined' ? localStorage.getItem(KEY) : null)
  if (!raw) {
    const seed = seedMitarbeiter()
    if (typeof window !== 'undefined') { localStorage.setItem(KEY, JSON.stringify(seed)) }
    return seed
  }
  return JSON.parse(raw)
}

export function saveMitarbeiter(list: Mitarbeiter[]) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list))
}

export function createMitarbeiter(data: Omit<Mitarbeiter, 'id' | 'erstelltAm' | 'aktualisiertAm'>): Mitarbeiter {
  const m: Mitarbeiter = {
    ...data,
    id: `M${Date.now()}`,
    erstelltAm: today(),
    aktualisiertAm: today(),
  }
  saveMitarbeiter([...getMitarbeiter(), m])
  return m
}

export function updateMitarbeiter(id: string, data: Partial<Mitarbeiter>) {
  saveMitarbeiter(getMitarbeiter().map(m =>
    m.id === id ? { ...m, ...data, aktualisiertAm: today() } : m
  ))
}

export function deleteMitarbeiter(id: string) {
  saveMitarbeiter(getMitarbeiter().filter(m => m.id !== id))
}

// ── Passwort-Reset Simulation ──────────────────────────────────

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── Ablaufdatum-Warnung ────────────────────────────────────────

export function getDokumentWarnungen(m: Mitarbeiter): MitarbeiterDokument[] {
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
  return m.dokumente.filter(d => d.ablaufdatum && d.ablaufdatum <= in90 && d.ablaufdatum >= today())
}

export function isAbgelaufen(dok: MitarbeiterDokument): boolean {
  return !!dok.ablaufdatum && dok.ablaufdatum < today()
}

// ══════════════════════════════════════════════════════════════
// LABELS & FARBEN
// ══════════════════════════════════════════════════════════════

export const ROLLE_LABELS: Record<MitarbeiterRolle, string> = {
  gf: 'Geschäftsführung',
  koordination: 'Koordination',
  buchhaltung: 'Buchhaltung',
  mitarbeiter: 'Mitarbeiter',
  extern: 'Extern',
}

export const ROLLE_COLORS: Record<MitarbeiterRolle, string> = {
  gf: 'bg-teal-100 text-teal-800 border-teal-300',
  koordination: 'bg-sky-100 text-sky-800 border-sky-300',
  buchhaltung: 'bg-violet-100 text-violet-800 border-violet-300',
  mitarbeiter: 'bg-slate-100 text-slate-700 border-slate-300',
  extern: 'bg-amber-100 text-amber-800 border-amber-300',
}

export const STATUS_LABELS: Record<MitarbeiterStatus, string> = {
  aktiv: 'Aktiv',
  karenz: 'Karenz',
  gekuendigt: 'Gekündigt',
  inaktiv: 'Inaktiv',
}

export const STATUS_COLORS: Record<MitarbeiterStatus, string> = {
  aktiv: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  karenz: 'bg-amber-50 text-amber-700 border-amber-200',
  gekuendigt: 'bg-rose-50 text-rose-600 border-rose-200',
  inaktiv: 'bg-slate-100 text-slate-500 border-slate-200',
}

export const DOK_KAT_LABELS: Record<DokumentKategorie, string> = {
  ausweis: 'Ausweis / Pass',
  fuehrerschein: 'Führerschein',
  vertrag: 'Vertrag',
  zeugnis: 'Zeugnis / Zertifikat',
  sozialversicherung: 'Sozialversicherung',
  bankdaten: 'Bankdaten',
  steuerdaten: 'Steuerdaten',
  sonstiges: 'Sonstiges',
}

export const DOK_KAT_ICONS: Record<DokumentKategorie, string> = {
  ausweis: '🪪',
  fuehrerschein: '🚗',
  vertrag: '📝',
  zeugnis: '🎓',
  sozialversicherung: '🏥',
  bankdaten: '🏦',
  steuerdaten: '📊',
  sonstiges: '📁',
}

export const MODUL_LABELS: Record<string, string> = {
  klienten: 'Klient:innen',
  betreuerinnen: 'Betreuerinnen',
  einsatzplanung: 'Einsatzplanung',
  wechselliste: 'Wechselliste',
  finanzen: 'Finanzen',
  dokumente: 'Dokumente',
  mitarbeiter: 'Mitarbeiter',
  berichte: 'Berichte',
}
