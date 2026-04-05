'use client'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/hooks/useAuth'

export default function PlaceholderPage({ title }: { title: string }) {
  const { loading } = useAuth()
  if (loading) return null
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-12 shadow-sm text-center">
          <div className="text-5xl mb-4">🚧</div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
          <p className="text-slate-500">Dieses Modul wird als nächstes entwickelt.</p>
        </div>
      </main>
    </div>
  )
}
