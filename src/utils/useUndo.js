import { useState, useRef, useCallback } from 'react'

/**
 * Lightweight delete-undo state for a screen. `showUndo(message, restore)`
 * surfaces a toast with an Undo action for 5 seconds; `restore` is invoked
 * when the user taps Undo (or the toast is dismissed).
 */
export function useUndo() {
  const [undo, setUndo] = useState(null)
  const timer = useRef(null)

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const showUndo = useCallback((message, restore) => {
    setUndo({ message, restore })
    clear()
    timer.current = setTimeout(() => setUndo(null), 5000)
  }, [clear])

  const dismissUndo = useCallback(() => {
    clear()
    setUndo(null)
  }, [clear])

  const applyUndo = useCallback(() => {
    clear()
    if (undo && typeof undo.restore === 'function') undo.restore()
    setUndo(null)
  }, [undo, clear])

  return { undo, showUndo, dismissUndo, applyUndo }
}
