'use client'
import { Btn, Badge } from '@/components/ui'
import {
  STATUS_LABELS, STATUS_COLORS, WECHSEL_LABELS, WECHSEL_COLORS,
  ABRECHNUNG_LABELS, ABRECHNUNG_COLORS, daysRemaining, type Einsatz,
} from '@/lib/einsaetze'
import clsx from 'clsx'

function Row({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === '' || value === null) return null
  return (
    <div className="grid gap-2 text-sm py-2 border-b border-slate-50 last:border-0"
      style={{ gridTemplateColumns: '160px 1fr' }}>
      <span className="text-slate-400 font-medium">{label}</span>
      <span className="text-slate-900">{String(value)}</span>
    </div>
  )
}

interface Props {
  einsatz: Einsatz
  canEdit: boolean
  onEdit: () => void
  onClose: () => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: Einsatz['status']) => void
}

export default function EinsatzDetail({ einsatz: e, canEdit, onEdit, onClose, onDelete, onStatusChange }: Props) {
  const remaining = daysRemaining(e.bis)
  const vonDate = new Date(e.von).toLocaleDateString('de-AT')
  const bisDate = new Date(e.bis).toLocaleDateString('de-AT')
  const wechselDate = e.wechselGeplantAm ? new Date(e.wechselGeplantAm).toLocaleDateString('de-AT') : '–'

  const urgencyColor =
    remaining < 0 ? 'text-slate-400' :
    remaining <= 3 ? 'text-rose-600' :
    remaining <= 7 ? 'text-amber-600' :
    'text-emerald-600'

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end bg-slate-900/30" onClick={onClose}>
      <div className="h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto flex flex-col"
        style={{ borderRadius: '28px 0 0 28px' }}
        onClick={ev => ev.stopPropagation()}>

        {/* ── Header ── */}
        <div className={clsx(
          'px-8 py-8 text-white flex-shrink-0',
          e.status === 'aktiv' ? 'bg-teal-700' :
          e.status === 'wechsel_offen' ? 'bg-amber-600' :
          e.status === 'geplant' ? 'bg-sky-700' :
          'bg-slate-600'
        )}>
          <div className="flex items-start justify-between mb-5">
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl cursor-pointer bg-transparent border-none">✕</button>
            {canEdit && (
              <div className="flex gap-2">
                <Btn onClick={onEdit} className="!bg-white/15 !text-white !border-white/20 hover:!bg-white/25">Bearbeiten</Btn>
                <Btn danger onClick={() => onDelete(e.id)} className="!bg-rose-500/20 !text-white !border-rose-300/30">Löschen</Btn>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest text-white/60 mb-1">
                {WECHSEL_LABELS[e.wechselTyp]} · Einsatz
              </div>
              <h1 className="text-3xl font-bold leading-tight">{e.klientName}</h1>
              <div className="text-white/70 mt-1">
                📍 {e.klientOrt}
                {e.betreuerinName && ` · ${e.betreuerinName}`}
              </div>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge label={STATUS_LABELS[e.status]} className={STATUS_COLORS[e.status]} />
            <Badge label={WECHSEL_LABELS[e.wechselTyp]} className={WECHSEL_COLORS[e.wechselTyp]} />
            <Badge label={ABRECHNUNG_LABELS[e.abrechnungsStatus]} className={ABRECHNUNG_COLORS[e.abrechnungsStatus]} />
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Zeitraum</div>
              <div className="text-sm font-semibold">{vonDate} – {bisDate}</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Verbleibend</div>
              <div className={clsx('text-2xl font-bold', remaining < 0 ? 'text-white/50' : 'text-white')}>
                {remaining < 0 ? `${Math.abs(remaining)} Tage her` : `${remaining} Tage`}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Gesamtbetrag</div>
              <div className="text-2xl font-bold">
                {e.gesamtbetrag.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })}
              </div>
            </div>
          </div>

          {/* Wechsel warning */}
          {e.status === 'wechsel_offen' && (
            <div className="mt-4 rounded-2xl bg-white/15 border border-white/25 px-5 py-3">
              <div className="text-sm font-bold mb-1">⚠️ Wechsel in {remaining} Tagen — Nachfolgerin fehlt!</div>
              <div className="text-xs text-white/80">Bitte Nachfolgerin zuweisen um automatischen Wechsellisteneintrag zu erstellen.</div>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 px-8 py-6 space-y-7">

          {/* Verknüpfungen */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">Verknüpfungen</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Klient:in</div>
                <div className="font-bold text-slate-900">{e.klientName}</div>
                <div className="text-sm text-slate-500 mt-0.5">📍 {e.klientOrt}</div>
              </div>
              <div className={clsx(
                'rounded-2xl border p-4',
                e.betreuerinName ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
              )}>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Betreuerin</div>
                {e.betreuerinName
                  ? <div className="font-bold text-slate-900">{e.betreuerinName}</div>
                  : <div className="text-amber-700 font-semibold text-sm">⚠️ Noch nicht zugewiesen</div>}
              </div>
            </div>
          </section>

          {/* Zeitraum & Abrechnung */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">Zeitraum & Abrechnung</h2>
            <div className="space-y-1">
              <Row label="Von" value={vonDate} />
              <Row label="Bis" value={bisDate} />
              <Row label="Dauer" value={`${e.turnusTage} Tage`} />
              <Row label="Tagessatz" value={`${e.tagessatz} €`} />
              <Row label="Gesamtbetrag" value={e.gesamtbetrag.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })} />
              <Row label="Abrechnungsstatus" value={ABRECHNUNG_LABELS[e.abrechnungsStatus]} />
              <Row label="Rechnungs-Nr." value={e.rechnungsId} />
            </div>

            {/* Abrechnungs-Quickactions */}
            {canEdit && e.status !== 'geplant' && (
              <div className="mt-4 flex flex-wrap gap-2">
                {e.abrechnungsStatus === 'offen' && (
                  <button onClick={() => onStatusChange(e.id, e.status)}
                    className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-teal-800">
                    → Rechnung erstellen
                  </button>
                )}
                {e.abrechnungsStatus === 'erstellt' && (
                  <button className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-sky-700">
                    → Als versendet markieren
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Wechsellogistik */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">Transport & Wechsel</h2>
            <div className="space-y-1">
              <Row label="Taxi Anreise" value={e.taxiHin} />
              <Row label="Taxi Abreise" value={e.taxiRueck} />
              <Row label="Taxikosten" value={e.taxiKosten ? `${e.taxiKosten} €` : undefined} />
              <Row label="Wechsel geplant" value={wechselDate} />
            </div>
            {e.uebergabeNotiz && (
              <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
                <div className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">Übergabenotiz</div>
                <div className="text-sm text-amber-900 whitespace-pre-wrap">{e.uebergabeNotiz}</div>
              </div>
            )}
          </section>

          {/* Nachfolge */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">Nachfolgeplanung</h2>
            {e.nachfolgerBetreuerinName
              ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Nachfolgerin geplant</div>
                  <div className="font-bold text-slate-900">{e.nachfolgerBetreuerinName}</div>
                  {e.wechselGeplantAm && (
                    <div className="text-sm text-slate-500 mt-1">
                      Wechsel am {new Date(e.wechselGeplantAm).toLocaleDateString('de-AT')}
                    </div>
                  )}
                </div>
              : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm text-amber-800">Noch keine Nachfolgerin geplant.</div>
                  {canEdit && (
                    <button onClick={onEdit}
                      className="mt-2 text-xs font-bold text-amber-700 hover:text-amber-900 cursor-pointer bg-transparent border-none underline">
                      Nachfolgerin jetzt zuweisen →
                    </button>
                  )}
                </div>}
          </section>

          {/* Notizen */}
          {e.notizen && (
            <section>
              <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">Notizen</h2>
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 whitespace-pre-wrap">{e.notizen}</div>
            </section>
          )}

          {/* Meta */}
          <section className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-100">
            <Row label="Zuständig" value={e.zustaendig} />
            <div>Erstellt am: {e.erstelltAm} · Aktualisiert: {e.aktualisiertAm}</div>
          </section>
        </div>
      </div>
    </div>
  )
}
