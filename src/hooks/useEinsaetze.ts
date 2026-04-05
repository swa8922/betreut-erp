'use client'
import { useState, useEffect, useCallback } from 'react'
import { type Einsatz } from '@/lib/einsaetze'
import { apiGetAll, apiInsert, apiUpdate, apiDelete } from '@/lib/api-client'

const TABLE = 'einsaetze'
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]

export function useEinsaetze() {
  const [einsaetze, setEinsaetze] = useState<Einsatz[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const raw = await apiGetAll<any>(TABLE)
    // Normalisiere API-Daten (snake_case → camelCase + data-JSONB)
    const data = raw.map((e: any): Einsatz => {
      const d = e.data || {}
      return {
        id: e.id,
        klientId: e.klient_id || d.klientId || '',
        klientName: e.klient_name || d.klientName || '',
        klientOrt: e.klient_ort || d.klientOrt || '',
        betreuerinId: e.betreuerin_id || d.betreuerinId || '',
        betreuerinName: e.betreuerin_name || d.betreuerinName || '',
        von: e.von || d.von || '',
        bis: e.bis || d.bis || '',
        turnusTage: Number(e.turnus_tage || d.turnusTage || 28),
        status: e.status || d.status || 'geplant',
        wechselTyp: e.wechsel_typ || d.wechselTyp || 'erstanreise',
        tagessatz: Number(e.tagessatz || d.tagessatz || 80),
        gesamtbetrag: Number(e.gesamtbetrag || d.gesamtbetrag || 0),
        abrechnungsStatus: e.abrechnungs_status || e.abrechnungsStatus || d.abrechnungsStatus || 'offen',
        rechnungsId: e.rechnungs_id || d.rechnungsId || '',
        taxiHin: e.taxi_hin || d.taxiHin || '',
        taxiRueck: e.taxi_rueck || d.taxiRueck || '',
        taxiKosten: Number(e.taxi_kosten || d.taxiKosten || 0),
        uebergabeNotiz: e.uebergabe_notiz || d.uebergabeNotiz || '',
        nachfolgerBetreuerinId: e.nachfolger_betreuerin_id || d.nachfolgerBetreuerinId || '',
        nachfolgerBetreuerinName: e.nachfolger_betreuerin_name || d.nachfolgerBetreuerinName || '',
        wechselGeplantAm: e.wechsel_geplant_am || d.wechselGeplantAm || '',
        zustaendig: e.zustaendig || d.zustaendig || '',
        notizen: e.notizen || d.notizen || '',
        // bewertung ist nicht im Einsatz-Type
        erstelltAm: e.erstellt_am || e.erstelltAm || d.erstelltAm || '',
        aktualisiertAm: e.aktualisiert_am || e.aktualisiertAm || d.aktualisiertAm || '',
        // Extra Abrechnungsfelder als passthrough
        ...(e.kunden_abgerechnet !== undefined ? { kunden_abgerechnet: e.kunden_abgerechnet } as any : {}),
        ...(e.honorar_abgerechnet !== undefined ? { honorar_abgerechnet: e.honorar_abgerechnet } as any : {}),
      } as Einsatz
    })
    setEinsaetze(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Akzeptiert vollständiges Einsatz ODER Partial — ergänzt fehlende Pflichtfelder
  const add = useCallback(async (e: Partial<Einsatz> & { klientId: string; von: string; bis: string }) => {
    const neu: Einsatz = {
      ...e as Einsatz,
      id: e.id || uid(),
      erstelltAm: e.erstelltAm || today(),
      aktualisiertAm: today(),
    }
    await apiInsert(TABLE, neu)
    setEinsaetze(prev => [neu, ...prev])
    return neu
  }, [])

  const update = useCallback(async (id: string, data: Partial<Einsatz>) => {
    await apiUpdate(TABLE, id, { ...data, aktualisiertAm: today() })
    setEinsaetze(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))
  }, [])

  const remove = useCallback(async (id: string) => {
    await apiDelete(TABLE, id)
    setEinsaetze(prev => prev.filter(e => e.id !== id))
  }, [])

  // Aliases für Kompatibilität mit altem Code
  const addEinsatz = add
  const updateEinsatz = update
  const deleteEinsatz = remove
  const reload = load

  return { einsaetze, loading, reload, add, update, remove, addEinsatz, updateEinsatz, deleteEinsatz }
}
