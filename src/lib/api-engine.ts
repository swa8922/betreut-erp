/**
 * API-Key Management + Webhook Engine
 * VBetreut CarePlus ERP — API-Stärke 2026
 */

import { createClient } from '@supabase/supabase-js'

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── API-Key Generierung ──────────────────────────────────────────
export function generiereApiKey(): { key: string; prefix: string; hash: string } {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const raw = Array.from({ length: 48 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const key = `vb_live_${raw}`
  const prefix = `vb_live_${raw.substring(0, 8)}...`
  // Einfacher Hash (in Produktion: bcrypt oder ähnlich)
  const hash = Buffer.from(key).toString('base64')
  return { key, prefix, hash }
}

// ── API-Key Validierung ──────────────────────────────────────────
export async function validiereApiKey(authHeader: string | null): Promise<{
  ok: boolean
  berechtigungen?: string[]
  fehler?: string
}> {
  if (!authHeader) return { ok: false, fehler: 'Kein Authorization Header' }

  const key = authHeader.replace('Bearer ', '').trim()
  if (!key.startsWith('vb_live_')) return { ok: false, fehler: 'Ungültiges Key-Format' }

  const hash = Buffer.from(key).toString('base64')
  const db = sb()
  const { data } = await db.from('api_keys')
    .select('*')
    .eq('key_hash', hash)
    .eq('aktiv', true)
    .single()

  if (!data) return { ok: false, fehler: 'API-Key ungültig oder deaktiviert' }

  // Letzten Zugriff aktualisieren
  await db.from('api_keys').update({ letzter_zugriff: new Date().toISOString() }).eq('id', data.id)

  return { ok: true, berechtigungen: data.berechtigungen || [] }
}

// ── Webhook Events ───────────────────────────────────────────────
export const WEBHOOK_EVENTS = [
  'rechnung.erstellt',
  'rechnung.bezahlt',
  'rechnung.storniert',
  'honorarnote.erstellt',
  'honorarnote.bezahlt',
  'klient.erstellt',
  'klient.aktualisiert',
  'einsatz.erstellt',
  'einsatz.abgeschlossen',
  'auszahlung.exportiert',
] as const

export type WebhookEvent = typeof WEBHOOK_EVENTS[number]

// ── Webhook auslösen ─────────────────────────────────────────────
export async function loescheWebhook(event: WebhookEvent, payload: object) {
  const db = sb()
  const { data: hooks } = await db.from('webhooks')
    .select('*')
    .eq('aktiv', true)
    .contains('events', [event])

  if (!hooks?.length) return

  const ergebnisse = await Promise.allSettled(
    hooks.map(async (hook: any) => {
      const body = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        version: '2026-04-01',
        data: payload,
      })

      // HMAC-Signatur
      let signature = ''
      if (hook.secret) {
        const encoder = new TextEncoder()
        const keyData = encoder.encode(hook.secret)
        const msgData = encoder.encode(body)
        try {
          const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
          const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
          signature = Buffer.from(sig).toString('hex')
        } catch {}
      }

      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VBetreut-Event': event,
          'X-VBetreut-Signature': signature,
          'X-VBetreut-Timestamp': Date.now().toString(),
          'User-Agent': 'VBetreut-ERP/2026',
        },
        body,
        signal: AbortSignal.timeout(10000),
      })

      // Log schreiben
      const logId = Date.now().toString(36) + Math.random().toString(36).slice(2)
      await db.from('webhook_log').insert({
        id: logId,
        webhook_id: hook.id,
        event,
        payload,
        status_code: res.status,
        erfolg: res.ok,
        fehler: res.ok ? '' : `HTTP ${res.status}`,
        erstellt_am: new Date().toISOString(),
      })

      await db.from('webhooks').update({
        letzter_aufruf: new Date().toISOString(),
        letzter_status: res.status,
        fehler_count: res.ok ? 0 : (hook.fehler_count || 0) + 1,
      }).eq('id', hook.id)

      return { hook: hook.name, ok: res.ok, status: res.status }
    })
  )

  return ergebnisse
}
