'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUser } from '@/lib/auth'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const user = getUser()
    router.push(user ? '/dashboard' : '/login')
  }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f4]">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-700 flex items-center justify-center text-white font-bold text-lg">VB</div>
        <div className="text-slate-500 text-sm">Laden ...</div>
      </div>
    </div>
  )
}
