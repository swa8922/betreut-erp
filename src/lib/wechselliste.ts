// src/lib/wechselliste.ts
// Wechselliste wird aus Turnus-Beginn und -Ende abgeleitet.
// Ein Einsatz 01.04 - 29.04 (28 Tage) ergibt:
//   → ANREISE am 01.04 (Betreuerin reist an)
//   → ABREISE am 29.04 (Betreuerin reist ab)
//   → gleichzeitig ANREISE Nachfolge-Betreuerin am 29.04
// Noch nicht besetzte Stellen werden als WARNUNG markiert.

import type { Einsatz } from './einsaetze'
import { getKlienten } from './klienten'

export type WechselStatus = 'vorbereitung' | 'bestaetigt' | 'durchgefuehrt' | 'storniert'
export type WechselTyp = 'anreise' | 'abreise' | 'wechsel' | 'erstanreise'

export interface WechselEintrag {
  einsatzId: string
  nachfolgeEinsatzId: string

  klientId: string
  klientName: string
  klientOrt: string
  wechselDatum: string    // Das Datum des Ereignisses

  // Gehende Betreuerin (bei Abreise/Wechsel)
  gehtBetreuerinId: string
  gehtBetreuerinName: string
  abreiseDatum: string

  // Kommende Betreuerin (bei Anreise/Wechsel)
  kommtBetreuerinId: string
  kommtBetreuerinName: string
  anreiseDatum: string

  typ: string
  wechselTypRaw: WechselTyp
  turnusTage: number
  status: WechselStatus

  // Warnung wenn Stelle nicht besetzt
  warnung: string

  // Logistik
  taxiHin: string
  taxiRueck: string
  taxiKosten: number
  uebergabeNotiz: string
  zustaendig: string
  klientStrasse: string
  klientPlz: string
  klientTelefon: string
  ansprechpartner: string
}

// ── Hauptfunktion ─────────────────────────────────────────────────────────────

export function einsaetzeToWechselliste(einsaetze: Einsatz[]): WechselEintrag[] {
  const eintraege: WechselEintrag[] = []
  const klienten = typeof window !== 'undefined' ? getKlienten() : []
  const klientenMap = new Map(klienten.map(k => [k.id, k]))

  // Sortiere Einsätze nach Klient + Datum
  const aktive = einsaetze.filter(e => e.status !== 'abgebrochen' && e.von && e.bis)
  aktive.sort((a, b) => a.von.localeCompare(b.von))

  // Gruppiere nach Klient
  const nachKlient = new Map<string, Einsatz[]>()
  for (const e of aktive) {
    if (!nachKlient.has(e.klientId)) nachKlient.set(e.klientId, [])
    nachKlient.get(e.klientId)!.push(e)
  }

  for (const [klientId, keinsaetze] of nachKlient) {
    const klient = klientenMap.get(klientId)
    const hauptkontakt = klient?.kontakte?.find(k => k.hauptkontakt) || klient?.kontakte?.[0]

    for (let i = 0; i < keinsaetze.length; i++) {
      const e = keinsaetze[i]
      const naechster = keinsaetze[i + 1]

      const vonDatum = e.von
      const bisDatum = e.bis
      const tage = e.turnusTage || Math.round(
        (new Date(bisDatum).getTime() - new Date(vonDatum).getTime()) / 86400000
      )

      // Status ableiten
      let status: WechselStatus = 'vorbereitung'
      if (e.status === 'beendet') status = 'durchgefuehrt'
      else if (e.betreuerinId) status = 'bestaetigt'

      const baseEntry = {
        einsatzId: e.id,
        nachfolgeEinsatzId: naechster?.id || '',
        klientId,
        klientName: e.klientName,
        klientOrt: e.klientOrt,
        turnusTage: tage,
        taxiHin: e.taxiHin || '',
        taxiRueck: e.taxiRueck || '',
        taxiKosten: e.taxiKosten || 0,
        uebergabeNotiz: e.uebergabeNotiz || '',
        zustaendig: e.zustaendig || '',
        klientStrasse: klient?.strasse || '',
        klientPlz: klient?.plz || '',
        klientTelefon: klient?.telefon || hauptkontakt?.telefon || '',
        ansprechpartner: hauptkontakt?.name || '',
      }

      // 1. ANREISE am Einsatzbeginn (vonDatum)
      if (i === 0 || !naechster) {
        // Erstanreise (erster Einsatz für diesen Klienten)
        const warnung = !e.betreuerinId ? '⚠️ Betreuerin nicht besetzt!' : ''
        eintraege.push({
          ...baseEntry,
          wechselDatum: vonDatum,
          gehtBetreuerinId: '',
          gehtBetreuerinName: '',
          abreiseDatum: '',
          kommtBetreuerinId: e.betreuerinId || '',
          kommtBetreuerinName: e.betreuerinName || '',
          anreiseDatum: vonDatum,
          typ: i === 0 ? 'Erstanreise' : 'Anreise',
          wechselTypRaw: i === 0 ? 'erstanreise' : 'anreise',
          status,
          warnung,
        })
      }

      // 2. WECHSEL/ABREISE am Einsatzende (bisDatum)
      if (bisDatum) {
        const kommtBetreuerin = naechster?.betreuerinId || ''
        const kommtBetreuerinName = naechster?.betreuerinName || ''
        const istLetzter = !naechster
        const warnung = !kommtBetreuerin && !istLetzter ? '⚠️ Nachfolge nicht besetzt!' : ''

        if (naechster) {
          // WECHSEL: aktuelle geht, neue kommt am gleichen Tag
          let wechselStatus: WechselStatus = 'vorbereitung'
          if (e.status === 'beendet') wechselStatus = 'durchgefuehrt'
          else if (kommtBetreuerin) wechselStatus = 'bestaetigt'

          eintraege.push({
            ...baseEntry,
            einsatzId: e.id,
            nachfolgeEinsatzId: naechster.id,
            wechselDatum: bisDatum,
            gehtBetreuerinId: e.betreuerinId || '',
            gehtBetreuerinName: e.betreuerinName || '',
            abreiseDatum: bisDatum,
            kommtBetreuerinId: kommtBetreuerin,
            kommtBetreuerinName: kommtBetreuerinName,
            anreiseDatum: bisDatum,
            typ: 'Wechsel',
            wechselTypRaw: 'wechsel',
            status: wechselStatus,
            warnung,
          })
        } else {
          // ABREISE: letzter Einsatz endet, keine Nachfolge
          eintraege.push({
            ...baseEntry,
            wechselDatum: bisDatum,
            gehtBetreuerinId: e.betreuerinId || '',
            gehtBetreuerinName: e.betreuerinName || '',
            abreiseDatum: bisDatum,
            kommtBetreuerinId: '',
            kommtBetreuerinName: '',
            anreiseDatum: '',
            typ: 'Abreise',
            wechselTypRaw: 'abreise',
            status,
            warnung: '',
          })
        }
      }
    }
  }

  // Dedupliziere und sortiere nach Datum
  return eintraege.sort((a, b) => {
    const dateCmp = a.wechselDatum.localeCompare(b.wechselDatum)
    if (dateCmp !== 0) return dateCmp
    // Warnungen zuerst
    if (a.warnung && !b.warnung) return -1
    if (!a.warnung && b.warnung) return 1
    return 0
  })
}

// Frühzeitige Warnung: Einsätze die in X Tagen enden ohne Nachfolger
export function getOffeneStellen(einsaetze: Einsatz[], tageVoraus = 14): Einsatz[] {
  const heute = new Date()
  const grenze = new Date(heute.getTime() + tageVoraus * 86400000)
  const grenzeStr = grenze.toISOString().split('T')[0]

  // Finde Einsätze die bald enden und keinen Nachfolger haben
  const klientenMitNachfolger = new Set(
    einsaetze
      .filter(e => e.status === 'geplant' || e.status === 'aktiv')
      .map(e => e.klientId + '_' + e.von)
  )

  return einsaetze.filter(e => {
    if (e.status === 'abgebrochen' || e.status === 'beendet') return false
    if (!e.bis) return false
    if (e.bis > grenzeStr) return false // noch nicht dringend
    // Prüfe ob es einen Nachfolge-Einsatz für diesen Klienten gibt
    const hatNachfolger = einsaetze.some(n =>
      n.klientId === e.klientId &&
      n.id !== e.id &&
      n.von >= e.bis &&
      n.status !== 'abgebrochen'
    )
    return !hatNachfolger
  })
}

export const WECHSEL_STATUS_LABELS: Record<WechselStatus, string> = {
  vorbereitung: 'In Vorbereitung',
  bestaetigt: 'Bestätigt',
  durchgefuehrt: 'Durchgeführt',
  storniert: 'Storniert',
}

export const WECHSEL_STATUS_COLORS: Record<WechselStatus, string> = {
  vorbereitung: 'bg-amber-50 text-amber-700 border-amber-200',
  bestaetigt: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  durchgefuehrt: 'bg-slate-100 text-slate-500 border-slate-200',
  storniert: 'bg-rose-50 text-rose-600 border-rose-200',
}

export const TYP_COLORS: Record<string, string> = {
  'Wechsel': 'bg-sky-50 text-sky-700 border-sky-200',
  'Erstanreise': 'bg-violet-50 text-violet-700 border-violet-200',
  'Anreise': 'bg-teal-50 text-teal-700 border-teal-200',
  'Abreise': 'bg-slate-100 text-slate-600 border-slate-200',
}
