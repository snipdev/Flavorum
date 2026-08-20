import { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { themeVariants } from './theme'
import { FONT_OPTIONS, setActiveFontKey } from './fonts'
import { auditAllThemes, AA_NORMAL, AA_LARGE } from './utils/contrast'

const THEME_KEY = 'flavorum_theme'
const TEXT_SCALE_KEY = 'flavorum_textScale'
const FONT_KEY = 'flavorum_font'
export const TEXT_SCALE_PRESETS = [0.9, 1.0, 1.15, 1.3]

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [key, setKey] = useState('emberLight')
  const [textScale, setTextScaleState] = useState(1.0)
  const [fontKey, setFontKeyState] = useState('system')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(saved => {
      if (saved && themeVariants[saved]) setKey(saved)
      setReady(true)
    }).catch(() => setReady(true))
  }, [])

  // Dev-only automatic contrast audit: on startup, verify every theme variant
  // and warn about pairs that fall below WCAG AA. Lets light-theme regressions
  // surface in the console without clicking through all ten themes.
  useEffect(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return
    if (typeof console === 'undefined' || !console.warn) return
    for (const { key, name, pairs } of auditAllThemes(themeVariants)) {
      const bad = pairs.filter(p => p.ratio < AA_NORMAL)
      if (bad.length === 0) continue
      const hard = bad.filter(p => p.ratio < AA_LARGE)
      const lines = bad.map(p =>
        `  ${p.label}: ${p.ratio.toFixed(2)} (${p.fg} on ${p.bg})${p.ratio < AA_LARGE ? ' ⚠' : ''}`
      )
      console.warn(
        `[contrast] ${name} (${key}): ${bad.length} pair(s) below AA ${AA_NORMAL}` +
        `${hard.length ? ` — ${hard.length} below AA ${AA_LARGE} ⚠` : ''}\n${lines.join('\n')}`
      )
    }
  }, [])

  useEffect(() => {
    AsyncStorage.getItem(TEXT_SCALE_KEY).then(saved => {
      const n = parseFloat(saved)
      if (TEXT_SCALE_PRESETS.includes(n)) setTextScaleState(n)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    AsyncStorage.getItem(FONT_KEY).then(saved => {
      if (saved && FONT_OPTIONS.some(o => o.key === saved)) setFontKeyState(saved)
    }).catch(() => {})
  }, [])

  const setTheme = (next) => {
    if (!themeVariants[next]) return
    setKey(next)
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {})
  }

  const setTextScale = (next) => {
    if (!TEXT_SCALE_PRESETS.includes(next)) return
    setTextScaleState(next)
    AsyncStorage.setItem(TEXT_SCALE_KEY, String(next)).catch(() => {})
  }

  const setFontKey = (next) => {
    if (!FONT_OPTIONS.some(o => o.key === next)) return
    setFontKeyState(next)
    AsyncStorage.setItem(FONT_KEY, next).catch(() => {})
  }

  // Keep the module-level active font in sync *before* children render so the
  // global font() helper used inside every createStyles() resolves the new
  // typeface on the same paint (no flash of the previous font).
  setActiveFontKey(fontKey)

  return (
    <ThemeContext.Provider value={{ key, ready, setTheme, theme: themeVariants[key], textScale, setTextScale, fontKey, setFontKey }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
