import type { AuthSession } from '@/types/auth'

export const SESSION_KEY = 'beauty-saas.auth.v1'
export const SESSION_EXPIRED_EVENT = 'beauty-saas:session-expired'

// The original admin seed import interpreted UTF-8 bytes as Windows-1252.
const LEGACY_ADMIN_NICKNAME = '\u00e7\u00ae\u00a1\u00e7\u0090\u2020\u00e5\u2018\u02dc'

export function tokenExpiresAt(token: string): number {
  try {
    const payload = token.split('.')[1]
    if (!payload) return 0
    const decoded: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof decoded !== 'object' || !decoded || !('exp' in decoded) || typeof decoded.exp !== 'number') return 0
    return decoded.exp * 1000
  } catch {
    return 0
  }
}

export function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || !value) return false
  const session = value as Partial<AuthSession>
  return typeof session.token === 'string'
    && typeof session.userInfo?.id === 'number'
    && typeof session.userInfo.username === 'string'
    && typeof session.userInfo.platformAdmin === 'boolean'
    && Number.isSafeInteger(session.userInfo.tenantId)
    && (session.userInfo.platformAdmin ? session.userInfo.tenantId === 0 : session.userInfo.tenantId > 0)
    && typeof session.userInfo.tenantCode === 'string' && (session.userInfo.platformAdmin || session.userInfo.tenantCode.length > 0)
    && typeof session.userInfo.tenantName === 'string'
    && typeof session.userInfo.owner === 'boolean'
    && Array.isArray(session.userInfo.permissions) && session.userInfo.permissions.every(permission => typeof permission === 'string')
    && tokenExpiresAt(session.token) > Date.now()
}

export function readSession(): AuthSession | null {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
    if (!isAuthSession(data)) return null
    // Migrate only the known seed value cached before the database repair.
    if (data.userInfo.id === 1 && data.userInfo.username === 'admin' && data.userInfo.nickname === LEGACY_ADMIN_NICKNAME) {
      const migrated = { ...data, userInfo: { ...data.userInfo, nickname: '管理员' } }
      persistSession(migrated)
      return migrated
    }
    return data
  } catch {
    return null
  }
}

export function persistSession(session: AuthSession | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // The current tab can still be used when browser storage is unavailable.
  }
}
