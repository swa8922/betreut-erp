/**
 * VBetreut CarePlus — Datenbankabstraktionsschicht
 * 
 * Unterstützt:
 *   1. Supabase (Produktion) — über /api/db/[table] Route
 *   2. Lokaler Server (PostgreSQL/SQLite) — über /api/db/[table] Route mit lokaler DB
 *   3. localStorage (Offline-Fallback) — wenn kein Server erreichbar
 * 
 * Wechsel der Datenbank: Nur NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 * in den Umgebungsvariablen ändern. Die App-Logik bleibt unverändert.
 * 
 * Für lokalem Betrieb: NEXT_PUBLIC_DB_MODE=local setzen, dann wird
 * /api/db/[table] gegen eine lokale SQLite/PostgreSQL-Datenbank gerichtet.
 */

const DB_API_BASE = '/api/db'

// ─── Typen ─────────────────────────────────────────────────────────────────

export type DbRecord = { id: string; [key: string]: any }

export interface DbProvider {
  getAll<T extends DbRecord>(table: string): Promise<T[]>
  getById<T extends DbRecord>(table: string, id: string): Promise<T | null>
  insert<T extends DbRecord>(table: string, record: T): Promise<T>
  update<T extends DbRecord>(table: string, id: string, data: Partial<T>): Promise<void>
  delete(table: string, id: string): Promise<void>
  query<T extends DbRecord>(table: string, filters: Record<string, any>): Promise<T[]>
}

// ─── API-Provider (Supabase oder lokale DB — beide über /api/db) ────────────

class ApiDbProvider implements DbProvider {
  async getAll<T extends DbRecord>(table: string): Promise<T[]> {
    try {
      const res = await fetch(`${DB_API_BASE}/${table}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return Array.isArray(data) ? data : []
    } catch {
      return LocalDbProvider.getInstance().getAll<T>(table)
    }
  }

  async getById<T extends DbRecord>(table: string, id: string): Promise<T | null> {
    try {
      const res = await fetch(`${DB_API_BASE}/${table}?id=${id}`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return LocalDbProvider.getInstance().getById<T>(table, id)
    }
  }

  async insert<T extends DbRecord>(table: string, record: T): Promise<T> {
    try {
      const res = await fetch(`${DB_API_BASE}/${table}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return record
    } catch {
      return LocalDbProvider.getInstance().insert(table, record)
    }
  }

  async update<T extends DbRecord>(table: string, id: string, data: Partial<T>): Promise<void> {
    try {
      const res = await fetch(`${DB_API_BASE}/${table}?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${errText}`)
      }
    } catch (e) {
      console.error(`[DB] PATCH ${table}/${id} fehlgeschlagen:`, e)
      await LocalDbProvider.getInstance().update(table, id, data)
    }
  }

  async delete(table: string, id: string): Promise<void> {
    try {
      await fetch(`${DB_API_BASE}/${table}?id=${id}`, { method: 'DELETE' })
    } catch {
      await LocalDbProvider.getInstance().delete(table, id)
    }
  }

  async query<T extends DbRecord>(table: string, filters: Record<string, any>): Promise<T[]> {
    const all = await this.getAll<T>(table)
    return all.filter(record =>
      Object.entries(filters).every(([key, val]) => record[key] === val)
    )
  }
}

// ─── localStorage-Fallback (Offline / Lokalbetrieb ohne Server) ─────────────

class LocalDbProvider implements DbProvider {
  private static instance: LocalDbProvider

  static getInstance(): LocalDbProvider {
    if (!LocalDbProvider.instance) LocalDbProvider.instance = new LocalDbProvider()
    return LocalDbProvider.instance
  }

  private key(table: string) { return `vbetreut_${table}` }

  private load<T>(table: string): T[] {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(this.key(table)) || '[]') } catch { return [] }
  }

  private save<T>(table: string, data: T[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(this.key(table), JSON.stringify(data))
  }

  async getAll<T extends DbRecord>(table: string): Promise<T[]> {
    return this.load<T>(table)
  }

  async getById<T extends DbRecord>(table: string, id: string): Promise<T | null> {
    return this.load<T>(table).find(r => r.id === id) || null
  }

  async insert<T extends DbRecord>(table: string, record: T): Promise<T> {
    const list = this.load<T>(table)
    if (!list.find(r => r.id === record.id)) {
      list.unshift(record)
      this.save(table, list)
    }
    return record
  }

  async update<T extends DbRecord>(table: string, id: string, data: Partial<T>): Promise<void> {
    const list = this.load<T>(table)
    const idx = list.findIndex(r => r.id === id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...data }
      this.save(table, list)
    }
  }

  async delete(table: string, id: string): Promise<void> {
    const list = this.load<DbRecord>(table).filter(r => r.id !== id)
    this.save(table, list)
  }

  async query<T extends DbRecord>(table: string, filters: Record<string, any>): Promise<T[]> {
    return this.load<T>(table).filter(r =>
      Object.entries(filters).every(([k, v]) => r[k] === v)
    )
  }
}

// ─── Singleton — wird überall verwendet ────────────────────────────────────

let _provider: DbProvider | null = null

export function getDbProvider(): DbProvider {
  if (!_provider) {
    // Im Browser: ApiDbProvider mit localStorage-Fallback
    // Auf dem Server (SSR): ApiDbProvider
    _provider = new ApiDbProvider()
  }
  return _provider
}

// Für Tests oder Offline-Betrieb: Provider überschreiben
export function setDbProvider(provider: DbProvider): void {
  _provider = provider
}

// ─── Convenience-Exports ────────────────────────────────────────────────────

export const db = {
  getAll: <T extends DbRecord>(table: string) => getDbProvider().getAll<T>(table),
  getById: <T extends DbRecord>(table: string, id: string) => getDbProvider().getById<T>(table, id),
  insert: <T extends DbRecord>(table: string, record: T) => getDbProvider().insert<T>(table, record),
  update: <T extends DbRecord>(table: string, id: string, data: Partial<T>) => getDbProvider().update<T>(table, id, data),
  delete: (table: string, id: string) => getDbProvider().delete(table, id),
  query: <T extends DbRecord>(table: string, filters: Record<string, any>) => getDbProvider().query<T>(table, filters),
}
