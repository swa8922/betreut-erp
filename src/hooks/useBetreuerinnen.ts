'use client'
import { useState, useEffect, useCallback } from 'react'
import { type Betreuerin } from '@/lib/betreuerinnen'
import { apiGetAll, apiInsert, apiUpdate, apiDelete } from '@/lib/api-client'

const TABLE = 'betreuerinnen'
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]

export function normalizeBetreuerin(raw: any): Betreuerin {
  if (!raw) return {} as Betreuerin
  const str = (v: any) => (v == null ? '' : String(v))
  const num = (v: any) => (v == null || isNaN(Number(v)) ? 0 : Number(v))
  const bool = (v: any) => v === true || v === 'true' || v === 1
  const arr = (v: any) => {
    if (Array.isArray(v)) return v
    if (typeof v === 'string' && v.startsWith('[')) { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] } }
    return []
  }

  // data-JSONB auspacken falls vorhanden
  const r = (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data) && raw.data.id)
    ? { ...raw.data, ...raw }
    : raw

  return {
    id: str(r.id),
    // Stammdaten
    vorname: str(r.vorname),
    nachname: str(r.nachname),
    geburtsdatum: str(r.geburtsdatum),
    geburtsort: str(r.geburtsort || r.geburts_ort),
    geburtsland: str(r.geburtsland || r.geburts_land),
    svnr: str(r.svnr),
    nationalitaet: str(r.nationalitaet),
    staatsangehoerigkeit: str(r.staatsangehoerigkeit),
    familienstand: str(r.familienstand),
    religion: str(r.religion),
    geschlecht: str(r.geschlecht) as any || '',
    // Ausweis
    ausweisNummer: str(r.ausweisNummer || r.ausweis_nr || r.ausweisNr),
    ausweisAblauf: str(r.ausweisAblauf || r.ausweis_gueltig_bis || r.ausweisGueltigBis),
    passNummer: str(r.passNummer || r.pass_nummer),
    passAblauf: str(r.passAblauf || r.pass_ablauf),
    fuehrerscheinNummer: str(r.fuehrerscheinNummer || r.fuehrerschein_nummer),
    fuehrerscheinKlasse: str(r.fuehrerscheinKlasse || r.fuehrerschein_klasse) || 'B',
    fuehrerscheinAblauf: str(r.fuehrerscheinAblauf || r.fuehrerschein_ablauf),
    fuehrerscheinAussteller: str(r.fuehrerscheinAussteller || r.fuehrerschein_aussteller),
    // Status & Rolle
    status: str(r.status) as any || 'verfuegbar',
    rolle: str(r.rolle) as any || 'betreuerin',
    turnus: str(r.turnus) as any || '28',
    verfuegbarAb: str(r.verfuegbarAb || r.verfuegbar_ab),
    aktuellerEinsatzKlient: str(r.aktuellerEinsatzKlient || r.aktueller_einsatz_klient),
    aktuellerEinsatzOrt: str(r.aktuellerEinsatzOrt || r.aktueller_einsatz_ort),
    aktuellerEinsatzBis: str(r.aktuellerEinsatzBis || r.aktueller_einsatz_bis),
    // Kontakt
    telefon: str(r.telefon),
    telefonWhatsapp: bool(r.telefonWhatsapp || r.telefon_whatsapp),
    telefonAlternativ: str(r.telefonAlternativ || r.telefon_alternativ),
    email: str(r.email),
    // Adressen — Hauptwohnsitz (Heimat)
    hauptwohnsitzStrasse: str(r.hauptwohnsitzStrasse || r.heimatadresse || r.heimat_strasse),
    hauptwohnsitzPlz: str(r.hauptwohnsitzPlz || r.heimatPlz || r.heimat_plz),
    hauptwohnsitzOrt: str(r.hauptwohnsitzOrt || r.heimatOrt || r.heimat_ort),
    hauptwohnsitzLand: str(r.hauptwohnsitzLand || r.heimatLand || r.heimat_land),
    // Nebenwohnsitz (Österreich-Adresse bei Einsatz)
    nebenwohnsitzStrasse: str(r.nebenwohnsitzStrasse || r.adresse || r.strasse),
    nebenwohnsitzPlz: str(r.nebenwohnsitzPlz || r.plz),
    nebenwohnsitzOrt: str(r.nebenwohnsitzOrt || r.ort),
    nebenwohnsitzLand: str(r.nebenwohnsitzLand || r.land) || 'Österreich',
    // Österreich-Adresse für Meldezettel
    oesterreichStrasse: str(r.oesterreichStrasse || r.adresse || r.strasse),
    oesterreichPlz: str(r.oesterreichPlz || r.plz),
    oesterreichOrt: str(r.oesterreichOrt || r.ort),
    // Gewerbe
    gewerbeStatus: str(r.gewerbeStatus || r.gewerbe_status) as any || 'nicht_angemeldet',
    gewerbeName: str(r.gewerbeName || r.gewerbe_name),
    gisaNummer: str(r.gisaNummer || r.gisa_nummer),
    gewerbeAblauf: str(r.gewerbeAblauf || r.gewerbe_ablauf),
    gewerbeCheck: r.gewerbeCheck || r.gewerbe_check || undefined,
    // Qualifikationen & Skills
    deutschkenntnisse: str(r.deutschkenntnisse) as any || 'gut',
    weitereSprachenDE: str(r.weitereSprachenDE || r.weitere_sprachen),
    qualifikationen: arr(r.qualifikationen),
    fuehrerschein: bool(r.fuehrerschein),
    raucher: bool(r.raucher),
    haustierErfahrung: bool(r.haustierErfahrung || r.haustier_erfahrung),
    demenzErfahrung: bool(r.demenzErfahrung || r.demenz_erfahrung),
    erfahrungJahre: num(r.erfahrungJahre || r.erfahrung_jahre || r.erfahrungsjahre),
    // Dokumente & Arrays
    dokumente: arr(r.dokumente),
    bankverbindungen: arr(r.bankverbindungen),
    dorisChat: arr(r.dorisChat || r.doris_chat),
    einsaetze: arr(r.einsaetze),
    // Interna
    bewerbungsdatum: str(r.bewerbungsdatum),
    bewertung: str(r.bewertung) || '3',
    region: str(r.region),
    zustaendig: str(r.zustaendig),
    notizen: str(r.notizen),
    internNotizen: str(r.internNotizen || r.intern_notizen),
    betreuerinId: str(r.betreuerinId || r.betreuerin_id_extern),
    // Meta
    erstelltAm: str(r.erstelltAm || r.erstellt_am),
    aktualisiertAm: str(r.aktualisiertAm || r.aktualisiert_am),
  } as Betreuerin
}

export function useBetreuerinnen() {
  const [betreuerinnen, setBetreuerinnen] = useState<Betreuerin[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGetAll<any>(TABLE)
      const seen = new Set<string>()
      const unique = data
        .map(normalizeBetreuerin)
        .filter(b => {
          if (!b.id || seen.has(b.id)) return false
          seen.add(b.id)
          return true
        })
      setBetreuerinnen(unique)
    } catch (e) {
      console.error('useBetreuerinnen load error:', e)
      setBetreuerinnen([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (b: Omit<Betreuerin, 'id' | 'erstelltAm' | 'aktualisiertAm'>) => {
    const neu: Betreuerin = { ...b as Betreuerin, id: uid(), erstelltAm: today(), aktualisiertAm: today() }
    await apiInsert(TABLE, neu)
    await load()
    return neu
  }, [load])

  const update = useCallback(async (id: string, data: Partial<Betreuerin>) => {
    await apiUpdate(TABLE, id, { ...data, aktualisiertAm: today() })
    setBetreuerinnen(prev => prev.map(b => b.id === id ? normalizeBetreuerin({ ...b, ...data }) : b))
  }, [])

  const remove = useCallback(async (id: string) => {
    await apiDelete(TABLE, id)
    setBetreuerinnen(prev => prev.filter(b => b.id !== id))
  }, [])

  return {
    betreuerinnen, loading, reload: load,
    add, update, remove,
    addBetreuerin: add, updateBetreuerin: update, deleteBetreuerin: remove,
  }
}
