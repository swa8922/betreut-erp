// src/lib/auth.ts
// Supabase-basierte Auth mit granularen Berechtigungen

export type Role = 'gf' | 'koordination' | 'mitarbeiter'

export interface Berechtigungen {
  klienten: boolean
  betreuerinnen: boolean
  einsaetze: boolean
  finanzen: boolean
  dokumente: boolean
  kalender: boolean
  admin: boolean
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  initials: string
  berechtigungen: Berechtigungen
}

const DEFAULT_BERECHTIGUNGEN: Record<Role, Berechtigungen> = {
  gf: { klienten: true, betreuerinnen: true, einsaetze: true, finanzen: true, dokumente: true, kalender: true, admin: true },
  koordination: { klienten: true, betreuerinnen: true, einsaetze: true, finanzen: false, dokumente: true, kalender: true, admin: false },
  mitarbeiter: { klienten: true, betreuerinnen: false, einsaetze: true, finanzen: false, dokumente: false, kalender: true, admin: false },
}

const FALLBACK_USERS: (Omit<User, 'berechtigungen'> & { password: string })[] = [
  { id: 'usr_stefan', name: 'Stefan Wagner', email: 'stefan@vbetreut.at', password: 'gf2026', role: 'gf', initials: 'SW' },
  { id: 'usr_lisa', name: 'Lisa Mayer', email: 'lisa@vbetreut.at', password: 'lisa2026', role: 'koordination', initials: 'LM' },
  { id: 'usr_michaela', name: 'Michaela Huber', email: 'michaela@vbetreut.at', password: 'michi2026', role: 'mitarbeiter', initials: 'MH' },
]

export function login(email: string, password: string): User | null {
  const u = FALLBACK_USERS.find(u => u.email === email && u.password === password)
  if (!u) return null
  const user: User = { ...u, berechtigungen: DEFAULT_BERECHTIGUNGEN[u.role] }
  if (typeof window !== 'undefined') localStorage.setItem('vb_user', JSON.stringify(user))
  return user
}

export function logout() {
  if (typeof window !== 'undefined') localStorage.removeItem('vb_user')
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('vb_user')
  if (!raw) return null
  const u = JSON.parse(raw)
  if (!u.berechtigungen) u.berechtigungen = DEFAULT_BERECHTIGUNGEN[u.role as Role] || DEFAULT_BERECHTIGUNGEN.mitarbeiter
  return u
}

export function hatBerechtigung(user: User | null, modul: keyof Berechtigungen): boolean {
  if (!user) return false
  if (user.role === 'gf') return true
  return user.berechtigungen?.[modul] ?? false
}

export const ROLE_LABELS: Record<Role, string> = {
  gf: 'Geschäftsführung',
  koordination: 'Koordination',
  mitarbeiter: 'Mitarbeiter',
}

export const ROLE_COLORS: Record<Role, string> = {
  gf: 'bg-teal-100 text-teal-700',
  koordination: 'bg-sky-100 text-sky-700',
  mitarbeiter: 'bg-slate-100 text-slate-600',
}
