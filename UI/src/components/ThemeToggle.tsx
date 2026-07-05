import { useEffect, useState } from 'react'
import { cycleTheme, getStoredTheme, resolveTheme, type Theme } from '../lib/theme'

const LABEL: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Auto',
}

export default function ThemeToggle() {
  const [pref, setPref] = useState<Theme>(() => getStoredTheme())
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    resolveTheme(getStoredTheme()),
  )

  useEffect(() => {
    const sync = () => {
      setPref(getStoredTheme())
      setResolved(resolveTheme(getStoredTheme()))
    }
    const onScheme = () => {
      if (getStoredTheme() === 'system') sync()
    }
    window.addEventListener('unitem-theme-change', sync)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onScheme)
    return () => {
      window.removeEventListener('unitem-theme-change', sync)
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', onScheme)
    }
  }, [])

  return (
    <button
      type="button"
      title={`Theme: ${LABEL[pref]}`}
      aria-label={`Theme: ${LABEL[pref]}. Click to switch.`}
      onClick={() => {
        const next = cycleTheme()
        setPref(next)
        setResolved(resolveTheme(next))
      }}
      className="glass-btn-subtle flex w-full items-center justify-center gap-2 rounded-xl py-2 font-heading text-[11px] font-semibold"
    >
      {resolved === 'dark' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
      {LABEL[pref]}
    </button>
  )
}
