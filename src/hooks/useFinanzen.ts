'use client'
import { useState, useEffect, useCallback } from 'react'
import { apiGetAll, apiInsert, apiUpdate, apiDelete } from '@/lib/api-client'
import {
  berechneDokumentSummen, generateSepaXml,
  type Dokument, type Artikel, type BankZahlung, type BGAuszahlung, type Position,
} from '@/lib/finanzen'

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().split('T')[0]
const year = () => new Date().getFullYear()

function normalizeDok(raw: any): Dokument {
  return {
    id: raw.id || '',
    dokumentNr: raw.dokument_nr || raw.dokumentNr || '',
    typ: raw.typ || 'rechnung',
    status: raw.status || 'entwurf',
    klientId: raw.klient_id || raw.klientId || '',
    klientName: raw.klient_name || raw.klientName || '',
    klientEmail: raw.klient_email || raw.klientEmail || '',
    betreuerinName: raw.betreuerin_name || raw.betreuerinName || '',
    einsatzId: raw.einsatz_id || raw.einsatzId || '',
    rechnungsDatum: raw.rechnungs_datum || raw.rechnungsDatum || today(),
    zahlungsziel: raw.zahlungsziel || '',
    zahlungseingangAm: raw.zahlung_eingang_am || raw.zahlungseingangAm || '',
    summeNetto: Number(raw.summe_netto || raw.summeNetto || 0),
    summeBrutto: Number(raw.summe_brutto || raw.summeBrutto || 0),
    offenerBetrag: Number(raw.offener_betrag || raw.offenerBetrag || 0),
    bezugDokumentId: raw.bezug_dokument_id || raw.bezugDokumentId || '',
    bezugDokumentNr: raw.bezug_dokument_nr || raw.bezugDokumentNr || '',
    erstelltVon: raw.erstellt_von || raw.erstelltVon || '',
    notizen: raw.notizen || '',
    erstelltAm: raw.erstellt_am || raw.erstelltAm || '',
    aktualisiertAm: raw.aktualisiert_am || raw.aktualisiertAm || '',
    positionen: Array.isArray(raw.positionen) ? raw.positionen : Array.isArray(raw.data?.positionen) ? raw.data.positionen : [],
    summeSteuern: (typeof raw.summeSteuern === 'object' && raw.summeSteuern) ? raw.summeSteuern : (typeof raw.data?.summeSteuern === 'object' ? raw.data.summeSteuern : {}),
    auditLog: Array.isArray(raw.auditLog) ? raw.auditLog : (raw.data?.auditLog || []),
    zahlungsart: raw.zahlungsart || raw.data?.zahlungsart || 'ueberweisung',
    ...(raw.data || {}),
  } as Dokument
}

export function useFinanzen() {
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [artikel, setArtikel] = useState<Artikel[]>([])
  const [zahlungen, setZahlungen] = useState<BankZahlung[]>([])
  const [auszahlungen, setAuszahlungen] = useState<BGAuszahlung[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [doks, settings] = await Promise.all([
        apiGetAll<any>('finanzen_dokumente'),
        apiGetAll<any>('admin_settings'),
      ])
      const seen = new Set<string>()
      setDokumente(doks.filter((d: any) => { if (seen.has(d.id)) return false; seen.add(d.id); return true }).map(normalizeDok))
      const artSetting = settings.find((s: any) => s.key === 'artikel')
      setArtikel(artSetting?.value || [])
      const zahlSetting = settings.find((s: any) => s.key === 'bank_zahlungen')
      setZahlungen(zahlSetting?.value || [])
      const auszSetting = settings.find((s: any) => s.key === 'auszahlungen')
      setAuszahlungen(auszSetting?.value || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  async function getNextNr(typ: string): Promise<string> {
    const key = `nr_${typ}_${year()}`
    try {
      const res = await fetch(`/api/db/nummernkreis?id=${key}`)
      if (res.ok) {
        const data = await res.json()
        const n = (data.wert || 0) + 1
        await apiUpdate('nummernkreis', key, { wert: n })
        const prefix = typ === 'rechnung' ? 'RE' : typ === 'gutschrift' ? 'GS' : typ === 'storno' ? 'ST' : 'AN'
        return `${prefix}-${year()}-${String(n).padStart(3, '0')}`
      }
    } catch {}
    return `${typ.toUpperCase()}-${year()}-${Date.now().toString().slice(-3)}`
  }

  return {
    dokumente, artikel, zahlungen, auszahlungen, loading, reload,

    createDokument: async (data: Partial<Dokument>) => {
      const nr = await getNextNr(data.typ || 'rechnung')
      const summen = data.positionen ? berechneDokumentSummen(data.positionen) : { summeNetto: 0, summeBrutto: 0, summeSteuern: {} }
      const dok: any = {
        id: uid(),
        dokument_nr: nr, dokumentNr: nr,
        typ: data.typ || 'rechnung',
        status: data.status || 'entwurf',
        klient_id: data.klientId || '', klient_name: data.klientName || '',
        betreuerin_name: data.betreuerinName || '',
        einsatz_id: data.einsatzId || '',
        rechnungs_datum: data.rechnungsDatum || today(),
        zahlungsziel: data.zahlungsziel || '',
        summe_netto: summen.summeNetto,
        summe_brutto: summen.summeBrutto,
        offener_betrag: summen.summeBrutto,
        erstellt_von: data.erstelltVon || '',
        notizen: data.notizen || '',
        erstellt_am: new Date().toISOString(),
        data: { ...data, ...summen, dokumentNr: nr, auditLog: [{ aktion: 'erstellt', von: data.erstelltVon || '', am: new Date().toISOString() }] },
      }
      await apiInsert('finanzen_dokumente', dok)
      // Einsatz als kunden_abgerechnet markieren — verhindert Doppelverrechnung
      try {
        await apiUpdate('einsaetze', einsatz.id, {
          kunden_abgerechnet: true,
          kunden_rechnung_id: dok.id,
          abrechnungsStatus: 'abgerechnet',
        })
      } catch {}
      await reload()
      return normalizeDok(dok)
    },

    updateDokument: async (id: string, data: Partial<Dokument>, benutzer?: string, aktion?: string) => {
      const existing = dokumente.find(d => d.id === id)
      const auditEntry = { aktion: aktion || 'aktualisiert', von: benutzer || '', am: new Date().toISOString() }
      const updates = {
        ...data,
        status: data.status,
        summe_brutto: data.summeBrutto,
        offener_betrag: data.offenerBetrag,
        zahlung_eingang_am: data.zahlungseingangAm,
        aktualisiert_am: new Date().toISOString(),
        data: { ...existing, ...data, auditLog: [...(existing?.auditLog || []), auditEntry] }
      }
      await apiUpdate('finanzen_dokumente', id, updates)
      setDokumente(prev => prev.map(d => d.id === id ? normalizeDok({ ...d, ...updates }) : d))
    },

    deleteDokument: async (id: string) => {
      await apiDelete('finanzen_dokumente', id)
      setDokumente(prev => prev.filter(d => d.id !== id))
    },

    createStorno: async (originalId: string, benutzer: string) => {
      const orig = dokumente.find(d => d.id === originalId)
      if (!orig) return
      const nr = await getNextNr('storno')
      const storno: Partial<Dokument> = {
        typ: 'storno', status: 'erstellt',
        klientId: orig.klientId, klientName: orig.klientName,
        betreuerinName: orig.betreuerinName,
        bezugDokumentId: orig.id, bezugDokumentNr: orig.dokumentNr,
        summeBrutto: -orig.summeBrutto, summeNetto: -orig.summeNetto,
        offenerBetrag: 0, erstelltVon: benutzer,
        positionen: orig.positionen?.map(p => ({ ...p, nettoBetrag: -p.nettoBetrag, bruttoBetrag: -p.bruttoBetrag })),
      }
      return await (await fetch('/api/db/finanzen_dokumente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: uid(), dokument_nr: nr, ...storno, erstellt_am: new Date().toISOString(), data: storno }) })).json()
    },

    createGutschrift: async (originalId: string, positionen: Position[], benutzer: string) => {
      const orig = dokumente.find(d => d.id === originalId)
      if (!orig) return
      const nr = await getNextNr('gutschrift')
      const summen = berechneDokumentSummen(positionen.map(p => ({ ...p, nettoBetrag: -p.nettoBetrag, bruttoBetrag: -p.bruttoBetrag, steuerBetrag: -(p.steuerBetrag || 0) })))
      const gut: any = {
        id: uid(), dokument_nr: nr, typ: 'gutschrift', status: 'erstellt',
        klient_id: orig.klientId, klient_name: orig.klientName,
        bezug_dokument_id: orig.id, bezug_dokument_nr: orig.dokumentNr,
        summe_brutto: summen.summeBrutto, offener_betrag: 0,
        erstellt_von: benutzer, erstellt_am: new Date().toISOString(),
        data: { ...summen, positionen, erstelltVon: benutzer }
      }
      await apiInsert('finanzen_dokumente', gut)
      await reload()
    },

    createRechnungAusEinsatz: async (params: { einsatz: any; erstelltVon: string }) => {
      const { einsatz, erstelltVon } = params
      const tage = einsatz.von && einsatz.bis ? Math.round((new Date(einsatz.bis).getTime() - new Date(einsatz.von).getTime()) / 86400000) : 28
      const tagessatz = einsatz.tagessatz || 80
      const netto = tage * tagessatz
      const brutto = Math.round(netto * 1.2 * 100) / 100
      const nr = await getNextNr('rechnung')
      const dok: any = {
        id: uid(), dokument_nr: nr, typ: 'rechnung', status: 'entwurf',
        klient_id: einsatz.klientId || '', klient_name: einsatz.klientName || '',
        betreuerin_name: einsatz.betreuerinName || '',
        einsatz_id: einsatz.id,
        rechnungs_datum: today(),
        summe_netto: netto, summe_brutto: brutto, offener_betrag: brutto,
        erstellt_von: erstelltVon, erstellt_am: new Date().toISOString(),
        data: { positionen: [{ bezeichnung: `Betreuung ${einsatz.klientName}`, menge: tage, einheit: 'Tage', nettoBetrag: netto, bruttoBetrag: brutto, steuerSatz: 20, steuerBetrag: brutto - netto }], erstelltVon }
      }
      await apiInsert('finanzen_dokumente', dok)
      // Einsatz als kunden_abgerechnet markieren — verhindert Doppelverrechnung
      try {
        await apiUpdate('einsaetze', einsatz.id, {
          kunden_abgerechnet: true,
          kunden_rechnung_id: dok.id,
          abrechnungsStatus: 'abgerechnet',
        })
      } catch {}
      await reload()
      return normalizeDok(dok)
    },

    saveArtikel: async (list: Artikel[]) => {
      await apiUpdate('admin_settings', 'artikel', { value: list })
        .catch(() => apiInsert('admin_settings', { key: 'artikel', value: list }))
      setArtikel(list)
    },

    importBankZahlungen: async (list: BankZahlung[]) => {
      const alle = [...zahlungen, ...list]
      await apiUpdate('admin_settings', 'bank_zahlungen', { value: alle })
        .catch(() => apiInsert('admin_settings', { key: 'bank_zahlungen', value: alle }))
      setZahlungen(alle)
    },

    zahlungsabgleich: (zahlung: BankZahlung) => {
      // Sucht passende Rechnung
      const re = dokumente.filter(d => d.typ === 'rechnung' && ['erstellt','versendet','mahnung'].includes(d.status))
      const byNr = re.filter(d => zahlung.verwendungszweck?.includes(d.dokumentNr))
      if (byNr.length === 1) return { match: 'eindeutig', kandidaten: byNr, hinweis: '' }
      const byBetrag = re.filter(d => Math.abs(zahlung.betrag - d.offenerBetrag) < 0.01)
      if (byBetrag.length === 1) return { match: 'eindeutig', kandidaten: byBetrag, hinweis: 'Betrag übereinstimmend' }
      if (byBetrag.length > 1) return { match: 'mehrere', kandidaten: byBetrag, hinweis: 'Mehrere mit gleichem Betrag' }
      return { match: 'keines', kandidaten: [], hinweis: 'Keine passende Rechnung' }
    },

    exportSepa: (ids: string[]) => generateSepaXml(auszahlungen.filter(a => ids.includes(a.id))),
  }
}
