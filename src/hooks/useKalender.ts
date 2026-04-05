'use client'
import { useState, useEffect, useCallback } from 'react'
import { apiGetAll, apiInsert, apiUpdate, apiDelete } from '@/lib/api-client'
import {
  arbeitstageZwischen,
  type KalenderEreignis, type Fahrzeug, type UrlaubsKonto,
} from '@/lib/kalender'

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]

export function useKalender() {
  const [ereignisse, setEreignisse] = useState<KalenderEreignis[]>([])
  const [fahrzeuge, setFahrzeuge] = useState<Fahrzeug[]>([])
  const [konten, setKonten] = useState<UrlaubsKonto[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [erg, fzg, knt] = await Promise.all([
        apiGetAll<any>('kalender_ereignisse'),
        apiGetAll<any>('busse'),
        apiGetAll<any>('admin_settings').then(s => {
          const k = s.find((x: any) => x.key === 'urlaubs_konten')
          return k?.value || []
        }),
      ])
      // Normalisiere Ereignisse
      setEreignisse(erg.map((e: any) => ({
        id: e.id,
        typ: e.typ || 'termin',
        titel: e.titel || '',
        von: e.von || e.datum_von || e.datum || '',
        bis: e.bis || e.datum_bis || e.datum || '',
        ganzerTag: e.ganzer_tag !== false,
        vonZeit: e.von_zeit || '',
        bisZeit: e.bis_zeit || '',
        mitarbeiterId: e.mitarbeiter_id || '',
        mitarbeiterName: e.mitarbeiter_name || '',
        ort: e.ort || '',
        notizen: e.notizen || '',
        status: e.status || 'offen',
        genehmigungsStatus: e.genehmigungsStatus || (e.typ === 'urlaub' ? 'ausstehend' : 'genehmigt'),
        erstelltAm: e.erstellt_am || '',
        aktualisiertAm: e.aktualisiert_am || '',
        ...e.data,
      } as KalenderEreignis)))
      setFahrzeuge(fzg.map((f: any) => ({
        id: f.id, name: f.name || '', kennzeichen: f.kennzeichen || '',
        kapazitaet: f.kapazitaet || 20, aktiv: f.aktiv !== false,
      })))
      setKonten(Array.isArray(knt) ? knt : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  return {
    ereignisse, fahrzeuge, konten, loading, reload,

    createEreignis: async (data: Omit<KalenderEreignis, 'id' | 'erstelltAm' | 'aktualisiertAm'>) => {
      const neu = {
        id: uid(), typ: data.typ, titel: data.titel,
        datum: data.von || data.datum || '', datum_bis: data.bis || data.datum_bis || '',
        datum_von: data.von || '', von: data.von || data.datum || '', bis: data.bis || data.datum_bis || '',
        gan_zer_tag: data.ganzerTag,
        von_zeit: data.vonZeit, bis_zeit: data.bisZeit,
        mitarbeiter_id: data.mitarbeiterId,
        mitarbeiter_name: data.mitarbeiterName,
        ort: data.ort, notizen: data.notizen,
        status: data.status || 'offen',
        erstellt_am: new Date().toISOString(),
        data: { ...data, genehmigungsStatus: data.typ === 'urlaub' ? 'ausstehend' : 'genehmigt' },
      }
      await apiInsert('kalender_ereignisse', neu)
      await reload()
    },

    updateEreignis: async (id: string, data: Partial<KalenderEreignis>) => {
      await apiUpdate('kalender_ereignisse', id, { ...data, aktualisiert_am: new Date().toISOString() })
      await reload()
    },

    deleteEreignis: async (id: string) => {
      await apiDelete('kalender_ereignisse', id)
      setEreignisse(prev => prev.filter(e => e.id !== id))
    },

    genehmige: async (id: string, von: string) => {
      await apiUpdate('kalender_ereignisse', id, { data: { genehmigungsStatus: 'genehmigt', genehmigtvon: von, genehmigt_am: today() } })
      await reload()
    },

    lehneAb: async (id: string, grund: string) => {
      await apiUpdate('kalender_ereignisse', id, { data: { genehmigungsStatus: 'abgelehnt', ablehnungsGrund: grund } })
      await reload()
    },

    saveFahrzeuge: async (list: Fahrzeug[]) => {
      // Fahrzeuge als Busse speichern
      for (const f of list) {
        await apiInsert('busse', { id: f.id, name: f.name, kennzeichen: f.kennzeichen, kapazitaet: f.kapazitaet, aktiv: f.aktiv })
          .catch(() => apiUpdate('busse', f.id, f))
      }
      await reload()
    },

    getKonto: (mitarbeiterId: string) => konten.find(k => k.mitarbeiterId === mitarbeiterId),
    saveKonten: async (list: UrlaubsKonto[]) => {
      await apiUpdate('admin_settings', 'urlaubs_konten', { value: list })
        .catch(() => apiInsert('admin_settings', { key: 'urlaubs_konten', value: list }))
      setKonten(list)
    },
  }
}
