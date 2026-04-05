'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import Sidebar from '@/components/Sidebar'

interface Vorlage {
  firmenname: string; adresse: string; plz_ort: string; telefon: string
  email: string; website: string; iban: string; bic: string
  uid: string; steuernr: string; gericht: string; gf: string
  kleinunternehmer: boolean; zahlungsziel_tage: number
  farbe: string; logo_url: string
  vortext_rechnung: string; nachtext_rechnung: string; fusszeile: string
  vortext_honorar: string
}

const DEFAULT: Vorlage = {
  firmenname: 'VBetreut GmbH', adresse: 'Krüzastraße 4', plz_ort: '6912 Hörbranz',
  telefon: '+43 670 205 1951', email: 'info@vbetreut.at', website: 'www.vbetreut.at',
  iban: 'AT06 2060 2000 0064 8568', bic: 'DOSPAT2D',
  uid: 'ATU81299827', steuernr: '98399/4740', gericht: 'BG Bregenz',
  gf: 'Stefan Wagner, Margot Schön', kleinunternehmer: true, zahlungsziel_tage: 14,
  farbe: '#0f766e', logo_url: '',
  vortext_rechnung: 'Sehr geehrte Damen und Herren,\nvielen Dank für Ihr Vertrauen. Wir erlauben uns, folgende Leistungen in Rechnung zu stellen:',
  nachtext_rechnung: 'Bitte überweisen Sie den Gesamtbetrag innerhalb von 14 Tagen auf das angegebene Konto.\n\nMit freundlichen Grüßen\nVBetreut GmbH',
  fusszeile: 'VBetreut GmbH · Krüzastraße 4 · 6912 Hörbranz · GF: Stefan Wagner, Margot Schön · Dornbirner Sparkasse · IBAN: AT06 2060 2000 0064 8568',
  vortext_honorar: 'Honorarnote für geleistete 24h-Personenbetreuung:',
}

export default function VorlagenPage() {
  const { user, loading } = useAuth()
  const [vorlage, setVorlage] = useState<Vorlage>(DEFAULT)
  const [laden, setLaden] = useState(true)
  const [gespeichert, setGespeichert] = useState(false)
  const [tab, setTab] = useState<'firma' | 'texte' | 'design' | 'vorschau'>('firma')

  useEffect(() => {
    if (!user) return
    fetch('/api/db/admin_settings?key=rechnungs_vorlage')
      .then(r => r.json())
      .then(data => {
        if (data?.value) setVorlage({ ...DEFAULT, ...data.value })
        setLaden(false)
      }).catch(() => setLaden(false))
  }, [user])

  function set<K extends keyof Vorlage>(k: K, v: Vorlage[K]) {
    setVorlage(prev => ({ ...prev, [k]: v }))
    setGespeichert(false)
  }

  async function speichern() {
    await fetch('/api/db/admin_settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'rechnungs_vorlage', value: vorlage }),
    }).catch(() =>
      fetch('/api/db/admin_settings?key=rechnungs_vorlage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: vorlage }),
      })
    )
    setGespeichert(true)
    setTimeout(() => setGespeichert(false), 2000)
  }

  if (loading || laden) return (
    <div className="flex min-h-screen"><Sidebar />
      <main className="flex-1 flex items-center justify-center text-slate-400">Laden...</main>
    </div>
  )
  if (!user) return null

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">VBETREUT · ERP</div>
            <h1 className="text-3xl font-bold text-slate-900">📄 Vorlagen</h1>
            <p className="text-slate-500 mt-1">Rechnungs- und Honorarnoten-Layout anpassen</p>
          </div>
          <button onClick={speichern}
            className="rounded-xl bg-teal-700 text-white font-bold px-6 py-2.5 cursor-pointer border-none hover:bg-teal-800 transition-colors">
            {gespeichert ? '✓ Gespeichert!' : '💾 Speichern'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          {([['firma', '🏢 Firmendaten'], ['texte', '📝 Texte'], ['design', '🎨 Design'], ['vorschau', '👁️ Vorschau']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`text-sm px-5 py-2 rounded-full border cursor-pointer font-medium transition-all ${tab === k ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 max-w-3xl">

          {/* FIRMENDATEN */}
          {tab === 'firma' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="font-bold text-slate-900 mb-4">Firmendaten</div>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    ['firmenname', 'Firmenname', 'text'],
                    ['adresse', 'Straße + Nr.', 'text'],
                    ['plz_ort', 'PLZ + Ort', 'text'],
                    ['telefon', 'Telefon', 'text'],
                    ['email', 'E-Mail', 'email'],
                    ['website', 'Website', 'text'],
                    ['gf', 'Geschäftsführung', 'text'],
                    ['gericht', 'Firmenbuchgericht', 'text'],
                  ] as const).map(([k, l, t]) => (
                    <div key={k}>
                      <div className="text-xs font-semibold text-slate-500 mb-1">{l}</div>
                      <input type={t} value={String(vorlage[k] || '')}
                        onChange={e => set(k, e.target.value as any)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="font-bold text-slate-900 mb-4">Bankverbindung & Steuer</div>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    ['iban', 'IBAN', 'text'],
                    ['bic', 'BIC', 'text'],
                    ['uid', 'USt-ID', 'text'],
                    ['steuernr', 'Steuernummer', 'text'],
                  ] as const).map(([k, l]) => (
                    <div key={k}>
                      <div className="text-xs font-semibold text-slate-500 mb-1">{l}</div>
                      <input value={String(vorlage[k] || '')} onChange={e => set(k, e.target.value as any)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
                    </div>
                  ))}
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-1">Zahlungsziel (Tage)</div>
                    <input type="number" value={vorlage.zahlungsziel_tage} onChange={e => set('zahlungsziel_tage', +e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <input type="checkbox" id="ku" checked={vorlage.kleinunternehmer}
                      onChange={e => set('kleinunternehmer', e.target.checked)}
                      className="accent-teal-600 w-4 h-4" />
                    <label htmlFor="ku" className="text-sm font-semibold text-slate-700 cursor-pointer">
                      Kleinunternehmer (§6 Abs. 1 Z 27 UStG) — keine USt
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TEXTE */}
          {tab === 'texte' && (
            <div className="space-y-4">
              {([
                ['vortext_rechnung', 'Einleitungstext Rechnung'],
                ['nachtext_rechnung', 'Abschlusstext Rechnung'],
                ['vortext_honorar', 'Text Honorarnote'],
                ['fusszeile', 'Fußzeile (alle Dokumente)'],
              ] as const).map(([k, l]) => (
                <div key={k} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="font-semibold text-slate-700 text-sm mb-2">{l}</div>
                  <textarea value={String(vorlage[k] || '')} onChange={e => set(k, e.target.value as any)}
                    rows={4} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none resize-none focus:border-teal-400" />
                </div>
              ))}
            </div>
          )}

          {/* DESIGN */}
          {tab === 'design' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="font-bold text-slate-900 mb-4">Farbe & Logo</div>
                <div className="flex items-center gap-6 mb-6">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-2">Hauptfarbe</div>
                    <div className="flex items-center gap-3">
                      <input type="color" value={vorlage.farbe || '#0f766e'}
                        onChange={e => set('farbe', e.target.value)}
                        className="w-12 h-12 rounded-xl cursor-pointer border border-slate-200" />
                      <input value={vorlage.farbe || '#0f766e'} onChange={e => set('farbe', e.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400 w-32" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-slate-500 mb-2">Logo URL (optional)</div>
                    <input value={vorlage.logo_url || ''} onChange={e => set('logo_url', e.target.value)}
                      placeholder="https://... (PNG oder SVG empfohlen)"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
                  </div>
                </div>
                <div className="rounded-xl p-4 text-white text-sm font-semibold" style={{ backgroundColor: vorlage.farbe || '#0f766e' }}>
                  Vorschau Farbe: {vorlage.firmenname}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                <strong>Tipp:</strong> Die Farbe wird als Tabellenheader-Farbe und für Überschriften auf Rechnungen und Honorarnoten verwendet. Standard ist Teal (#0f766e).
              </div>
            </div>
          )}

          {/* VORSCHAU */}
          {tab === 'vorschau' && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 text-sm font-semibold text-slate-600">
                Vorschau — Rechnungslayout (A4)
              </div>
              <div className="p-8 font-sans text-slate-800 text-sm leading-relaxed" style={{ minHeight: '600px', maxWidth: '700px' }}>
                {/* Header */}
                <div className="flex justify-between mb-8">
                  <div>
                    {vorlage.logo_url && <img src={vorlage.logo_url} alt="Logo" className="h-12 mb-2" />}
                    <div className="text-xl font-bold" style={{ color: vorlage.farbe }}>{vorlage.firmenname}</div>
                    <div className="text-xs text-slate-500 mt-1">{vorlage.adresse}</div>
                    <div className="text-xs text-slate-500">{vorlage.plz_ort}</div>
                    <div className="text-xs text-slate-500">{vorlage.telefon} · {vorlage.email}</div>
                    <div className="text-xs text-slate-500">USt-ID: {vorlage.uid}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold" style={{ color: vorlage.farbe }}>Rechnung</div>
                    <div className="text-xs text-slate-500 mt-1">RE-2026-001</div>
                    <div className="text-xs text-slate-500">Datum: {new Date().toLocaleDateString('de-AT')}</div>
                    <div className="text-xs text-slate-500">Fällig: in {vorlage.zahlungsziel_tage} Tagen</div>
                  </div>
                </div>

                {/* Empfänger */}
                <div className="mb-6">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Rechnungsempfänger</div>
                  <div className="font-semibold">Musterklient GmbH</div>
                </div>

                {/* Vortext */}
                {vorlage.vortext_rechnung && (
                  <div className="mb-4 text-xs text-slate-600 whitespace-pre-line">{vorlage.vortext_rechnung}</div>
                )}

                {/* Tabelle */}
                <table className="w-full text-xs mb-4" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: vorlage.farbe, color: 'white' }}>
                      <th className="p-2 text-left">Beschreibung</th>
                      <th className="p-2 text-center">Tage</th>
                      <th className="p-2 text-right">Einzelpreis</th>
                      <th className="p-2 text-right">Gesamt</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td className="p-2">24h-Personenbetreuung Musterklient<br /><span className="text-slate-400">01.04.2026 – 29.04.2026</span></td>
                      <td className="p-2 text-center">29</td>
                      <td className="p-2 text-right">80,00 €</td>
                      <td className="p-2 text-right font-semibold">2.320,00 €</td>
                    </tr>
                  </tbody>
                </table>
                <div className="text-right font-bold mb-2" style={{ color: vorlage.farbe }}>Gesamtbetrag: 2.320,00 €</div>
                {vorlage.kleinunternehmer && (
                  <div className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl px-3 py-1.5 inline-block mb-4">
                    Kleinunternehmer gem. § 6 Abs. 1 Z 27 UStG — keine USt ausgewiesen
                  </div>
                )}

                {/* Nachtext */}
                {vorlage.nachtext_rechnung && (
                  <div className="mt-4 text-xs text-slate-600 whitespace-pre-line border-t border-slate-100 pt-4">{vorlage.nachtext_rechnung}</div>
                )}

                {/* Bank */}
                <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs">
                  <div className="font-semibold mb-1">Zahlungsinformationen</div>
                  <div>Kontoinhaber: {vorlage.firmenname}</div>
                  <div>IBAN: {vorlage.iban} · BIC: {vorlage.bic}</div>
                  <div>Verwendungszweck: RE-2026-001</div>
                </div>

                {/* Fußzeile */}
                <div className="mt-6 pt-3 border-t border-slate-200 text-xs text-slate-400">{vorlage.fusszeile}</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
