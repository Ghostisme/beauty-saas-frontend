import { request } from '@/lib/request'
import type { ResourceKind } from '@/types/iam'

export function iamPath(kind: ResourceKind, values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) })
  return `/iam/${kind}?${params.toString()}`
}
export function saveRecord(kind: ResourceKind, id: number | undefined, values: unknown, send = request) {
  return send<number>(`/iam/${kind}${id === undefined ? '' : `/${id}`}`, { method: id === undefined ? 'POST' : 'PUT', body: JSON.stringify(values) })
}
export function deleteRecord(kind: ResourceKind, id: number, send = request) { return send<void>(`/iam/${kind}/${id}`, { method: 'DELETE' }) }
