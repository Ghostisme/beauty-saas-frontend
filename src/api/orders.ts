import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { request } from '@/lib/request'
import type { OrderFilters, OrderTab } from '@/types/orders'

// Scope is explicit per request. Never borrow a mutable "current enterprise" for a write.
export function orderRequest<T>(path: string, tenantId?: number, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (tenantId !== undefined) headers.set('X-Tenant-Id', String(tenantId))
  return request<T>(path, { ...init, headers })
}

export function orderListPath(tab: OrderTab, filters: OrderFilters) {
  const params = new URLSearchParams({ tab })
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) })
  return `/orders?${params}`
}

export function useOrderQuery<T>(path: string, tenantId?: number, revision = 0, enabled = true) {
  const { session } = useAuth()
  const [retry, setRetry] = useState(0)
  const key = `${session?.token ?? ''}:${tenantId ?? ''}:${path}:${revision}:${retry}`
  const [result, setResult] = useState<{ key: string; data?: T; error: string }>()
  useEffect(() => {
    if (!enabled) { setResult(undefined); return }
    const controller = new AbortController()
    void orderRequest<T>(path, tenantId, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ key, data, error: '' })
    }).catch(cause => {
      if (!controller.signal.aborted) setResult({ key, error: cause instanceof Error ? cause.message : '加载失败，请重试' })
    })
    return () => controller.abort()
  }, [key, path, tenantId, enabled])
  const current = enabled && result?.key === key ? result : undefined
  return { data: current?.data, error: current?.error ?? '', loading: enabled && !current, reload: useCallback(() => setRetry(value => value + 1), []) }
}
