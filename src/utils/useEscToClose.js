import { useEffect } from 'react'
import { isWeb } from '../theme'

/**
 * Closes a modal when Escape is pressed (web only — native modals already
 * close via onRequestClose/back button). Guards on `e.defaultPrevented` so a
 * dialog opened above another (e.g. a ConfirmDialog) wins and only one
 * handler acts per keypress.
 */
export function useEscToClose(active, onClose) {
  useEffect(() => {
    if (!active || !isWeb) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, onClose])
}
