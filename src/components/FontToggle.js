import { useState } from 'react'
import { TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../ThemeContext'
import { useI18n } from '../i18n'
import FontPickerModal from './FontPickerModal'
import { hapticLight } from '../utils/haptics'

/**
 * Font button for screen headers. Self-contained: owns its modal visibility,
 * so any screen can drop it into its hero without extra state.
 */
export default function FontToggle() {
  const [visible, setVisible] = useState(false)
  const { theme } = useTheme()
  const { t } = useI18n()
  const styles = createStyles(theme)
  return (
    <>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => { hapticLight(); setVisible(true) }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('font.title')}
      >
        <Ionicons name="text-outline" size={20} color={theme.primaryLight} />
      </TouchableOpacity>
      <FontPickerModal visible={visible} onClose={() => setVisible(false)} />
    </>
  )
}

const createStyles = (colors) => StyleSheet.create({
  btn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
})