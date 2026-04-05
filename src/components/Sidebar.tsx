'use client'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_LABELS, ROLE_COLORS, hatBerechtigung } from '@/lib/auth'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'

const NAV = [
  { href: '/dashboard',       label: '🏠 Dashboard',          modul: null },
  { href: '/klienten',        label: 'Klient:innen',           modul: 'klienten' },
  { href: '/betreuerinnen',   label: 'Betreuerinnen',          modul: 'betreuerinnen' },
  { href: '/kalender',        label: 'Kalender',               modul: 'kalender' },
  { href: '/aufgaben',        label: 'Aufgaben',               modul: null },
  { href: '/turnus',          label: 'Turnusverwaltung',       modul: 'einsaetze' },
  { href: '/wechselliste',    label: 'Wechselliste',           modul: 'einsaetze' },
  { href: '/touren',          label: '🚌 Tourenplanung',       modul: 'einsaetze' },
  { href: '/rechnungen',       label: 'Rechnungen',             modul: null },
  { href: '/auszahlungen',      label: 'Auszahlungen',           modul: null },
  { href: '/finanzen',        label: '💶 Finanzen',            modul: 'finanzen' },
  { href: '/dokumente-modul', label: '📄 Dokumente (Alfred)',  modul: 'dokumente' },
  { href: '/dokumente',       label: 'Dokumente',              modul: 'dokumente' },
  { href: '/mitarbeiter',     label: '👥 Mitarbeiter',         modul: 'admin' },
  { href: '/notizen',         label: 'Notizen',                modul: null },
  { href: '/partner',         label: 'Partner & Taxis',        modul: 'einsaetze' },
  { href: '/admin',           label: '⚙️ Administration',      modul: 'admin' },
] as const

export default function Sidebar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  if (!user) return null

  const erlaubteNav = NAV.filter(item =>
    item.modul === null || hatBerechtigung(user, item.modul as any)
  )

  return (
    <aside className="w-64 flex-shrink-0 bg-[#eaecef] border-r border-slate-200 flex flex-col overflow-y-auto"
      style={{ minHeight: '100vh' }}>
      <div className="px-5 py-6 flex flex-col gap-0 flex-1">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-teal-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">VB</div>
          <div>
            <div className="text-xl font-bold text-slate-900 leading-tight">VBetreut</div>
            <div className="text-xs text-slate-500">CarePlus ERP</div>
          </div>
        </div>

        {/* User card */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 mb-5">
          <div className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-1">Angemeldet</div>
          <div className="text-lg font-bold text-slate-900">{user?.name}</div>
          <span className={clsx('inline-block mt-1 rounded-full px-3 py-0.5 text-xs font-semibold', ROLE_COLORS[user?.role ?? 'mitarbeiter'])}>
            {ROLE_LABELS[user?.role ?? 'mitarbeiter']}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 mb-6">
          {erlaubteNav.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <button key={item.href} onClick={() => router.push(item.href)}
                className={clsx(
                  'w-full text-left px-4 py-3 rounded-xl text-sm transition-all cursor-pointer border',
                  active
                    ? 'border-teal-300 bg-white text-slate-900 font-semibold shadow-sm'
                    : 'border-transparent text-slate-600 hover:bg-white/60 font-normal'
                )}>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Quick actions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
          <div className="text-sm font-bold text-slate-900 mb-3">Schnellaktionen</div>
          <div className="flex flex-col gap-2">
            {hatBerechtigung(user, 'klienten') && (
              <button onClick={() => router.push('/klienten?neu=1')}
                className="w-full rounded-xl bg-teal-700 px-3 py-2.5 text-left text-xs font-semibold text-white cursor-pointer border-none hover:bg-teal-800 transition-colors">
                Neue Klient:in anlegen
              </button>
            )}
            <button onClick={() => router.push('/notizen')}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
              Notiz schreiben
            </button>
            {hatBerechtigung(user, 'einsaetze') && (
              <button onClick={() => router.push('/turnus?neu=1')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
                Einsatz planen
              </button>
            )}
          </div>
        </div>

        {/* Logout */}
        <button onClick={logout}
          className="mt-auto w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-50 hover:text-rose-600 transition-colors">
          Abmelden
        </button>
      </div>
    </aside>
  )
}
