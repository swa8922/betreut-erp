-- VBetreut CarePlus ERP — Vollständiges Datenbankschema
-- Ausführen in: Supabase SQL Editor, PostgreSQL, oder SQLite
-- Stand: April 2026

-- ─── Klienten ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS klienten (
  id text PRIMARY KEY,
  vorname text DEFAULT '', nachname text DEFAULT '',
  geburtsdatum text DEFAULT '', status text DEFAULT 'aktiv',
  pflegestufe text DEFAULT '0', pflegegeld numeric DEFAULT 0,
  telefon text DEFAULT '', email text DEFAULT '',
  adresse text DEFAULT '', strasse text DEFAULT '',
  plz text DEFAULT '', ort text DEFAULT '', land text DEFAULT 'Österreich',
  stockwerk text DEFAULT '', bundesland text DEFAULT '',
  hausarzt text DEFAULT '', hausarzt_telefon text DEFAULT '',
  krankenhaus text DEFAULT '', krankenkasse text DEFAULT '',
  krankenkasse_nr text DEFAULT '',
  allergien text DEFAULT '', medikamente text DEFAULT '',
  besonderheiten text DEFAULT '', notizen text DEFAULT '',
  intern_notizen text DEFAULT '',
  tagessatz_standard numeric DEFAULT 80,
  aktueller_turnus text DEFAULT '28',
  aktuelle_betreuerin text DEFAULT '',
  foerderung text DEFAULT 'keine',
  zustaendig text DEFAULT '', wiedervorlage text DEFAULT '',
  angebot_nummer text DEFAULT '', angebot_datum text DEFAULT '',
  angebot_status text DEFAULT '',
  kontakte jsonb DEFAULT '[]',
  dokumente jsonb DEFAULT '[]',
  diagnosen jsonb DEFAULT '[]',
  foerderungen jsonb DEFAULT '[]',
  pflegemassnahmen jsonb DEFAULT '[]',
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now(),
  data jsonb DEFAULT '{}'
);

-- ─── Betreuerinnen ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS betreuerinnen (
  id text PRIMARY KEY,
  vorname text DEFAULT '', nachname text DEFAULT '',
  geburtsdatum text DEFAULT '', geburtsort text DEFAULT '',
  geschlecht text DEFAULT 'weiblich',
  staatsangehoerigkeit text DEFAULT '', nationalitaet text DEFAULT '',
  familienstand text DEFAULT '', religion text DEFAULT '',
  telefon text DEFAULT '', email text DEFAULT '',
  adresse text DEFAULT '', strasse text DEFAULT '',
  plz text DEFAULT '', ort text DEFAULT '', land text DEFAULT 'Österreich',
  heimatadresse text DEFAULT '', heimat_plz text DEFAULT '',
  heimat_ort text DEFAULT '', heimat_land text DEFAULT '',
  ausweis_typ text DEFAULT '', ausweis_nr text DEFAULT '',
  ausweis_ausgestellt_am text DEFAULT '',
  ausweis_behoerde text DEFAULT '', ausweis_gueltig_bis text DEFAULT '',
  fuehrerschein boolean DEFAULT false,
  fuehrerschein_klasse text DEFAULT 'B',
  fuehrerschein_nummer text DEFAULT '',
  fuehrerschein_ablauf text DEFAULT '',
  iban text DEFAULT '', bic text DEFAULT '', bank text DEFAULT '',
  svnr text DEFAULT '',
  deutschkenntnisse text DEFAULT 'gut',
  erfahrungsjahre integer DEFAULT 0,
  status text DEFAULT 'verfuegbar',
  notizen text DEFAULT '', intern_notizen text DEFAULT '',
  dokumente jsonb DEFAULT '[]',
  bankverbindungen jsonb DEFAULT '[]',
  qualifikationen jsonb DEFAULT '[]',
  sprachkenntnisse jsonb DEFAULT '[]',
  doris_chat jsonb DEFAULT '[]',
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now(),
  data jsonb DEFAULT '{}'
);

-- ─── Einsätze ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS einsaetze (
  id text PRIMARY KEY,
  klient_id text DEFAULT '', klient_name text DEFAULT '',
  klient_ort text DEFAULT '',
  betreuerin_id text DEFAULT '', betreuerin_name text DEFAULT '',
  von text DEFAULT '', bis text DEFAULT '',
  turnus_tage integer DEFAULT 28,
  tagessatz numeric DEFAULT 80,
  status text DEFAULT 'geplant',
  taxi_hin text DEFAULT '', taxi_rueck text DEFAULT '',
  taxi_kosten numeric DEFAULT 0,
  anreise_datum text DEFAULT '', abreise_datum text DEFAULT '',
  uebergabe_notiz text DEFAULT '',
  notizen text DEFAULT '',
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now(),
  data jsonb DEFAULT '{}'
);

-- ─── Finanzen ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finanzen_dokumente (
  id text PRIMARY KEY,
  dokument_nr text DEFAULT '', typ text DEFAULT 'rechnung',
  status text DEFAULT 'entwurf',
  klient_id text DEFAULT '', klient_name text DEFAULT '',
  klient_email text DEFAULT '',
  betreuerin_name text DEFAULT '', einsatz_id text DEFAULT '',
  rechnungs_datum text DEFAULT '', zahlungsziel text DEFAULT '',
  zahlung_eingang_am text DEFAULT '',
  summe_netto numeric DEFAULT 0, summe_brutto numeric DEFAULT 0,
  offener_betrag numeric DEFAULT 0,
  bezug_dokument_id text DEFAULT '',
  bezug_dokument_nr text DEFAULT '',
  erstellt_von text DEFAULT '', notizen text DEFAULT '',
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now(),
  data jsonb DEFAULT '{}'
);

-- ─── Mitarbeiter ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mitarbeiter (
  id text PRIMARY KEY,
  vorname text DEFAULT '', nachname text DEFAULT '',
  email text DEFAULT '', telefon text DEFAULT '',
  rolle text DEFAULT 'koordination', abteilung text DEFAULT '',
  eintrittsdatum text DEFAULT '',
  status text DEFAULT 'aktiv', notizen text DEFAULT '',
  dokumente jsonb DEFAULT '[]',
  bankverbindungen jsonb DEFAULT '[]',
  rechte jsonb DEFAULT '[]',
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now(),
  data jsonb DEFAULT '{}'
);

-- ─── Partner & Taxis ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner (
  id text PRIMARY KEY,
  name text DEFAULT '', typ text DEFAULT 'taxi',
  telefon text DEFAULT '', email text DEFAULT '',
  adresse text DEFAULT '', kontakt text DEFAULT '',
  kurzname text DEFAULT '', pin text DEFAULT '',
  aktiv boolean DEFAULT true,
  notizen text DEFAULT '',
  data jsonb DEFAULT '{}'
);

-- ─── Kalender ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kalender_ereignisse (
  id text PRIMARY KEY,
  typ text DEFAULT 'termin', titel text DEFAULT '',
  von text DEFAULT '', bis text DEFAULT '',
  datum_von text DEFAULT '', datum_bis text DEFAULT '',
  ganzer_tag boolean DEFAULT true,
  von_zeit text DEFAULT '', bis_zeit text DEFAULT '',
  mitarbeiter_id text DEFAULT '', mitarbeiter_name text DEFAULT '',
  ort text DEFAULT '', notizen text DEFAULT '',
  status text DEFAULT 'offen',
  erstellt_am timestamptz DEFAULT now(),
  data jsonb DEFAULT '{}'
);

-- ─── Busse/Fahrzeuge ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS busse (
  id text PRIMARY KEY,
  name text DEFAULT '', kennzeichen text DEFAULT '',
  kapazitaet integer DEFAULT 20,
  aktiv boolean DEFAULT true,
  data jsonb DEFAULT '{}'
);

-- ─── Touren ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS touren (
  id text PRIMARY KEY,
  name text DEFAULT '', datum text DEFAULT '',
  bus_id text DEFAULT '', status text DEFAULT 'geplant',
  erstellt_am timestamptz DEFAULT now(),
  data jsonb DEFAULT '{}'
);

-- ─── Dokumente ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dokumente (
  id text PRIMARY KEY,
  klient_id text DEFAULT '', klient_name text DEFAULT '',
  betreuerin_id text DEFAULT '', betreuerin_name text DEFAULT '',
  titel text DEFAULT '', typ text DEFAULT '',
  status text DEFAULT '', inhalt text DEFAULT '',
  datei_name text DEFAULT '', datei_base64 text DEFAULT '',
  notizen text DEFAULT '',
  erstellt_von text DEFAULT '',
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now(),
  data jsonb DEFAULT '{}'
);

-- ─── Wechselliste ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wechselliste (
  id text PRIMARY KEY,
  klient_id text DEFAULT '', klient_name text DEFAULT '',
  klient_ort text DEFAULT '',
  geht_betreuerin_id text DEFAULT '', geht_betreuerin_name text DEFAULT '',
  kommt_betreuerin_id text DEFAULT '', kommt_betreuerin_name text DEFAULT '',
  wechsel_datum text DEFAULT '', abreise_datum text DEFAULT '',
  anreise_datum text DEFAULT '', turnus_tage integer DEFAULT 28,
  taxi_hin text DEFAULT '', taxi_rueck text DEFAULT '',
  taxi_kosten numeric DEFAULT 0,
  status text DEFAULT 'vorbereitung',
  uebergabe_notiz text DEFAULT '',
  data jsonb DEFAULT '{}'
);

-- ─── Chronologie ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chronologie (
  id text PRIMARY KEY,
  typ text DEFAULT 'einsatz',
  klient_id text DEFAULT '', klient_name text DEFAULT '',
  betreuerin_id text DEFAULT '', betreuerin_name text DEFAULT '',
  einsatz_id text DEFAULT '',
  datum_von text DEFAULT '', datum_bis text DEFAULT '',
  beschreibung text DEFAULT '', erstellt_von text DEFAULT '',
  erstellt_am timestamptz DEFAULT now(),
  data jsonb DEFAULT '{}'
);

-- ─── Lerndaten (KI-Assistenten) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lerndaten (
  id text PRIMARY KEY,
  assistent text DEFAULT 'doris',
  kategorie text DEFAULT 'allgemein',
  titel text DEFAULT '', inhalt text DEFAULT '',
  tags text DEFAULT '', aktiv boolean DEFAULT true,
  erstellt_von text DEFAULT '',
  erstellt_am timestamptz DEFAULT now(),
  data jsonb DEFAULT '{}'
);

-- ─── Benutzer ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text DEFAULT '',
  rolle text DEFAULT 'mitarbeiter',
  passwort text DEFAULT '',
  aktiv boolean DEFAULT true,
  berechtigungen jsonb DEFAULT '{}',
  letzter_login timestamptz,
  erstellt_am timestamptz DEFAULT now(),
  data jsonb DEFAULT '{}'
);

-- ─── Einstellungen (Key-Value Store) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value jsonb DEFAULT '{}'
);

-- ─── Nummernkreis ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nummernkreis (
  key text PRIMARY KEY,
  wert integer DEFAULT 0,
  aktualisiert_am timestamptz DEFAULT now()
);

-- ─── RLS Policies (für Supabase) ─────────────────────────────────────────────
-- Für lokale PostgreSQL: Diese Zeilen weglassen oder anpassen

ALTER TABLE klienten ENABLE ROW LEVEL SECURITY;
ALTER TABLE betreuerinnen ENABLE ROW LEVEL SECURITY;
ALTER TABLE einsaetze ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanzen_dokumente ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitarbeiter ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner ENABLE ROW LEVEL SECURITY;
ALTER TABLE kalender_ereignisse ENABLE ROW LEVEL SECURITY;
ALTER TABLE busse ENABLE ROW LEVEL SECURITY;
ALTER TABLE touren ENABLE ROW LEVEL SECURITY;
ALTER TABLE dokumente ENABLE ROW LEVEL SECURITY;
ALTER TABLE wechselliste ENABLE ROW LEVEL SECURITY;
ALTER TABLE chronologie ENABLE ROW LEVEL SECURITY;
ALTER TABLE lerndaten ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nummernkreis ENABLE ROW LEVEL SECURITY;

-- Open policies (für development — in Produktion einschränken)
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY['klienten','betreuerinnen','einsaetze','finanzen_dokumente',
    'mitarbeiter','partner','kalender_ereignisse','busse','touren','dokumente',
    'wechselliste','chronologie','lerndaten','users','admin_settings','nummernkreis'])
  LOOP
    EXECUTE format('CREATE POLICY "allow_all" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ─── Startwerte ──────────────────────────────────────────────────────────────
INSERT INTO nummernkreis (key, wert) VALUES
  ('rechnung_2026', 0), ('honorar_2026', 0), ('gutschrift_2026', 0)
ON CONFLICT (key) DO NOTHING;

INSERT INTO users (id, email, name, rolle, aktiv, berechtigungen) VALUES
  ('usr_stefan', 'stefan@vbetreut.at', 'Stefan Wagner', 'gf', true,
   '{"klienten":true,"betreuerinnen":true,"einsaetze":true,"finanzen":true,"dokumente":true,"kalender":true,"admin":true}'),
  ('usr_lisa', 'lisa@vbetreut.at', 'Lisa Mayer', 'koordination', true,
   '{"klienten":true,"betreuerinnen":true,"einsaetze":true,"finanzen":false,"dokumente":true,"kalender":true,"admin":false}'),
  ('usr_michaela', 'michaela@vbetreut.at', 'Michaela Huber', 'mitarbeiter', true,
   '{"klienten":true,"betreuerinnen":false,"einsaetze":true,"finanzen":false,"dokumente":false,"kalender":true,"admin":false}')
ON CONFLICT (id) DO NOTHING;
