// src/lib/db-adapter.ts
// Universeller Daten-Adapter: Supabase (Produktion) oder localStorage (Entwicklung)
// Alle Datenoperationen laufen über diese Datei.

import { supabase, isSupabaseConfigured } from './supabase'

const USE_SUPABASE = isSupabaseConfigured()

// ── Generischer CRUD-Adapter ────────────────────────────────
export async function dbGetAll<T>(table: string, localKey: string): Promise<T[]> {
  if (USE_SUPABASE && supabase) {
    const { data, error } = await supabase.from(table).select('*').order('erstellt_am', { ascending: false })
    if (error) { console.error(`DB Fehler (${table}):`, error); return getLocal<T>(localKey) }
    return (data || []).map(row => mergeData<T>(row))
  }
  return getLocal<T>(localKey)
}

export async function dbGet<T>(table: string, id: string, localKey: string): Promise<T | null> {
  if (USE_SUPABASE && supabase) {
    const { data, error } = await supabase.from(table).select('*').eq('id', id).single()
    if (error) return null
    return mergeData<T>(data)
  }
  const list = getLocal<T & { id: string }>(localKey)
  return list.find(x => x.id === id) || null
}

export async function dbInsert<T extends { id: string }>(table: string, localKey: string, item: T): Promise<T> {
  if (USE_SUPABASE && supabase) {
    const row = toRow(item)
    const { data, error } = await supabase.from(table).insert(row).select().single()
    if (error) { console.error(`DB Insert Fehler (${table}):`, error); saveLocal(localKey, [...getLocal<T>(localKey), item]); return item }
    return mergeData<T>(data)
  }
  const list = getLocal<T>(localKey)
  list.push(item)
  saveLocal(localKey, list)
  return item
}

export async function dbUpdate<T extends { id: string }>(table: string, localKey: string, id: string, updates: Partial<T>): Promise<void> {
  if (USE_SUPABASE && supabase) {
    const row = toRow(updates)
    const { error } = await supabase.from(table).update(row).eq('id', id)
    if (error) { console.error(`DB Update Fehler (${table}):`, error) }
    return
  }
  const list = getLocal<T & { id: string }>(localKey)
  const idx = list.findIndex(x => x.id === id)
  if (idx >= 0) { list[idx] = { ...list[idx], ...updates }; saveLocal(localKey, list) }
}

export async function dbDelete(table: string, localKey: string, id: string): Promise<void> {
  if (USE_SUPABASE && supabase) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { console.error(`DB Delete Fehler (${table}):`, error) }
    return
  }
  const list = getLocal<{ id: string }>(localKey)
  saveLocal(localKey, list.filter(x => x.id !== id))
}

// ── Hilfsfunktionen ─────────────────────────────────────────

// Camelcase JS-Objekt → snake_case Datenbankzeile
function toRow(obj: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  // Alle bekannten Felder als JSONB data speichern (einfachste Methode)
  row.data = obj
  // Bekannte Spalten direkt mappen
  if (obj.id) row.id = obj.id
  if (obj.vorname !== undefined) row.vorname = obj.vorname
  if (obj.nachname !== undefined) row.nachname = obj.nachname
  if (obj.ort !== undefined) row.ort = obj.ort
  if (obj.status !== undefined) row.status = obj.status
  if (obj.erstelltAm !== undefined) row.erstellt_am = obj.erstelltAm
  if (obj.aktualisiertAm !== undefined) row.aktualisiert_am = obj.aktualisiertAm
  if (obj.klientId !== undefined) row.klient_id = obj.klientId
  if (obj.klientName !== undefined) row.klient_name = obj.klientName
  if (obj.betreuerinId !== undefined) row.betreuerin_id = obj.betreuerinId
  if (obj.betreuerinName !== undefined) row.betreuerin_name = obj.betreuerinName
  if (obj.von !== undefined) row.von = obj.von
  if (obj.bis !== undefined) row.bis = obj.bis
  if (obj.typ !== undefined) row.typ = obj.typ
  if (obj.titel !== undefined) row.titel = obj.titel
  if (obj.name !== undefined) row.name = obj.name
  return row
}

// Datenbankzeile → camelCase JS-Objekt (data JSONB hat Vorrang)
function mergeData<T>(row: Record<string, unknown>): T {
  const data = (row.data as Record<string, unknown>) || {}
  // data JSONB überschreibt die Tabellenspalten (vollständiges Objekt)
  return { ...data, id: row.id } as T
}

// localStorage Helfer
function getLocal<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  if (typeof window === 'undefined') return []
  try { return JSON.parse((typeof window !== 'undefined' ? localStorage.getItem(key) : null) || '[]') } catch { return [] }
}

function saveLocal<T>(key: string, list: T[]): void {
  if (typeof window === 'undefined') return
  if (typeof window !== 'undefined') { localStorage.setItem(key, JSON.stringify(list)) }
}
