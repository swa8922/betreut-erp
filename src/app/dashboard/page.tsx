'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/hooks/useAuth'
import { apiGetAll } from '@/lib/api-client'
import clsx from 'clsx'

const fmt = (n: number) => n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })
const today = () => new Date().toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

// ── Widget-Definitionen ──────────────────────────────────────
const ALLE_WIDGETS = [
  { id: 'klienten',      label: 'Klienten aktiv',            icon: '🏠', roles: ['gf','koordination','mitarbeiter'] },
  { id: 'betreuerinnen', label: 'Betreuerinnen im Einsatz',  icon: '👩‍⚕️', roles: ['gf','koordination'] },
  { id: 'wechsel',       label: 'Offene Wechsel',            icon: '🔁', roles: ['gf','koordination','mitarbeiter'] },
  { id: 'finanzen',      label: 'Offene Abrechnungen',       icon: '💶', roles: ['gf'] },
  { id: 'umsatz',        label: 'Monatsumsatz',              icon: '📈', roles: ['gf'] },
  { id: 'dokumente',     label: 'Neue Dokumente',            icon: '📄', roles: ['gf','koordination'] },
  { id: 'partner',       label: 'Aktive Partner',            icon: '🚕', roles: ['gf','koordination'] },
  { id: 'mitarbeiter',   label: 'Team Mitglieder',           icon: '👥', roles: ['gf'] },
]

const SCHNELLLINKS_ALLE = [
  { label: 'Neue Klientin',        icon: '👤', href: '/klienten',      roles: ['gf','koordination'] },
  { label: 'Betreuerin hinzufügen',icon: '🩺', href: '/betreuerinnen', roles: ['gf','koordination'] },
  { label: 'Wechselliste',         icon: '🔄', href: '/wechselliste',  roles: ['gf','koordination','mitarbeiter'] },
  { label: 'Abrechnung',           icon: '💶', href: '/finanzen',      roles: ['gf'] },
  { label: 'Turnus planen',        icon: '📅', href: '/turnus',        roles: ['gf','koordination'] },
  { label: 'Dokumente',            icon: '📁', href: '/dokumente-modul',roles: ['gf','koordination','mitarbeiter'] },
  { label: 'Touren',               icon: '🗺️', href: '/touren',        roles: ['gf','koordination'] },
  { label: 'Partner & Taxis',      icon: '🚖', href: '/partner',       roles: ['gf','koordination'] },
]

const AKTIVITAETEN = [
  { title: 'Neue Klientin angelegt',           meta: 'Maria P. • vor 18 Min.',      status: 'Erfasst',    color: 'bg-teal-50 text-teal-700' },
  { title: 'Betreuerinnen-Wechsel bestätigt',  meta: 'Einsatz Wien 12 • vor 42 Min.',status: 'Bestätigt', color: 'bg-sky-50 text-sky-700' },
  { title: 'Abrechnung März vorbereitet',      meta: 'Team Nord • heute',            status: 'In Prüfung', color: 'bg-amber-50 text-amber-700' },
  { title: 'Partnerdokument aktualisiert',     meta: 'Care Partner Süd • heute',     status: 'Neu',        color: 'bg-violet-50 text-violet-700' },
]

const TERMINE = [
  { time: '08:30', title: 'Team-Übergabe',    place: 'Büro Wien' },
  { time: '10:00', title: 'Klientenaufnahme', place: 'Hausbesuch' },
  { time: '13:30', title: 'Partnergespräch',  place: 'Online' },
  { time: '16:00', title: 'Abrechnungscheck', place: 'Backoffice' },
]

// ── Hauptkomponente ──────────────────────────────────────────
export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [stats, setStats] = useState({ klienten: 0, betreuerinnen: 0, wechsel: 0, finanzen: 0, umsatz: 0, dokumente: 0, partner: 0, mitarbeiter: 0 })
  const [editMode, setEditMode] = useState(false)
  const [activeWidgets, setActiveWidgets] = useState<string[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  // Widgets laden (aus localStorage je User)
  useEffect(() => {
    if (!user) return
    const key = `vb_dashboard_widgets_${user?.id}`
    // Dashboard-Layout: localStorage für UI-Präferenzen (geräte-spezifisch)
    const saved = typeof window !== 'undefined' ? localStorage.getItem(key) : null
    if (saved) {
      setActiveWidgets(JSON.parse(saved))
    } else {
      // Default: alle Widgets die für die Rolle erlaubt sind
      const defaults = ALLE_WIDGETS.filter(w => w.roles.includes(user?.role)).map(w => w.id)
      setActiveWidgets(defaults)
    }
  }, [user])

  // Stats laden
  const loadStats = useCallback(async () => {
    if (!user) return
    setStatsLoading(true)
    try {
      const [klienten, betreuerinnen, einsaetze, partner, mitarbeiter, dokumente, finanzen] = await Promise.all([
        apiGetAll<any>('klienten'),
        apiGetAll<any>('betreuerinnen'),
        apiGetAll<any>('einsaetze'),
        apiGetAll<any>('partner'),
        apiGetAll<any>('mitarbeiter'),
        apiGetAll<any>('dokumente'),
        apiGetAll<any>('finanzen_dokumente'),
      ])
      const aktiveKlienten = klienten.filter((k: any) => k.status === 'aktiv' || !k.status)
      const imEinsatz = betreuerinnen.filter((b: any) => b.status === 'im_einsatz')
      const offeneWechsel = einsaetze.filter((e: any) => e.status === 'wechsel_offen' || e.wechselTyp === 'wechsel')
      const offeneRechnungen = finanzen.filter((d: any) => d.typ === 'rechnung' && ['erstellt','versendet','mahnung'].includes(d.status))
      const umsatz = finanzen.filter((d: any) => d.typ === 'rechnung' && d.status === 'bezahlt').reduce((s: number, d: any) => s + (d.summeBrutto || 0), 0)
      const aktivePartner = partner.filter((p: any) => p.aktiv !== false)

      setStats({
        klienten: aktiveKlienten.length,
        betreuerinnen: imEinsatz.length,
        wechsel: offeneWechsel.length,
        finanzen: offeneRechnungen.length,
        umsatz,
        dokumente: dokumente.length,
        partner: aktivePartner.length,
        mitarbeiter: mitarbeiter.length,
      })
    } catch (e) {
      console.error('Stats laden fehlgeschlagen:', e)
    } finally {
      setStatsLoading(false)
    }
  }, [user])

  useEffect(() => { loadStats() }, [loadStats])

  function toggleWidget(id: string) {
    if (!user) return
    const next = activeWidgets.includes(id)
      ? activeWidgets.filter(w => w !== id)
      : [...activeWidgets, id]
    setActiveWidgets(next)
    localStorage.setItem(`vb_dashboard_widgets_${user?.id}`, JSON.stringify(next))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden ...</div>
  if (!user) return null

  const erlaubteWidgets = ALLE_WIDGETS.filter(w => w.roles.includes(user?.role))
  const sichtbareWidgets = erlaubteWidgets.filter(w => activeWidgets.includes(w.id))
  const schnelllinks = SCHNELLLINKS_ALLE.filter(l => l.roles.includes(user?.role))

  const widgetWert = (id: string) => {
    if (statsLoading) return '...'
    const map: Record<string, string> = {
      klienten: stats.klienten.toString(),
      betreuerinnen: stats.betreuerinnen.toString(),
      wechsel: stats.wechsel.toString(),
      finanzen: stats.finanzen.toString(),
      umsatz: fmt(stats.umsatz),
      dokumente: stats.dokumente.toString(),
      partner: stats.partner.toString(),
      mitarbeiter: stats.mitarbeiter.toString(),
    }
    return map[id] || '–'
  }

  const widgetChange = (id: string) => {
    const map: Record<string, string> = {
      klienten: '+6 diesen Monat',
      betreuerinnen: '+3 diese Woche',
      wechsel: stats.wechsel > 0 ? `${Math.min(2, stats.wechsel)} dringend` : 'Alle versorgt',
      finanzen: stats.finanzen > 0 ? '5 heute fällig' : 'Alles beglichen',
      umsatz: 'Bezahlte Rechnungen',
      dokumente: 'Gesamt im Archiv',
      partner: 'Taxis & Dienste',
      mitarbeiter: 'Im System aktiv',
    }
    return map[id] || ''
  }

  const widgetColor = (id: string) => {
    const map: Record<string, string> = {
      klienten: 'border-teal-200 bg-teal-50',
      betreuerinnen: 'border-sky-200 bg-sky-50',
      wechsel: stats.wechsel > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white',
      finanzen: stats.finanzen > 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white',
      umsatz: 'border-emerald-200 bg-emerald-50',
      dokumente: 'border-violet-200 bg-violet-50',
      partner: 'border-orange-200 bg-orange-50',
      mitarbeiter: 'border-slate-200 bg-white',
    }
    return map[id] || 'border-slate-200 bg-white'
  }

  const widgetTextColor = (id: string) => {
    const map: Record<string, string> = {
      klienten: 'text-teal-700',
      betreuerinnen: 'text-sky-700',
      wechsel: stats.wechsel > 0 ? 'text-amber-700' : 'text-slate-700',
      finanzen: stats.finanzen > 0 ? 'text-rose-700' : 'text-slate-700',
      umsatz: 'text-emerald-700',
      dokumente: 'text-violet-700',
      partner: 'text-orange-700',
      mitarbeiter: 'text-slate-700',
    }
    return map[id] || 'text-slate-700'
  }

  return (
    <div className="flex min-h-screen bg-[#f4f7fb]">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8 lg:p-10">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Header */}
          <header className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-[#103b66] mb-1">VBetreut CarePlus</div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">{(() => { const h = new Date().getHours(); return h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend' })()} , {user?.name?.split(' ')[0]} 👋</h1>
              <p className="text-slate-500 mt-1">{today()}</p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button onClick={() => setEditMode(v => !v)}
                className={clsx('rounded-2xl px-5 py-3 text-sm font-semibold border transition-all cursor-pointer',
                  editMode
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50')}>
                {editMode ? '✓ Fertig' : '⚙️ Dashboard anpassen'}
              </button>
              <button onClick={loadStats}
                className="rounded-2xl bg-[#103b66] px-5 py-3 text-sm font-semibold text-white cursor-pointer hover:bg-[#0d3059] border-none">
                🔄 Aktualisieren
              </button>
            </div>
          </header>

          {/* Edit Mode Banner */}
          {editMode && (
            <div className="rounded-3xl border-2 border-dashed border-[#103b66]/30 bg-[#103b66]/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-2xl">🎨</div>
                <div>
                  <div className="font-bold text-[#103b66]">Dashboard anpassen</div>
                  <div className="text-sm text-slate-500">Wählen Sie welche Widgets Sie sehen möchten. Ihre Einstellungen werden gespeichert.</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {erlaubteWidgets.map(w => (
                  <button key={w.id} onClick={() => toggleWidget(w.id)}
                    className={clsx('rounded-2xl px-4 py-2 text-sm font-semibold cursor-pointer border-2 transition-all',
                      activeWidgets.includes(w.id)
                        ? 'bg-[#103b66] text-white border-[#103b66]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-[#103b66]/40')}>
                    {w.icon} {w.label}
                    {activeWidgets.includes(w.id) ? ' ✓' : ' +'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fokus-Banner (nur wenn Wechsel offen) */}
          {stats.wechsel > 0 && !editMode && (
            <div className="rounded-3xl bg-[#103b66] text-white p-6 flex items-center justify-between cursor-pointer hover:bg-[#0d3059] transition-all"
              onClick={() => router.push('/wechselliste')}>
              <div className="flex items-center gap-4">
                <div className="text-3xl">⚠️</div>
                <div>
                  <div className="font-bold text-lg">Handlungsbedarf: {stats.wechsel} offene Wechsel</div>
                  <div className="text-white/70 text-sm mt-0.5">Klicken um zur Wechselliste zu gelangen → sofortige Zuordnung erforderlich</div>
                </div>
              </div>
              <div className="text-4xl font-bold text-white/80">{stats.wechsel}</div>
            </div>
          )}

          {/* KPI-Widgets */}
          {sichtbareWidgets.length > 0 && (
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {sichtbareWidgets.map(w => (
                <div key={w.id}
                  className={clsx('rounded-[28px] p-6 border shadow-sm transition-all hover:shadow-md', widgetColor(w.id),
                    editMode && 'ring-2 ring-[#103b66]/20 cursor-pointer')}
                  onClick={() => editMode && toggleWidget(w.id)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-slate-500">{w.label}</div>
                      <div className={clsx('text-4xl font-bold mt-2', widgetTextColor(w.id))}>
                        {widgetWert(w.id)}
                      </div>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-white/70 flex items-center justify-center text-2xl shadow-sm">
                      {w.icon}
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-slate-500 font-medium">{widgetChange(w.id)}</div>
                  {editMode && (
                    <div className="mt-3 text-xs text-rose-600 font-semibold">✕ Klicken zum Entfernen</div>
                  )}
                </div>
              ))}
              {editMode && erlaubteWidgets.filter(w => !activeWidgets.includes(w.id)).map(w => (
                <div key={w.id}
                  className="rounded-[28px] p-6 border-2 border-dashed border-slate-200 bg-white/50 cursor-pointer hover:border-[#103b66]/40 transition-all"
                  onClick={() => toggleWidget(w.id)}>
                  <div className="flex items-start justify-between opacity-40">
                    <div>
                      <div className="text-sm text-slate-500">{w.label}</div>
                      <div className="text-4xl font-bold mt-2 text-slate-400">–</div>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl">{w.icon}</div>
                  </div>
                  <div className="mt-3 text-xs text-teal-600 font-semibold">+ Klicken zum Hinzufügen</div>
                </div>
              ))}
            </section>
          )}

          {/* Schnellklick */}
          <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Schnellzugriff</h2>
              <span className="text-sm text-slate-400">Ihre häufigsten Aktionen</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {schnelllinks.map(item => (
                <button key={item.label} onClick={() => router.push(item.href)}
                  className="rounded-2xl border border-slate-200 bg-[#f8fafc] hover:bg-[#eef5fb] hover:border-[#103b66]/30 px-4 py-4 text-left transition-all shadow-sm cursor-pointer">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="font-semibold text-slate-900 text-sm">{item.label}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Aktivitäten + Termine */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Aktivitäten */}
            <div className="xl:col-span-2 bg-white rounded-[28px] p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-slate-900">Letzte Aktivitäten</h2>
                <button className="text-sm text-[#103b66] font-semibold cursor-pointer">Alle anzeigen</button>
              </div>
              <div className="space-y-3">
                {AKTIVITAETEN.map(a => (
                  <div key={a.title}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 hover:bg-slate-100 transition-colors cursor-pointer">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{a.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{a.meta}</div>
                    </div>
                    <span className={clsx('shrink-0 rounded-full px-3 py-1 text-xs font-semibold', a.color)}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Heute */}
            <div className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-slate-900">Heute</h2>
                <span className="text-sm text-slate-400">{new Date().toLocaleDateString('de-AT', { weekday: 'long' })}</span>
              </div>
              <div className="space-y-3">
                {TERMINE.map(t => (
                  <div key={t.time} className="rounded-2xl border border-slate-100 p-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                    <div className="text-xs text-[#2ea7a0] font-bold">{t.time}</div>
                    <div className="font-semibold text-slate-900 text-sm mt-1">{t.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{t.place}</div>
                  </div>
                ))}
              </div>

              {/* Rolle-Info */}
              <div className="mt-5 rounded-2xl bg-[#103b66]/5 border border-[#103b66]/10 p-4">
                <div className="text-xs text-[#103b66]/60 font-semibold uppercase tracking-wider mb-1">Ihre Rolle</div>
                <div className="font-bold text-[#103b66]">
                  {user?.role === 'gf' ? '👑 Geschäftsführung' : user?.role === 'koordination' ? '📋 Koordination' : '👤 Mitarbeiter:in'}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {user?.role === 'gf' ? 'Vollzugriff auf alle Module' : user?.role === 'koordination' ? 'Zugriff auf Planung & Klienten' : 'Eingeschränkter Lesezugriff'}
                </div>
              </div>
            </div>

          </section>
        </div>
      </main>
    </div>
  )
}
