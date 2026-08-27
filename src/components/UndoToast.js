import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fs, font } from '../theme'
import { useTheme } from '../ThemeContext'
import { useI18n } from '../i18n'

// Floating toast that appears after a delete, with an Undo action. Rendered
// absolutely above the bottom bar/dock; the wrapper ignores pointer events so
// only the toast itself is interactive.
export default function UndoToast({ message, onUndo, onDismiss }) {
  const { t } = useI18n()
  const { theme, textScale } = useTheme()
  const colors = theme
  const styles = createStyles(colors, textScale)
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.toast}>
        <Ionicons name="arrow-undo-outline" size={15} color={colors.primaryLight} />
        <Text style={styles.msg} numberOfLines={2}>{message}</Text>
        <TouchableOpacity
          onPress={onUndo}
          onLongPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('common.undo')}
          style={styles.undoBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.undoText}>{t('common.undo')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 88,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 420,
    backgroundColor: colors.modalBg,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  msg: {
    flexShrink: 1,
    fontSize: fs(13, scale),
    color: colors.textMuted,
    ...font('500'),
  },
  undoBtn: {
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoText: { fontSize: fs(13, scale), ...font('700'), color: colors.primaryLight },
})
