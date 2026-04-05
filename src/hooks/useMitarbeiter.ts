'use client'
import { useState, useEffect, useCallback } from 'react'
import { apiGetAll, apiInsert, apiUpdate, apiDelete } from '@/lib/api-client'
import type { Mitarbeiter, MitarbeiterDokument, Bankverbindung, ModulRecht } from '@/lib/mitarbeiter'

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]

function normalize(raw: any): Mitarbeiter {
  const arr = (v: any) => Array.isArray(v) ? v : []
  return {
    ...raw,
    id: raw.id || '',
    vorname: raw.vorname || '',
    nachname: raw.nachname || '',
    email: raw.email || '',
    telefon: raw.telefon || '',
    rolle: raw.rolle || raw.role || 'koordination',
    abteilung: raw.abteilung || '',
    eintrittsdatum: raw.eintrittsdatum || '',
    status: raw.status || 'aktiv',
    notizen: raw.notizen || '',
    dokumente: arr(raw.dokumente),
    bankverbindungen: arr(raw.bankverbindungen),
    rechte: arr(raw.rechte),
    erstelltAm: raw.erstelltAm || raw.erstellt_am || '',
    aktualisiertAm: raw.aktualisiertAm || raw.aktualisiert_am || '',
  } as Mitarbeiter
}

export function useMitarbeiter() {
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const data = await apiGetAll<any>('mitarbeiter')
    const seen = new Set<string>()
    setMitarbeiter(data.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true }).map(normalize))
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const save = async (id: string, updates: Partial<Mitarbeiter>) => {
    await apiUpdate('mitarbeiter', id, { ...updates, aktualisiertAm: today() })
    setMitarbeiter(prev => prev.map(m => m.id === id ? normalize({ ...m, ...updates }) : m))
  }

  return {
    mitarbeiter, loading, reload,

    create: async (data: Omit<Mitarbeiter, 'id' | 'erstelltAm' | 'aktualisiertAm'>) => {
      const neu: Mitarbeiter = { ...data as Mitarbeiter, id: uid(), erstelltAm: today(), aktualisiertAm: today() }
      await apiInsert('mitarbeiter', neu)
      await reload()
      return neu
    },

    update: async (id: string, data: Partial<Mitarbeiter>) => { await save(id, data) },
    delete: async (id: string) => { await apiDelete('mitarbeiter', id); setMitarbeiter(prev => prev.filter(m => m.id !== id)) },

    addDokument: async (id: string, dok: MitarbeiterDokument) => {
      const m = mitarbeiter.find(m => m.id === id)
      if (!m) return
      await save(id, { dokumente: [...m.dokumente, dok] })
    },
    removeDokument: async (mitarbeiterId: string, dokId: string) => {
      const m = mitarbeiter.find(m => m.id === mitarbeiterId)
      if (!m) return
      await save(mitarbeiterId, { dokumente: m.dokumente.filter(d => d.id !== dokId) })
    },
    updateRechte: async (id: string, rechte: ModulRecht[]) => { await save(id, { rechte }) },
    addBank: async (id: string, bank: Bankverbindung) => {
      const m = mitarbeiter.find(m => m.id === id)
      if (!m) return
      await save(id, { bankverbindungen: [...m.bankverbindungen, bank] })
    },
    removeBank: async (id: string, iban: string) => {
      const m = mitarbeiter.find(m => m.id === id)
      if (!m) return
      await save(id, { bankverbindungen: m.bankverbindungen.filter(b => b.iban !== iban) })
    },
  }
}
