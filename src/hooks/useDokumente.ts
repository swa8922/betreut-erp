'use client'
import { useState, useEffect, useCallback } from 'react'
import { seedVorlagen, seedLernregeln, type Vorlage, type AkteDokument, type Lernregel, type AlfredNachricht } from '@/lib/dokumente'

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

// admin_settings direkt über API laden — key-basiert
async function loadSetting(key: string, defaultVal: any) {
  try {
    const res = await fetch(`/api/db/admin_settings?id=${key}`)
    if (!res.ok) return defaultVal
    const d = await res.json()
    // Neue API gibt { value: ..., _key: ... } zurück
    if (d?.value !== undefined) return d.value
    // Fallback: Array direkt
    if (Array.isArray(d)) return d
    return defaultVal
  } catch { return defaultVal }
}

async function saveSetting(key: string, value: any) {
  try {
    await fetch('/api/db/admin_settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
  } catch (e) { console.error('saveSetting error:', e) }
}

function normalizeVorlage(v: any): Vorlage {
  return {
    ...v,
    typ: v.typ || v.vorlageTyp || 'sonstige',
    vorlageTyp: v.vorlageTyp || v.typ || 'sonstige',
    status: v.status || (v.aktiv !== false ? 'aktiv' : 'archiviert'),
    felder: Array.isArray(v.felder) ? v.felder : [],
    inhalt: v.inhalt || v.textvorlage || '',
    textvorlage: v.textvorlage || v.inhalt || '',
  } as Vorlage
}

export function useDokumenteModul() {
  const [vorlagen, setVorlagen] = useState<Vorlage[]>([])
  const [dokumente, setDokumente] = useState<AkteDokument[]>([])
  const [regeln, setRegeln] = useState<Lernregel[]>([])
  const [alfredChat, setAlfredChat] = useState<AlfredNachricht[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [v, d, r, c] = await Promise.all([
        loadSetting('dokument_vorlagen', seedVorlagen()),
        loadSetting('akte_dokumente', []),
        loadSetting('lernregeln', seedLernregeln()),
        loadSetting('alfred_chat', []),
      ])
      setVorlagen(Array.isArray(v) ? v.map(normalizeVorlage) : seedVorlagen())
      setDokumente(Array.isArray(d) ? d : [])
      setRegeln(Array.isArray(r) ? r : seedLernregeln())
      setAlfredChat(Array.isArray(c) ? c : [])
    } catch (e) {
      console.error('useDokumenteModul reload error:', e)
      setVorlagen(seedVorlagen())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  return {
    vorlagen, dokumente, regeln, alfredChat, loading, reload,
    saveVorlagen: async (v: Vorlage[]) => { await saveSetting('dokument_vorlagen', v); setVorlagen(v.map(normalizeVorlage)) },
    saveDokumente: async (d: AkteDokument[]) => { await saveSetting('akte_dokumente', d); setDokumente(d) },
    saveRegeln: async (r: Lernregel[]) => { await saveSetting('lernregeln', r); setRegeln(r) },
    saveAlfredChat: async (c: AlfredNachricht[]) => { await saveSetting('alfred_chat', c.slice(-100)); setAlfredChat(c) },
  }
}
