import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '../ThemeContext'
import { fs, font } from '../theme'
import { useI18n } from '../i18n'
import { hapticLight } from '../utils/haptics'

export default function LangToggle() {
  const { lang, switchLang, t } = useI18n()
  const { theme, textScale } = useTheme()
  const colors = theme
  const styles = createStyles(colors, textScale)
  return (
    <View style={styles.seg}>
      <TouchableOpacity
        style={[styles.btn, lang === 'en' && styles.active]}
        onPress={() => { hapticLight(); switchLang('en') }}
        activeOpacity={0.7}
        hitSlop={{ top: 5, bottom: 5, left: 3, right: 3 }}
        accessibilityRole="button"
        accessibilityLabel={t('common.langEn')}
        accessibilityState={{ selected: lang === 'en' }}
      >
        <Text style={[styles.text, lang === 'en' && styles.textActive]}>EN</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, lang === 'tr' && styles.active]}
        onPress={() => { hapticLight(); switchLang('tr') }}
        activeOpacity={0.7}
        hitSlop={{ top: 5, bottom: 5, left: 3, right: 3 }}
        accessibilityRole="button"
        accessibilityLabel={t('common.langTr')}
        accessibilityState={{ selected: lang === 'tr' }}
      >
        <Text style={[styles.text, lang === 'tr' && styles.textActive]}>TR</Text>
      </TouchableOpacity>
    </View>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btn: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    backgroundColor: colors.primary + '33',
  },
  text: { fontSize: fs(13, scale), ...font('700'), color: colors.textDim, letterSpacing: 0.5 },
  textActive: { color: colors.primaryLight },
})
