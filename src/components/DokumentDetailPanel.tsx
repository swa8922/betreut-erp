'use client'
import { useState } from 'react'
import { Btn, Badge } from '@/components/ui'
import {
  type Dokument, type DokumentStatus,
  TYP_LABELS, STATUS_LABELS, STATUS_COLORS,
  VERSANDART_LABELS, ZAHLUNGSART_LABELS,
  berechneTurnusTage,
} from '@/lib/finanzen'
import clsx from 'clsx'

const fmt = (n: number) => n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('de-AT') : '–'

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
  dokument: Dokument
  canEdit: boolean
  canGF: boolean
  onEdit: () => void
  onClose: () => void
  onStorno: () => void
  onGutschrift: () => void
  onStatusChange: (status: DokumentStatus) => void
  onAngebotAnnehmen: () => void
  onAngebotInRechnung: () => void
  onPDF: () => void
}

export default function DokumentDetailPanel({
  dokument: d, canEdit, canGF, onEdit, onClose, onStorno, onGutschrift,
  onStatusChange, onAngebotAnnehmen, onAngebotInRechnung, onPDF,
}: Props) {
  const [auditOpen, setAuditOpen] = useState(false)

  const turnusInfo = d.zeitraumVon && d.zeitraumBis
    ? berechneTurnusTage(d.zeitraumVon, d.zeitraumBis)
    : null

  const istUeberfaellig = d.zahlungsziel && !['bezahlt', 'storniert'].includes(d.status)
    && new Date(d.zahlungsziel) < new Date()

  const headerColor =
    d.typ === 'storno' ? 'bg-rose-700' :
    d.typ === 'gutschrift' ? 'bg-emerald-700' :
    d.typ === 'angebot' ? 'bg-violet-700' :
    d.status === 'mahnung' ? 'bg-rose-600' :
    'bg-teal-700'

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end bg-slate-900/30" onClick={onClose}>
      <div className="h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto flex flex-col"
        style={{ borderRadius: '28px 0 0 28px' }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={clsx('px-8 py-7 text-white flex-shrink-0', headerColor)}>
          <div className="flex items-start justify-between mb-4">
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl cursor-pointer bg-transparent border-none">✕</button>
            <div className="flex gap-2 flex-wrap justify-end">
              <button onClick={onPDF}
                className="rounded-xl bg-white/15 px-4 py-2 text-sm font-bold text-white cursor-pointer border-none hover:bg-white/25">
                📄 PDF
              </button>
              {canEdit && !['storniert', 'bezahlt'].includes(d.status) && (
                <button onClick={onEdit}
                  className="rounded-xl bg-white/15 px-4 py-2 text-sm font-bold text-white cursor-pointer border-none hover:bg-white/25">
                  ✏️ Bearbeiten
                </button>
              )}
              {canGF && d.typ === 'rechnung' && !d.stornoDokumentId && d.status !== 'storniert' && (
                <button onClick={onStorno}
                  className="rounded-xl bg-rose-500/30 px-4 py-2 text-sm font-bold text-white cursor-pointer border-none hover:bg-rose-500/40">
                  Storno
                </button>
              )}
              {canGF && d.typ === 'rechnung' && d.status !== 'storniert' && (
                <button onClick={onGutschrift}
                  className="rounded-xl bg-emerald-500/30 px-4 py-2 text-sm font-bold text-white cursor-pointer border-none hover:bg-emerald-500/40">
                  Gutschrift
                </button>
              )}
            </div>
          </div>

          <div className="text-xs uppercase tracking-widest text-white/60 mb-1">{TYP_LABELS[d.typ]}</div>
          <h2 className="text-3xl font-bold">{d.dokumentNr}</h2>
          <div className="text-white/70 mt-1">
            {d.klientName}
            {d.betreuerinName && ` · ${d.betreuerinName}`}
          </div>
          {d.bezugDokumentNr && (
            <div className="text-white/50 text-sm mt-0.5">Bezug auf: {d.bezugDokumentNr}</div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            <Badge label={STATUS_LABELS[d.status]} className={STATUS_COLORS[d.status]} />
            {istUeberfaellig && <Badge label="⚠️ Überfällig" className="bg-rose-500 text-white border-rose-400" />}
            {d.stornoDokumentId && <Badge label="Storniert" className="bg-rose-100 text-rose-700 border-rose-200" />}
            {d.gutschriftIds?.length > 0 && <Badge label={`${d.gutschriftIds.length} Gutschrift(en)`} className="bg-emerald-100 text-emerald-700 border-emerald-200" />}
          </div>

          {/* Betragskacheln */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Netto</div>
              <div className="text-xl font-bold">{fmt(d.summeNetto)}</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="text-xs text-white/60 uppercase tracking-wide mb-1">MwSt. gesamt</div>
              <div className="text-xl font-bold">
                {fmt(Object.values(d.summeSteuern || {}).reduce((s, v) => s + v, 0))}
              </div>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3">
              <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Brutto</div>
              <div className="text-2xl font-bold">{fmt(d.summeBrutto)}</div>
            </div>
          </div>

          {/* Offener Betrag */}
          {d.offenerBetrag > 0 && d.offenerBetrag !== d.summeBrutto && (
            <div className="mt-3 rounded-2xl bg-amber-500/20 border border-amber-300/30 px-5 py-3">
              <div className="text-sm font-bold">Offen: {fmt(d.offenerBetrag)}</div>
              <div className="text-xs text-white/70 mt-0.5">Bereits gezahlt: {fmt(d.gezahltBetrag)}</div>
            </div>
          )}
        </div>

        {/* ── Aktions-Workflow ── */}
        {canEdit && (
          <div className="px-8 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-2">
            {d.status === 'entwurf' && (
              <button onClick={() => onStatusChange('erstellt')}
                className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-teal-800">
                → Fertigstellen (Erstellt)
              </button>
            )}
            {d.status === 'erstellt' && (
              <button onClick={() => onStatusChange('versendet')}
                className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-teal-800">
                → Als versendet markieren
              </button>
            )}
            {(d.status === 'versendet' || d.status === 'teilbezahlt') && (
              <>
                <button onClick={() => onStatusChange('bezahlt')}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-emerald-800">
                  ✓ Als bezahlt markieren
                </button>
                <button onClick={() => onStatusChange('mahnung')}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 cursor-pointer hover:bg-rose-100">
                  Mahnung erstellen
                </button>
              </>
            )}
            {d.status === 'mahnung' && (
              <button onClick={() => onStatusChange('bezahlt')}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-emerald-800">
                ✓ Als bezahlt markieren
              </button>
            )}
            {/* Angebot-Workflow */}
            {d.typ === 'angebot' && d.status !== 'angenommen' && d.status !== 'storniert' && (
              <button onClick={onAngebotAnnehmen}
                className="rounded-xl bg-violet-700 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-violet-800">
                ✓ Angebot angenommen
              </button>
            )}
            {d.typ === 'angebot' && d.status === 'angenommen' && (
              <button onClick={onAngebotInRechnung}
                className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white cursor-pointer border-none hover:bg-teal-800">
                → In Rechnung umwandeln
              </button>
            )}
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 px-8 py-6 space-y-7">

          {/* Turnusberechnung */}
          {turnusInfo && (
            <section>
              <h3 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">Turnusberechnung</h3>
              <div className="rounded-2xl bg-teal-50 border border-teal-200 p-4">
                <div className="text-sm font-bold text-teal-800 mb-1">
                  {fmtDate(d.zeitraumVon)} – {fmtDate(d.zeitraumBis)} = <span className="text-xl">{turnusInfo.tage} Tage</span>
                </div>
                <div className="text-xs text-teal-600">{turnusInfo.detail}</div>
              </div>
            </section>
          )}

          {/* Positionen */}
          <section>
            <h3 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">
              Positionen ({d.positionen.length})
            </h3>
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="grid bg-slate-50 px-4 py-2 border-b text-xs font-bold uppercase text-slate-400"
                style={{ gridTemplateColumns: '1fr 55px 80px 55px 85px 85px' }}>
                <div>Bezeichnung</div>
                <div className="text-right">Menge</div>
                <div className="text-right">Einzel</div>
                <div className="text-center">MwSt.</div>
                <div className="text-right">Netto</div>
                <div className="text-right">Brutto</div>
              </div>
              {d.positionen.map((p, i) => (
                <div key={p.id} className={clsx('grid px-4 py-3 border-b border-slate-50 last:border-0 text-sm', i % 2 === 1 && 'bg-slate-50/50')}
                  style={{ gridTemplateColumns: '1fr 55px 80px 55px 85px 85px' }}>
                  <div>
                    <div className="font-medium text-slate-900">{p.bezeichnung}</div>
                    {p.beschreibung && <div className="text-xs text-slate-400 mt-0.5">{p.beschreibung}</div>}
                  </div>
                  <div className="text-right text-slate-600">{p.menge} {p.einheit}</div>
                  <div className="text-right text-slate-600">{fmt(p.einzelpreis)}</div>
                  <div className="text-center">
                    <span className={clsx('text-xs rounded-full px-1.5 py-0.5',
                      p.steuersatz === 0 ? 'bg-slate-100 text-slate-500' :
                      p.steuersatz === 10 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                    )}>
                      {p.steuersatz}%
                    </span>
                  </div>
                  <div className="text-right text-slate-600">{fmt(p.nettoBetrag)}</div>
                  <div className="text-right font-semibold text-slate-900">{fmt(p.bruttoBetrag)}</div>
                </div>
              ))}

              {/* Summen-Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Summe Netto</span><span className="font-semibold">{fmt(d.summeNetto)}</span>
                </div>
                {Object.entries(d.summeSteuern || {}).filter(([, v]) => v !== 0).map(([satz, betrag]) => (
                  <div key={satz} className="flex justify-between text-sm text-slate-500">
                    <span>MwSt. {satz}%</span><span>{fmt(betrag)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-teal-700 pt-2 border-t border-teal-200 text-base">
                  <span>Gesamtbetrag</span><span className="text-xl">{fmt(d.summeBrutto)}</span>
                </div>
                {d.gezahltBetrag > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Davon gezahlt</span><span className="font-semibold">{fmt(d.gezahltBetrag)}</span>
                  </div>
                )}
                {d.offenerBetrag > 0 && (
                  <div className="flex justify-between text-sm font-bold text-amber-600">
                    <span>Noch offen</span><span>{fmt(d.offenerBetrag)}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Zahlung & Versand */}
          <section>
            <h3 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">Zahlung & Versand</h3>
            <div className="space-y-0">
              <Row label="Rechnungsdatum" value={fmtDate(d.rechnungsDatum)} />
              <Row label="Zahlungsziel" value={fmtDate(d.zahlungsziel)} />
              <Row label="Zahlungsart" value={ZAHLUNGSART_LABELS[d.zahlungsart]} />
              <Row label="Versandart" value={VERSANDART_LABELS[d.versandart]} />
              <Row label="Versendet am" value={fmtDate(d.versendetAm)} />
              <Row label="Versendet an" value={d.versendetAn?.join(', ')} />
              <Row label="Zahlung eingegangen" value={fmtDate(d.zahlungseingangAm)} />
              {d.bankrReferenz && <Row label="Bank-Referenz" value={d.bankrReferenz} />}
            </div>
          </section>

          {/* Angebot-Details */}
          {d.typ === 'angebot' && (
            <section>
              <h3 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">Angebot</h3>
              <Row label="Gültig bis" value={fmtDate(d.angebotGueltigBis)} />
              <Row label="Angenommen am" value={fmtDate(d.angebotAngenommenAm)} />
              {new Date(d.angebotGueltigBis) < new Date() && d.status !== 'angenommen' && (
                <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                  ⚠️ Angebot ist abgelaufen.
                </div>
              )}
            </section>
          )}

          {/* Notizen */}
          {(d.notizen || d.internNotizen) && (
            <section>
              <h3 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">Notizen</h3>
              {d.notizen && (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4 text-sm text-slate-700 whitespace-pre-wrap mb-3">{d.notizen}</div>
              )}
              {d.internNotizen && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4">
                  <div className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">Interne Notiz</div>
                  <div className="text-sm text-amber-900 whitespace-pre-wrap">{d.internNotizen}</div>
                </div>
              )}
            </section>
          )}

          {/* Verknüpfte Dokumente */}
          {(d.stornoDokumentId || d.gutschriftIds?.length > 0 || d.bezugDokumentNr) && (
            <section>
              <h3 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">Verknüpfte Dokumente</h3>
              {d.bezugDokumentNr && <Row label="Bezug auf" value={d.bezugDokumentNr} />}
              {d.stornoDokumentId && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mt-2">Zu dieser Rechnung existiert ein Storno.</div>}
              {d.gutschriftIds?.length > 0 && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 mt-2">{d.gutschriftIds.length} Gutschrift(en) vorhanden.</div>}
            </section>
          )}

          {/* Audit-Log */}
          <section>
            <button type="button" onClick={() => setAuditOpen(v => !v)}
              className="flex items-center gap-2 text-base font-bold text-slate-900 w-full pb-2 border-b border-slate-100 cursor-pointer bg-transparent border-x-0 border-t-0">
              <span>Änderungsprotokoll ({d.auditLog?.length || 0})</span>
              <span className="text-slate-400 text-sm">{auditOpen ? '▲' : '▼'}</span>
            </button>
            {auditOpen && d.auditLog && (
              <div className="mt-3 space-y-2">
                {[...d.auditLog].reverse().map((log, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="text-xs text-slate-400 w-40 flex-shrink-0">{new Date(log.zeitpunkt).toLocaleString('de-AT')}</div>
                    <div>
                      <span className="font-medium text-slate-700">{log.benutzer}</span>
                      <span className="text-slate-500"> · {log.aktion}</span>
                      {log.altWert && <div className="text-xs text-slate-400 mt-0.5">{log.feld}: {log.altWert} → {log.neuWert}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Meta */}
          <section className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-100">
            <div>Erstellt von: {d.erstelltVon || '–'} · am {fmtDate(d.erstelltAm)}</div>
            <div>Zuletzt aktualisiert: {fmtDate(d.aktualisiertAm)}</div>
          </section>
        </div>
      </div>
    </div>
  )
}
