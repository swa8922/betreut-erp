'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import Sidebar from '@/components/Sidebar'
import EmailModal from '@/components/EmailModal'
import clsx from 'clsx'

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
function fmtDate(iso: string) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return iso }
}

interface EmailLog {
  id: string
  betreff: string
  empfaenger_email: string
  empfaenger_name: string
  inhalt: string
  typ: string
  status: string
  klient_name: string
  betreuerin_name: string
  dokument_typ: string
  erstellt_von: string
  erstellt_am: string
}

// Standard-E-Mail-Vorlagen
const EMAIL_VORLAGEN = [
  {
    id: 'vorstellung_betreuerin',
    name: '👤 Vorstellung Betreuerin',
    typ: 'vorstellung',
    betreff: 'Ihre neue Betreuerin – Vorstellung {{betreuerinName}}',
    inhalt: `Sehr geehrte {{anrede}} {{klientNachname}},

wir freuen uns, Ihnen Ihre neue Betreuerin vorstellen zu dürfen.

{{betreuerinVorname}} {{betreuerinNachname}} wird Ihnen ab {{datum}} zur Seite stehen.

Zu Ihrer Information:
• Name: {{betreuerinVorname}} {{betreuerinNachname}}
• Nationalität: {{betreuerinNationalitaet}}
• Sprachkenntnisse: Deutsch

Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.

Mit freundlichen Grüßen
Stefan Wagner
VBetreut GmbH
Krüzastraße 4, 6912 Hörbranz
Tel: +43 670 205 1951
info@vbetreut.at`,
  },
  {
    id: 'wechsel_info',
    name: '🔄 Wechsel-Information',
    typ: 'wechsel',
    betreff: 'Bevorstehender Betreuungswechsel – {{klientName}}',
    inhalt: `Sehr geehrte {{anrede}} {{klientNachname}},

wir möchten Sie über den bevorstehenden Betreuungswechsel informieren.

• Wechseldatum: {{wechselDatum}}
• Abreisende Betreuerin: {{gehtBetreuerinName}}
• Anreisende Betreuerin: {{kommtBetreuerinName}}

Die neue Betreuerin wird sich in Kürze bei Ihnen vorstellen.

Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.

Mit freundlichen Grüßen
VBetreut GmbH`,
  },
  {
    id: 'rechnung',
    name: '💶 Rechnung',
    typ: 'rechnung',
    betreff: 'Rechnung {{rechnungsNr}} vom {{datum}}',
    inhalt: `Sehr geehrte {{anrede}} {{klientNachname}},

anbei übermitteln wir Ihnen die Rechnung {{rechnungsNr}} vom {{datum}}.

Rechnungsbetrag: {{betrag}} Euro
Zahlungsziel: {{zahlungsziel}}

Bankverbindung:
Dornbirner Sparkasse
IBAN: AT06 2060 2000 0064 8568
BIC: DOSPAT2D

Bitte geben Sie bei der Überweisung die Rechnungsnummer als Verwendungszweck an.

Mit freundlichen Grüßen
VBetreut GmbH`,
  },
  {
    id: 'mahnung',
    name: '⚠️ Zahlungserinnerung',
    typ: 'mahnung',
    betreff: 'Zahlungserinnerung – Rechnung {{rechnungsNr}}',
    inhalt: `Sehr geehrte {{anrede}} {{klientNachname}},

bei der Überprüfung unserer Buchhaltung haben wir festgestellt, dass die Rechnung {{rechnungsNr}} vom {{datum}} über {{betrag}} Euro noch offen ist.

Wir bitten Sie, den offenen Betrag bis {{zahlungsziel}} zu überweisen.

Bei bereits erfolgter Zahlung bitten wir Sie, diese Erinnerung als gegenstandslos zu betrachten.

Mit freundlichen Grüßen
VBetreut GmbH`,
  },
  {
    id: 'willkommen',
    name: '🤝 Willkommen neuer Klient',
    typ: 'willkommen',
    betreff: 'Willkommen bei VBetreut – {{klientName}}',
    inhalt: `Sehr geehrte {{anrede}} {{klientNachname}},

herzlich willkommen bei VBetreut GmbH!

Wir freuen uns, Sie als neuen Klienten begrüßen zu dürfen und werden alles dafür tun, Ihnen eine qualitativ hochwertige 24h-Betreuung zu gewährleisten.

Ihre erste Betreuerin {{betreuerinVorname}} {{betreuerinNachname}} wird am {{datum}} bei Ihnen eintreffen.

Unsere Kontaktdaten:
VBetreut GmbH
Krüzastraße 4, 6912 Hörbranz
Tel: +43 670 205 1951
info@vbetreut.at

Mit freundlichen Grüßen
Stefan Wagner
VBetreut GmbH`,
  },
  {
    id: 'foerderung',
    name: '📋 Förderungsinfo',
    typ: 'foerderung',
    betreff: 'Information zur 24h-Betreuungsförderung',
    inhalt: `Sehr geehrte {{anrede}} {{klientNachname}},

wir möchten Sie über die Möglichkeiten der 24h-Betreuungsförderung informieren.

Bundesförderung:
• Bundeszuschuss: bis zu €550/Monat
• Voraussetzung: Pflegegeldstufe 3 oder höher, Gewerbeschein der Betreuerin

Landesförderung Vorarlberg:
• Zusätzliche Landesunterstützung möglich
• Antrag beim Land Vorarlberg

Gerne unterstützen wir Sie bei der Beantragung. Bitte kontaktieren Sie uns für weitere Informationen.

Mit freundlichen Grüßen
VBetreut GmbH`,
  },
  {
    id: 'allgemein',
    name: '✉️ Allgemeine Nachricht',
    typ: 'allgemein',
    betreff: '',
    inhalt: `Sehr geehrte Damen und Herren,

[Nachrichtentext]

Mit freundlichen Grüßen
Stefan Wagner
VBetreut GmbH
Krüzastraße 4, 6912 Hörbranz
Tel: +43 670 205 1951
info@vbetreut.at`,
  },
]

const STATUS_FARBE: Record<string, string> = {
  gesendet: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  fehler: 'bg-rose-50 text-rose-700 border-rose-200',
  kein_api_key: 'bg-amber-50 text-amber-700 border-amber-200',
  geplant: 'bg-blue-50 text-blue-700 border-blue-200',
}
const STATUS_LABEL: Record<string, string> = {
  gesendet: '✅ Gesendet',
  fehler: '❌ Fehler',
  kein_api_key: '📧 Via Client',
  geplant: '⏳ Geplant',
}

export default function EmailModulPage() {
  const { user, loading } = useAuth()
  const [emails, setEmails] = useState<EmailLog[]>([])
  const [laden, setLaden] = useState(true)
  const [showNeu, setShowNeu] = useState(false)
  const [aktVorlage, setAktVorlage] = useState<typeof EMAIL_VORLAGEN[0] | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'postausgang' | 'vorlagen'>('postausgang')
  const [detailEmail, setDetailEmail] = useState<EmailLog | null>(null)

  useEffect(() => {
    if (!user) return
    fetch('/api/email/send').then(r => r.ok ? r.json() : []).then(data => {
      setEmails(Array.isArray(data) ? data : [])
      setLaden(false)
    }).catch(() => setLaden(false))
  }, [user])

  const gefiltert = useMemo(() => {
    if (!search) return emails
    const q = search.toLowerCase()
    return emails.filter(e =>
      e.betreff?.toLowerCase().includes(q) ||
      e.empfaenger_email?.toLowerCase().includes(q) ||
      e.klient_name?.toLowerCase().includes(q) ||
      e.betreuerin_name?.toLowerCase().includes(q)
    )
  }, [emails, search])

  function vorlageOeffnen(v: typeof EMAIL_VORLAGEN[0]) {
    setAktVorlage(v)
    setShowNeu(true)
  }

  if (loading || laden) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden...</div>
  if (!user) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">✉️ E-Mail</h1>
            <p className="text-slate-500 mt-1">Dokumente und Nachrichten direkt versenden</p>
          </div>
          <button onClick={() => { setAktVorlage(EMAIL_VORLAGEN[EMAIL_VORLAGEN.length - 1]); setShowNeu(true) }}
            className="rounded-2xl bg-teal-700 text-white font-bold px-5 py-2.5 cursor-pointer border-none hover:bg-teal-800">
            + Neue E-Mail
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Gesamt', count: emails.length, color: 'bg-slate-50 border-slate-200 text-slate-700' },
            { label: 'Gesendet', count: emails.filter(e => e.status === 'gesendet').length, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
            { label: 'Via Client', count: emails.filter(e => e.status === 'kein_api_key').length, color: 'bg-amber-50 border-amber-200 text-amber-700' },
            { label: 'Fehler', count: emails.filter(e => e.status === 'fehler').length, color: 'bg-rose-50 border-rose-200 text-rose-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <div className="text-2xl font-bold">{s.count}</div>
              <div className="text-sm font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5">
          {[
            ['postausgang', '📤 Postausgang'],
            ['vorlagen', '📋 Vorlagen & Schnellversand'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={clsx('text-sm px-5 py-2 rounded-full border cursor-pointer font-medium transition-all',
                tab === key ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>
              {label}
            </button>
          ))}
        </div>

        {/* POSTAUSGANG */}
        {tab === 'postausgang' && (
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="E-Mails suchen..."
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-teal-400" />
              <div className="text-sm text-slate-400">{gefiltert.length} E-Mails</div>
            </div>

            {gefiltert.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-5xl mb-4">📭</div>
                <div className="text-lg font-semibold text-slate-600 mb-2">Noch keine E-Mails</div>
                <div className="text-sm">Klicken Sie auf "+ Neue E-Mail" oder wählen Sie eine Vorlage</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {gefiltert.map(email => (
                  <div key={email.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 cursor-pointer transition-all"
                    onClick={() => setDetailEmail(email)}>
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {email.empfaenger_name?.charAt(0) || email.empfaenger_email.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 text-sm truncate">{email.betreff}</div>
                        <div className="text-xs text-slate-400 flex gap-2 mt-0.5">
                          <span>An: {email.empfaenger_name || email.empfaenger_email}</span>
                          {email.klient_name && <span>· {email.klient_name}</span>}
                          {email.betreuerin_name && <span>· {email.betreuerin_name}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_FARBE[email.status] || STATUS_FARBE.geplant}`}>
                        {STATUS_LABEL[email.status] || email.status}
                      </span>
                      <div className="text-xs text-slate-400">{fmtDate(email.erstellt_am)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VORLAGEN */}
        {tab === 'vorlagen' && (
          <div className="grid grid-cols-2 gap-4">
            {EMAIL_VORLAGEN.map(v => (
              <div key={v.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-md cursor-pointer transition-all hover:border-teal-300"
                onClick={() => vorlageOeffnen(v)}>
                <div className="font-bold text-slate-900 mb-2">{v.name}</div>
                <div className="text-xs text-slate-500 mb-3 line-clamp-2">{v.betreff || 'Freier Betreff'}</div>
                <div className="text-xs text-slate-400 line-clamp-3 font-mono bg-slate-50 rounded-lg p-2">
                  {v.inhalt.substring(0, 150)}...
                </div>
                <button className="mt-3 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-xl px-3 py-1.5 cursor-pointer hover:bg-teal-100">
                  ✉️ Verwenden
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Detail-Modal */}
        {detailEmail && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClick={() => setDetailEmail(null)}>
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="bg-teal-700 px-6 py-5 flex items-center justify-between flex-shrink-0">
                <div>
                  <div className="text-xs text-white/60 mb-0.5">E-Mail Detail</div>
                  <div className="font-bold text-white">{detailEmail.betreff}</div>
                </div>
                <button onClick={() => setDetailEmail(null)} className="text-white/60 hover:text-white text-2xl bg-transparent border-none cursor-pointer">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div><span className="text-slate-400">An:</span> <span className="font-medium">{detailEmail.empfaenger_email}</span></div>
                  <div><span className="text-slate-400">Status:</span> <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_FARBE[detailEmail.status]}`}>{STATUS_LABEL[detailEmail.status]}</span></div>
                  <div><span className="text-slate-400">Datum:</span> <span className="font-medium">{fmtDate(detailEmail.erstellt_am)}</span></div>
                  <div><span className="text-slate-400">Von:</span> <span className="font-medium">{detailEmail.erstellt_von}</span></div>
                  {detailEmail.klient_name && <div><span className="text-slate-400">Klient:</span> <span className="font-medium">{detailEmail.klient_name}</span></div>}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">{detailEmail.inhalt}</pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* E-Mail Modal */}
        {showNeu && (
          <EmailModal
            betreff={aktVorlage?.betreff || ''}
            inhalt={aktVorlage?.inhalt || ''}
            typ={aktVorlage?.typ || 'allgemein'}
            erstelltVon={user?.name || 'Stefan Wagner'}
            onClose={() => { setShowNeu(false); setAktVorlage(null) }}
            onSent={logId => {
              // Neu laden
              fetch('/api/email/send').then(r => r.json()).then(data => setEmails(data || []))
            }}
          />
        )}
      </main>
    </div>
  )
}
