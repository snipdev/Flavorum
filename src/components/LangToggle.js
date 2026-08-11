import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '../ThemeContext'
import { fs } from '../theme'
import { useI18n } from '../i18n'

export default function LangToggle() {
  const { lang, switchLang, t } = useI18n()
  const { theme, textScale } = useTheme()
  const colors = theme
  const styles = createStyles(colors, textScale)
  return (
    <View style={styles.seg}>
      <TouchableOpacity
        style={[styles.btn, lang === 'en' && styles.active]}
        onPress={() => switchLang('en')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('common.langEn')}
        accessibilityState={{ selected: lang === 'en' }}
      >
        <Text style={[styles.text, lang === 'en' && styles.textActive]}>EN</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, lang === 'tr' && styles.active]}
        onPress={() => switchLang('tr')}
        activeOpacity={0.7}
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
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    backgroundColor: colors.primary + '33',
  },
  text: { fontSize: fs(14, scale), fontWeight: '700', color: colors.textDim, letterSpacing: 0.5 },
  textActive: { color: colors.primaryLight },
})
