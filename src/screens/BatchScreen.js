import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { fs, spacing } from '../theme'
import { useTheme } from '../ThemeContext'
import ConfirmDialog from '../components/ConfirmDialog'
import LangToggle from '../components/LangToggle'
import { loadBatches, saveBatches } from '../utils/recipes'
import { scheduleSteepNotification, cancelNotification, requestNotifPermission } from '../utils/notifUtils'
import { useI18n } from '../i18n'

let notesTimer = null
const persistNotes = (updated) => {
  if (notesTimer) clearTimeout(notesTimer)
  notesTimer = setTimeout(() => saveBatches(updated).catch(() => {}), 500)
}

export default function BatchScreen({ navigation }) {
  const { t, lang } = useI18n()
  const { theme: colors, textScale } = useTheme()
  const styles = createStyles(colors, textScale)
  const [batches, setBatches] = useState([])
  const [confirmId, setConfirmId] = useState(null)
  const [reminderFeedback, setReminderFeedback] = useState(null)
  const batchesRef = useRef(batches)
  useEffect(() => { batchesRef.current = batches }, [batches])

  useFocusEffect(
    useCallback(() => {
      let active = true
      loadBatches().then(list => { if (active) setBatches(list) })
      return () => { active = false }
    }, [])
  )

  const remove = useCallback((id) => {
    setBatches(prev => {
      const updated = prev.filter(b => b.id !== id)
      saveBatches(updated).catch(() => {})
      return updated
    })
  }, [])

  const updateBatchField = (id, field, value) => {
    setBatches(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, [field]: value } : b)
      if (field === 'notes') persistNotes(updated)
      else saveBatches(updated).catch(() => {})
      return updated
    })
  }

  const flushNotes = () => {
    if (notesTimer) { clearTimeout(notesTimer); notesTimer = null }
    saveBatches(batchesRef.current).catch(() => {})
  }

  const flashFeedback = (fb) => {
    setReminderFeedback(fb)
    setTimeout(() => setReminderFeedback(null), 3500)
  }

  const toggleReminder = async (b) => {
    if (b.notifId) {
      await cancelNotification(b.notifId)
      await updateBatchField(b.id, 'notifId', null)
      flashFeedback({ id: b.id, ok: true, text: t('batches.reminderCancelled') })
    } else {
      const granted = await requestNotifPermission()
      if (!granted) {
        flashFeedback({ id: b.id, ok: false, text: t('batches.reminderPermissionDenied') })
        return
      }
      const id = await scheduleSteepNotification(b.name, b.steepDays || 14, b.createdAt || new Date().toISOString(), lang)
      if (id) {
        await updateBatchField(b.id, 'notifId', id)
        flashFeedback({ id: b.id, ok: true, text: t('batches.reminderSetOk') })
      } else {
        flashFeedback({ id: b.id, ok: false, text: t('batches.reminderScheduleFailed') })
      }
    }
  }

  const formatDate = iso => {
    if (!iso) return ''
    const d = new Date(iso)
    const locale = lang === 'tr' ? 'tr-TR' : 'en-US'
    return `${d.toLocaleDateString(locale)} ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
  }

  const calcSteepStatus = (b) => {
    const steepDays = b.steepDays || 14
    if (!b.createdAt) return { pct: 100, daysLeft: 0, isReady: true, steepDays }
    const created = new Date(b.createdAt).getTime()
    const now = Date.now()
    const elapsedDays = (now - created) / (1000 * 60 * 60 * 24)
    const pct = Math.min(100, Math.round((elapsedDays / steepDays) * 100))
    const daysLeft = Math.max(0, Math.ceil(steepDays - elapsedDays))
    return { pct, daysLeft, isReady: pct >= 100, steepDays }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name="layers" size={24} color={colors.primaryLight} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.title}>{t('batches.title')}</Text>
            <Text style={styles.subtitle} numberOfLines={2}>{t('batches.subtitle')}</Text>
          </View>
          <View style={styles.heroRight}>
            <LangToggle />
          </View>
        </View>

        {batches.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="layers-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyText}>{t('batches.empty')}</Text>
            <TouchableOpacity style={styles.emptyCtaBtn} onPress={() => navigation.navigate('build')} activeOpacity={0.8} accessibilityRole="button">
              <Ionicons name="flask" size={16} color="#fff" />
              <Text style={styles.emptyCtaText}>{t('batches.emptyCta')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {[...batches].reverse().map(b => {
          const { pct, daysLeft, isReady, steepDays } = calcSteepStatus(b)
          const rating = b.rating || 0
          return (
            <View key={b.id} style={styles.batchCard}>
              <TouchableOpacity style={styles.batchDelete} onPress={() => setConfirmId(b.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('batches.deleteTitle')}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
              <Text style={styles.batchName}>{b.name}</Text>
              {b.createdAt && <Text style={styles.batchDate}>{formatDate(b.createdAt)}</Text>}

              {/* Steeping Progress Bar */}
              <View style={[styles.steepContainer, isReady && styles.steepContainerReady]}>
                <View style={styles.steepHeader}>
                  <View style={styles.steepTitleRow}>
                    <Ionicons name="timer-outline" size={14} color={isReady ? colors.success : colors.primaryLight} />
                    <Text style={styles.steepTitle}>{t('batches.steepProgress', { days: steepDays })}</Text>
                  </View>
                  <Text style={[styles.steepBadgeText, { color: isReady ? colors.success : colors.primaryLight }]}>
                    {isReady ? t('batches.readyToVape') : t('batches.steepDaysLeft', { days: daysLeft, pct })}
                  </Text>
                </View>
                <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
                  <View style={[styles.progressBar, { width: `${pct}%`, backgroundColor: isReady ? colors.success : colors.primaryLight }]} />
                </View>
              </View>

              <View style={styles.tagRow}>
                <View style={[styles.modeBadge, b.ingredientMode === 'mix' ? styles.modeBadgeMix : styles.modeBadgeFlavor]}>
                  <Ionicons name={b.ingredientMode === 'mix' ? 'flask' : 'leaf'} size={12} color={b.ingredientMode === 'mix' ? colors.primaryLight : colors.success} />
                  <Text style={[styles.modeBadgeText, { color: b.ingredientMode === 'mix' ? colors.primaryLight : colors.success }]}>
                    {b.ingredientMode === 'mix' ? t('build.mix.mode') : t('build.flavor.mode')}
                  </Text>
                </View>
                {b.targetStrength ? <View style={[styles.chip, styles.chipPrimary]}><Text style={[styles.chipText, styles.chipTextPrimary]}>{b.targetStrength}mg</Text></View> : null}
                {b.targetPg ? <View style={[styles.chip, styles.chipPrimary]}><Text style={[styles.chipText, styles.chipTextPrimary]}>{b.targetPg}% PG</Text></View> : null}
                {(b.totalVolume || b.mixAmount) ? <View style={[styles.chip, styles.chipPrimary]}><Text style={[styles.chipText, styles.chipTextPrimary]}>{b.totalVolume || b.mixAmount}ml</Text></View> : null}
                {b.nicStrength ? <View style={[styles.chip, styles.chipPrimary]}><Text style={[styles.chipText, styles.chipTextPrimary]}>{b.nicStrength}mg/ml base</Text></View> : null}
              </View>

              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>{b.ingredientMode === 'mix' ? t('build.mix.mode') : t('build.target')}</Text>
                {b.ingredientMode === 'mix' ? (
                  <Text style={styles.detailText}>{t('build.mixDetail', { amount: b.mixAmount, pct: b.flavorPct })}</Text>
                ) : (
                  <Text style={styles.detailText}>{b.flavorPct ? t('build.flavorDetail', { volume: b.totalVolume, pct: b.flavorPct }) : t('build.flavorDetailNoPct', { volume: b.totalVolume })}</Text>
                )}
              </View>

              {Array.isArray(b.flavors) && b.flavors.length > 0 && (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>{t('batches.flavors')}</Text>
                  <View style={styles.flavorList}>
                    {b.flavors.map((f, i) => (
                      <View key={i} style={[styles.chip, styles.chipSuccess]}><Text style={[styles.chipText, styles.chipTextSuccess]}>{f.name || t('recipes.flavorN', { i: i + 1 })} {f.value}%</Text></View>
                    ))}
                  </View>
                </View>
              )}

              {Array.isArray(b.nicSources) && b.nicSources.length > 0 && (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>{t('batches.nicSources')}</Text>
                  {b.nicSources.map((s, i) => (
                    <Text key={i} style={styles.detailText}>
                      {t('build.sourcesDetail', { i: i + 1, strength: s.strength, base: s.baseType === 'custom' ? `${s.customPg}% ${t('build.baseTypePg')}` : (s.baseType === 'vg' ? t('build.baseTypeVg') : t('build.baseTypePg')).toUpperCase(), amount: s.amount })}
                    </Text>
                  ))}
                </View>
              )}

              {b.result && (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>{t('batches.result')}</Text>
                  <Text style={styles.detailText}>{t('build.resultDetail1', { flavorMl: b.result.flavorMl, nicMl: b.result.nicMl, pgNeeded: b.result.pgNeeded, vgNeeded: b.result.vgNeeded })}</Text>
                  <Text style={styles.detailText}>{t('build.resultDetail2', { total: b.result.actualTotal, nic: b.result.actualNic })}</Text>
                </View>
              )}

              {/* 5-Star Rating & Tasting Notes */}
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>{t('batches.ratingTitle')}</Text>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => updateBatchField(b.id, 'rating', star === rating ? 0 : star)}
                      style={styles.starBtn}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={t('batches.star', { star })}
                      accessibilityState={{ selected: star <= rating }}
                    >
                      <Ionicons
                        name={star <= rating ? "star" : "star-outline"}
                        size={24}
                        color={star <= rating ? colors.warning : colors.textDim}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.notesInput}
                  value={b.notes || ''}
                  onChangeText={val => updateBatchField(b.id, 'notes', val)}
                  onBlur={flushNotes}
                  placeholder={t('batches.notesPlaceholder')}
                  placeholderTextColor={colors.textDim}
                  multiline
                />
              </View>

              {/* Steep Reminder Toggle */}
              <TouchableOpacity
                style={[styles.reminderBtn, b.notifId && styles.reminderBtnActive]}
                onPress={() => toggleReminder(b)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={b.notifId ? t('batches.reminderActive') : t('batches.reminderSet')}
                accessibilityState={{ checked: !!b.notifId }}
              >
                <Ionicons
                  name={b.notifId ? 'notifications' : 'notifications-outline'}
                  size={15}
                  color={b.notifId ? colors.primaryLight : colors.textDim}
                />
                <Text style={[styles.reminderBtnText, b.notifId && styles.reminderBtnTextActive]}>
                  {b.notifId ? t('batches.reminderActive') : t('batches.reminderSet')}
                </Text>
              </TouchableOpacity>
              {reminderFeedback?.id === b.id && (
                <Text style={[styles.reminderFeedback, { color: reminderFeedback.ok ? colors.success : colors.danger }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
                  {reminderFeedback.text}
                </Text>
              )}
            </View>
          )
        })}
      </ScrollView>

      <ConfirmDialog
        visible={confirmId !== null}
        title={t('batches.deleteTitle')}
        message={t('batches.deleteMsg')}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => { remove(confirmId); setConfirmId(null) }}
      />
    </SafeAreaView>
  )
}


const createStyles = (colors, scale = 1) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingHorizontal: 14, paddingBottom: 100 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  heroText: { flex: 1, flexShrink: 1 },
  heroRight: { marginLeft: 'auto', flexShrink: 0 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: fs(29, scale), fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: fs(16, scale), color: colors.textMuted, marginTop: 1 },
  batchCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
  },
  batchDelete: { position: 'absolute', top: 10, right: 10, zIndex: 1, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  batchName: { fontSize: fs(19, scale), fontWeight: '600', color: colors.text, marginBottom: 2, paddingRight: 46 },
  batchDate: { fontSize: fs(13, scale), color: colors.textMuted, marginBottom: spacing.sm },
  steepContainer: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: spacing.sm,
  },
  steepContainerReady: { borderColor: colors.success + '66', backgroundColor: colors.success + '14' },
  steepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  steepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  steepTitle: { fontSize: fs(14, scale), fontWeight: '700', color: colors.textMuted },
  steepBadgeText: { fontSize: fs(14, scale), fontWeight: '700' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.glassBorder,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', borderRadius: 4 },
  ratingRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  starBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  notesInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
    fontSize: fs(14, scale),
    minHeight: 60,
    textAlignVertical: 'top',
  },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  chip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  chipPrimary: { backgroundColor: colors.primary + '26' },
  chipSuccess: { backgroundColor: colors.success + '26' },
  chipText: { fontSize: fs(13, scale), fontWeight: '500' },
  chipTextPrimary: { color: colors.primaryLight },
  chipTextSuccess: { color: colors.success },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  modeBadgeFlavor: { backgroundColor: colors.success + '33', borderWidth: 1, borderColor: colors.success + '66' },
  modeBadgeMix: { backgroundColor: colors.primary + '33', borderWidth: 1, borderColor: colors.primary + '66' },
  modeBadgeText: { fontSize: fs(13, scale), fontWeight: '700' },
  detailBlock: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.primary + '33' },
  detailLabel: {
    fontSize: fs(13, scale),
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  detailText: { fontSize: fs(14, scale), color: colors.textMuted, marginBottom: 2 },
  flavorList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: fs(17, scale), color: colors.textMuted },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  emptyCtaText: { color: '#fff', fontSize: fs(14, scale), fontWeight: '700' },
  reminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 44,
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  reminderBtnActive: { borderColor: colors.primaryLight + '66', backgroundColor: colors.primary + '2E' },
  reminderBtnText: { fontSize: fs(13, scale), color: colors.textMuted, fontWeight: '600' },
  reminderBtnTextActive: { color: colors.primaryLight },
  reminderFeedback: { fontSize: fs(13, scale), fontWeight: '600', marginTop: 8, textAlign: 'center' },
})

