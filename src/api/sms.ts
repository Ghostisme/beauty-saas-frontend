import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { request } from '@/lib/request'
import { readSession, SESSION_EXPIRED_EVENT } from '@/lib/session'
import type { SmsRecordFilters } from '@/types/sms'

// Capture the enterprise on every call, including writes and downloads. No mutable global scope.
export function smsRequest<T>(path: string, tenantId?: number, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (tenantId !== undefined) headers.set('X-Tenant-Id', String(tenantId))
  return request<T>(path, { ...init, headers })
}

export function smsRecordsPath(filters: SmsRecordFilters, exporting = false) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && (!exporting || !['page', 'pageSize'].includes(key))) params.set(key, String(value))
  })
  return `/sms/records${exporting ? '/export' : ''}?${params}`
}

export function useSmsQuery<T>(path: string, tenantId?: number, enabled = true) {
  const { session } = useAuth()
  const [retry, setRetry] = useState(0)
  const key = `${session?.token ?? ''}:${tenantId ?? ''}:${path}:${retry}`
  const [result, setResult] = useState<{ key: string; data?: T; error: string }>()
  useEffect(() => {
    if (!enabled) { setResult(undefined); return }
    const controller = new AbortController()
    void smsRequest<T>(path, tenantId, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ key, data, error: '' })
    }).catch(cause => {
      if (!controller.signal.aborted) setResult({ key, error: cause instanceof Error ? cause.message : '加载失败，请重试' })
    })
    return () => controller.abort()
  }, [key, path, tenantId, enabled])
  const current = enabled && result?.key === key ? result : undefined
  const update = useCallback((change: (data: T) => T) => {
    setResult(previous => previous?.key === key && previous.data ? { ...previous, data: change(previous.data) } : previous)
  }, [key])
  return { data: current?.data, error: current?.error ?? '', loading: enabled && !current, reload: useCallback(() => setRetry(value => value + 1), []), update }
}

export async function downloadSmsReport(filters: SmsRecordFilters, tenantId: number | undefined, signal: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal.aborted) controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  const timer = window.setTimeout(abort, 30_000)
  const session = readSession()
  const headers = new Headers({ Accept: 'text/csv' })
  if (session) headers.set('Authorization', `Bearer ${session.token}`)
  if (tenantId !== undefined) headers.set('X-Tenant-Id', String(tenantId))
  try {
    const response = await fetch(`/api${smsRecordsPath(filters, true)}`, { headers, signal: controller.signal })
    if (response.status === 401) {
      if (readSession()?.token === session?.token) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
      throw new Error('登录已过期，请重新登录')
    }
    if (response.status >= 500) throw new Error('服务暂时不可用，请稍后重试')
    if (!response.ok) {
      const error = await response.json() as { message?: string }
      throw new Error(error.message || '报表下载失败，请稍后重试')
    }
    if (!response.headers.get('content-type')?.includes('text/csv')) throw new Error('报表格式不正确，请稍后重试')
    const blob = await response.blob()
    if (signal.aborted) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `短信发送记录_${filters.startDate}_${filters.endDate}.csv`
    document.body.append(link); link.click(); link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (signal.aborted) throw error
      throw new Error('下载超时，请缩小日期范围后重试')
    }
    if (error instanceof TypeError || error instanceof SyntaxError) throw new Error('无法连接服务，请确认后端已启动')
    throw error
  } finally {
    window.clearTimeout(timer); signal.removeEventListener('abort', abort)
  }
}
