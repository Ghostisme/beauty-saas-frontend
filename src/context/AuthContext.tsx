import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { passwordLogin } from '@/api/auth'
import { persistSession, readSession, SESSION_EXPIRED_EVENT, SESSION_KEY, tokenExpiresAt } from '@/lib/session'
import type { AuthSession, LoginCredentials } from '@/types/auth'

interface AuthContextValue {
  session: AuthSession | null
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(readSession)

  useEffect(() => {
    function expireSession() {
      persistSession(null)
      setSession(null)
    }
    function syncSession(event: StorageEvent) {
      if (event.key === SESSION_KEY || event.key === null) setSession(readSession())
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, expireSession)
    window.addEventListener('storage', syncSession)
    const timeout = session
      ? window.setTimeout(expireSession, Math.min(Math.max(tokenExpiresAt(session.token) - Date.now(), 0), 2_147_483_647))
      : undefined
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener(SESSION_EXPIRED_EVENT, expireSession)
      window.removeEventListener('storage', syncSession)
    }
  }, [session])

  async function login(credentials: LoginCredentials) {
    const nextSession = await passwordLogin(credentials)
    persistSession(nextSession)
    setSession(nextSession)
  }

  function logout() {
    persistSession(null)
    setSession(null)
  }

  return <AuthContext.Provider value={{ session, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

