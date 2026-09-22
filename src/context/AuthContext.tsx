import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { passwordLogin } from '@/api/auth'
import { isAuthSession, persistSession, readSession, SESSION_EXPIRED_EVENT, SESSION_KEY, tokenExpiresAt } from '@/lib/session'
import type { AuthSession, LoginCredentials, UserInfo } from '@/types/auth'
import { request } from '@/lib/request'

interface AuthContextValue {
  session: AuthSession | null
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  can: (permission: string) => boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(readSession)

  const refreshProfile = useCallback(async () => {
    const active = readSession()
    if (!active) return
    const userInfo = await request<UserInfo>('/iam/me')
    // A slow response from a previous enterprise/session must not overwrite the new login.
    if (readSession()?.token !== active.token) return
    const updated = { ...active, userInfo }
    if (!isAuthSession(updated)) throw new Error('账号信息格式不正确，请重新登录')
    persistSession(updated)
    setSession(updated)
  }, [])

  useEffect(() => {
    if (!session) return
    const refresh = () => { void refreshProfile().catch(() => { /* Requests enforce revocation; keep the last profile on transient network errors. */ }) }
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [session?.token, refreshProfile])

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

  const can = (permission: string) => session?.userInfo.permissions.includes(permission) ?? false
  return <AuthContext.Provider value={{ session, login, logout, can, refreshProfile }}>{children}</AuthContext.Provider>
}

export function useOptionalAuth() { return useContext(AuthContext) }

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
