'use client'
// Universeller Supabase-Daten-Hook
// Ersetzt localStorage vollständig für alle Tabellen

import { useState, useEffect, useCallback } from 'react'
import { apiGetAll, apiInsert, apiUpdate, apiDelete } from '@/lib/api-client'

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]

export function useSupabaseData<T extends { id: string }>(table: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiGetAll<T>(table)
      // Duplikate entfernen
      const seen = new Set<string>()
      const unique = result.filter(r => {
        if (seen.has(r.id)) return false
        seen.add(r.id)
        return true
      })
      setData(unique)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [table])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (item: Omit<T, 'id'>) => {
    const neu = { ...item, id: uid(), erstelltAm: today(), aktualisiertAm: today() } as T
    await apiInsert(table, neu)
    await load()
    return neu
  }, [table, load])

  const update = useCallback(async (id: string, updates: Partial<T>) => {
    await apiUpdate(table, id, { ...updates, aktualisiertAm: today() })
    setData(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
  }, [table])

  const remove = useCallback(async (id: string) => {
    await apiDelete(table, id)
    setData(prev => prev.filter(d => d.id !== id))
  }, [table])

  const upsert = useCallback(async (id: string, item: Partial<T>) => {
    const exists = data.find(d => d.id === id)
    if (exists) {
      await update(id, item)
    } else {
      await add({ ...item, id } as Omit<T, 'id'>)
    }
  }, [data, add, update])

  return { data, loading, error, reload: load, add, update, remove, upsert }
}

// Spezifische Hooks für häufig verwendete Tabellen
export function useKalender() {
  return useSupabaseData<any>('kalender_ereignisse')
}

export function useTouren() {
  return useSupabaseData<any>('touren')
}

export function useBusse() {
  return useSupabaseData<any>('busse')
}

export function useDokumentVorlagen() {
  return useSupabaseData<any>('dokument_vorlagen')
}

export function usePartner() {
  return useSupabaseData<any>('partner')
}

export function useMitarbeiterDB() {
  return useSupabaseData<any>('mitarbeiter')
}
