'use client'
import { useState, useEffect, useCallback } from 'react'
import { type Klient } from '@/lib/klienten'
import { apiGetAll, apiInsert, apiUpdate, apiDelete } from '@/lib/api-client'

const TABLE = 'klienten'
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toLocaleDateString('de-AT', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('.').reverse().join('-')

// Normalisiert einen Klienten — funktioniert egal ob camelCase oder snake_case aus DB kommt
export function normalizeKlient(raw: any): Klient {
  const str = (v: any) => (v == null ? '' : String(v))
  const num = (v: any) => (v == null || isNaN(Number(v)) ? 0 : Number(v))
  const bool = (v: any) => !!v
  const arr = (v: any) => {
    if (Array.isArray(v)) return v
    if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] } }
    return []
  }
  // Doppelte data-Wrapping auflösen
  const r = (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data))
    ? { ...raw.data, ...raw }
    : raw

  return {
    id: str(r.id),
    vorname: str(r.vorname),
    nachname: str(r.nachname),
    geburtsdatum: str(r.geburtsdatum),
    geschlecht: str(r.geschlecht),
    geburtsort: str(r.geburtsort),
    staatsbuergerschaft: str(r.staatsbuergerschaft) || 'Österreich',
    nationalitaet: str(r.nationalitaet),
    familienstand: str(r.familienstand),
    svnr: str(r.svnr),
    ausweisTyp: str(r.ausweisTyp || r.ausweis_typ),
    ausweisNr: str(r.ausweisNr || r.ausweis_nr),
    ausweisAusgestelltAm: str(r.ausweisAusgestelltAm || r.ausweis_ausgestellt_am),
    ausweisBehoerde: str(r.ausweisBehoerde || r.ausweis_behoerde),
    ausweisGueltigBis: str(r.ausweisGueltigBis || r.ausweis_gueltig_bis),
    strasse: str(r.strasse || r.adresse),
    adresse: str(r.adresse || r.strasse),
    plz: str(r.plz),
    ort: str(r.ort),
    land: str(r.land) || 'Österreich',
    bundesland: str(r.bundesland),
    stockwerk: str(r.stockwerk),
    türcode: str(r.türcode || r.tuercode),
    wohnungsschluessel: str(r.wohnungsschluessel),
    internetWlan: str(r.internetWlan || r.internet_wlan),
    raucher: bool(r.raucher),
    haustiere: bool(r.haustiere),
    haustierArt: str(r.haustierArt || r.haustier_art),
    telefon: str(r.telefon),
    telefonWhatsapp: bool(r.telefonWhatsapp || r.telefon_whatsapp),
    telefonAlternativ: str(r.telefonAlternativ || r.telefon_alternativ),
    email: str(r.email),
    pflegestufe: str(r.pflegestufe) || '0',
    pflegegeld: num(r.pflegegeld),
    mobilitaet: str(r.mobilitaet),
    hausarzt: str(r.hausarzt),
    hausarztTelefon: str(r.hausarztTelefon || r.hausarzt_telefon),
    krankenhaus: str(r.krankenhaus),
    krankenkasse: str(r.krankenkasse),
    krankenkasseNr: str(r.krankenkasseNr || r.krankenkasse_nr),
    allergien: str(r.allergien),
    medikamente: str(r.medikamente),
    besonderheiten: str(r.besonderheiten),
    tagessatzStandard: num(r.tagessatzStandard || r.tagessatz_standard) || 80,
    zahlungsart: str(r.zahlungsart),
    // Finanzen
    klientNr: str(r.klientNr || r.klient_nr),
    pflegegeld: num(r.pflegegeld),
    foerderungBis: str(r.foerderungBis || r.foerderung_bis),
    foerderungBetrag: num(r.foerderungBetrag || r.foerderung_betrag),
    telefonWhatsapp: bool(r.telefonWhatsapp || r.telefon_whatsapp),
    telefonAlternativ: str(r.telefonAlternativ || r.telefon_alternativ),
    tagessatzWochenende: num(r.tagessatzWochenende || r.tagessatz_wochenende),
    tagessatzFeiertag: num(r.tagessatzFeiertag || r.tagessatz_feiertag),
    agenturpauschale: num(r.agenturpauschale),
    taxiHin: num(r.taxiHin || r.taxi_hin),
    taxiRueck: num(r.taxiRueck || r.taxi_rueck),
    monatlicheBeitrag: num(r.monatlicheBeitrag || r.monatliche_beitrag),
    zahlungsziel: num(r.zahlungsziel),
    iban: str(r.iban),
    bic: str(r.bic),
    zahlungshinweis: str(r.zahlungshinweis),
    ernaehrung: str(r.ernaehrung),
    geschlecht: str(r.geschlecht) as any || '',
    nationalitaet: str(r.nationalitaet),
    familienstand: str(r.familienstand),
    religion: str(r.religion),
    geburtsort: str(r.geburtsort),
    mobilitaet: str(r.mobilitaet) as any || '',
    angebotAngenommenAm: str(r.angebotAngenommenAm || r.angebot_angenommen_am),
    einsaetze: arr((r as any).einsaetze),
    angebotNummer: str(r.angebotNummer || r.angebot_nummer),
    angebotDatum: str(r.angebotDatum || r.angebot_datum),
    angebotStatus: str(r.angebotStatus || r.angebot_status),
    aktuellerTurnus: str(r.aktuellerTurnus || r.aktueller_turnus) || '28',
    aktuelleBetreuerin: str(r.aktuelleBetreuerin || r.aktuelle_betreuerin),
    aktuellerEinsatzBis: str(r.aktuellerEinsatzBis || r.aktueller_einsatz_bis),
    naechsterWechsel: str(r.naechsterWechsel || r.naechster_wechsel),
    foerderung: str(r.foerderung) || 'keine',
    status: str(r.status) || 'aktiv',
    zustaendig: str(r.zustaendig),
    wiedervorlage: str(r.wiedervorlage),
    notizen: str(r.notizen),
    internNotizen: str(r.internNotizen || r.intern_notizen),
    erstelltVon: str(r.erstelltVon || r.erstellt_von),
    erstelltAm: str(r.erstelltAm || r.erstellt_am),
    aktualisiertAm: str(r.aktualisiertAm || r.aktualisiert_am),
    kontakte: arr(r.kontakte),
    dokumente: arr(r.dokumente),
    diagnosen: arr(r.diagnosen),
    foerderungen: arr(r.foerderungen),
    pflegemassnahmen: arr(r.pflegemassnahmen),
    beobachtungen: arr(r.beobachtungen),
    geraete: arr(r.geraete),
  } as Klient
}

export function useKlienten() {
  const [klienten, setKlienten] = useState<Klient[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGetAll<any>(TABLE)
      const seen = new Set<string>()
      const unique = data
        .map(normalizeKlient)
        .filter(k => {
          if (!k.id || seen.has(k.id)) return false
          seen.add(k.id)
          return true
        })
      setKlienten(unique)
    } catch (e) {
      console.error('useKlienten load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (k: Omit<Klient, 'id' | 'erstelltAm' | 'aktualisiertAm'>) => {
    const neu: Klient = { ...k as Klient, id: uid(), erstelltAm: today(), aktualisiertAm: today() }
    await apiInsert(TABLE, neu)
    await load()
    return neu
  }, [load])

  const update = useCallback(async (id: string, data: Partial<Klient>) => {
    await apiUpdate(TABLE, id, { ...data, aktualisiertAm: today() })
    setKlienten(prev => prev.map(k => k.id === id ? normalizeKlient({ ...k, ...data }) : k))
  }, [])

  const remove = useCallback(async (id: string) => {
    await apiDelete(TABLE, id)
    setKlienten(prev => prev.filter(k => k.id !== id))
  }, [])

  return {
    klienten, loading, reload: load,
    add, update, remove,
    addKlient: add, updateKlient: update, deleteKlient: remove,
  }
}
