import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { fs, spacing, isWeb, useWideWeb, useSidebarWeb } from '../theme'
import { useTheme } from '../ThemeContext'
import ConfirmDialog from '../components/ConfirmDialog'
import LangToggle from '../components/LangToggle'
import ThemeToggle from '../components/ThemeToggle'
import StickyHeader from '../components/StickyHeader'
import BottleSVG from '../components/BottleSVG'
import { loadBatches, saveBatches } from '../utils/recipes'
import { scheduleSteepNotification, cancelNotification, requestNotifPermission } from '../utils/notifUtils'
import { useUndo } from '../utils/useUndo'
import UndoToast from '../components/UndoToast'
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
  // Wide web (viewport >= 820px): batch cards render as a two-column grid.
  const wide = useWideWeb()
  const desktop = useSidebarWeb()
  const [batches, setBatches] = useState([])
  const [confirmId, setConfirmId] = useState(null)
  const [reminderFeedback, setReminderFeedback] = useState(null)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const sortOrder = ['newest', 'oldest', 'name', 'rating']

  // Search + sort without mutating the saved list.
  const visibleBatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? batches.filter(b => (b.name || '').toLowerCase().includes(q))
      : [...batches]
    switch (sortBy) {
      case 'oldest':
        list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
        break
      case 'name':
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        break
      case 'rating':
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0))
        break
      default:
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    }
    return list
  }, [batches, query, sortBy])
  const headerRef = useRef(null)
  const onHeaderScroll = useCallback((e) => headerRef.current?.handleScroll(e), [])
  const batchesRef = useRef(batches)
  useEffect(() => { batchesRef.current = batches }, [batches])

  useFocusEffect(
    useCallback(() => {
      let active = true
      loadBatches().then(list => { if (active) setBatches(list) })
      return () => { active = false }
    }, [])
  )

  const { undo, showUndo, dismissUndo, applyUndo } = useUndo()

  const remove = useCallback((id) => {
    const target = batches.find(b => b.id === id)
    const updated = batches.filter(b => b.id !== id)
    setBatches(updated)
    saveBatches(updated).catch(() => {})
    if (target) {
      showUndo(t('batches.undoDeleteMsg'), () => {
        setBatches(batches)
        saveBatches(batches).catch(() => {})
      })
    }
  }, [batches, showUndo, t])

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

  // Bottle layer ratios for a batch card: exact from saved result, else estimate
  // from the batch's saved VG/PG, nicotine and flavor values.
  const batchComposition = (b) => {
    const resTotal = b.result && parseFloat(b.result.actualTotal) > 0 ? parseFloat(b.result.actualTotal) : 0
    if (resTotal > 0) {
      return {
        total: resTotal,
        segs: [
          { label: 'PG', pct: (parseFloat(b.result.pgNeeded) / resTotal) * 100, color: '#f97316' },
          { label: 'VG', pct: (parseFloat(b.result.vgNeeded) / resTotal) * 100, color: '#22c55e' },
          { label: t('build.nicotine'), pct: (parseFloat(b.result.nicMl) / resTotal) * 100, color: '#ef4444' },
          { label: t('build.flavor.mode'), pct: (parseFloat(b.result.flavorMl) / resTotal) * 100, color: '#3b82f6' },
        ].filter(s => s.pct > 0.05),
      }
    }
    // Fallback estimation from saved values
    let vol = 0
    let flavorMl = 0
    if (b.ingredientMode === 'mix') {
      const amt = parseFloat(b.mixAmount) || 0
      const pct = parseFloat(b.flavorPct) || 0
      if (amt > 0 && pct > 0) {
        vol = amt / (pct / 100)
        flavorMl = amt
      }
    } else {
      vol = parseFloat(b.totalVolume) || 0
      const fSum = Array.isArray(b.flavors)
        ? b.flavors.reduce((a, f) => a + (parseFloat(f.value) || 0), 0)
        : 0
      flavorMl = (fSum / 100) * vol
    }
    if (!(vol > 0)) return null
    const nicStr = parseFloat(b.nicStrength) || 0
    const target = parseFloat(b.targetStrength) || 0
    const nicMl = nicStr > 0 && target > 0 ? (target * vol) / nicStr : 0
    const pgRatio = (parseFloat(b.targetPg) || 50) / 100
    const rest = Math.max(0, vol - flavorMl - nicMl)
    const pgMl = rest * pgRatio
    const vgMl = rest * (1 - pgRatio)
    return {
      total: Math.round(vol * 10) / 10,
      segs: [
        { label: 'PG', pct: (pgMl / vol) * 100, color: '#f97316' },
        { label: 'VG', pct: (vgMl / vol) * 100, color: '#22c55e' },
        { label: t('build.nicotine'), pct: (nicMl / vol) * 100, color: '#ef4444' },
        { label: t('build.flavor.mode'), pct: (flavorMl / vol) * 100, color: '#3b82f6' },
      ].filter(s => s.pct > 0.05),
    }
  }

  const heroBlock = (
    <View style={[styles.hero, desktop && styles.heroDesktop]}>
      {!desktop && (
        <View style={styles.iconCircle}>
          <Ionicons name="layers" size={20} color={colors.primaryLight} />
        </View>
      )}
      <View style={styles.heroText}>
        <Text style={[styles.title, desktop && styles.titleDesktop]}>{t('batches.title')}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>{t('batches.subtitle')}</Text>
      </View>
      {!desktop && (
        <View style={styles.heroRight}>
          <ThemeToggle />
          <LangToggle />
        </View>
      )}
    </View>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StickyHeader ref={headerRef}>{heroBlock}</StickyHeader>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onHeaderScroll}
        scrollEventThrottle={16}
      >
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

        {batches.length > 0 && (
          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={15} color={colors.textDim} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={t('batches.searchPlaceholder')}
                placeholderTextColor={colors.textDim}
                accessibilityLabel={t('batches.searchPlaceholder')}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('common.close')} activeOpacity={0.6}>
                  <Ionicons name="close-circle" size={16} color={colors.textDim} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.sortWrap}>
              <Ionicons name="swap-vertical" size={14} color={colors.textDim} />
              <Text style={styles.sortLabel}>{t('batches.sortBy')}</Text>
              <TouchableOpacity
                style={styles.sortBtn}
                onPress={() => setSortBy(prev => sortOrder[(sortOrder.indexOf(prev) + 1) % sortOrder.length])}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('batches.sortBy')}
              >
                <Text style={styles.sortBtnText}>{t(`batches.sort${sortBy[0].toUpperCase()}${sortBy.slice(1)}`)}</Text>
                <Ionicons name="chevron-down" size={13} color={colors.primaryLight} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {batches.length > 0 && visibleBatches.length === 0 && (
          <Text style={styles.noMatch}>{`${t('recipes.noMatch')} "${query}"`}</Text>
        )}

        <View style={[styles.batchGrid, wide && styles.batchGridWide]}>
        {visibleBatches.map(b => {
          const { pct, daysLeft, isReady, steepDays } = calcSteepStatus(b)
          const rating = b.rating || 0
          const comp = batchComposition(b)
          return (
            <View key={b.id} style={[styles.batchCard, wide && styles.batchCardWide]}>
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

              {comp ? (
                <View style={styles.bottleBlock}>
                  <BottleSVG segments={comp.segs} totalMl={comp.total} width={isWeb ? 76 : 64} />
                  <View style={styles.bottleInfo}>
                    <Text style={styles.detailLabel}>{t('batches.result')}</Text>
                    {comp.segs.map(seg => (
                      <View key={seg.label} style={styles.bottleInfoRow}>
                        <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                        <Text style={styles.bottleInfoLabel} numberOfLines={1}>{seg.label}</Text>
                        <Text style={styles.bottleInfoPct}>%{seg.pct.toFixed(1)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : b.result ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>{t('batches.result')}</Text>
                  <Text style={styles.detailText}>{t('build.resultDetail1', { flavorMl: b.result.flavorMl, nicMl: b.result.nicMl, pgNeeded: b.result.pgNeeded, vgNeeded: b.result.vgNeeded })}</Text>
                  <Text style={styles.detailText}>{t('build.resultDetail2', { total: b.result.actualTotal, nic: b.result.actualNic })}</Text>
                </View>
              ) : null}

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
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmId !== null}
        title={t('batches.deleteTitle')}
        message={t('batches.deleteMsg')}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => { remove(confirmId); setConfirmId(null) }}
      />
      {undo && (
        <UndoToast message={undo.message} onUndo={applyUndo} onDismiss={dismissUndo} />
      )}
    </SafeAreaView>
  )
}


const createStyles = (colors, scale = 1) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingHorizontal: 14, paddingBottom: 100 },
  // Sticky header above the scroll (narrow & wide — matches Build tab)
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  heroDesktop: { marginBottom: spacing.sm },
  heroText: { flex: 1, flexShrink: 1 },
  heroRight: { marginLeft: 'auto', flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: fs(23, scale), fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  titleDesktop: { fontSize: fs(18, scale) },
  subtitle: { fontSize: fs(13, scale), color: colors.textMuted, marginTop: 1 },
  batchCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
  },
  batchGrid: {},
  // Wide web: two-column grid (cards keep equal width, rows align to top)
  batchGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  batchCardWide: { width: '48%', marginBottom: 0 },
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
    gap: 8,
    marginBottom: 6,
  },
  // Both sides may shrink so the badge wraps inside the card instead of
  // overflowing to the right on narrow screens.
  steepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  steepTitle: { fontSize: fs(14, scale), fontWeight: '700', color: colors.textMuted, flexShrink: 1 },
  steepBadgeText: { fontSize: fs(14, scale), fontWeight: '700', flexShrink: 1, textAlign: 'right' },
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
  bottleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.primary + '33',
  },
  bottleInfo: { flex: 1, gap: 5 },
  bottleInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bottleInfoLabel: { flex: 1, fontSize: fs(13, scale), color: colors.textMuted },
  bottleInfoPct: { fontSize: fs(13, scale), fontWeight: '600', color: colors.text },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
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
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchBox: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 42,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: fs(14, scale), paddingVertical: 8, outlineStyle: 'none' },
  sortWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortLabel: { fontSize: fs(13, scale), color: colors.textDim, fontWeight: '500' },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary + '4D',
    backgroundColor: colors.primary + '14',
  },
  sortBtnText: { fontSize: fs(13, scale), fontWeight: '600', color: colors.primaryLight },
  noMatch: { color: colors.textDim, textAlign: 'center', paddingVertical: 24 },
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

