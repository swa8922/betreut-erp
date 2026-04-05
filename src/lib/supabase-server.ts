// src/lib/supabase-server.ts
// Server-seitiger Supabase Client (für API Routes) — verwendet Service Role Key
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Service Role Client: umgeht RLS, nur server-seitig verwenden!
export function getServerClient() {
  if (!url || (!serviceKey && !anonKey)) {
    throw new Error('Supabase nicht konfiguriert. Bitte .env.local befüllen.')
  }
  return createClient(url, serviceKey || anonKey)
}

export function isConfigured() {
  return !!(url && (serviceKey || anonKey))
}
