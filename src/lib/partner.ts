// src/lib/partner.ts — Taxis & externe Partner

export type PartnerTyp = 'taxi' | 'pflegedienst' | 'apotheke' | 'arzt' | 'sonstiges'

export interface Partner {
  id: string
  typ: PartnerTyp
  name: string               // z.B. "Taxi Bregenz Auinger"
  kurzname: string           // z.B. "Taxi Bregenz" — für Wechselliste
  telefon: string
  telefonAlternativ: string
  email: string
  adresse: string
  ort: string
  plz: string
  region: string             // z.B. "Vorarlberg", "Wien"
  kontaktperson: string
  // Leserecht Wechselliste
  wechsellisteZugang: boolean
  wechsellistePIN: string    // 4-stellige PIN für externen Zugang
  // Konditionen
  preisHin: number           // Standard-Preis Anreise
  preisRueck: number         // Standard-Preis Abreise
  // Meta
  aktiv: boolean
  notizen: string
  erstelltAm: string
  aktualisiertAm: string
}

const KEY = 'vb_partner'
const today = () => new Date().toISOString().split('T')[0]
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

function seed(): Partner[] {
  return [
    {
      id: '1', typ: 'taxi', name: 'Taxi Auinger Bregenz', kurzname: 'Taxi Bregenz',
      telefon: '+43 5574 12345', telefonAlternativ: '+43 664 1234567',
      email: 'office@taxi-auinger.at', adresse: 'Bahnhofstraße 1',
      ort: 'Bregenz', plz: '6900', region: 'Vorarlberg', kontaktperson: 'Franz Auinger',
      wechsellisteZugang: true, wechsellistePIN: '1234',
      preisHin: 45, preisRueck: 45,
      aktiv: true, notizen: 'Bevorzugter Partner für Vorarlberg. Kennt unsere Betreuerinnen.',
      erstelltAm: '2024-01-01', aktualisiertAm: today(),
    },
    {
      id: '2', typ: 'taxi', name: 'Taxi Wien Airport Service', kurzname: 'Taxi Wien',
      telefon: '+43 1 40100', telefonAlternativ: '',
      email: 'buchung@taxi-wien.at', adresse: 'Mariahilfer Straße 100',
      ort: 'Wien', plz: '1060', region: 'Wien', kontaktperson: 'Dispatch',
      wechsellisteZugang: true, wechsellistePIN: '5678',
      preisHin: 35, preisRueck: 35,
      aktiv: true, notizen: 'Für Wien und Umgebung.',
      erstelltAm: '2024-01-01', aktualisiertAm: today(),
    },
    {
      id: '3', typ: 'taxi', name: 'Taxi Dornbirn Huber', kurzname: 'Taxi Dornbirn',
      telefon: '+43 5572 98765', telefonAlternativ: '',
      email: '', adresse: '',
      ort: 'Dornbirn', plz: '6850', region: 'Vorarlberg', kontaktperson: 'Karl Huber',
      wechsellisteZugang: false, wechsellistePIN: '',
      preisHin: 40, preisRueck: 40,
      aktiv: true, notizen: '',
      erstelltAm: '2024-06-01', aktualisiertAm: today(),
    },
  ]
}

export function getPartner(): Partner[] {
  if (typeof window === 'undefined') return []
  const raw = (typeof window!=='undefined' ? localStorage.getItem(KEY) : null)
  if (typeof window !== 'undefined') { if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s } }
  return JSON.parse(raw)
}

export function savePartner(list: Partner[]) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list))
}

export function addPartner(p: Omit<Partner, 'id' | 'erstelltAm' | 'aktualisiertAm'>): Partner {
  const list = getPartner()
  const neu: Partner = { ...p, id: uid(), erstelltAm: today(), aktualisiertAm: today() }
  savePartner([...list, neu])
  return neu
}

export function updatePartner(id: string, data: Partial<Partner>) {
  savePartner(getPartner().map(p => p.id === id ? { ...p, ...data, aktualisiertAm: today() } : p))
}

export function deletePartner(id: string) {
  savePartner(getPartner().filter(p => p.id !== id))
}

export function getTaxiPartner(): Partner[] {
  return getPartner().filter(p => p.typ === 'taxi' && p.aktiv)
}

export function getTaxiByRegion(region: string): Partner[] {
  return getTaxiPartner().filter(p =>
    p.region.toLowerCase() === region.toLowerCase() ||
    p.ort.toLowerCase().includes(region.toLowerCase())
  )
}

// PIN-basierter Zugang für Wechselliste
export function partnerByPIN(pin: string): Partner | null {
  return getPartner().find(p => p.wechsellisteZugang && p.wechsellistePIN === pin) || null
}

export const TYP_LABELS: Record<PartnerTyp, string> = {
  taxi: '🚕 Taxi', pflegedienst: '🏥 Pflegedienst', apotheke: '💊 Apotheke',
  arzt: '👨‍⚕️ Arzt', sonstiges: '🏢 Sonstiges',
}
