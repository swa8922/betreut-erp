-- ============================================================
-- VBetreut ERP – Supabase Datenbankschema
-- Ausführen in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Erweiterungen ────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Benutzer/Rollen (ergänzt Supabase Auth) ─────────────────
create table if not exists public.team_mitglieder (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  email       text unique not null,
  rolle       text not null check (rolle in ('gf','koordination','mitarbeiter')),
  initials    text,
  aktiv       boolean default true,
  erstellt_am timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── Klient:innen ─────────────────────────────────────────────
create table if not exists public.klienten (
  id                    uuid primary key default uuid_generate_v4(),
  vorname               text not null,
  nachname              text not null,
  geburtsdatum          date,
  svnr                  text,
  status                text not null default 'aktiv' check (status in ('aktiv','interessent','pausiert','beendet')),
  pflegestufe           text default '0',
  foerderung            text default 'keine' check (foerderung in ('aktiv','beantragt','keine')),
  telefon               text,
  email                 text,
  strasse               text,
  plz                   text,
  ort                   text,
  stockwerk             text,
  kontakte              jsonb default '[]',
  hausarzt              text,
  besonderheiten        text,
  raucher               boolean default false,
  haustiere             boolean default false,
  zustaendig            text,
  notizen               text,
  erstellt_am           timestamptz default now(),
  aktualisiert_am       timestamptz default now()
);

-- ── Betreuerinnen ────────────────────────────────────────────
create table if not exists public.betreuerinnen (
  id                      uuid primary key default uuid_generate_v4(),
  vorname                 text not null,
  nachname                text not null,
  geburtsdatum            date,
  geburtsort              text,
  svnr                    text,
  nationalitaet           text,
  familienstand           text,
  religion                text,
  status                  text not null default 'verfuegbar' check (status in ('aktiv','verfuegbar','im_einsatz','pause','inaktiv')),
  rolle                   text default 'betreuerin' check (rolle in ('betreuerin','springerin','teamleitung')),
  turnus                  text default '28',
  verfuegbar_ab           date,
  telefon                 text,
  telefon_whatsapp        boolean default false,
  email                   text,
  hw_strasse              text,  -- Hauptwohnsitz
  hw_plz                  text,
  hw_ort                  text,
  hw_land                 text,
  nw_strasse              text,  -- Nebenwohnsitz AT
  nw_plz                  text,
  nw_ort                  text,
  deutschkenntnisse       text default 'B1',
  weitere_sprachen        text,
  qualifikationen         jsonb default '[]',
  fuehrerschein           boolean default false,
  fuehrerschein_klasse    text,
  raucher                 boolean default false,
  haustier_erfahrung      boolean default false,
  demenz_erfahrung        boolean default false,
  bewerbungsdatum         date,
  bewertung               text default '3',
  region                  text,
  zustaendig              text,
  notizen                 text,
  erstellt_am             timestamptz default now(),
  aktualisiert_am         timestamptz default now()
);

-- ── Einsätze (Turnusliste) ───────────────────────────────────
create table if not exists public.einsaetze (
  id                          uuid primary key default uuid_generate_v4(),
  klient_id                   uuid references public.klienten(id),
  klient_name                 text not null,  -- denormalisiert
  klient_ort                  text,
  betreuerin_id               uuid references public.betreuerinnen(id),
  betreuerin_name             text,           -- denormalisiert
  von                         date not null,
  bis                         date not null,
  turnus_tage                 integer default 28,
  status                      text default 'geplant' check (status in ('geplant','aktiv','wechsel_offen','beendet','abgebrochen')),
  wechsel_typ                 text default 'erstanreise' check (wechsel_typ in ('wechsel','verlaengerung','erstanreise','neustart')),
  tagessatz                   numeric(10,2) default 80,
  gesamtbetrag                numeric(10,2) default 0,
  abrechnungs_status          text default 'offen' check (abrechnungs_status in ('offen','erstellt','versendet','bezahlt','storniert')),
  rechnungs_id                text,
  taxi_hin                    text,
  taxi_rueck                  text,
  taxi_kosten                 numeric(10,2) default 0,
  uebergabe_notiz             text,
  nachfolger_betreuerin_id    uuid references public.betreuerinnen(id),
  nachfolger_betreuerin_name  text,
  wechsel_geplant_am          date,
  zustaendig                  text,
  notizen                     text,
  erstellt_am                 timestamptz default now(),
  aktualisiert_am             timestamptz default now()
);

-- ── Rechnungen ───────────────────────────────────────────────
create table if not exists public.rechnungen (
  id                    uuid primary key default uuid_generate_v4(),
  rechnungs_nr          text unique not null,
  einsatz_id            uuid references public.einsaetze(id),
  klient_id             uuid references public.klienten(id),
  klient_name           text not null,
  klient_adresse        text,
  betreuerin_name       text,
  positionen            jsonb default '[]',
  netto_betrag          numeric(10,2) default 0,
  taxi_kosten           numeric(10,2) default 0,
  gesamt_betrag         numeric(10,2) default 0,
  status                text default 'erstellt' check (status in ('entwurf','erstellt','versendet','bezahlt','mahnung','storniert')),
  zahlungsart           text default 'ueberweisung' check (zahlungsart in ('ueberweisung','lastschrift','bar')),
  zahlungsziel          date,
  zahlungseingang_am    date,
  rechnungs_datum       date default current_date,
  zeitraum_von          date,
  zeitraum_bis          date,
  notizen               text,
  erstellt_am           timestamptz default now(),
  aktualisiert_am       timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS) — Zugriffskontrolle
-- ============================================================

alter table public.klienten          enable row level security;
alter table public.betreuerinnen     enable row level security;
alter table public.einsaetze         enable row level security;
alter table public.rechnungen        enable row level security;
alter table public.team_mitglieder   enable row level security;

-- Alle eingeloggten Benutzer dürfen lesen
create policy "Authenticated users can read klienten"
  on public.klienten for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read betreuerinnen"
  on public.betreuerinnen for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read einsaetze"
  on public.einsaetze for select
  using (auth.role() = 'authenticated');

-- Nur GF und Koordination dürfen schreiben
-- (Implementiert über team_mitglieder.rolle in der App-Logik)
-- Für Produktion: RLS-Policies mit Supabase Custom Claims erweitern

create policy "Authenticated users can insert klienten"
  on public.klienten for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update klienten"
  on public.klienten for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert betreuerinnen"
  on public.betreuerinnen for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update betreuerinnen"
  on public.betreuerinnen for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert einsaetze"
  on public.einsaetze for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update einsaetze"
  on public.einsaetze for update
  using (auth.role() = 'authenticated');

create policy "GF can manage rechnungen"
  on public.rechnungen for all
  using (auth.role() = 'authenticated');

-- ============================================================
-- Trigger: updated_at automatisch setzen
-- ============================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.aktualisiert_am = now();
  return new;
end;
$$ language plpgsql;

create trigger klienten_updated_at          before update on public.klienten          for each row execute function public.set_updated_at();
create trigger betreuerinnen_updated_at     before update on public.betreuerinnen     for each row execute function public.set_updated_at();
create trigger einsaetze_updated_at         before update on public.einsaetze         for each row execute function public.set_updated_at();
create trigger rechnungen_updated_at        before update on public.rechnungen        for each row execute function public.set_updated_at();

-- ============================================================
-- Rechnungsnummer-Sequenz
-- ============================================================

create sequence if not exists public.rechnungs_nr_seq start 1;

create or replace function public.next_rechnungs_nr()
returns text as $$
begin
  return 'RE-' || extract(year from now()) || '-' || lpad(nextval('public.rechnungs_nr_seq')::text, 3, '0');
end;
$$ language plpgsql;
