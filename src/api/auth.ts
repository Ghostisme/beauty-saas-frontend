import { request } from '@/lib/request'
import { isAuthSession } from '@/lib/session'
import type { LoginCredentials } from '@/types/auth'

export async function passwordLogin(credentials: LoginCredentials) {
  const session = await request<unknown>('/user/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
  if (!isAuthSession(session)) throw new Error('登录信息无效，请联系管理员')
  return session
}

