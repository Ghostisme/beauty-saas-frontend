import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_STORE_NAME } from '@/config/app'
import { useOptionalAuth } from '@/context/AuthContext'

const STORE_NAME_KEY = 'beauty-saas.store-name.v1'
const DISPLAY_MODE_KEY = 'beauty-saas.display-mode.v1'
type DisplayMode = 'pc' | 'pad'
interface Preferences {
  storeName: string
  setStoreName: (name: string) => void
  displayMode: DisplayMode | null
  setDisplayMode: (mode: DisplayMode) => void
}
const PreferencesContext = createContext<Preferences | null>(null)

function readStoreName(key: string, fallback: string) {
  try {
    return localStorage.getItem(key)?.trim().slice(0, 30) || fallback
  } catch {
    return fallback
  }
}

function readDisplayMode(): DisplayMode | null {
  try {
    const stored = localStorage.getItem(DISPLAY_MODE_KEY)
    return stored === 'pc' || stored === 'pad' ? stored : null
  } catch {
    return null
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const auth = useOptionalAuth()
  const storeKey = `${STORE_NAME_KEY}.${auth?.session?.userInfo.tenantId ?? 'guest'}`
  const fallback = auth?.session?.userInfo.tenantName || DEFAULT_STORE_NAME
  const [names, updateNames] = useState<Record<string, string>>({})
  const storeName = names[storeKey] ?? readStoreName(storeKey, fallback)
  const [displayMode, updateDisplayMode] = useState(readDisplayMode)
  function setStoreName(name: string) {
    const next = name.trim().slice(0, 30) || fallback
    updateNames(previous => ({ ...previous, [storeKey]: next }))
    try { localStorage.setItem(storeKey, next) } catch { /* Keep the in-memory preference. */ }
  }
  function setDisplayMode(mode: DisplayMode) {
    updateDisplayMode(mode)
    try { localStorage.setItem(DISPLAY_MODE_KEY, mode) } catch { /* Keep the in-memory preference. */ }
  }
  return <PreferencesContext.Provider value={{ storeName, setStoreName, displayMode, setDisplayMode }}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider')
  return context
}
