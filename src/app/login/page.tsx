'use client'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const { login } = useAuth(false)
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const ok = login(email, password)
    if (ok) {
      router.push('/klienten')
    } else {
      setError('E-Mail oder Passwort falsch.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f2f4] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-4 mb-8 justify-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-700 flex items-center justify-center text-white font-bold text-xl">VB</div>
          <div>
            <div className="text-2xl font-bold text-slate-900">VBetreut</div>
            <div className="text-sm text-slate-500">ERP · Agentur</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Anmelden</h1>
          <p className="text-slate-500 mb-8">Bitte melde dich mit deinen Zugangsdaten an.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <label className="block">
              <div className="text-sm font-semibold text-slate-600 mb-1.5">E-Mail</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="name@vbetreut.at" autoComplete="email"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400" />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-600 mb-1.5">Passwort</div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••" autoComplete="current-password"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400" />
            </label>

            {error && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full rounded-2xl bg-teal-700 py-4 text-base font-bold text-white hover:bg-teal-800 transition-colors disabled:opacity-60 cursor-pointer border-none mt-2">
              {loading ? 'Anmelden ...' : 'Anmelden'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8 rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Demo-Zugänge</div>
            <div className="flex flex-col gap-2">
              {[
                ['stefan@vbetreut.at', 'gf2026', 'Geschäftsführung'],
                ['lisa@vbetreut.at', 'lisa2026', 'Koordination'],
                ['michaela@vbetreut.at', 'michi2026', 'Mitarbeiter'],
              ].map(([em, pw, role]) => (
                <button key={em} type="button"
                  onClick={() => { setEmail(em); setPassword(pw); }}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
                  <span className="font-medium">{em}</span>
                  <span className="text-slate-400">{role}</span>
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-400 mt-2">Klick auf einen Eintrag befüllt das Formular.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
