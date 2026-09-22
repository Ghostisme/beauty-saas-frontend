import { createContext, useCallback, useContext } from 'react'
import { request } from '@/lib/request'

// Request-local scope, not a global preference. Changing enterprises remounts the workspace and aborts old queries.
export const IamScopeContext = createContext<number | undefined>(undefined)
export function useIamRequest() {
  const tenantId = useContext(IamScopeContext)
  return useCallback(<T,>(path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    if (tenantId !== undefined && path.startsWith('/iam/')) headers.set('X-Tenant-Id', String(tenantId))
    return request<T>(path, { ...init, headers })
  }, [tenantId])
}
