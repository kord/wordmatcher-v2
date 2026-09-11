import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Settings } from '../../domain/types'
import {
  defaultSettings,
  loadSettings,
  saveSettings,
} from '../../storage/settings'

interface SettingsContextValue {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  replace: (next: Settings) => void
  reset: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function resolveTheme(preference: Settings['theme']): 'light' | 'dark' {
  if (preference !== 'system') return preference
  if (typeof matchMedia !== 'function') return 'light'
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  const persist = useCallback((next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }, [])

  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch }
        saveSettings(next)
        return next
      })
    },
    [],
  )

  const replace = useCallback((next: Settings) => persist(next), [persist])
  const reset = useCallback(() => persist(defaultSettings()), [persist])

  // Reflect the theme and character set on <html> so tokens and the browser
  // chrome agree, and so Chinese text can prefer the matching script's face.
  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(settings.theme)
      document.documentElement.dataset.theme = resolved
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', resolved === 'dark' ? '#14130f' : '#f7f5f0')
    }

    apply()
    if (settings.theme !== 'system' || typeof matchMedia !== 'function') return

    const query = matchMedia('(prefers-color-scheme: dark)')
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [settings.theme])

  useEffect(() => {
    document.documentElement.dataset.charset = settings.characterSet
  }, [settings.characterSet])

  const value = useMemo(
    () => ({ settings, update, replace, reset }),
    [settings, update, replace, reset],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings must be used inside a SettingsProvider')
  return value
}
