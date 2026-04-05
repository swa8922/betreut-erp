/**
 * VBetreut CarePlus — API-Client
 * 
 * Verwendet db-provider.ts als Abstraktionsschicht.
 * Daten kommen aus Supabase (über /api/db/[table]),
 * mit automatischem localStorage-Fallback wenn offline.
 * 
 * Datenbank wechseln: Nur ENV-Variablen ändern, dieser Code bleibt gleich.
 */

import { db } from './db-provider'

export async function apiGetAll<T>(table: string): Promise<T[]> {
  return db.getAll<any>(table)
}

export async function apiGet<T>(table: string, id: string): Promise<T | null> {
  return db.getById<any>(table, id)
}

export async function apiInsert<T>(table: string, item: T): Promise<T> {
  return db.insert<any>(table, item as any)
}

export async function apiUpdate<T>(table: string, id: string, updates: Partial<T>): Promise<void> {
  return db.update<any>(table, id, updates as any)
}

export async function apiDelete(table: string, id: string): Promise<void> {
  return db.delete(table, id)
}

export async function apiQuery<T>(table: string, filters: Record<string, any>): Promise<T[]> {
  return db.query<any>(table, filters)
}
