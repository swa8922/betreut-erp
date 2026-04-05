'use client'
import { useState, useEffect } from 'react'

export interface FirmaData {
  name: string
  strasse: string
  plz: string
  ort: string
  land: string
  telefon: string
  email: string
  web: string
  ustId: string
  steuerNr: string
  gericht: string
  gf: string
  bank: string
  iban: string
  bic: string
  logoUrl: string
  logoName?: string
  unterschriftUrl: string
  stempelUrl: string
  rechnungsFuss?: string
  firmenname?: string
  slogan?: string
}

export const FIRMA_DEFAULT: FirmaData = {
  name: 'VBetreut GmbH',
  firmenname: 'VBetreut GmbH',
  strasse: 'Krüzastraße 4',
  plz: '6912',
  ort: 'Hörbranz',
  land: 'Österreich',
  telefon: '+43 670 205 1951',
  email: 'info@vbetreut.at',
  web: 'www.vbetreut.at',
  ustId: 'ATU81299827',
  steuerNr: '98399/4740',
  gericht: 'BG Bregenz',
  gf: 'Stefan Wagner, Margot Schön',
  bank: 'Dornbirner Sparkasse',
  iban: 'AT06 2060 2000 0064 8568',
  bic: 'DOSPAT2D',
  logoUrl: '',
  unterschriftUrl: '',
  stempelUrl: '',
  rechnungsFuss: 'VBetreut GmbH · Krüzastraße 4 · 6912 Hörbranz · ATU81299827',
  slogan: '24h Betreuung mit Herz',
}

let _cachedFirma: FirmaData | null = null
let _loading = false
const _listeners: ((f: FirmaData) => void)[] = []

async function loadFirmaFromDB(): Promise<FirmaData> {
  if (_cachedFirma) return _cachedFirma
  try {
    const res = await fetch('/api/db/admin_settings?id=firma')
    if (res.ok) {
      const d = await res.json()
      // Neue API: { value: {...}, _key: 'firma' } ODER direkt { name, strasse, ... }
      const firmaData = d?.value || d
      if (firmaData && firmaData.name) {
        _cachedFirma = { ...FIRMA_DEFAULT, ...firmaData }
        return _cachedFirma
      }
    }
  } catch {}
  return FIRMA_DEFAULT
}

export async function saveFirmaToDB(firma: FirmaData): Promise<void> {
  _cachedFirma = firma
  _listeners.forEach(l => l(firma))
  try {
    await fetch('/api/db/admin_settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'firma', key: 'firma', value: firma }),
    })
  } catch {}
}

export function useFirma() {
  const [firma, setFirma] = useState<FirmaData>(_cachedFirma || FIRMA_DEFAULT)
  const [loading, setLoading] = useState(!_cachedFirma)

  useEffect(() => {
    if (_cachedFirma) { setFirma(_cachedFirma); return }
    loadFirmaFromDB().then(f => { setFirma(f); setLoading(false) })
    _listeners.push(setFirma)
    return () => { const i = _listeners.indexOf(setFirma); if (i >= 0) _listeners.splice(i, 1) }
  }, [])

  async function saveFirma(f: FirmaData) {
    setFirma(f)
    await saveFirmaToDB(f)
  }

  // Hilfsfunktion: Platzhalter im Text ersetzen
  function ersetzeFirmaPlatzhalter(text: string): string {
    return text
      .replace(/\{\{firma_name\}\}/g, firma.name)
      .replace(/\{\{firma_strasse\}\}/g, firma.strasse)
      .replace(/\{\{firma_plz\}\}/g, firma.plz)
      .replace(/\{\{firma_ort\}\}/g, firma.ort)
      .replace(/\{\{firma_telefon\}\}/g, firma.telefon)
      .replace(/\{\{firma_email\}\}/g, firma.email)
      .replace(/\{\{firma_web\}\}/g, firma.web)
      .replace(/\{\{firma_ust_id\}\}/g, firma.ustId)
      .replace(/\{\{firma_steuer_nr\}\}/g, firma.steuerNr)
      .replace(/\{\{firma_gericht\}\}/g, firma.gericht)
      .replace(/\{\{firma_gf\}\}/g, firma.gf)
      .replace(/\{\{firma_bank\}\}/g, firma.bank)
      .replace(/\{\{firma_iban\}\}/g, firma.iban)
      .replace(/\{\{firma_bic\}\}/g, firma.bic)
  }

  return { firma, loading, saveFirma, ersetzeFirmaPlatzhalter }
}
