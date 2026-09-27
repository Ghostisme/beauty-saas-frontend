import { useCallback, useEffect, useState } from 'react'
import { request } from '@/lib/request'

export function catalogRequest<T>(path: string, tenantId?: number, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (tenantId !== undefined) headers.set('X-Tenant-Id', String(tenantId))
  return request<T>(path, { ...init, headers })
}

export function useCatalogQuery<T>(path: string, tenantId?: number, revision = 0, enabled = true) {
  const [state, setState] = useState<{ key: string; data?: T; error: string; loading: boolean }>({ key: '', error: '', loading: enabled })
  const [retry, setRetry] = useState(0)
  const key = `${tenantId ?? ''}:${path}:${revision}:${retry}`
  useEffect(() => {
    if (!enabled) { setState({ key, error: '', loading: false }); return }
    const controller = new AbortController()
    setState(value => ({ ...value, key, error: '', loading: true }))
    void catalogRequest<T>(path, tenantId, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ key, data, error: '', loading: false })
    }).catch(cause => {
      if (!controller.signal.aborted) setState({ key, error: cause instanceof Error ? cause.message : '加载失败，请重试', loading: false })
    })
    return () => controller.abort()
  }, [key, path, tenantId, enabled])
  const current = state.key === key ? state : { key, error: '', loading: enabled }
  return { data: current.data, error: current.error, loading: current.loading, reload: useCallback(() => setRetry(value => value + 1), []) }
}
