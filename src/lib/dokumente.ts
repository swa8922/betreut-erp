// src/lib/dokumente.ts — Akten-Alfred Dokumentensystem

export type VorlageTyp = 'betreuungsvertrag' | 'vermittlungsvertrag' | 'organisationsvertrag' | 'vollmacht' | 'meldezettel' | 'rechnung' | 'rechnung_klient' | 'honorarnote' | 'email' | 'sonstige'
export type VorlageStatus = 'aktiv' | 'entwurf' | 'archiviert'
export type DokumentStatus = 'entwurf' | 'bereit' | 'unterschrieben' | 'archiviert' | 'storniert'
export type VersandArt = 'email' | 'post' | 'buero' | 'ausdruck'
export type FallTyp = 'erstanreise' | 'wechsel' | 'verlaengerung' | 'beendigung' | 'sonstig'

export interface VorlageFeld {
  key: string; label: string; typ: 'text' | 'datum' | 'auswahl' | 'textarea'
  optionen?: string[]; pflicht: boolean; alfred_tipp?: string
}

export interface Vorlage {
  id: string; name: string; typ: VorlageTyp; status: VorlageStatus
  beschreibung: string; inhalt: string; felder: VorlageFeld[]
  versandBetreuerin: VersandArt | ''; versandKunde: VersandArt | ''
  freigebenErforderlich: boolean; ausdruckErforderlich: boolean
  erstelltAm: string; aktualisiertAm: string; dateiOriginal?: string
  // Upload-Felder
  dateiBase64?: string          // hochgeladene Original-Datei (Word/PDF)
  dateiTyp?: string             // 'docx' | 'pdf' | 'txt'
  dateiMediaType?: string       // MIME-Type
  importierterText?: string     // extrahierter Text (für Suche + Bearbeitung)
  importierterHtml?: string     // HTML-Darstellung
}

export interface DokumentFeld { key: string; wert: string }

export interface Aufgabe {
  id: string; typ: 'email_betreuerin' | 'freigabe_klient' | 'postversand' | 'ausdruck' | 'allgemein'
  titel: string; beschreibung: string; prioritaet: 'hoch' | 'mittel' | 'niedrig'
  erledigtAm: string; faelligAm: string; zugewiesen: string; dokumentId: string
}

export interface AkteDokument {
  id: string; vorlageId: string; vorlageName: string; vorlageTyp: VorlageTyp
  klientId: string; klientName: string; betreuerinId: string; betreuerinName: string
  ausgefuellterText: string; felder: DokumentFeld[]; status: DokumentStatus
  versandBetreuerin: VersandArt | ''; versandKunde: VersandArt | ''
  freigebenErforderlich: boolean; freigegebenVon: string; freigegebenAm: string
  ausdruckErforderlich: boolean; unterschriebenAm: string; unterschriebenVon: string
  // Digitale Unterschrift
  signaturDataUrl: string        // PNG Base64 der Handunterschrift
  signaturUhrzeit: string        // HH:MM
  signaturHinweis: string        // rechtlicher Hinweis
  // Importiertes Dokument (Word/PDF)
  importierterText: string       // extrahierter Volltext
  importierterHtml: string       // HTML für Word-Dokumente
  importierteDatei: string       // Dateiname
  importiertDateiBase64: string  // Original-Datei
  importiertDateiTyp: string     // 'docx' | 'pdf' | 'txt'
  emailVersendetAm: string; emailVersendetAn: string[]; aufgaben: Aufgabe[]
  erstelltAm: string; aktualisiertAm: string; erstelltVon: string; alfredAnalyse: string
}

export interface Lernregel {
  id: string; fallTyp: FallTyp; beschreibung: string; vorlageIds: string[]
  reihenfolge: number[]; aktiv: boolean; erstelltAm: string; lernquelle: 'manuell' | 'alfred'
}

export interface AlfredNachricht {
  id: string; von: 'alfred' | 'user'; text: string; zeitstempel: string
  aktionsTyp?: 'auto' | 'vorschlag' | 'warnung' | 'info'
}

function today() { return new Date().toISOString().split('T')[0] }

// ══════════════════════════════════════════════════════════════
// ECHTE VERTRAGSVORLAGEN
// ══════════════════════════════════════════════════════════════

const BV = `BETREUUNGSVERTRAG
betreffend die „zu betreuende Person":

Name: {{klient_name}}
Anschrift: {{klient_anschrift}}
Geburtsdatum: {{klient_geburtsdatum}}     E-Mail: {{klient_email}}
Telefonnummer: {{klient_telefon}}

══════════════════════════════════════════════
1. PERSÖNLICHE DATEN DER VERTRAGSPARTNER
══════════════════════════════════════════════

1. Auftraggeber
Name: {{auftraggeber_name}}
Geburtsdatum: {{auftraggeber_geburtsdatum}}
Anschrift: {{auftraggeber_anschrift}}
Bei Vertretung – Nachweis der Vertretungsmacht: {{vertretungsnachweis}}

2. Auftragnehmer (Betreuungsunternehmen)
Firma: VBetreut 24h-Betreuungsagentur
Anschrift: {{vbetreut_anschrift}}
E-Mail: office@vbetreut.at     Telefon: {{vbetreut_telefon}}

══════════════════════════════════════════════
2. BETREUUNGSLEISTUNG
══════════════════════════════════════════════

Leistungsbeschreibung:
{{leistungsbeschreibung}}

Betreuungsbeginn: {{betreuung_von}}
Betreuungsende: {{betreuung_bis}}
Betreuungsort: {{betreuungsort}}

Betreuerin: {{betreuerin_name}}
Geburtsdatum Betreuerin: {{betreuerin_geburtsdatum}}
Nationalität: {{betreuerin_nationalitaet}}

══════════════════════════════════════════════
3. ENTGELT
══════════════════════════════════════════════

Betreuungsentgelt (monatlich): {{entgelt_monatlich}} €
Agenturpauschale: {{agentur_pauschale}} €
Fahrtkosten: {{fahrtkosten}} €
Zahlungsmodalitäten: {{zahlungsmodalitaeten}}
Fällig am: {{zahlungsziel}} des Monats

══════════════════════════════════════════════
4. VERTRAGSDAUER UND KÜNDIGUNG
══════════════════════════════════════════════

Vertragsdauer: {{vertragsdauer}}
Kündigungsfrist: {{kuendigungsfrist}} Tage

══════════════════════════════════════════════
5. SCHLUSSBESTIMMUNGEN
══════════════════════════════════════════════

Anwendbares Recht: Österreichisches Recht
Gerichtsstand: Zuständiges Gericht am Wohnsitz des Auftraggebers

═══════════════════════════════════════════════════════════════
Ort, Datum: {{ort_datum}}

_________________________________    _________________________________
Unterschrift Auftraggeber             Unterschrift Betreuungsunternehmen
{{auftraggeber_name}}                VBetreut 24h-Betreuungsagentur`

const VV = `VERMITTLUNGSVERTRAG
betreffend die zu betreuende Person:

Name: {{klient_name}}
Anschrift: {{klient_anschrift}}
Geburtsdatum: {{klient_geburtsdatum}}     E-Mail: {{klient_email}}
Telefonnummer: {{klient_telefon}}

══════════════════════════════════════════════
1. PERSÖNLICHE DATEN DER VERTRAGSPARTNER
══════════════════════════════════════════════

1. Auftraggeber
Name: {{auftraggeber_name}}
Geburtsdatum: {{auftraggeber_geburtsdatum}}
Anschrift: {{auftraggeber_anschrift}}
Bei Vertretung – Nachweis (in Kopie beilegen): {{vertretungsnachweis}}

2. Auftragnehmer – „Vermittlungsunternehmen"
Firma: VBetreut 24h-Betreuungsagentur
Anschrift: {{vbetreut_anschrift}}     Telefon: {{vbetreut_telefon}}

══════════════════════════════════════════════
2. GEGENSTAND
══════════════════════════════════════════════

Das Vermittlungsunternehmen übernimmt die Vermittlung einer geeigneten Betreuungsperson
sowie die organisatorische Unterstützung bei der Vertragsabwicklung.

Betreuerin: {{betreuerin_name}}
Betreuungszeitraum: {{betreuung_von}} bis {{betreuung_bis}}
Betreuungsort: {{betreuungsort}}

══════════════════════════════════════════════
3. VERMITTLUNGSENTGELT
══════════════════════════════════════════════

Vermittlungspauschale: {{vermittlungs_pauschale}} €
Agenturpauschale (monatlich): {{agentur_pauschale}} €
Fällig am: {{zahlungsziel}} des Monats

══════════════════════════════════════════════
4. SCHLUSSBESTIMMUNGEN
══════════════════════════════════════════════

Anwendbares Recht: Österreichisches Recht
Gerichtsstand: Zuständiges Gericht am Wohnsitz des Auftraggebers

═══════════════════════════════════════════════════════════════
Ort, Datum: {{ort_datum}}

_________________________________    _________________________________
Unterschrift Auftraggeber             Unterschrift Vermittlungsunternehmen
{{auftraggeber_name}}                VBetreut 24h-Betreuungsagentur`

const OV = `ORGANISATIONSVERTRAG

══════════════════════════════════════════════
1. PERSÖNLICHE DATEN
══════════════════════════════════════════════

1. Auftraggeber – „Betreuungsunternehmen"
Name / Firma: {{auftraggeber_firma}}
Firmenbuchnummer / Geb.datum: {{auftraggeber_firmenbuch}}
Anschrift: {{auftraggeber_anschrift}}
E-Mail: {{auftraggeber_email}}     Telefon: {{auftraggeber_telefon}}

2. Auftragnehmer – „Vermittlungsunternehmen"
Firma: VBetreut 24h-Betreuungsagentur
Anschrift: {{vbetreut_anschrift}}     Telefon: {{vbetreut_telefon}}

Ansprechpartner: {{ansprechpartner_name}}
E-Mail: {{ansprechpartner_email}}     Telefon: {{ansprechpartner_telefon}}

══════════════════════════════════════════════
2. GRUNDLAGEN
══════════════════════════════════════════════

Gegenstand ist die Vermittlung eines Betreuungsvertrages sowie die Unterstützung des
Betreuungsunternehmens bei der laufenden Vertragsabwicklung in Österreich.

══════════════════════════════════════════════
3. LEISTUNGEN
══════════════════════════════════════════════

{{leistungsbeschreibung_org}}

══════════════════════════════════════════════
4. ENTGELT
══════════════════════════════════════════════

Organisationspauschale: {{organisations_pauschale}} €
Zahlungsmodalitäten: {{zahlungsmodalitaeten}}
Fällig am: {{zahlungsziel}} des Monats

══════════════════════════════════════════════
5. SCHLUSSBESTIMMUNGEN
══════════════════════════════════════════════

Anwendbares Recht: Österreichisches Recht

═══════════════════════════════════════════════════════════════
Ort, Datum: {{ort_datum}}

_________________________________    _________________________________
Unterschrift Betreuungsunternehmen    Unterschrift Vermittlungsunternehmen
{{auftraggeber_firma}}               VBetreut 24h-Betreuungsagentur`

const VM = `VOLLMACHT

welche ich

{{vollmachtgeber_name}}, geboren {{vollmachtgeber_geburtsdatum}}

wohnhaft: {{vollmachtgeber_anschrift}}

hiermit

{{vollmachtnehmer_name}}, geboren {{vollmachtnehmer_geburtsdatum}}
wohnhaft: {{vollmachtnehmer_anschrift}}
Telefon: {{vollmachtnehmer_telefon}}

erteile und ihn/sie ermächtige, mich in allen gewerberechtlichen Belangen und Verfahren vor den
zuständigen Behörden und Körperschaften sowie in allen Belangen der Mitgliedschaft und der
Entrichtung von Umlagen zu Organisationen der gewerblichen Wirtschaft im Sinne des § 3 Abs 1
Wirtschaftskammergesetz 1998 – WKG zu vertreten.

Dies betrifft insbesondere die Gewerbeanmeldung, Gewerberücklegung, die Ruhend- und
Wiederbetriebsmeldung der Gewerbeausübung sowie die Durchführung von Standortverlegungen,
die Einrichtung einer Zusendeadresse und deren Änderung für die postalische Kommunikation
der Wirtschaftskammerorganisationen sowie die Einholung von Auskünften hinsichtlich der
Grundumlage gemäß § 123 WKG.

Der/Die Machthaber/in ist berechtigt, im Verhinderungsfall die Vollmacht auf einen anderen
Bevollmächtigten nach eigener Wahl im gleichen oder eingeschränkten Umfang zu übertragen.

Diese Vollmacht bleibt bis zum Widerruf gültig.

Gültig ab: {{vollmacht_datum_von}}     Gültig bis: {{vollmacht_datum_bis}}

═══════════════════════════════════════════════════════════════
Ort, Datum: {{ort_datum}}

_________________________________    _________________________________
Unterschrift Vollmachtgeber           Unterschrift Bevollmächtigter
{{vollmachtgeber_name}}              {{vollmachtnehmer_name}}`

const MZ = `MELDEZETTEL — Anlage A (Meldegesetz BGBl. I Nr. 173/2022)

══════════════════════════════════════════════
PERSÖNLICHE DATEN
══════════════════════════════════════════════

FAMILIENNAME: {{nachname}}
VORNAME lt. Geburtsurkunde: {{vorname}}
Familienname vor erster Eheschließung: {{geburtsname}}
Sonstiger Name (z.B. Vatersname): {{sonstiger_name}}

GEBURTSDATUM: {{geburtsdatum}}
GESCHLECHT: {{geschlecht}}

GEBURTSORT: {{geburtsort}}
STAATSANGEHÖRIGKEIT: {{staatsangehoerigkeit}}
FAMILIENSTAND: {{familienstand}}
Kirche / Religionsgesellschaft: {{religion}}

REISEDOKUMENT (bei Fremden):
Art: {{reisedokument_art}}     Nummer: {{reisedokument_nummer}}
Ausstellungsdatum: {{reisedokument_datum}}
Ausstellende Behörde, Staat: {{reisedokument_behoerde}}

══════════════════════════════════════════════
ANMELDUNG DER UNTERKUNFT IN:
══════════════════════════════════════════════

Straße / Ort: {{unterkunft_strasse}}
Haus-Nr.: {{unterkunft_hausnr}}     Stiege: {{unterkunft_stiege}}     Tür Nr.: {{unterkunft_tuer}}
PLZ: {{unterkunft_plz}}     Ortsgemeinde, Bundesland: {{unterkunft_ort}}

Ist diese Unterkunft Hauptwohnsitz? {{hauptwohnsitz}}

Wenn NEIN – Hauptwohnsitz bleibt in:
Straße: {{hauptwohnsitz_strasse}}     PLZ/Ort: {{hauptwohnsitz_ort}}

Zuzug aus dem Ausland? {{zuzug_ausland}}
Wenn JA – Staat: {{zuzug_staat}}

══════════════════════════════════════════════
UNTERKUNFTGEBER
══════════════════════════════════════════════

Name (Blockschrift): {{unterkunftgeber_name}}
Datum und Unterschrift: _______________________________

═══════════════════════════════════════════════════════════════
Datum: {{ort_datum}}

_________________________________
Unterschrift des/der Meldepflichtigen
{{vorname}} {{nachname}}`

export function seedVorlagen(): Vorlage[] {
  return [
    {
      id: 'V1', name: 'Betreuungsvertrag', typ: 'betreuungsvertrag', status: 'aktiv',
      beschreibung: 'Betreuungsvertrag zwischen Klient/Auftraggeber und VBetreut. Grundlagendokument.',
      inhalt: BV, dateiOriginal: 'Betreuungsvertrag___CLEAN_05_2025.doc',
      felder: [
        { key: 'klient_name', label: 'Name Klient', typ: 'text', pflicht: true, alfred_tipp: 'Klienten-Stammdaten' },
        { key: 'klient_anschrift', label: 'Anschrift Klient', typ: 'text', pflicht: true, alfred_tipp: 'Klienten-Stammdaten' },
        { key: 'klient_geburtsdatum', label: 'Geburtsdatum Klient', typ: 'datum', pflicht: true, alfred_tipp: 'Klienten-Stammdaten' },
        { key: 'klient_email', label: 'E-Mail Klient', typ: 'text', pflicht: false },
        { key: 'klient_telefon', label: 'Telefon Klient', typ: 'text', pflicht: false },
        { key: 'auftraggeber_name', label: 'Name Auftraggeber', typ: 'text', pflicht: true, alfred_tipp: 'Oft identisch mit Klient oder Angehöriger' },
        { key: 'auftraggeber_geburtsdatum', label: 'Geburtsdatum Auftraggeber', typ: 'datum', pflicht: true },
        { key: 'auftraggeber_anschrift', label: 'Anschrift Auftraggeber', typ: 'text', pflicht: true },
        { key: 'vertretungsnachweis', label: 'Vertretungsnachweis', typ: 'text', pflicht: false, alfred_tipp: 'Nur bei Stellvertretung' },
        { key: 'vbetreut_anschrift', label: 'VBetreut Adresse', typ: 'text', pflicht: true, alfred_tipp: 'Standard: Hohenems, Vorarlberg' },
        { key: 'vbetreut_telefon', label: 'VBetreut Telefon', typ: 'text', pflicht: true },
        { key: 'betreuerin_name', label: 'Name Betreuerin', typ: 'text', pflicht: true, alfred_tipp: 'Betreuerinnen-Stammdaten' },
        { key: 'betreuerin_geburtsdatum', label: 'Geburtsdatum Betreuerin', typ: 'datum', pflicht: false, alfred_tipp: 'Betreuerinnen-Stammdaten' },
        { key: 'betreuerin_nationalitaet', label: 'Nationalität Betreuerin', typ: 'text', pflicht: false, alfred_tipp: 'Betreuerinnen-Stammdaten' },
        { key: 'leistungsbeschreibung', label: 'Leistungsbeschreibung', typ: 'textarea', pflicht: true },
        { key: 'betreuung_von', label: 'Betreuungsbeginn', typ: 'datum', pflicht: true, alfred_tipp: 'Einsatzplanung' },
        { key: 'betreuung_bis', label: 'Betreuungsende', typ: 'datum', pflicht: false, alfred_tipp: 'Einsatzplanung' },
        { key: 'betreuungsort', label: 'Betreuungsort', typ: 'text', pflicht: true, alfred_tipp: 'Wohnadresse des Klienten' },
        { key: 'entgelt_monatlich', label: 'Betreuungsentgelt monatlich (€)', typ: 'text', pflicht: true },
        { key: 'agentur_pauschale', label: 'Agenturpauschale (€)', typ: 'text', pflicht: true },
        { key: 'fahrtkosten', label: 'Fahrtkosten (€)', typ: 'text', pflicht: false },
        { key: 'zahlungsmodalitaeten', label: 'Zahlungsmodalitäten', typ: 'text', pflicht: false },
        { key: 'zahlungsziel', label: 'Zahlungsziel (Tag)', typ: 'text', pflicht: false },
        { key: 'vertragsdauer', label: 'Vertragsdauer', typ: 'auswahl', optionen: ['unbestimmte Zeit', '1 Monat', '3 Monate', '6 Monate', '1 Jahr'], pflicht: true },
        { key: 'kuendigungsfrist', label: 'Kündigungsfrist (Tage)', typ: 'text', pflicht: false },
        { key: 'ort_datum', label: 'Ort und Datum', typ: 'text', pflicht: true, alfred_tipp: 'Hohenems, ' + new Date().toLocaleDateString('de-AT') },
      ],
      versandBetreuerin: '', versandKunde: 'ausdruck', freigebenErforderlich: false, ausdruckErforderlich: true,
      erstelltAm: today(), aktualisiertAm: today(),
    },
    {
      id: 'V2', name: 'Vermittlungsvertrag', typ: 'vermittlungsvertrag', status: 'aktiv',
      beschreibung: 'Vermittlungsvertrag zwischen Klient und VBetreut als Vermittlungsunternehmen.',
      inhalt: VV, dateiOriginal: 'Vermittlungsvertrag__CLEAN_05_2025.doc',
      felder: [
        { key: 'klient_name', label: 'Name Klient', typ: 'text', pflicht: true, alfred_tipp: 'Klienten-Stammdaten' },
        { key: 'klient_anschrift', label: 'Anschrift Klient', typ: 'text', pflicht: true },
        { key: 'klient_geburtsdatum', label: 'Geburtsdatum Klient', typ: 'datum', pflicht: true },
        { key: 'klient_email', label: 'E-Mail Klient', typ: 'text', pflicht: false },
        { key: 'klient_telefon', label: 'Telefon Klient', typ: 'text', pflicht: false },
        { key: 'auftraggeber_name', label: 'Name Auftraggeber', typ: 'text', pflicht: true },
        { key: 'auftraggeber_geburtsdatum', label: 'Geburtsdatum Auftraggeber', typ: 'datum', pflicht: true },
        { key: 'auftraggeber_anschrift', label: 'Anschrift Auftraggeber', typ: 'text', pflicht: true },
        { key: 'vertretungsnachweis', label: 'Vertretungsnachweis', typ: 'text', pflicht: false },
        { key: 'vbetreut_anschrift', label: 'VBetreut Adresse', typ: 'text', pflicht: true },
        { key: 'vbetreut_telefon', label: 'VBetreut Telefon', typ: 'text', pflicht: true },
        { key: 'betreuerin_name', label: 'Name Betreuerin', typ: 'text', pflicht: true, alfred_tipp: 'Einsatzplanung' },
        { key: 'betreuung_von', label: 'Betreuungsbeginn', typ: 'datum', pflicht: true },
        { key: 'betreuung_bis', label: 'Betreuungsende', typ: 'datum', pflicht: false },
        { key: 'betreuungsort', label: 'Betreuungsort', typ: 'text', pflicht: true },
        { key: 'vermittlungs_pauschale', label: 'Vermittlungspauschale (€)', typ: 'text', pflicht: true },
        { key: 'agentur_pauschale', label: 'Agenturpauschale monatlich (€)', typ: 'text', pflicht: true },
        { key: 'zahlungsziel', label: 'Zahlungsziel (Tag)', typ: 'text', pflicht: false },
        { key: 'ort_datum', label: 'Ort und Datum', typ: 'text', pflicht: true },
      ],
      versandBetreuerin: '', versandKunde: 'ausdruck', freigebenErforderlich: false, ausdruckErforderlich: true,
      erstelltAm: today(), aktualisiertAm: today(),
    },
    {
      id: 'V3', name: 'Organisationsvertrag', typ: 'organisationsvertrag', status: 'aktiv',
      beschreibung: 'Organisationsvertrag für laufende Zusammenarbeit mit Betreuungsunternehmen.',
      inhalt: OV, dateiOriginal: 'Organisationsvertrag__CLEAN_05_2025.doc',
      felder: [
        { key: 'auftraggeber_firma', label: 'Firma / Name Auftraggeber', typ: 'text', pflicht: true },
        { key: 'auftraggeber_firmenbuch', label: 'Firmenbuchnummer / Geb.datum', typ: 'text', pflicht: false },
        { key: 'auftraggeber_anschrift', label: 'Anschrift Auftraggeber', typ: 'text', pflicht: true },
        { key: 'auftraggeber_email', label: 'E-Mail Auftraggeber', typ: 'text', pflicht: false },
        { key: 'auftraggeber_telefon', label: 'Telefon Auftraggeber', typ: 'text', pflicht: false },
        { key: 'vbetreut_anschrift', label: 'VBetreut Adresse', typ: 'text', pflicht: true },
        { key: 'vbetreut_telefon', label: 'VBetreut Telefon', typ: 'text', pflicht: true },
        { key: 'ansprechpartner_name', label: 'Ansprechpartner VBetreut', typ: 'text', pflicht: true },
        { key: 'ansprechpartner_email', label: 'Ansprechpartner E-Mail', typ: 'text', pflicht: true },
        { key: 'ansprechpartner_telefon', label: 'Ansprechpartner Telefon', typ: 'text', pflicht: true },
        { key: 'leistungsbeschreibung_org', label: 'Leistungsbeschreibung', typ: 'textarea', pflicht: true },
        { key: 'organisations_pauschale', label: 'Organisationspauschale (€)', typ: 'text', pflicht: true },
        { key: 'zahlungsmodalitaeten', label: 'Zahlungsmodalitäten', typ: 'text', pflicht: false },
        { key: 'zahlungsziel', label: 'Zahlungsziel (Tag)', typ: 'text', pflicht: false },
        { key: 'ort_datum', label: 'Ort und Datum', typ: 'text', pflicht: true },
      ],
      versandBetreuerin: '', versandKunde: 'post', freigebenErforderlich: true, ausdruckErforderlich: true,
      erstelltAm: today(), aktualisiertAm: today(),
    },
    {
      id: 'V4', name: 'Vollmacht', typ: 'vollmacht', status: 'aktiv',
      beschreibung: 'Vollmacht für gewerberechtliche Vertretung durch VBetreut (WKG).',
      inhalt: VM, dateiOriginal: 'Vollmacht_DE.docx',
      felder: [
        { key: 'vollmachtgeber_name', label: 'Name Vollmachtgeber (Betreuerin)', typ: 'text', pflicht: true, alfred_tipp: 'Betreuerinnen-Stammdaten' },
        { key: 'vollmachtgeber_geburtsdatum', label: 'Geburtsdatum Vollmachtgeber', typ: 'datum', pflicht: true, alfred_tipp: 'Betreuerinnen-Stammdaten' },
        { key: 'vollmachtgeber_anschrift', label: 'Heimatadresse Vollmachtgeber', typ: 'text', pflicht: true, alfred_tipp: 'Hauptwohnsitz Betreuerin' },
        { key: 'vollmachtnehmer_name', label: 'Bevollmächtigter (VBetreut)', typ: 'text', pflicht: true },
        { key: 'vollmachtnehmer_geburtsdatum', label: 'Geburtsdatum Bevollmächtigter', typ: 'datum', pflicht: false },
        { key: 'vollmachtnehmer_anschrift', label: 'Adresse Bevollmächtigter', typ: 'text', pflicht: true },
        { key: 'vollmachtnehmer_telefon', label: 'Telefon Bevollmächtigter', typ: 'text', pflicht: true },
        { key: 'vollmacht_datum_von', label: 'Vollmacht gültig ab', typ: 'datum', pflicht: true },
        { key: 'vollmacht_datum_bis', label: 'Vollmacht gültig bis (leer = bis Widerruf)', typ: 'datum', pflicht: false },
        { key: 'ort_datum', label: 'Ort und Datum', typ: 'text', pflicht: true },
      ],
      versandBetreuerin: 'email', versandKunde: '', freigebenErforderlich: false, ausdruckErforderlich: false,
      erstelltAm: today(), aktualisiertAm: today(),
    },
    {
      id: 'V5', name: 'Meldezettel (Anlage A)', typ: 'meldezettel', status: 'aktiv',
      beschreibung: 'Offizieller Meldezettel Anlage A (MeldeG BGBl. I Nr. 173/2022). Für An-/Abmeldung der Betreuerin.',
      inhalt: MZ, dateiOriginal: 'Anlage_A_MeldeG_Meldezettel_2023.pdf',
      felder: [
        { key: 'nachname', label: 'Familienname', typ: 'text', pflicht: true, alfred_tipp: 'Betreuerinnen-Stammdaten' },
        { key: 'vorname', label: 'Vorname lt. Geburtsurkunde', typ: 'text', pflicht: true, alfred_tipp: 'Betreuerinnen-Stammdaten' },
        { key: 'geburtsname', label: 'Familienname vor erster Ehe', typ: 'text', pflicht: false },
        { key: 'sonstiger_name', label: 'Sonstiger Name (Vatersname etc.)', typ: 'text', pflicht: false },
        { key: 'geburtsdatum', label: 'Geburtsdatum', typ: 'datum', pflicht: true, alfred_tipp: 'Betreuerinnen-Stammdaten' },
        { key: 'geschlecht', label: 'Geschlecht', typ: 'auswahl', optionen: ['weiblich', 'männlich', 'divers', 'inter', 'offen', 'keine Angabe'], pflicht: true },
        { key: 'geburtsort', label: 'Geburtsort', typ: 'text', pflicht: true, alfred_tipp: 'Betreuerinnen-Stammdaten' },
        { key: 'staatsangehoerigkeit', label: 'Staatsangehörigkeit', typ: 'text', pflicht: true, alfred_tipp: 'Betreuerinnen-Stammdaten' },
        { key: 'familienstand', label: 'Familienstand', typ: 'auswahl', optionen: ['ledig', 'verheiratet', 'in eingetragener Partnerschaft', 'geschieden', 'verwitwet'], pflicht: true },
        { key: 'religion', label: 'Kirche / Religionsgesellschaft', typ: 'text', pflicht: false },
        { key: 'reisedokument_art', label: 'Reisedokument Art', typ: 'auswahl', optionen: ['Reisepass', 'Personalausweis', 'Sonstiges'], pflicht: false },
        { key: 'reisedokument_nummer', label: 'Reisedokument Nummer', typ: 'text', pflicht: false },
        { key: 'reisedokument_datum', label: 'Ausstellungsdatum', typ: 'datum', pflicht: false },
        { key: 'reisedokument_behoerde', label: 'Ausstellende Behörde, Staat', typ: 'text', pflicht: false },
        { key: 'unterkunft_strasse', label: 'Straße der Unterkunft', typ: 'text', pflicht: true, alfred_tipp: 'Wohnadresse des Klienten' },
        { key: 'unterkunft_hausnr', label: 'Hausnummer', typ: 'text', pflicht: true },
        { key: 'unterkunft_stiege', label: 'Stiege', typ: 'text', pflicht: false },
        { key: 'unterkunft_tuer', label: 'Tür Nr.', typ: 'text', pflicht: false },
        { key: 'unterkunft_plz', label: 'PLZ', typ: 'text', pflicht: true },
        { key: 'unterkunft_ort', label: 'Ortsgemeinde, Bundesland', typ: 'text', pflicht: true },
        { key: 'hauptwohnsitz', label: 'Ist dies Hauptwohnsitz?', typ: 'auswahl', optionen: ['ja', 'nein'], pflicht: true },
        { key: 'hauptwohnsitz_strasse', label: 'Hauptwohnsitz Straße (wenn nein)', typ: 'text', pflicht: false },
        { key: 'hauptwohnsitz_ort', label: 'Hauptwohnsitz PLZ/Ort', typ: 'text', pflicht: false },
        { key: 'zuzug_ausland', label: 'Zuzug aus dem Ausland?', typ: 'auswahl', optionen: ['nein', 'ja'], pflicht: true },
        { key: 'zuzug_staat', label: 'Herkunftsstaat (wenn ja)', typ: 'text', pflicht: false },
        { key: 'unterkunftgeber_name', label: 'Name Unterkunftgeber', typ: 'text', pflicht: true, alfred_tipp: 'Name des Klienten (Wohnungsinhaber)' },
        { key: 'ort_datum', label: 'Ort und Datum', typ: 'text', pflicht: true },
      ],
      versandBetreuerin: 'email', versandKunde: '', freigebenErforderlich: false, ausdruckErforderlich: true,
      erstelltAm: today(), aktualisiertAm: today(),
    },
  ]
}

export function seedLernregeln(): Lernregel[] {
  return [
    { id: 'R1', fallTyp: 'erstanreise', beschreibung: 'Erstanreise: Vermittlungs- + Betreuungsvertrag + Vollmacht + Meldezettel', vorlageIds: ['V2', 'V1', 'V4', 'V5'], reihenfolge: [1,2,3,4], aktiv: true, erstelltAm: today(), lernquelle: 'manuell' },
    { id: 'R2', fallTyp: 'wechsel', beschreibung: 'Wechsel: Vollmacht + Meldezettel für neue Betreuerin', vorlageIds: ['V4', 'V5'], reihenfolge: [1,2], aktiv: true, erstelltAm: today(), lernquelle: 'manuell' },
    { id: 'R3', fallTyp: 'verlaengerung', beschreibung: 'Verlängerung: nur Betreuungsvertrag erneuern', vorlageIds: ['V1'], reihenfolge: [1], aktiv: true, erstelltAm: today(), lernquelle: 'manuell' },
    { id: 'R4', fallTyp: 'beendigung', beschreibung: 'Beendigung: Meldezettel Abmeldung', vorlageIds: ['V5'], reihenfolge: [1], aktiv: true, erstelltAm: today(), lernquelle: 'manuell' },
  ]
}

// ── Storage ───────────────────────────────────────────────────

const KV = 'vb_vorlagen', KD = 'vb_akte_dok', KR = 'vb_lernregeln', KC = 'vb_alfred_chat'

export function getVorlagen(): Vorlage[] {
  if (typeof window === 'undefined') return []
  const raw = (typeof window !== 'undefined' ? localStorage.getItem(KV) : null)
  if (typeof window !== 'undefined') { if (!raw) { const s = seedVorlagen(); localStorage.setItem(KV, JSON.stringify(s)); return s } }
  return JSON.parse(raw)
}
export function saveVorlagen(v: Vorlage[]) { if (typeof window !== 'undefined') localStorage.setItem(KV, JSON.stringify(v)) }

export function getAkteDokumente(): AkteDokument[] {
  if (typeof window === 'undefined') return []
  return JSON.parse((typeof window !== 'undefined' ? localStorage.getItem(KD) : null) || '[]')
}
export function saveAkteDokumente(d: AkteDokument[]) { if (typeof window !== 'undefined') localStorage.setItem(KD, JSON.stringify(d)) }

export function getLernregeln(): Lernregel[] {
  if (typeof window === 'undefined') return []
  const raw = (typeof window !== 'undefined' ? localStorage.getItem(KR) : null)
  if (typeof window !== 'undefined') { if (!raw) { const s = seedLernregeln(); localStorage.setItem(KR, JSON.stringify(s)); return s } }
  return JSON.parse(raw)
}
export function saveLernregeln(r: Lernregel[]) { if (typeof window !== 'undefined') localStorage.setItem(KR, JSON.stringify(r)) }

export function getAlfredChat(): AlfredNachricht[] {
  if (typeof window === 'undefined') return []
  return JSON.parse((typeof window !== 'undefined' ? localStorage.getItem(KC) : null) || '[]')
}
export function saveAlfredChat(m: AlfredNachricht[]) { if (typeof window !== 'undefined') localStorage.setItem(KC, JSON.stringify(m)) }

// ── Hilfsfunktionen ────────────────────────────────────────────

export function fuelleText(inhalt: string, felder: DokumentFeld[]): string {
  let t = inhalt
  for (const f of felder) t = t.replaceAll(`{{${f.key}}}`, f.wert || `[${f.key}]`)
  return t
}

export function analysiereFall(fallTyp: FallTyp, regeln: Lernregel[], vorlagen: Vorlage[]): { vorlageIds: string[]; begruendung: string } {
  // 1. Lernregel aus DB suchen
  const r = regeln.find(r => r.aktiv && r.fallTyp === fallTyp)
  if (r && r.vorlageIds.length > 0) {
    // Prüfen ob die Vorlagen-IDs tatsächlich existieren
    const gueltigeIds = r.vorlageIds.filter(id => vorlagen.some(v => v.id === id))
    if (gueltigeIds.length > 0) {
      const namen = gueltigeIds.map(id => vorlagen.find(v => v.id === id)?.name || id).join(', ')
      return { vorlageIds: gueltigeIds, begruendung: `Lernregel angewendet: "${r.beschreibung}". Dokumente: ${namen}.` }
    }
  }

  // 2. Fallback: Vorlagen nach Typ und Falltyp automatisch vorschlagen
  const vorschlaegeByFall: Record<FallTyp, string[]> = {
    erstanreise:  ['meldezettel', 'betreuungsvertrag', 'vermittlungsvertrag', 'email'],
    wechsel:      ['meldezettel', 'email', 'honorarnote'],
    verlaengerung:['rechnung_klient', 'honorarnote'],
    beendigung:   ['meldezettel', 'rechnung_klient', 'honorarnote'],
    sonstig:      ['sonstige'],
  }

  const typen = vorschlaegeByFall[fallTyp] || []
  const vorschlaege = vorlagen
    .filter(v => v.status === 'aktiv' && typen.some(t => v.typ === t || v.vorlageTyp === t))
    .map(v => v.id)

  if (vorschlaege.length > 0) {
    const namen = vorschlaege.map(id => vorlagen.find(v => v.id === id)?.name || id).join(', ')
    return { vorlageIds: vorschlaege, begruendung: `Automatisch für "${FALL_TYP_LABELS[fallTyp]}" vorgeschlagen: ${namen}.` }
  }

  // 3. Letzter Fallback: erste 2 aktive Vorlagen
  const erste = vorlagen.filter(v => v.status === 'aktiv').slice(0, 2).map(v => v.id)
  return { vorlageIds: erste, begruendung: 'Keine passende Regel — erste verfügbare Vorlagen vorgeschlagen.' }
}

export const FALL_TYP_LABELS: Record<FallTyp, string> = {
  erstanreise: '🆕 Erstanreise', wechsel: '🔄 Betreuerwechsel',
  verlaengerung: '📅 Verlängerung', beendigung: '🏁 Beendigung', sonstig: '📄 Sonstiges',
}
export const VORLAGE_TYP_LABELS: Record<VorlageTyp, string> = {
  betreuungsvertrag: 'Betreuungsvertrag', vermittlungsvertrag: 'Vermittlungsvertrag',
  organisationsvertrag: 'Organisationsvertrag', vollmacht: 'Vollmacht',
  meldezettel: 'Meldezettel',
  rechnung: 'Rechnung', rechnung_klient: 'Rechnung Klient:in',
  honorarnote: 'Honorarnote Betreuerin',
  email: 'E-Mail Vorlage',
  sonstige: 'Sonstiges',
}
export const VORLAGE_TYP_ICONS: Record<VorlageTyp, string> = {
  betreuungsvertrag: '📋', vermittlungsvertrag: '🤝', organisationsvertrag: '🏢',
  vollmacht: '✍️', meldezettel: '🏛️',
  rechnung: '💶', rechnung_klient: '💶',
  honorarnote: '📄',
  email: '📧',
  sonstige: '📄',
}
export const VERSAND_LABELS: Record<VersandArt, string> = {
  email: '📧 E-Mail', post: '📮 Post', buero: '🏢 Büro', ausdruck: '🖨️ Ausdruck',
}
