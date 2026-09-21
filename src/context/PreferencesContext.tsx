import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_STORE_NAME } from '@/config/app'

const STORE_NAME_KEY = 'beauty-saas.store-name.v1'
interface Preferences {
  storeName: string
  setStoreName: (name: string) => void
}
const PreferencesContext = createContext<Preferences | null>(null)

function readStoreName() {
  try {
    return localStorage.getItem(STORE_NAME_KEY)?.trim().slice(0, 30) || DEFAULT_STORE_NAME
  } catch {
    return DEFAULT_STORE_NAME
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [storeName, updateStoreName] = useState(readStoreName)
  function setStoreName(name: string) {
    const next = name.trim().slice(0, 30) || DEFAULT_STORE_NAME
    updateStoreName(next)
    try { localStorage.setItem(STORE_NAME_KEY, next) } catch { /* Keep the in-memory preference. */ }
  }
  return <PreferencesContext.Provider value={{ storeName, setStoreName }}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider')
  return context
}

