'use client'
// src/hooks/useData.ts
// Universeller Datenhook - alle Entitäten über eine einheitliche API
import { useState, useEffect, useCallback } from 'react'
import { apiGetAll, apiInsert, apiUpdate, apiDelete } from '@/lib/api-client'

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]

export function useData<T extends { id: string }>(table: string) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await apiGetAll<T>(table)
    setItems(data)
    setLoading(false)
  }, [table])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (item: Partial<T>): Promise<T> => {
    const neu = { ...item, id: (item as any).id || uid(), erstelltAm: today(), aktualisiertAm: today() } as T
    await apiInsert(table, neu)
    setItems(prev => [neu, ...prev])
    return neu
  }, [table])

  const update = useCallback(async (id: string, data: Partial<T>): Promise<void> => {
    await apiUpdate(table, id, { ...data, aktualisiertAm: today() })
    setItems(prev => prev.map(x => x.id === id ? { ...x, ...data } : x))
  }, [table])

  const remove = useCallback(async (id: string): Promise<void> => {
    await apiDelete(table, id)
    setItems(prev => prev.filter(x => x.id !== id))
  }, [table])

  return { items, loading, reload: load, add, update, remove }
}

export function usePartner() { return useData<any>('partner') }
