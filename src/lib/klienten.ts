// src/lib/klienten.ts

export type Pflegestufe = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'
export type Status = 'aktiv' | 'interessent' | 'pausiert' | 'beendet' | 'verstorben'
export type Foerderung = 'aktiv' | 'beantragt' | 'keine'
export type KlientDokKat = 'ausweis' | 'foerderbescheid' | 'pflegegutachten' | 'arztbrief' | 'vollmacht' | 'vertrag' | 'meldebestaetigung' | 'versicherung' | 'rezept' | 'sonstiges'

export interface Kontakt {
  id: string
  name: string
  beziehung: string
  telefon: string
  email: string
  adresse: string
  hauptkontakt: boolean
  notizen: string
}

export interface KlientDokument {
  id: string
  kategorie: KlientDokKat
  bezeichnung: string
  dateiName: string
  dateiBase64?: string
  hochgeladenAm: string
  ablaufdatum: string
  ausgestellt: string
  ausstellendeBehörde: string
  dokumentNummer: string
  notizen: string
  vertraulich: boolean
}

export interface BetreuungsEinsatz {
  id: string
  betreuerinId: string
  betreuerinName: string
  von: string
  bis: string
  status: 'aktiv' | 'beendet' | 'geplant'
  tagessatz: number
  notiz: string
  bewertung: number   // 1-5 Sterne für Betreuerin
}

export interface Diagnose {
  bezeichnung: string
  seit: string
  schweregrad: 'leicht' | 'mittel' | 'schwer' | ''
}

export type FoerderTyp = 'bundesfoerderung' | 'landesfoerderung' | 'haertefall' | 'gemeinde' | 'sonstiges'
export type FoerderStatus = 'geplant' | 'beantragt' | 'genehmigt' | 'abgelehnt' | 'auslaufend' | 'erneuert'

export interface FoerderEintrag {
  id: string
  typ: FoerderTyp
  bezeichnung: string           // z.B. "Pflegegeld Stufe 6", "Vbg. Betreuungsgeld"
  status: FoerderStatus
  // Beantragung
  beantragungGeplantAm: string  // Wann soll/sollte eingereicht werden
  beantragungEingereichtAm: string
  beantragungBei: string        // Behörde / Stelle
  antragNummer: string
  // Bescheid
  genehmigungAm: string
  bescheidNummer: string
  // Betrag & Laufzeit
  betragMonatlich: number
  gueltigAb: string
  gueltigBis: string            // leer = unbefristet
  jaehrlichErneuerung: boolean  // → Erinnerung erzeugen
  naechsteErneuerungAm: string
  // Erinnerung
  erinnerungTageVorher: number  // Standard 60 Tage
  erinnerungAn: string          // Zuständiger Mitarbeiter
  erinnerungVersendetAm: string
  // Leselotte
  ausLeselottes: boolean        // Automatisch ausgelesen
  dokDateiName: string
  // Notizen
  notizen: string
}

export interface Klient {
  id: string
  klientNr: string           // K-1001 etc.
  // Stammdaten
  vorname: string
  nachname: string
  geburtsdatum: string
  geburtsort: string
  svnr: string
  geschlecht: 'weiblich' | 'maennlich' | 'divers' | ''
  nationalitaet: string
  familienstand: string
  religion: string
  // Status & Förderung
  status: Status
  pflegestufe: Pflegestufe
  foerderung: Foerderung
  foerderungBis: string
  foerderungBetrag: number
  verstorbenAm: string
  betreuungBeginn: string
  betreuungEnde: string
  // Kontakt & Adresse
  telefon: string
  telefonWhatsapp: boolean
  telefonAlternativ: string
  email: string
  strasse: string
  plz: string
  ort: string
  land: string
  stockwerk: string
  türcode: string             // Türcode / Schlüssel
  // Aktueller Turnus
  aktuellerTurnus: '14' | '28' | 'flexibel' | 'dauerhaft' | ''
  aktuelleBetreuerin: string
  aktuellerEinsatzBis: string
  naechsterWechsel: string
  // Medizinisches
  hausarzt: string
  hausarztTelefon: string
  krankenhaus: string
  krankenkasse: string
  krankenkasseNr: string
  diagnosen: Diagnose[]
  medikamente: string        // Freitext Liste
  allergien: string
  besonderheiten: string
  mobilitaet: 'selbstständig' | 'mit_hilfe' | 'rollstuhl' | 'bettlaegerig' | ''
  ernaehrung: string
  // Haushalt
  raucher: boolean
  haustiere: boolean
  haustierArt: string
  wohnungsschluessel: string  // Wo liegt der Schlüssel
  internetWlan: string
  // Angehörige & Kontakte
  kontakte: Kontakt[]
  // Dokumente
  dokumente: KlientDokument[]
  // Einsatz-Historie
  einsaetze: BetreuungsEinsatz[]
  // Finanzen — Angebot & Tagessätze
  angebotNummer: string
  angebotDatum: string
  angebotStatus: 'entwurf' | 'gesendet' | 'angenommen' | 'abgelehnt' | ''
  angebotAngenommenAm: string
  // Standard-Tagessätze (gelten für alle Betreuerinnen bei diesem Klienten)
  tagessatzStandard: number        // Normaler 24h-Tagessatz
  tagessatzWochenende: number      // Wochenende-Zuschlag
  tagessatzFeiertag: number        // Feiertags-Zuschlag
  agenturpauschale: number         // Monatliche Agenturpauschale
  taxiHin: number                  // Taxi Anreise
  taxiRueck: number                // Taxi Abreise
  // Zahlung
  monatlicheBeitrag: number
  zahlungsart: string
  zahlungsziel: number             // Tage
  iban: string
  bic: string
  zahlungshinweis: string
  // Interna
  zustaendig: string
  notizen: string
  internNotizen: string
  notizEintraege: any[]
  wiedervorlage: string       // Datum für Wiedervorlage
  // Förderungen (strukturiert)
  foerderungen: FoerderEintrag[]
  // Meta
  erstelltAm: string
  aktualisiertAm: string
  erstelltVon: string
}

// ══════════════════════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════════════════════

const KEY = 'vb_klienten'
const today = () => new Date().toISOString().split('T')[0]
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

function seed(): Klient[] {
  return [
    {
      id: '1', klientNr: 'K-1001',
      vorname: 'Irene', nachname: 'Baumgartl',
      geburtsdatum: '1938-06-24', geburtsort: 'Bregenz', svnr: '1234 240638',
      geschlecht: 'weiblich', nationalitaet: 'Österreich', familienstand: 'verwitwet', religion: 'römisch-katholisch',
      status: 'aktiv', pflegestufe: '6', foerderung: 'aktiv', foerderungBis: '2026-12-31', foerderungBetrag: 1688,
      telefon: '+43 176 84404340', telefonWhatsapp: false, telefonAlternativ: '',
      email: '', strasse: 'Lipburgerstraße 5 / Top 30', plz: '6900', ort: 'Bregenz', land: 'Österreich',
      stockwerk: '1. Stock, Lift', türcode: '4721', aktuellerTurnus: '28',
      aktuelleBetreuerin: 'Mirjana Licina', aktuellerEinsatzBis: '2026-03-25', naechsterWechsel: '2026-03-25',
      hausarzt: 'Dr. Muxel', hausarztTelefon: '+43 5574 12345', krankenhaus: 'LKH Bregenz',
      krankenkasse: 'ÖGK', krankenkasseNr: '1234240638',
      diagnosen: [
        { bezeichnung: 'Demenz (mittelschwer)', seit: '2022-01-01', schweregrad: 'mittel' },
        { bezeichnung: 'Hypertonie', seit: '2015-06-01', schweregrad: 'leicht' },
        { bezeichnung: 'Diabetes Typ 2', seit: '2018-03-01', schweregrad: 'mittel' },
      ],
      medikamente: 'Ramipril 5mg (morgens)\nMetformin 500mg (zu den Mahlzeiten)\nDonepezil 10mg (abends)',
      allergien: 'Penicillin (Ausschlag)', besonderheiten: 'Vormittags am besten erreichbar. Liebt Kaffee und Kuchen.',
      mobilitaet: 'mit_hilfe', ernaehrung: 'Weiche Kost, kein Schweinefleisch',
      raucher: false, haustiere: false, haustierArt: '',
      wohnungsschluessel: 'Schlüssel hängt beim Nachbarn Wohnung 28',
      internetWlan: 'Netzwerk: Baumgartl, Passwort: Irene1938',
      kontakte: [
        { id: uid(), name: 'Peter Baumgartl', beziehung: 'Sohn', telefon: '+43 699 1234567', email: 'baumpet@web.de', adresse: 'Kirchgasse 4, 6900 Bregenz', hauptkontakt: true, notizen: 'Bevollmächtigter, entscheidet bei med. Fragen' },
        { id: uid(), name: 'Dr. Muxel', beziehung: 'Hausarzt', telefon: '+43 5574 12345', email: '', adresse: 'Römerstraße 10, 6900 Bregenz', hauptkontakt: false, notizen: 'Praxis Di/Do 8-12 Uhr' },
      ],
      dokumente: [
        { id: uid(), kategorie: 'foerderbescheid', bezeichnung: 'Pflegegeld Bescheid 2025', dateiName: 'foerderbescheid_2025.pdf', hochgeladenAm: '2025-01-15', ablaufdatum: '2026-12-31', ausgestellt: '2025-01-10', ausstellendeBehörde: 'BMSGPK', dokumentNummer: 'PG-2025-4521', notizen: '', vertraulich: false },
        { id: uid(), kategorie: 'pflegegutachten', bezeichnung: 'Pflegegutachten Pflegestufe 6', dateiName: 'gutachten_2024.pdf', hochgeladenAm: '2024-06-01', ablaufdatum: '', ausgestellt: '2024-05-28', ausstellendeBehörde: 'MDK Wien', dokumentNummer: '', notizen: '', vertraulich: false },
        { id: uid(), kategorie: 'vollmacht', bezeichnung: 'Vollmacht Peter Baumgartl', dateiName: 'vollmacht_baumgartl.pdf', hochgeladenAm: '2024-01-15', ablaufdatum: '', ausgestellt: '2024-01-10', ausstellendeBehörde: 'Notar Mayer', dokumentNummer: '', notizen: 'Gültig bis Widerruf', vertraulich: false },
      ],
      einsaetze: [
        { id: uid(), betreuerinId: '1', betreuerinName: 'Mirjana Licina', von: '2026-02-11', bis: '2026-03-25', status: 'aktiv', tagessatz: 80, notiz: 'Sehr gute Beziehung', bewertung: 5 },
        { id: uid(), betreuerinId: '2', betreuerinName: 'Andrea Leitner', von: '2025-08-01', bis: '2026-02-10', status: 'beendet', tagessatz: 80, notiz: '', bewertung: 4 },
      ],
      monatlicheBeitrag: 2500, zahlungsart: 'Banküberweisung',
      angebotNummer: 'AN-2026-001', angebotDatum: '2024-01-10', angebotStatus: 'angenommen', angebotAngenommenAm: '2024-01-14',
      tagessatzStandard: 80, tagessatzWochenende: 80, tagessatzFeiertag: 90,
      agenturpauschale: 250, taxiHin: 45, taxiRueck: 45,
      zahlungsziel: 14, iban: '', bic: '', zahlungshinweis: '',
      foerderungen: [
        { id: uid(), typ: 'bundesfoerderung', bezeichnung: 'Bundespflegegeld Stufe 6', status: 'genehmigt', beantragungGeplantAm: '', beantragungEingereichtAm: '2024-01-05', beantragungBei: 'BMSGPK / PVA', antragNummer: 'PVA-2024-44321', genehmigungAm: '2024-01-15', bescheidNummer: 'PG-2025-4521', betragMonatlich: 1568.90, gueltigAb: '2024-02-01', gueltigBis: '', jaehrlichErneuerung: false, naechsteErneuerungAm: '', erinnerungTageVorher: 60, erinnerungAn: 'Stefan Wagner', erinnerungVersendetAm: '', ausLeselottes: false, dokDateiName: 'foerderbescheid_2025.pdf', notizen: '' },
        { id: uid(), typ: 'landesfoerderung', bezeichnung: 'Vbg. Betreuungsgeld (LFI)', status: 'genehmigt', beantragungGeplantAm: '', beantragungEingereichtAm: '2025-01-10', beantragungBei: 'Land Vorarlberg – BLDS', antragNummer: 'VBG-LFI-2025-882', genehmigungAm: '2025-02-03', bescheidNummer: 'LFI-2025-882', betragMonatlich: 550, gueltigAb: '2025-02-01', gueltigBis: '2025-12-31', jaehrlichErneuerung: true, naechsteErneuerungAm: '2025-11-01', erinnerungTageVorher: 60, erinnerungAn: 'Stefan Wagner', erinnerungVersendetAm: '', ausLeselottes: false, dokDateiName: '', notizen: 'Jährlich bis 1. Nov neu einreichen!' },
      ],
      zustaendig: 'Stefan Wagner', notizen: 'Förderbescheid zur Verlängerung erhalten.',
      internNotizen: 'Familie sehr kooperativ. Sohn regelmäßig erreichbar.',
      wiedervorlage: '2026-06-01',
      erstelltAm: '2024-01-15', aktualisiertAm: today(), erstelltVon: 'Stefan Wagner',
    },
    {
      id: '2', klientNr: 'K-1002',
      vorname: 'Maria', nachname: 'Huber',
      geburtsdatum: '1945-09-11', geburtsort: 'Wien', svnr: '2345 110945',
      geschlecht: 'weiblich', nationalitaet: 'Österreich', familienstand: 'geschieden', religion: '',
      status: 'aktiv', pflegestufe: '4', foerderung: 'beantragt', foerderungBis: '', foerderungBetrag: 0,
      telefon: '+43 699 1111111', telefonWhatsapp: true, telefonAlternativ: '',
      email: '', strasse: 'Mariahilfer Straße 18', plz: '1060', ort: 'Wien', land: 'Österreich',
      stockwerk: '2. Stock, kein Lift', türcode: '', aktuellerTurnus: '28',
      aktuelleBetreuerin: 'Andrea Leitner', aktuellerEinsatzBis: '2026-03-29', naechsterWechsel: '2026-03-29',
      hausarzt: 'Dr. Weiss', hausarztTelefon: '+43 1 5556677', krankenhaus: 'AKH Wien',
      krankenkasse: 'ÖGK', krankenkasseNr: '2345110945',
      diagnosen: [{ bezeichnung: 'Diabetes Typ 2', seit: '2010-01-01', schweregrad: 'mittel' }],
      medikamente: 'Insulin (morgens/abends)\nMetformin 850mg (zu den Mahlzeiten)',
      allergien: '', besonderheiten: 'Diabetische Ernährung. Kein Zucker.',
      mobilitaet: 'mit_hilfe', ernaehrung: 'Diabetiker-Kost, kein Zucker',
      raucher: false, haustiere: false, haustierArt: '',
      wohnungsschluessel: 'Schlüssel bei Betreuerin',
      internetWlan: '',
      kontakte: [
        { id: uid(), name: 'Anna Huber', beziehung: 'Tochter', telefon: '+43 699 1111111', email: 'anna.huber@mail.at', adresse: 'Schönbrunner Str. 12, 1050 Wien', hauptkontakt: true, notizen: '' },
      ],
      dokumente: [],
      einsaetze: [{ id: uid(), betreuerinId: '2', betreuerinName: 'Andrea Leitner', von: '2026-03-01', bis: '2026-03-29', status: 'aktiv', tagessatz: 80, notiz: '', bewertung: 0 }],
      monatlicheBeitrag: 2200, zahlungsart: 'SEPA-Lastschrift',
      angebotNummer: 'AN-2026-002', angebotDatum: '2024-03-05', angebotStatus: 'angenommen', angebotAngenommenAm: '2024-03-09',
      tagessatzStandard: 80, tagessatzWochenende: 80, tagessatzFeiertag: 90,
      agenturpauschale: 250, taxiHin: 45, taxiRueck: 45,
      zahlungsziel: 14, iban: '', bic: '', zahlungshinweis: '',
      foerderungen: [
        { id: uid(), typ: 'bundesfoerderung', bezeichnung: 'Bundespflegegeld Stufe 4', status: 'genehmigt', beantragungGeplantAm: '', beantragungEingereichtAm: '2024-02-20', beantragungBei: 'BMSGPK / SVS', antragNummer: 'SVS-2024-11223', genehmigungAm: '2024-03-10', bescheidNummer: 'PG-2024-9876', betragMonatlich: 827.10, gueltigAb: '2024-04-01', gueltigBis: '', jaehrlichErneuerung: false, naechsteErneuerungAm: '', erinnerungTageVorher: 60, erinnerungAn: 'Lisa Koller', erinnerungVersendetAm: '', ausLeselottes: false, dokDateiName: '', notizen: '' },
        { id: uid(), typ: 'landesfoerderung', bezeichnung: 'Wiener Pflegegeld-Bonus', status: 'beantragt', beantragungGeplantAm: '', beantragungEingereichtAm: '2026-01-15', beantragungBei: 'MA 40 Wien', antragNummer: 'MA40-2026-5544', genehmigungAm: '', bescheidNummer: '', betragMonatlich: 0, gueltigAb: '', gueltigBis: '', jaehrlichErneuerung: true, naechsteErneuerungAm: '', erinnerungTageVorher: 60, erinnerungAn: 'Lisa Koller', erinnerungVersendetAm: '', ausLeselottes: false, dokDateiName: '', notizen: 'In Bearbeitung — MA40 hat Rückfragen' },
      ],
      zustaendig: 'Lisa Koller', notizen: 'Förderbescheid offen — nachreichen.',
      internNotizen: '', wiedervorlage: '2026-04-01',
      erstelltAm: '2024-03-10', aktualisiertAm: today(), erstelltVon: 'Lisa Koller',
    },
    {
      id: '3', klientNr: 'K-1003',
      vorname: 'Josef', nachname: 'Koller',
      geburtsdatum: '1961-01-05', geburtsort: 'Dornbirn', svnr: '',
      geschlecht: 'maennlich', nationalitaet: 'Österreich', familienstand: 'verheiratet', religion: '',
      status: 'interessent', pflegestufe: '0', foerderung: 'keine', foerderungBis: '', foerderungBetrag: 0,
      telefon: '+43 664 2222222', telefonWhatsapp: true, telefonAlternativ: '',
      email: 'j.koller@mail.at', strasse: 'Bahnhofstraße 3', plz: '6850', ort: 'Dornbirn', land: 'Österreich',
      stockwerk: 'EG, barrierefrei', türcode: '', aktuellerTurnus: '',
      aktuelleBetreuerin: '', aktuellerEinsatzBis: '', naechsterWechsel: '',
      hausarzt: '', hausarztTelefon: '', krankenhaus: '', krankenkasse: '', krankenkasseNr: '',
      diagnosen: [], medikamente: '', allergien: '',
      besonderheiten: 'Erstgespräch diese Woche', mobilitaet: 'selbstständig', ernaehrung: '',
      raucher: false, haustiere: false, haustierArt: '', wohnungsschluessel: '', internetWlan: '',
      kontakte: [],
      dokumente: [], einsaetze: [],
      monatlicheBeitrag: 0, zahlungsart: '',
      angebotNummer: '', angebotDatum: '', angebotStatus: '', angebotAngenommenAm: '',
      tagessatzStandard: 0, tagessatzWochenende: 0, tagessatzFeiertag: 0,
      agenturpauschale: 0, taxiHin: 0, taxiRueck: 0,
      zahlungsziel: 14, iban: '', bic: '', zahlungshinweis: '',
      foerderungen: [],
      zustaendig: 'Stefan Wagner', notizen: 'Telefonische Erstaufnahme erfolgt.', internNotizen: '', wiedervorlage: '',
      erstelltAm: '2026-03-04', aktualisiertAm: today(), erstelltVon: 'Stefan Wagner',
    },
  ]
}

export function getKlienten(): Klient[] {
  if (typeof window === 'undefined') return []
  const raw = (typeof window!=='undefined' ? localStorage.getItem(KEY) : null)
  if (typeof window !== 'undefined') { if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s } }
  // Merge: bestehende Einträge mit neuen Feldern ergänzen
  const list = JSON.parse(raw) as Klient[]
  return list.map(k => ({
    klientNr: '', geburtsort: '', geschlecht: '' as const, nationalitaet: 'Österreich',
    familienstand: '', religion: '', foerderungBis: '', foerderungBetrag: 0,
    telefonWhatsapp: false, telefonAlternativ: '', land: 'Österreich', türcode: '',
    aktuellerTurnus: '' as const, aktuelleBetreuerin: '', aktuellerEinsatzBis: '', naechsterWechsel: '',
    hausarztTelefon: '', krankenhaus: '', krankenkasse: '', krankenkasseNr: '',
    diagnosen: [], medikamente: '', allergien: '', mobilitaet: '' as const, ernaehrung: '',
    haustierArt: '', wohnungsschluessel: '', internetWlan: '', dokumente: [], einsaetze: [],
    monatlicheBeitrag: 0, zahlungsart: '', internNotizen: '', notizEintraege: [], wiedervorlage: '', erstelltVon: '',
    angebotNummer: '', angebotDatum: '', angebotStatus: '' as const, angebotAngenommenAm: '',
    tagessatzStandard: 0, tagessatzWochenende: 0, tagessatzFeiertag: 0,
    agenturpauschale: 0, taxiHin: 0, taxiRueck: 0,
    zahlungsziel: 14, iban: '', bic: '', zahlungshinweis: '',
    foerderungen: [],
    ...k,
    kontakte: (k.kontakte || []).map((c: any) => ({ id: uid(), adresse: '', hauptkontakt: false, notizen: '', ...c })),
  }))
}

export function saveKlienten(list: Klient[]) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list))
}

export function addKlient(k: Omit<Klient, 'id' | 'erstelltAm' | 'aktualisiertAm'>): Klient {
  const list = getKlienten()
  const lastNr = list.reduce((max, x) => {
    const n = parseInt(x.klientNr?.replace('K-', '') || '1000')
    return n > max ? n : max
  }, 1000)
  const neu: Klient = { ...k, id: uid(), klientNr: `K-${lastNr + 1}`, erstelltAm: today(), aktualisiertAm: today() }
  saveKlienten([...list, neu])
  return neu
}

export function updateKlient(id: string, data: Partial<Klient>) {
  saveKlienten(getKlienten().map(k => k.id === id ? { ...k, ...data, aktualisiertAm: today() } : k))
}

export function deleteKlient(id: string) {
  saveKlienten(getKlienten().filter(k => k.id !== id))
}

// ── Ablauf-Checks ─────────────────────────────────────────────

export function isDokAbgelaufen(d: KlientDokument): boolean {
  return !!d.ablaufdatum && d.ablaufdatum < today()
}
export function isDokBaldAbgelaufen(d: KlientDokument): boolean {
  if (!d.ablaufdatum) return false
  const grenze = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
  return d.ablaufdatum <= grenze && !isDokAbgelaufen(d)
}

// ── Labels & Farben ───────────────────────────────────────────

export const STATUS_LABELS: Record<Status, string> = {
  aktiv: 'Aktiv', interessent: 'Interessent', pausiert: 'Pausiert', beendet: 'Beendet', verstorben: '✝️ Verstorben',
}
export const STATUS_COLORS: Record<Status, string> = {
  aktiv: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  interessent: 'bg-sky-50 text-sky-700 border-sky-200',
  pausiert: 'bg-amber-50 text-amber-700 border-amber-200',
  beendet: 'bg-slate-100 text-slate-600 border-slate-200',
  verstorben: 'bg-slate-200 text-slate-500 border-slate-300',
}
export const FOERDERUNG_LABELS: Record<Foerderung, string> = {
  aktiv: 'Förderung aktiv', beantragt: 'In Beantragung', keine: 'Keine Förderung',
}
export const FOERDERUNG_COLORS: Record<Foerderung, string> = {
  aktiv: 'bg-teal-50 text-teal-700 border-teal-200',
  beantragt: 'bg-amber-50 text-amber-700 border-amber-200',
  keine: 'bg-slate-100 text-slate-500 border-slate-200',
}
export const TURNUS_LABELS: Record<string, string> = {
  '14': '14 Tage', '28': '28 Tage', 'flexibel': 'Flexibel', 'dauerhaft': 'Dauerhaft', '': '–',
}
export const MOBILITAET_LABELS: Record<string, string> = {
  selbstständig: 'Selbstständig', mit_hilfe: 'Mit Hilfe', rollstuhl: 'Rollstuhl', bettlaegerig: 'Bettlägerig', '': '–',
}
export const DOK_KAT_LABELS: Record<KlientDokKat, string> = {
  ausweis: 'Ausweis / Pass', foerderbescheid: 'Förderbescheid / Pflegegeld', pflegegutachten: 'Pflegegutachten',
  arztbrief: 'Arztbrief / Befund', vollmacht: 'Vollmacht', vertrag: 'Vertrag',
  meldebestaetigung: 'Meldebestätigung', versicherung: 'Versicherung', rezept: 'Rezept / Medikamente', sonstiges: 'Sonstiges',
}
export const DOK_KAT_ICONS: Record<KlientDokKat, string> = {
  ausweis: '🪪', foerderbescheid: '💶', pflegegutachten: '🏥', arztbrief: '👨‍⚕️',
  vollmacht: '✍️', vertrag: '📝', meldebestaetigung: '🏛️', versicherung: '🛡️', rezept: '💊', sonstiges: '📁',
}

// ── Förderungs-Labels ─────────────────────────────────────────

export const FOERDER_TYP_LABELS: Record<FoerderTyp, string> = {
  bundesfoerderung: 'Bundesförderung (Pflegegeld)',
  landesfoerderung: 'Landesförderung',
  haertefall: 'Härtefallfonds',
  gemeinde: 'Gemeinde / Sozialfonds',
  sonstiges: 'Sonstige Förderung',
}

export const FOERDER_TYP_ICONS: Record<FoerderTyp, string> = {
  bundesfoerderung: '🇦🇹',
  landesfoerderung: '🏛️',
  haertefall: '🆘',
  gemeinde: '🏘️',
  sonstiges: '📋',
}

export const FOERDER_STATUS_LABELS: Record<FoerderStatus, string> = {
  geplant: 'Zu beantragen',
  beantragt: 'Beantragt',
  genehmigt: 'Genehmigt',
  abgelehnt: 'Abgelehnt',
  auslaufend: 'Läuft aus',
  erneuert: 'Erneuert',
}

export const FOERDER_STATUS_COLORS: Record<FoerderStatus, string> = {
  geplant: 'bg-slate-100 text-slate-600 border-slate-300',
  beantragt: 'bg-amber-50 text-amber-700 border-amber-300',
  genehmigt: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  abgelehnt: 'bg-rose-50 text-rose-700 border-rose-300',
  auslaufend: 'bg-orange-50 text-orange-700 border-orange-300',
  erneuert: 'bg-teal-50 text-teal-700 border-teal-200',
}

// Erinnerungs-Prüfung: welche Förderungen laufen bald ab / müssen erneuert werden
export function getFoerderungWarnungen(k: Klient): { foerderung: FoerderEintrag; tage: number; typ: 'ablauf' | 'erneuerung' }[] {
  const warnungen: { foerderung: FoerderEintrag; tage: number; typ: 'ablauf' | 'erneuerung' }[] = []
  const heute = new Date().toISOString().split('T')[0]
  for (const f of k.foerderungen) {
    // Ablauf-Warnung
    if (f.gueltigBis && f.status === 'genehmigt') {
      const tage = Math.ceil((new Date(f.gueltigBis).getTime() - Date.now()) / 86400000)
      if (tage <= (f.erinnerungTageVorher || 60) && tage >= 0) {
        warnungen.push({ foerderung: f, tage, typ: 'ablauf' })
      }
      if (tage < 0) {
        warnungen.push({ foerderung: f, tage, typ: 'ablauf' })
      }
    }
    // Erneuerungs-Warnung
    if (f.jaehrlichErneuerung && f.naechsteErneuerungAm) {
      const tage = Math.ceil((new Date(f.naechsteErneuerungAm).getTime() - Date.now()) / 86400000)
      if (tage <= (f.erinnerungTageVorher || 60)) {
        warnungen.push({ foerderung: f, tage, typ: 'erneuerung' })
      }
    }
  }
  return warnungen
}
