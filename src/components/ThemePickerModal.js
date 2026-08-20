import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { fs, themeVariants, isWeb, font } from '../theme'
import { useTheme } from '../ThemeContext'
import { useI18n } from '../i18n'
import { useEscToClose } from '../utils/useEscToClose'
import { auditAllThemes, AA_NORMAL } from '../utils/contrast'

const DARK_KEYS = ['ember', 'nebula', 'glacier', 'obsidian', 'contrast']
const SILVER_KEYS = ['silver']
const LIGHT_KEYS = ['emberLight', 'nebulaLight', 'glacierLight', 'obsidianLight', 'contrastLight']

// Number of WCAG AA (< 4.5:1) failures per theme — surfaces accessibility
// regressions directly in the theme picker instead of only the dev console.
const FAIL_MAP = (() => {
  const map = {}
  for (const { key, pairs } of auditAllThemes(themeVariants)) {
    map[key] = pairs.filter(p => p.ratio < AA_NORMAL).length
  }
  return map
})()

export default function ThemePickerModal({ visible, onClose }) {
  const { theme, key: active, setTheme, textScale } = useTheme()
  const { t } = useI18n()
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
            <Text style={styles.title}>{t('theme.title')}</Text>
            <Text style={styles.subtitle}>{t('theme.selectHint')}</Text>
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
            <Text style={styles.sectionLabel}>{t('theme.darkSection')}</Text>
            {DARK_KEYS.map(key => {
              const tv = themeVariants[key]
              const isActive = active === key
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.option, isActive && { borderColor: tv.primaryLight, backgroundColor: tv.primary + '22' }]}
                  onPress={() => setTheme(key)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={tv.name}
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={[styles.dot, { backgroundColor: tv.primary }]} />
                  <Text style={[styles.optionText, { color: isActive ? tv.primaryLight : theme.text }]}>
                    {tv.name}
                  </Text>
                  {FAIL_MAP[key] > 0 && (
                    <View style={[styles.contrastBadge, { borderColor: tv.danger + '55', backgroundColor: tv.danger + '1A' }]}>
                      <Ionicons name="warning" size={11} color={tv.danger} importantForAccessibility="no" />
                      <Text style={[styles.contrastBadgeText, { color: tv.danger }]}>{t('theme.lowContrast')}</Text>
                    </View>
                  )}
                  {isActive && <Ionicons name="checkmark-circle" size={18} color={tv.primaryLight} />}
                </TouchableOpacity>
              )
            })}
            {SILVER_KEYS.map(key => {
              const tv = themeVariants[key]
              const isActive = active === key
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.option, styles.optionFull, isActive && { borderColor: tv.primaryLight, backgroundColor: tv.primary + '22' }]}
                  onPress={() => setTheme(key)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={tv.name}
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={[styles.dot, { backgroundColor: tv.primary }]} />
                  <Text style={[styles.optionText, { color: isActive ? tv.primaryLight : theme.text }]}>
                    {tv.name}
                  </Text>
                  {FAIL_MAP[key] > 0 && (
                    <View style={[styles.contrastBadge, { borderColor: tv.danger + '55', backgroundColor: tv.danger + '1A' }]}>
                      <Ionicons name="warning" size={11} color={tv.danger} importantForAccessibility="no" />
                      <Text style={[styles.contrastBadgeText, { color: tv.danger }]}>{t('theme.lowContrast')}</Text>
                    </View>
                  )}
                  {isActive && <Ionicons name="checkmark-circle" size={18} color={tv.primaryLight} />}
                </TouchableOpacity>
              )
            })}
            <Text style={styles.sectionLabel}>{t('theme.lightSection')}</Text>
            {LIGHT_KEYS.map(key => {
              const tv = themeVariants[key]
              const isActive = active === key
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.option, isActive && { borderColor: tv.primaryLight, backgroundColor: tv.primary + '22' }]}
                  onPress={() => setTheme(key)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={tv.name}
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={[styles.dot, { backgroundColor: tv.primary }]} />
                  <Text style={[styles.optionText, { color: isActive ? tv.primaryLight : theme.text }]}>
                    {tv.name}
                  </Text>
                  {FAIL_MAP[key] > 0 && (
                    <View style={[styles.contrastBadge, { borderColor: tv.danger + '55', backgroundColor: tv.danger + '1A' }]}>
                      <Ionicons name="warning" size={11} color={tv.danger} importantForAccessibility="no" />
                      <Text style={[styles.contrastBadgeText, { color: tv.danger }]}>{t('theme.lowContrast')}</Text>
                    </View>
                  )}
                  {isActive && <Ionicons name="checkmark-circle" size={18} color={tv.primaryLight} />}
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={styles.previewLabel}>{t('theme.preview')}</Text>
          <Preview theme={theme} t={t} scale={textScale} />

          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: theme.primary }]} onPress={onClose} activeOpacity={0.9} accessibilityRole="button">
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.doneBtnText}>{t('theme.done')}</Text>
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

function Preview({ theme, t, scale }) {
  const styles = createStyles(theme, scale)
  return (
    <View style={[styles.previewCard, { borderColor: theme.glassBorder, backgroundColor: theme.glass }]}>
      <View style={styles.previewRow}>
        <View style={[styles.previewIcon, { backgroundColor: theme.primary + '24' }]}>
          <Ionicons name="flask" size={16} color={theme.primaryLight} />
        </View>
        <View style={styles.previewTitleWrap}>
          <Text style={[styles.previewTitle, { color: theme.text }]} numberOfLines={1}>{t('theme.sampleRecipe1')}</Text>
        </View>
        <View style={[styles.previewBadge, { borderColor: theme.glassBorderStrong }]}>
          <Text style={[styles.previewBadgeText, { color: theme.primaryLight }]}>{t('theme.badgeNew')}</Text>
        </View>
      </View>
      <View style={styles.previewPills}>
        <View style={[styles.previewPill, { backgroundColor: theme.primary + '1A', borderColor: theme.primary + '2B' }]}>
          <Text style={[styles.previewPillText, { color: theme.primaryLight }]}>Banana Cream 6%</Text>
        </View>
        <View style={[styles.previewPill, { backgroundColor: theme.success + '1A', borderColor: theme.success + '2B' }]}>
          <Text style={[styles.previewPillText, { color: theme.success }]}>Vanilla Bean 2%</Text>
        </View>
      </View>
      <View style={[styles.previewBtn, { backgroundColor: theme.primary }]}>
        <Ionicons name="calculator" size={11} color="#fff" />
        <Text style={styles.previewBtnText}>{t('build.calculate')}</Text>
      </View>
    </View>
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
  options: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginBottom: 16 },
  sectionLabel: {
    fontSize: fs(11, scale),
    ...font('700'),
    color: theme.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 2,
  },
  option: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    width: '48.5%',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.inputBg,
  },
  optionFull: { width: '100%' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  optionFull: { width: '100%' },
  optionText: { flex: 1, fontSize: fs(15, scale), ...font('600') },
  contrastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  contrastBadgeText: { fontSize: fs(9, scale), ...font('700') },
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
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  previewIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewTitleWrap: { flex: 1 },
  previewTitle: { fontSize: fs(15, scale), ...font('600') },
  previewBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  previewBadgeText: { fontSize: fs(10, scale), ...font('800'), letterSpacing: 0.5 },
  previewPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  previewPill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  previewPillText: { fontSize: fs(12, scale), ...font('600') },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  previewBtnText: { fontSize: fs(12, scale), ...font('700'), color: '#fff' },
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
