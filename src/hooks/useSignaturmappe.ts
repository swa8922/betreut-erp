'use client'
/**
 * useSignaturmappe — Verwaltung von Signaturmappen
 * 
 * Eine Signaturmappe = Ordner pro Klient mit Dokumenten zur Unterschrift
 * Workflow:
 *   1. Mappe erstellen (Klient + Vorlagen auswählen)
 *   2. Dokumente befüllen (Platzhalter ersetzen)
 *   3. Zur Unterschrift bereitstellen (Klient + Betreuerin)
 *   4. Nach Unterschrift archivieren
 */

import { useState, useEffect, useCallback } from 'react'

export interface SignaturDokument {
  id: string
  mappeId: string
  klientId: string
  klientName: string
  vorlageId: string
  vorlageName: string
  vorlageTyp: string
  titel: string
  inhalt: string
  status: 'ausstehend' | 'unterschrieben' | 'abgelehnt'
  unterschriftVon: string
  unterschriftAm: string
  unterzeichner: 'klient' | 'betreuerin' | 'unterkunftgeber' | 'alle'
  notizen: string
  erstelltAm: string
}

export interface Signaturmappe {
  id: string
  klientId: string
  klientName: string
  betreuerinId: string
  betreuerinName: string
  titel: string
  status: 'offen' | 'teilweise' | 'abgeschlossen' | 'archiviert'
  erstelltVon: string
  erstelltAm: string
  abgeschlossenAm: string
  archiviertAm: string
  dokumente?: SignaturDokument[]
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]

export function useSignaturmappen() {
  const [mappen, setMappen] = useState<Signaturmappe[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mappenRes, dokRes] = await Promise.all([
        fetch('/api/db/signaturmappen').then(r => r.json()),
        fetch('/api/db/signatur_dokumente').then(r => r.json()),
      ])

      const dokumente: SignaturDokument[] = (Array.isArray(dokRes) ? dokRes : []).map((row: any) => {
        const d = row.data || row  // API gibt manchmal data-Objekt
        return {
          id: row.id || d.id || '',
          mappeId: row.mappe_id || d.mappe_id || row.mappeId || '',
          klientId: row.klient_id || d.klient_id || '',
          klientName: row.klient_name || d.klient_name || '',
          vorlageId: row.vorlage_id || d.vorlage_id || '',
          vorlageName: row.vorlage_name || d.vorlage_name || '',
          vorlageTyp: row.vorlage_typ || d.vorlage_typ || '',
          titel: row.titel || d.titel || '',
          inhalt: row.inhalt || d.inhalt || '',
          status: row.status || d.status || 'ausstehend',
          unterschriftVon: row.unterschrift_von || d.unterschrift_von || '',
          unterschriftAm: row.unterschrift_am || d.unterschrift_am || '',
          unterzeichner: row.unterzeichner || d.unterzeichner || 'alle',
          notizen: row.notizen || d.notizen || '',
          erstelltAm: row.erstellt_am || d.erstellt_am || '',
        }
      })

      const mappenList: Signaturmappe[] = (Array.isArray(mappenRes) ? mappenRes : []).map((m: any) => {
        // API gibt manchmal data-Objekt — als Fallback nutzen
        const d = m.data || {}
        return {
          id: m.id || d.id || '',
          klientId: m.klient_id || d.klient_id || m.klientId || '',
          klientName: m.klient_name || d.klient_name || m.klientName || '',
          betreuerinId: m.betreuerin_id || d.betreuerin_id || m.betreuerinId || '',
          betreuerinName: m.betreuerin_name || d.betreuerin_name || m.betreuerinName || '',
          titel: m.titel || d.titel || '',
          status: m.status || d.status || 'offen',
          erstelltVon: m.erstellt_von || d.erstellt_von || m.erstelltVon || '',
          erstelltAm: m.erstellt_am || d.erstellt_am || m.erstelltAm || '',
          abgeschlossenAm: m.abgeschlossen_am || d.abgeschlossen_am || m.abgeschlossenAm || '',
          archiviertAm: m.archiviert_am || d.archiviert_am || m.archiviertAm || '',
          dokumente: dokumente.filter(dok => dok.mappeId === (m.id || d.id)),
        }
      })

      setMappen(mappenList)
    } catch (e) {
      console.error('useSignaturmappen load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Neue Signaturmappe erstellen
  const erstelleMappe = useCallback(async (params: {
    klientId: string
    klientName: string
    betreuerinId?: string
    betreuerinName?: string
    titel: string
    erstelltVon: string
    dokumente: Omit<SignaturDokument, 'id' | 'mappeId' | 'status' | 'unterschriftVon' | 'unterschriftAm' | 'erstelltAm'>[]
  }) => {
    const mappeId = uid()
    const mappe: Signaturmappe = {
      id: mappeId,
      klientId: params.klientId,
      klientName: params.klientName,
      betreuerinId: params.betreuerinId || '',
      betreuerinName: params.betreuerinName || '',
      titel: params.titel,
      status: 'offen',
      erstelltVon: params.erstelltVon,
      erstelltAm: today(),
      abgeschlossenAm: '',
      archiviertAm: '',
    }

    // Mappe speichern
    await fetch('/api/db/signaturmappen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: mappeId,
        klient_id: mappe.klientId,
        klient_name: mappe.klientName,
        betreuerin_id: mappe.betreuerinId,
        betreuerin_name: mappe.betreuerinName,
        titel: mappe.titel,
        status: 'offen',
        erstellt_von: mappe.erstelltVon,
        erstellt_am: mappe.erstelltAm,
      })
    })

    // Dokumente speichern
    const gespeicherteDok: SignaturDokument[] = []
    for (const dok of params.dokumente) {
      const dokId = uid()
      await fetch('/api/db/signatur_dokumente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dokId,
          mappe_id: mappeId,
          klient_id: dok.klientId,
          klient_name: dok.klientName,
          vorlage_id: dok.vorlageId,
          vorlage_name: dok.vorlageName,
          vorlage_typ: dok.vorlageTyp,
          titel: dok.titel,
          inhalt: dok.inhalt,
          status: 'ausstehend',
          unterzeichner: dok.unterzeichner,
          notizen: dok.notizen,
          erstellt_am: today(),
        })
      })
      gespeicherteDok.push({
        ...dok, id: dokId, mappeId,
        status: 'ausstehend', unterschriftVon: '', unterschriftAm: '', erstelltAm: today()
      })
    }

    const vollstaendigeMappe = { ...mappe, dokumente: gespeicherteDok }
    setMappen(prev => [vollstaendigeMappe, ...prev])
    return vollstaendigeMappe
  }, [])

  // Dokument als unterschrieben markieren
  const dokumentUnterschreiben = useCallback(async (mappeId: string, dokumentId: string, unterschriftVon: string) => {
    const jetzt = new Date().toISOString()
    await fetch(`/api/db/signatur_dokumente?id=${dokumentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'unterschrieben', unterschrift_von: unterschriftVon, unterschrift_am: jetzt })
    })

    setMappen(prev => prev.map(m => {
      if (m.id !== mappeId) return m
      const neueDok = (m.dokumente || []).map(d =>
        d.id === dokumentId ? { ...d, status: 'unterschrieben' as const, unterschriftVon, unterschriftAm: jetzt } : d
      )
      const alleUnterschrieben = neueDok.every(d => d.status === 'unterschrieben')
      const keinesUnterschrieben = neueDok.every(d => d.status === 'ausstehend')
      const neuerStatus = alleUnterschrieben ? 'abgeschlossen' : keinesUnterschrieben ? 'offen' : 'teilweise'
      
      // Mappe-Status updaten
      fetch(`/api/db/signaturmappen?id=${mappeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: neuerStatus, ...(alleUnterschrieben ? { abgeschlossen_am: jetzt } : {}) })
      })

      return { ...m, dokumente: neueDok, status: neuerStatus as any }
    }))
  }, [])

  // Mappe archivieren (nach vollständiger Unterschrift)
  const archivieren = useCallback(async (mappeId: string) => {
    const jetzt = new Date().toISOString()
    await fetch(`/api/db/signaturmappen?id=${mappeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archiviert', archiviert_am: jetzt })
    })
    setMappen(prev => prev.map(m => m.id === mappeId ? { ...m, status: 'archiviert', archiviertAm: jetzt } : m))
  }, [])

  return { mappen, loading, reload: load, erstelleMappe, dokumentUnterschreiben, archivieren }
}
