'use client'
import { useState, useEffect, useCallback } from 'react'
import { getRechnungen, updateRechnung, deleteRechnung, createRechnungFromEinsatz, type Rechnung } from '@/lib/abrechnung'
import type { Einsatz } from '@/lib/einsaetze'

export function useAbrechnung() {
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([])
  const reload = useCallback(() => setRechnungen(getRechnungen()), [])
  useEffect(() => { reload() }, [reload])

  function createFromEinsatz(einsatz: Einsatz) {
    const r = createRechnungFromEinsatz(einsatz)
    reload()
    return r
  }

  function update(id: string, data: Partial<Rechnung>) {
    updateRechnung(id, data)
    reload()
  }

  function remove(id: string) {
    deleteRechnung(id)
    reload()
  }

  return { rechnungen, createFromEinsatz, update, remove, reload }
}
