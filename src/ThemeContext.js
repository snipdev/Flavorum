import { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { themeVariants } from './theme'

const THEME_KEY = 'flavorum_theme'
const TEXT_SCALE_KEY = 'flavorum_textScale'
export const TEXT_SCALE_PRESETS = [0.9, 1.0, 1.15, 1.3]

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [key, setKey] = useState('ember')
  const [textScale, setTextScaleState] = useState(1.0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(saved => {
      if (saved && themeVariants[saved]) setKey(saved)
      setReady(true)
    }).catch(() => setReady(true))
  }, [])

  useEffect(() => {
    AsyncStorage.getItem(TEXT_SCALE_KEY).then(saved => {
      const n = parseFloat(saved)
      if (TEXT_SCALE_PRESETS.includes(n)) setTextScaleState(n)
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

  return (
    <ThemeContext.Provider value={{ key, ready, setTheme, theme: themeVariants[key], textScale, setTextScale }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
