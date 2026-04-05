// src/app/api/db/[table]/route.ts — VBetreut CarePlus ERP
// Universelle CRUD API für alle Tabellen — Supabase Backend
import { NextRequest, NextResponse } from 'next/server'
import { getServerClient, isConfigured } from '@/lib/supabase-server'

const ALLOWED_TABLES = [
  'klienten', 'betreuerinnen', 'einsaetze', 'finanzen_dokumente',
  'dokumente', 'wechselliste', 'mitarbeiter', 'partner', 'admin_settings',
  'users', 'chronologie', 'kalender_ereignisse', 'touren', 'busse',
  'dokument_vorlagen', 'nummernkreis', 'lerndaten',
  'signaturmappen', 'signatur_dokumente', 'pdf_vorlagen',
]

// Tabellen mit 'key' als Primärschlüssel (statt 'id')
const KEY_TABLES = ['admin_settings', 'nummernkreis']

// Tabellen die direkt flat gespeichert sind (kein data-JSONB wrapping)
const FLAT_TABLES = [
  'admin_settings', 'nummernkreis', 'lerndaten', 'users',
  'kalender_ereignisse', 'busse', 'touren',
  'signaturmappen', 'signatur_dokumente', 'pdf_vorlagen',
]

export async function GET(req: NextRequest, { params }: { params: { table: string } }) {
  const { table } = params
  if (!ALLOWED_TABLES.includes(table)) return NextResponse.json({ error: 'Ungültige Tabelle' }, { status: 400 })
  if (!isConfigured()) return NextResponse.json({ error: 'DB nicht konfiguriert' }, { status: 503 })

  const db = getServerClient()
  const idParam = req.nextUrl.searchParams.get('id')
  const pkField = KEY_TABLES.includes(table) ? 'key' : 'id'

  // Einzelner Datensatz
  if (idParam) {
    const { data, error } = await db.from(table).select('*').eq(pkField, idParam).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(normalizeRow(table, data))
  }

  // Alle — ohne ORDER BY um Fehler bei text-Spalten zu vermeiden
  const { data, error } = await db.from(table).select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  const items = (data || []).map(row => normalizeRow(table, row))
  return NextResponse.json(items)
}

export async function POST(req: NextRequest, { params }: { params: { table: string } }) {
  const { table } = params
  if (!ALLOWED_TABLES.includes(table)) return NextResponse.json({ error: 'Ungültige Tabelle' }, { status: 400 })
  if (!isConfigured()) return NextResponse.json({ error: 'DB nicht konfiguriert' }, { status: 503 })

  const body = await req.json()
  const db = getServerClient()
  const row = buildRow(table, body)

  const { error } = await db.from(table).upsert(row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(body, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: { table: string } }) {
  const { table } = params
  if (!ALLOWED_TABLES.includes(table)) return NextResponse.json({ error: 'Ungültige Tabelle' }, { status: 400 })
  if (!isConfigured()) return NextResponse.json({ error: 'DB nicht konfiguriert' }, { status: 503 })

  const idParam = req.nextUrl.searchParams.get('id')
  if (!idParam) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })

  const body = await req.json()
  const db = getServerClient()
  const pkField = KEY_TABLES.includes(table) ? 'key' : 'id'

  // admin_settings: value direkt
  if (table === 'admin_settings') {
    const val = body.value !== undefined ? body.value : body
    const { error } = await db.from(table).upsert({ key: idParam, value: val })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ key: idParam, value: val })
  }

  // Flat tables: direkt updaten
  if (FLAT_TABLES.includes(table)) {
    const { error } = await db.from(table).update(body).eq(pkField, idParam)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(body)
  }

  // Standard: data JSONB laden, mergen, speichern
  const { data: existing } = await db.from(table).select('*').eq(pkField, idParam).single()
  const existingData = (existing?.data && typeof existing.data === 'object') ? existing.data as Record<string,unknown> : (existing || {})
  const merged = { ...existingData, ...body, id: idParam }
  const row = buildRow(table, merged)
  const { error } = await db.from(table).update(row).eq(pkField, idParam)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(merged)
}

export async function DELETE(req: NextRequest, { params }: { params: { table: string } }) {
  const { table } = params
  if (!ALLOWED_TABLES.includes(table)) return NextResponse.json({ error: 'Ungültige Tabelle' }, { status: 400 })
  if (!isConfigured()) return NextResponse.json({ error: 'DB nicht konfiguriert' }, { status: 503 })

  const idParam = req.nextUrl.searchParams.get('id')
  if (!idParam) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })

  const db = getServerClient()
  const pkField = KEY_TABLES.includes(table) ? 'key' : 'id'
  const { error } = await db.from(table).delete().eq(pkField, idParam)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Row aus DB normalisieren → sauberes JS-Objekt
function normalizeRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  if (!row) return {}

  // admin_settings: value zurückgeben
  if (table === 'admin_settings') {
    const val = row.value
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return { ...(val as Record<string, unknown>), key: row.key, _key: row.key }
    }
    return { value: val, key: row.key, _key: row.key }
  }

  // Flat tables: direkt zurück
  if (FLAT_TABLES.includes(table)) return row

  // Betreuerinnen: data JSONB + echte Spalten zusammenführen
  if (table === 'betreuerinnen') {
    const d = (row.data && typeof row.data === 'object' && !Array.isArray(row.data))
      ? row.data as Record<string, unknown>
      : {}
    if (d.data) delete d.data
    return {
      ...d,
      id: row.id,
      // Direkte Spalten überschreiben data-Werte (sind aktueller)
      vorname: row.vorname || d.vorname || '',
      nachname: row.nachname || d.nachname || '',
      geburtsdatum: row.geburtsdatum || d.geburtsdatum || '',
      nationalitaet: row.nationalitaet || d.nationalitaet || '',
      staatsangehoerigkeit: row.nationalitaet || d.staatsangehoerigkeit || '',
      status: row.status || d.status || 'verfuegbar',
      turnus: String(row.turnus || d.turnus || '28'),
      telefon: row.telefon || d.telefon || '',
      email: row.email || d.email || '',
      svnr: row.svnr || d.svnr || '',
      notizen: row.notizen || d.notizen || '',
      iban: row.iban || d.iban || '',
      // Ausweis — DB-Spalten → camelCase
      ausweisNummer: row.ausweis_nr || d.ausweisNummer || d.ausweisNr || '',
      ausweisTyp: row.ausweis_typ || d.ausweisTyp || '',
      ausweisAusgestelltAm: row.ausweis_ausgestellt_am || d.ausweisAusgestelltAm || '',
      ausweisBehoerde: row.ausweis_behoerde || d.ausweisBehoerde || '',
      ausweisAblauf: row.ausweis_gueltig_bis || d.ausweisAblauf || d.ausweisGueltigBis || '',
      // Adressen
      hauptwohnsitzStrasse: row.heimatadresse || d.hauptwohnsitzStrasse || '',
      hauptwohnsitzPlz: row.heimat_plz || d.hauptwohnsitzPlz || '',
      hauptwohnsitzOrt: row.heimat_ort || d.hauptwohnsitzOrt || '',
      hauptwohnsitzLand: row.heimat_land || d.hauptwohnsitzLand || '',
      nebenwohnsitzStrasse: row.adresse || d.nebenwohnsitzStrasse || '',
      nebenwohnsitzPlz: row.plz || d.nebenwohnsitzPlz || '',
      nebenwohnsitzOrt: row.ort || d.nebenwohnsitzOrt || '',
      nebenwohnsitzLand: row.land || d.nebenwohnsitzLand || '',
    }
  }

  // Standard: data JSONB enthält vollständiges Objekt
  if (row.data && typeof row.data === 'object' && !Array.isArray(row.data)) {
    const d = row.data as Record<string, unknown>
    if (d.data) delete d.data
    return { ...d, id: row.id }
  }

  return row
}

// Row für DB aufbauen
function buildRow(table: string, obj: Record<string, unknown>): Record<string, unknown> {
  if (table === 'admin_settings') {
    return { key: obj.key || obj.id, value: obj.value !== undefined ? obj.value : obj }
  }
  if (table === 'nummernkreis') {
    return { key: obj.key || obj.id, wert: obj.wert || 0 }
  }
  if (table === 'lerndaten') {
    return {
      id: obj.id, assistent: obj.assistent || 'doris',
      kategorie: obj.kategorie || 'allgemein',
      titel: obj.titel || '', inhalt: obj.inhalt || '',
      tags: obj.tags || '', aktiv: obj.aktiv !== false,
      erstellt_von: obj.erstellt_von || obj.erstelltVon || '',
      erstellt_am: obj.erstellt_am || obj.erstelltAm || new Date().toISOString(),
      data: obj,
    }
  }
  if (table === 'users') {
    return {
      id: obj.id, email: obj.email || '',
      name: obj.name || '', rolle: obj.rolle || 'mitarbeiter',
      aktiv: obj.aktiv !== false,
      berechtigungen: obj.berechtigungen || {},
      erstellt_am: obj.erstellt_am || obj.erstelltAm || new Date().toISOString(),
      data: obj,
    }
  }
  if (table === 'kalender_ereignisse') {
    return {
      id: obj.id, typ: obj.typ || 'termin',
      titel: obj.titel || '',
      datum: obj.von || obj.datum_von || obj.datum || '',
      datum_bis: obj.bis || obj.datum_bis || '',
      ganzer_tag: obj.ganzerTag !== false,
      von_zeit: obj.vonZeit || obj.von_zeit || '',
      bis_zeit: obj.bisZeit || obj.bis_zeit || '',
      mitarbeiter_id: obj.mitarbeiterId || obj.mitarbeiter_id || '',
      mitarbeiter_name: obj.mitarbeiterName || obj.mitarbeiter_name || '',
      ort: obj.ort || '', notizen: obj.notizen || '',
      status: obj.status || 'offen',
      erstellt_am: obj.erstelltAm || obj.erstellt_am || new Date().toISOString(),
      data: obj,
    }
  }
  if (table === 'signaturmappen') {
    return {
      id: obj.id,
      klient_id: obj.klientId || obj.klient_id || '',
      klient_name: obj.klientName || obj.klient_name || '',
      betreuerin_id: obj.betreuerinId || obj.betreuerin_id || '',
      betreuerin_name: obj.betreuerinName || obj.betreuerin_name || '',
      titel: obj.titel || '',
      status: obj.status || 'offen',
      erstellt_von: obj.erstelltVon || obj.erstellt_von || '',
      erstellt_am: obj.erstelltAm || obj.erstellt_am || new Date().toISOString(),
      abgeschlossen_am: obj.abgeschlossenAm || obj.abgeschlossen_am || null,
      archiviert_am: obj.archiviertAm || obj.archiviert_am || null,
      data: obj,
    }
  }
  if (table === 'signatur_dokumente') {
    return {
      id: obj.id,
      mappe_id: obj.mappeId || obj.mappe_id || '',
      klient_id: obj.klientId || obj.klient_id || '',
      klient_name: obj.klientName || obj.klient_name || '',
      vorlage_id: obj.vorlageId || obj.vorlage_id || '',
      vorlage_name: obj.vorlageName || obj.vorlage_name || '',
      vorlage_typ: obj.vorlageTyp || obj.vorlage_typ || '',
      titel: obj.titel || '',
      inhalt: obj.inhalt || '',
      status: obj.status || 'ausstehend',
      unterschrift_von: obj.unterschriftVon || obj.unterschrift_von || '',
      unterschrift_am: obj.unterschriftAm || obj.unterschrift_am || null,
      unterzeichner: obj.unterzeichner || 'alle',
      notizen: obj.notizen || '',
      erstellt_am: obj.erstelltAm || obj.erstellt_am || new Date().toISOString(),
      data: obj,
    }
  }

  // Standard: data JSONB
  const row: Record<string, unknown> = {
    id: obj.id,
    data: obj,
    erstellt_am: obj.erstelltAm || obj.erstellt_am || new Date().toISOString(),
    aktualisiert_am: new Date().toISOString(),
  }

  if (['klienten', 'betreuerinnen', 'mitarbeiter'].includes(table)) {
    row.vorname = obj.vorname || ''
    row.nachname = obj.nachname || ''
    row.status = obj.status || 'aktiv'
  }
  if (table === 'betreuerinnen') {
    row.nationalitaet = obj.nationalitaet || obj.staatsangehoerigkeit || ''
    // Ausweis-Felder: alle Schreibweisen → echte DB-Spalten
    row.ausweis_nr = obj.ausweisNummer || obj.ausweisNr || obj.ausweis_nr || ''
    row.ausweis_typ = obj.ausweisTyp || obj.ausweis_typ || ''
    row.ausweis_ausgestellt_am = obj.ausweisAusgestelltAm || obj.ausweis_ausgestellt_am || ''
    row.ausweis_behoerde = obj.ausweisBehoerde || obj.ausweis_behoerde || ''
    row.ausweis_gueltig_bis = obj.ausweisAblauf || obj.ausweisGueltigBis || obj.ausweis_gueltig_bis || ''
    // Personen-Felder
    row.geburtsdatum = obj.geburtsdatum || ''
    row.svnr = obj.svnr || ''
    row.telefon = obj.telefon || ''
    row.email = obj.email || ''
    row.status = obj.status || 'verfuegbar'
    row.turnus = obj.turnus || '28'
    row.deutschkenntnisse = obj.deutschkenntnisse || ''
    row.notizen = obj.notizen || ''
    // Adressen
    row.iban = obj.iban || ''
    row.heimatadresse = obj.hauptwohnsitzStrasse || obj.heimatadresse || ''
    row.heimat_plz = obj.hauptwohnsitzPlz || obj.heimatPlz || obj.heimat_plz || ''
    row.heimat_ort = obj.hauptwohnsitzOrt || obj.heimatOrt || obj.heimat_ort || ''
    row.heimat_land = obj.hauptwohnsitzLand || obj.heimat_land || ''
    row.land = obj.nebenwohnsitzLand || obj.land || ''
    row.adresse = obj.nebenwohnsitzStrasse || obj.adresse || ''
    row.plz = obj.nebenwohnsitzPlz || obj.plz || ''
    row.ort = obj.nebenwohnsitzOrt || obj.ort || ''
  }
  if (table === 'partner') {
    row.name = obj.name || ''
    row.typ = obj.typ || 'taxi'
    row.aktiv = obj.aktiv !== false
  }
  if (table === 'einsaetze') {
    row.klient_id = obj.klientId || obj.klient_id || null
    row.klient_name = obj.klientName || obj.klient_name || ''
    row.betreuerin_id = obj.betreuerinId || obj.betreuerin_id || null
    row.betreuerin_name = obj.betreuerinName || obj.betreuerin_name || ''
    row.von = obj.von || ''
    row.bis = obj.bis || ''
    row.status = obj.status || 'geplant'
  }
  if (table === 'finanzen_dokumente') {
    row.typ = obj.typ || 'rechnung'
    row.status = obj.status || 'entwurf'
    row.klient_name = obj.klientName || obj.klient_name || ''
    row.dokument_nr = obj.dokumentNr || obj.dokument_nr || ''
    row.summe_brutto = obj.summeBrutto || obj.summe_brutto || 0
  }
  if (table === 'chronologie') {
    row.typ = obj.typ || 'einsatz'
    row.klient_id = obj.klientId || obj.klient_id || ''
    row.klient_name = obj.klientName || obj.klient_name || ''
    row.betreuerin_id = obj.betreuerinId || obj.betreuerin_id || ''
    row.betreuerin_name = obj.betreuerinName || obj.betreuerin_name || ''
  }

  return row
}
