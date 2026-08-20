import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { fs, isWeb, font } from '../theme'
import { useTheme, TEXT_SCALE_PRESETS } from '../ThemeContext'
import { useI18n } from '../i18n'
import { useEscToClose } from '../utils/useEscToClose'
import { FONT_OPTIONS, familyFor } from '../fonts'

export default function FontPickerModal({ visible, onClose }) {
  const { theme, fontKey, setFontKey, textScale, setTextScale } = useTheme()
  const { t, lang } = useI18n()
  const styles = createStyles(theme, textScale)
  const cardRef = useRef(null)
  useEscToClose(visible, onClose)

  useEffect(() => {
    if (!visible || !isWeb) return
    const prev = document.activeElement
    const timer = setTimeout(() => {
      if (cardRef.current && typeof cardRef.current.focus === 'function') cardRef.current.focus()
    }, 50)
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
      if (prev && typeof prev.focus === 'function' && prev !== document.body) prev.focus()
    }
  }, [visible, onClose])

  const inner = (
    <>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      />
      <View
        ref={cardRef}
        style={styles.card}
        accessibilityRole="dialog"
        {...(isWeb ? { tabIndex: -1, outlineStyle: 'none' } : {})}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cardContent}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{t('font.title')}</Text>
              <Text style={styles.subtitle}>{t('font.subtitle')}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={theme.textDim} />
            </TouchableOpacity>
          </View>

          <View style={styles.options}>
            {FONT_OPTIONS.map(opt => {
              const isActive = fontKey === opt.key
              const label = lang === 'tr' ? opt.nameTr : opt.name
              const previewFam = familyFor(opt.key, 600)
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.option, isActive && { borderColor: theme.primaryLight, backgroundColor: theme.primary + '22' }]}
                  onPress={() => setFontKey(opt.key)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={styles.optionTextWrap}>
                    <Text
                      style={[
                        styles.optionName,
                        { color: isActive ? theme.primaryLight : theme.text, ...(previewFam ? { fontFamily: previewFam } : {}) },
                      ]}
                    >
                      {label}
                    </Text>
                    <Text style={styles.optionSample} numberOfLines={1}>
                      {t('font.sample')}
                    </Text>
                  </View>
                  {isActive && <Ionicons name="checkmark-circle" size={18} color={theme.primaryLight} />}
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={styles.previewLabel}>{t('theme.textSize')}</Text>
          <View style={styles.textSizeRow}>
            {TEXT_SCALE_PRESETS.map((s, i) => {
              const isActive = textScale === s
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.textSizeBtn, isActive && { borderColor: theme.primaryLight, backgroundColor: theme.primary + '22' }]}
                  onPress={() => setTextScale(s)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={['S', 'M', 'L', 'XL'][i]}
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[styles.textSizeBtnText, { color: isActive ? theme.primaryLight : theme.textMuted }]}>
                    {['S', 'M', 'L', 'XL'][i]}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>{t('font.preview')}</Text>
            <Text style={styles.previewTitle}>
              Banana Pudding King
            </Text>
            <Text style={styles.previewBody}>
              {t('font.sampleLong')}
            </Text>
          </View>

          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: theme.primary }]} onPress={onClose} activeOpacity={0.9} accessibilityRole="button">
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.doneBtnText}>{t('font.done')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </>
  )

  const overlay = isWeb ? (
    <View style={[styles.overlay, styles.overlayFallback]}>{inner}</View>
  ) : (
    <BlurView intensity={22} tint="dark" style={styles.overlay}>{inner}</BlurView>
  )

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {overlay}
    </Modal>
  )
}

const createStyles = (theme, scale = 1) => StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  overlayFallback: {
    backgroundColor: 'rgba(8, 11, 18, 0.62)',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '92%',
    backgroundColor: theme.modalBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.glassBorderStrong,
  },
  cardContent: { padding: 18 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  headerText: { flex: 1 },
  title: { fontSize: fs(20, scale), ...font('600'), color: theme.text, letterSpacing: -0.3 },
  subtitle: { fontSize: fs(13, scale), color: theme.textMuted, marginTop: 3 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -6, marginRight: -6 },
  options: { gap: 8, marginBottom: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.inputBg,
  },
  optionTextWrap: { flex: 1, gap: 2 },
  optionName: { fontSize: fs(16, scale), ...font('600') },
  optionSample: { fontSize: fs(12, scale), color: theme.textMuted, ...font('400') },
  textSizeRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  textSizeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.inputBg,
  },
  textSizeBtnText: { fontSize: fs(14, scale), ...font('700') },
  previewLabel: {
    fontSize: fs(12, scale),
    ...font('700'),
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.textDim,
    marginBottom: 8,
  },
  previewCard: {
    borderWidth: 1,
    borderColor: theme.glassBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    backgroundColor: theme.glass,
  },
  previewTitle: { fontSize: fs(18, scale), ...font('700'), color: theme.text, marginBottom: 6 },
  previewBody: { fontSize: fs(14, scale), ...font('400'), color: theme.textMuted, lineHeight: 20 },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  doneBtnText: { fontSize: fs(15, scale), ...font('700'), color: '#fff' },
})