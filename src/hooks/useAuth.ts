'use client'
import { useState, useEffect } from 'react'
import { getUser, login, logout, type User } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export function useAuth(requireAuth = true) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const u = getUser()
    setUser(u)
    setLoading(false)
    if (requireAuth && !u) router.push('/login')
  }, [requireAuth, router])

  function doLogin(email: string, password: string): boolean {
    const u = login(email, password)
    if (u) { setUser(u); return true }
    return false
  }

  function doLogout() {
    logout()
    setUser(null)
    router.push('/login')
  }

  return { user, loading, login: doLogin, logout: doLogout }
}
