import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from '../theme'
import { useI18n } from '../i18n'

export default function LangToggle() {
  const { lang, switchLang } = useI18n()
  return (
    <View style={styles.seg}>
      <TouchableOpacity
        style={[styles.btn, lang === 'en' && styles.active]}
        onPress={() => switchLang('en')}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      >
        <Text style={[styles.text, lang === 'en' && styles.textActive]}>EN</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, lang === 'tr' && styles.active]}
        onPress={() => switchLang('tr')}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      >
        <Text style={[styles.text, lang === 'tr' && styles.textActive]}>TR</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    backgroundColor: 'rgba(197, 146, 6, 0.18)',
  },
  text: { fontSize: 12, fontWeight: '700', color: colors.textDim, letterSpacing: 0.5 },
  textActive: { color: colors.primaryLight },
})
