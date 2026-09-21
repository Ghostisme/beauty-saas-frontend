import { readSession, SESSION_EXPIRED_EVENT } from '@/lib/session'

interface ApiResponse<T> {
  code: number
  message?: string
  data: T
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15_000)
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  const session = readSession()
  if (session) headers.set('Authorization', `Bearer ${session.token}`)

  try {
    const response = await fetch(`/api${path}`, { ...init, headers, signal: controller.signal })
    if (response.status === 401) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
      throw new Error('登录已过期，请重新登录')
    }
    if (response.status >= 500) throw new Error('服务暂时不可用，请稍后重试')
    const body: ApiResponse<T> = await response.json()
    if (!response.ok || body.code !== 200) throw new Error(body.message || '请求失败，请稍后重试')
    return body.data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('连接超时，请稍后重试')
    if (error instanceof TypeError || error instanceof SyntaxError) throw new Error('无法连接服务，请确认后端已启动')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

