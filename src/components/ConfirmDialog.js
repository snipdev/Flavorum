import { useEffect, useRef } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fs, spacing, isWeb, font } from '../theme'
import { useTheme } from '../ThemeContext'
import { useI18n } from '../i18n'

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmText,
  icon = 'trash-outline',
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  const { t } = useI18n()
  const { theme, textScale } = useTheme()
  const colors = theme
  const styles = createStyles(colors, textScale)
  const confirmLabel = confirmText || t('dialog.delete')
  const accent = tone === 'danger' ? colors.danger : colors.primary
  const accentLight = tone === 'danger' ? colors.danger : colors.primaryLight
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!visible || !isWeb) return
    const prev = document.activeElement
    const timer = setTimeout(() => {
      if (cancelRef.current && typeof cancelRef.current.focus === 'function') cancelRef.current.focus()
    }, 50)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key === 'Tab') {
        const first = cancelRef.current
        const last = confirmRef.current
        if (!first || !last) return
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
      if (prev && typeof prev.focus === 'function' && prev !== document.body) prev.focus()
    }
  }, [visible, onCancel])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onCancel} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <View style={styles.card} accessibilityRole="alertdialog">
          <View style={[styles.iconCircle, { backgroundColor: accentLight + '26' }]}>
            <Ionicons name={icon} size={24} color={accent} importantForAccessibility="no" />
          </View>
          <Text style={styles.title} accessibilityRole="alert">{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity ref={cancelRef} style={[styles.btn, styles.cancel]} onPress={onCancel} activeOpacity={0.7} accessibilityRole="button">
              <Text style={styles.cancelText}>{t('dialog.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity ref={confirmRef} style={[styles.btn, styles.confirm, { backgroundColor: accent }]} onPress={onConfirm} activeOpacity={0.7} accessibilityRole="button">
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.modalBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    overflow: 'hidden',
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.danger + '1F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: fs(18, scale), ...font('600'), color: colors.text, textAlign: 'center' },
  message: { fontSize: fs(14, scale), color: colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, alignSelf: 'stretch' },
  btn: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  cancel: { backgroundColor: 'rgba(148, 163, 184, 0.12)', borderWidth: 1.5, borderColor: colors.border },
  cancelText: { fontSize: fs(15, scale), ...font('600'), color: colors.text },
  confirm: { backgroundColor: colors.danger },
  confirmText: { fontSize: fs(15, scale), ...font('700'), color: '#fff' },
})
