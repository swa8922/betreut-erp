// src/lib/db.ts
// Universeller Datenzugriff — wechselt automatisch zwischen
// localStorage (Entwicklung) und Supabase (Produktion)
//
// Verwendung:
//   const klienten = await db.klienten.getAll()
//   await db.klienten.create(data)
//   await db.klienten.update(id, data)
//   await db.klienten.delete(id)

import { supabase, isSupabaseConfigured } from './supabase'
import { getKlienten, saveKlienten, type Klient } from './klienten'
import { getBetreuerinnen, saveBetreuerinnen, type Betreuerin } from './betreuerinnen'
import { getEinsaetze, saveEinsaetze, type Einsatz } from './einsaetze'
import { getRechnungen, saveRechnungen, type Rechnung } from './abrechnung'

// ── Hilfsfunktion: localStorage ↔ Supabase Feldnamen ────────────────────────

function klientToRow(k: Omit<Klient, 'id' | 'erstelltAm' | 'aktualisiertAm'>) {
  return {
    vorname: k.vorname, nachname: k.nachname,
    geburtsdatum: k.geburtsdatum || null,
    svnr: k.svnr, status: k.status,
    pflegestufe: k.pflegestufe, foerderung: k.foerderung,
    telefon: k.telefon, email: k.email,
    strasse: k.strasse, plz: k.plz, ort: k.ort, stockwerk: k.stockwerk,
    kontakte: k.kontakte,
    hausarzt: k.hausarzt, besonderheiten: k.besonderheiten,
    raucher: k.raucher, haustiere: k.haustiere,
    zustaendig: k.zustaendig, notizen: k.notizen,
  }
}

function rowToKlient(row: Record<string, unknown>): Klient {
  return {
    id: String(row.id),
    vorname: String(row.vorname || ''),
    nachname: String(row.nachname || ''),
    geburtsdatum: String(row.geburtsdatum || ''),
    svnr: String(row.svnr || ''),
    status: row.status as Klient['status'],
    pflegestufe: row.pflegestufe as Klient['pflegestufe'],
    foerderung: row.foerderung as Klient['foerderung'],
    telefon: String(row.telefon || ''),
    email: String(row.email || ''),
    strasse: String(row.strasse || ''),
    plz: String(row.plz || ''),
    ort: String(row.ort || ''),
    stockwerk: String(row.stockwerk || ''),
    kontakte: (row.kontakte as Klient['kontakte']) || [],
    hausarzt: String(row.hausarzt || ''),
    besonderheiten: String(row.besonderheiten || ''),
    raucher: Boolean(row.raucher),
    haustiere: Boolean(row.haustiere),
    zustaendig: String(row.zustaendig || ''),
    notizen: String(row.notizen || ''),
    erstelltAm: String(row.erstellt_am || '').split('T')[0],
    aktualisiertAm: String(row.aktualisiert_am || '').split('T')[0],
  }
}

// ── Klienten ────────────────────────────────────────────────────────────────

const klientenDB = {
  async getAll(): Promise<Klient[]> {
    if (!isSupabaseConfigured() || !supabase) return getKlienten()
    const { data, error } = await supabase.from('klienten').select('*').order('nachname')
    if (error) { console.error('Supabase error:', error); return getKlienten() }
    return (data || []).map(rowToKlient)
  },

  async create(k: Omit<Klient, 'id' | 'erstelltAm' | 'aktualisiertAm'>): Promise<Klient | null> {
    if (!isSupabaseConfigured() || !supabase) {
      const list = getKlienten()
      const neu: Klient = { ...k, id: Date.now().toString(), erstelltAm: today(), aktualisiertAm: today() }
      saveKlienten([...list, neu])
      return neu
    }
    const { data, error } = await supabase.from('klienten').insert(klientToRow(k)).select().single()
    if (error) { console.error('Supabase error:', error); return null }
    return rowToKlient(data)
  },

  async update(id: string, k: Partial<Klient>): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      const list = getKlienten()
      saveKlienten(list.map(x => x.id === id ? { ...x, ...k, aktualisiertAm: today() } : x))
      return
    }
    const { error } = await supabase.from('klienten').update(klientToRow(k as any)).eq('id', id)
    if (error) console.error('Supabase error:', error)
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      saveKlienten(getKlienten().filter(k => k.id !== id))
      return
    }
    const { error } = await supabase.from('klienten').delete().eq('id', id)
    if (error) console.error('Supabase error:', error)
  },
}

// ── Betreuerinnen ─────────────────────────────────────────────────────────────

const betreuerinnenDB = {
  async getAll(): Promise<Betreuerin[]> {
    if (!isSupabaseConfigured() || !supabase) return getBetreuerinnen()
    const { data, error } = await supabase.from('betreuerinnen').select('*').order('nachname')
    if (error) { console.error('Supabase error:', error); return getBetreuerinnen() }
    // Map Supabase snake_case → camelCase
    return (data || []).map(r => ({
      id: r.id, vorname: r.vorname, nachname: r.nachname,
      geburtsdatum: r.geburtsdatum || '', geburtsort: r.geburtsort || '',
      svnr: r.svnr || '', nationalitaet: r.nationalitaet || '',
      familienstand: r.familienstand || '', religion: r.religion || '',
      status: r.status, rolle: r.rolle, turnus: r.turnus,
      verfuegbarAb: r.verfuegbar_ab || '',
      telefon: r.telefon || '', telefonWhatsapp: r.telefon_whatsapp || false,
      email: r.email || '',
      hauptwohnsitzStrasse: r.hw_strasse || '', hauptwohnsitzPlz: r.hw_plz || '',
      hauptwohnsitzOrt: r.hw_ort || '', hauptwohnsitzLand: r.hw_land || '',
      nebenwohnsitzStrasse: r.nw_strasse || '', nebenwohnsitzPlz: r.nw_plz || '',
      nebenwohnsitzOrt: r.nw_ort || '',
      deutschkenntnisse: r.deutschkenntnisse, weitereSprachenDE: r.weitere_sprachen || '',
      qualifikationen: r.qualifikationen || [],
      fuehrerschein: r.fuehrerschein || false, fuehrerscheinKlasse: r.fuehrerschein_klasse || '',
      raucher: r.raucher || false, haustierErfahrung: r.haustier_erfahrung || false,
      demenzErfahrung: r.demenz_erfahrung || false,
      bewerbungsdatum: r.bewerbungsdatum || '', bewertung: r.bewertung || '3',
      region: r.region || '', zustaendig: r.zustaendig || '',
      notizen: r.notizen || '', einsaetze: [],
      erstelltAm: (r.erstellt_am || '').split('T')[0],
      aktualisiertAm: (r.aktualisiert_am || '').split('T')[0],
    } as Betreuerin))
  },

  async create(b: Omit<Betreuerin, 'id' | 'erstelltAm' | 'aktualisiertAm'>): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      const list = getBetreuerinnen()
      saveBetreuerinnen([...list, { ...b, id: Date.now().toString(), erstelltAm: today(), aktualisiertAm: today() }])
      return
    }
    const { error } = await supabase.from('betreuerinnen').insert({
      vorname: b.vorname, nachname: b.nachname,
      geburtsdatum: b.geburtsdatum || null, geburtsort: b.geburtsort,
      svnr: b.svnr, nationalitaet: b.nationalitaet,
      familienstand: b.familienstand, religion: b.religion,
      status: b.status, rolle: b.rolle, turnus: b.turnus,
      verfuegbar_ab: b.verfuegbarAb || null,
      telefon: b.telefon, telefon_whatsapp: b.telefonWhatsapp, email: b.email,
      hw_strasse: b.hauptwohnsitzStrasse, hw_plz: b.hauptwohnsitzPlz,
      hw_ort: b.hauptwohnsitzOrt, hw_land: b.hauptwohnsitzLand,
      nw_strasse: b.nebenwohnsitzStrasse, nw_plz: b.nebenwohnsitzPlz, nw_ort: b.nebenwohnsitzOrt,
      deutschkenntnisse: b.deutschkenntnisse, weitere_sprachen: b.weitereSprachenDE,
      qualifikationen: b.qualifikationen,
      fuehrerschein: b.fuehrerschein, fuehrerschein_klasse: b.fuehrerscheinKlasse,
      raucher: b.raucher, haustier_erfahrung: b.haustierErfahrung, demenz_erfahrung: b.demenzErfahrung,
      bewerbungsdatum: b.bewerbungsdatum || null, bewertung: b.bewertung,
      region: b.region, zustaendig: b.zustaendig, notizen: b.notizen,
    })
    if (error) console.error('Supabase error:', error)
  },

  async update(id: string, data: Partial<Betreuerin>): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      saveBetreuerinnen(getBetreuerinnen().map(b => b.id === id ? { ...b, ...data, aktualisiertAm: today() } : b))
      return
    }
    const { error } = await supabase.from('betreuerinnen').update({ notizen: data.notizen, status: data.status, region: data.region }).eq('id', id)
    if (error) console.error('Supabase error:', error)
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      saveBetreuerinnen(getBetreuerinnen().filter(b => b.id !== id))
      return
    }
    const { error } = await supabase.from('betreuerinnen').delete().eq('id', id)
    if (error) console.error('Supabase error:', error)
  },
}

// ── Einsätze ─────────────────────────────────────────────────────────────────

const einsaetzeDB = {
  async getAll(): Promise<Einsatz[]> {
    if (!isSupabaseConfigured() || !supabase) return getEinsaetze()
    const { data, error } = await supabase.from('einsaetze').select('*').order('bis')
    if (error) { console.error('Supabase error:', error); return getEinsaetze() }
    return (data || []).map(r => ({
      id: r.id, klientId: r.klient_id || '', klientName: r.klient_name || '', klientOrt: r.klient_ort || '',
      betreuerinId: r.betreuerin_id || '', betreuerinName: r.betreuerin_name || '',
      von: r.von || '', bis: r.bis || '', turnusTage: r.turnus_tage || 28,
      status: r.status, wechselTyp: r.wechsel_typ,
      tagessatz: Number(r.tagessatz), gesamtbetrag: Number(r.gesamtbetrag),
      abrechnungsStatus: r.abrechnungs_status, rechnungsId: r.rechnungs_id || '',
      taxiHin: r.taxi_hin || '', taxiRueck: r.taxi_rueck || '', taxiKosten: Number(r.taxi_kosten || 0),
      uebergabeNotiz: r.uebergabe_notiz || '',
      nachfolgerBetreuerinId: r.nachfolger_betreuerin_id || '', nachfolgerBetreuerinName: r.nachfolger_betreuerin_name || '',
      wechselGeplantAm: r.wechsel_geplant_am || '',
      zustaendig: r.zustaendig || '', notizen: r.notizen || '',
      erstelltAm: (r.erstellt_am || '').split('T')[0], aktualisiertAm: (r.aktualisiert_am || '').split('T')[0],
    } as Einsatz))
  },

  async create(e: Omit<Einsatz, 'id' | 'erstelltAm' | 'aktualisiertAm'>): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      const list = getEinsaetze()
      saveEinsaetze([...list, { ...e, id: Date.now().toString(), erstelltAm: today(), aktualisiertAm: today() }])
      return
    }
    const { error } = await supabase.from('einsaetze').insert({
      klient_id: e.klientId || null, klient_name: e.klientName, klient_ort: e.klientOrt,
      betreuerin_id: e.betreuerinId || null, betreuerin_name: e.betreuerinName,
      von: e.von, bis: e.bis, turnus_tage: e.turnusTage,
      status: e.status, wechsel_typ: e.wechselTyp,
      tagessatz: e.tagessatz, gesamtbetrag: e.gesamtbetrag,
      abrechnungs_status: e.abrechnungsStatus, rechnungs_id: e.rechnungsId || null,
      taxi_hin: e.taxiHin, taxi_rueck: e.taxiRueck, taxi_kosten: e.taxiKosten,
      uebergabe_notiz: e.uebergabeNotiz,
      nachfolger_betreuerin_id: e.nachfolgerBetreuerinId || null,
      nachfolger_betreuerin_name: e.nachfolgerBetreuerinName,
      wechsel_geplant_am: e.wechselGeplantAm || null,
      zustaendig: e.zustaendig, notizen: e.notizen,
    })
    if (error) console.error('Supabase error:', error)
  },

  async update(id: string, data: Partial<Einsatz>): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      saveEinsaetze(getEinsaetze().map(e => e.id === id ? { ...e, ...data, aktualisiertAm: today() } : e))
      return
    }
    const updateData: Record<string, unknown> = {}
    if (data.status) updateData.status = data.status
    if (data.abrechnungsStatus) updateData.abrechnungs_status = data.abrechnungsStatus
    if (data.rechnungsId) updateData.rechnungs_id = data.rechnungsId
    if (data.nachfolgerBetreuerinId !== undefined) updateData.nachfolger_betreuerin_id = data.nachfolgerBetreuerinId || null
    if (data.nachfolgerBetreuerinName !== undefined) updateData.nachfolger_betreuerin_name = data.nachfolgerBetreuerinName
    if (data.wechselGeplantAm !== undefined) updateData.wechsel_geplant_am = data.wechselGeplantAm || null
    if (data.taxiHin !== undefined) updateData.taxi_hin = data.taxiHin
    if (data.taxiRueck !== undefined) updateData.taxi_rueck = data.taxiRueck
    if (data.uebergabeNotiz !== undefined) updateData.uebergabe_notiz = data.uebergabeNotiz
    if (data.notizen !== undefined) updateData.notizen = data.notizen
    const { error } = await supabase.from('einsaetze').update(updateData).eq('id', id)
    if (error) console.error('Supabase error:', error)
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      saveEinsaetze(getEinsaetze().filter(e => e.id !== id))
      return
    }
    const { error } = await supabase.from('einsaetze').delete().eq('id', id)
    if (error) console.error('Supabase error:', error)
  },
}

// ── Rechnungen ───────────────────────────────────────────────────────────────

const rechnungenDB = {
  async getAll(): Promise<Rechnung[]> {
    if (!isSupabaseConfigured() || !supabase) return getRechnungen()
    const { data, error } = await supabase.from('rechnungen').select('*').order('erstellt_am', { ascending: false })
    if (error) { console.error('Supabase error:', error); return getRechnungen() }
    return (data || []).map(r => ({
      id: r.id, rechnungsNr: r.rechnungs_nr,
      einsatzId: r.einsatz_id || '', klientId: r.klient_id || '',
      klientName: r.klient_name || '', klientAdresse: r.klient_adresse || '',
      betreuerinName: r.betreuerin_name || '',
      positionen: r.positionen || [],
      nettoBetrag: Number(r.netto_betrag), taxiKosten: Number(r.taxi_kosten),
      gesamtBetrag: Number(r.gesamt_betrag),
      status: r.status, zahlungsart: r.zahlungsart,
      zahlungsziel: r.zahlungsziel || '', zahlungseingangAm: r.zahlungseingang_am || '',
      rechnungsDatum: r.rechnungs_datum || '',
      zeitraumVon: r.zeitraum_von || '', zeitraumBis: r.zeitraum_bis || '',
      notizen: r.notizen || '',
      erstelltAm: (r.erstellt_am || '').split('T')[0],
      aktualisiertAm: (r.aktualisiert_am || '').split('T')[0],
    } as Rechnung))
  },

  async update(id: string, data: Partial<Rechnung>): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      saveRechnungen(getRechnungen().map(r => r.id === id ? { ...r, ...data } : r))
      return
    }
    const updateData: Record<string, unknown> = {}
    if (data.status) updateData.status = data.status
    if (data.zahlungseingangAm) updateData.zahlungseingang_am = data.zahlungseingangAm
    if (data.notizen !== undefined) updateData.notizen = data.notizen
    const { error } = await supabase.from('rechnungen').update(updateData).eq('id', id)
    if (error) console.error('Supabase error:', error)
  },
}

// ── Helfer ───────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split('T')[0] }

// ── Öffentliche API ──────────────────────────────────────────────────────────

export const db = {
  klienten: klientenDB,
  betreuerinnen: betreuerinnenDB,
  einsaetze: einsaetzeDB,
  rechnungen: rechnungenDB,
  isCloud: isSupabaseConfigured,
}
