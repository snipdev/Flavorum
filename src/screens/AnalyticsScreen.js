import { useState, useCallback, useMemo, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import Svg, { Circle } from 'react-native-svg'
import { fs, spacing, isWeb, useLayoutMode, font } from '../theme'
import { useTheme } from '../ThemeContext'
import { useI18n } from '../i18n'
import StickyHeader from '../components/StickyHeader'
import ScreenHero from '../components/ScreenHero'
import {
  loadRecipes, loadBatches, loadInventory,
  loadInventoryMeta,
} from '../utils/recipes'
import { loadPrices } from '../utils/prices'
import { buildBackup, restoreBackup, downloadTextFile } from '../utils/backup'

function UsageDonut({ recipeUses, batchUses, size = 148, stroke = 18, colors, usesLabel }) {
  const total = recipeUses + batchUses
  if (total <= 0) return null
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const rf = recipeUses / total
  const c = size / 2
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={c} cy={c} r={r}
          stroke={colors.primaryLight}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${rf * C} ${C}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
        {batchUses > 0 && (
          <Circle
            cx={c} cy={c} r={r}
            stroke={colors.success}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${(1 - rf) * C} ${C}`}
            transform={`rotate(${-90 + rf * 360} ${c} ${c})`}
          />
        )}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 20, ...font('700'), color: colors.text }}>{total}</Text>
        <Text style={{ fontSize: 11, color: colors.textDim }}>{usesLabel}</Text>
      </View>
    </View>
  )
}

export default function AnalyticsScreen() {
  const { t } = useI18n()
  const { theme: colors, textScale } = useTheme()
  const styles = createStyles(colors, textScale)
  // Wide web (viewport >= 820px): charts render side by side.
  const { wide, desktop } = useLayoutMode()

  const [recipes, setRecipes] = useState([])
  const [batches, setBatches] = useState([])
  const [inventory, setInventory] = useState([])
  const [meta, setMeta] = useState({})
  const [prices, setPrices] = useState([])
  const [exportDone, setExportDone] = useState(false)
  const [backupMsg, setBackupMsg] = useState(null)
  const headerRef = useRef(null)
  const fileInputRef = useRef(null)
  const onHeaderScroll = useCallback((e) => headerRef.current?.handleScroll(e), [])

  const loadAll = useCallback(() => {
    Promise.all([loadRecipes(), loadBatches(), loadInventory(), loadInventoryMeta(), loadPrices()]).then(([r, b, inv, m, p]) => {
      setRecipes(r)
      setBatches(b)
      setInventory(inv)
      setMeta(m || {})
      setPrices(p || [])
    })
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadAll()
    }, [loadAll])
  )

  const flashBackupMsg = (kind) => {
    setBackupMsg(kind)
    setTimeout(() => setBackupMsg(null), 3000)
  }

  const exportBackup = async () => {
    const json = await buildBackup()
    if (isWeb && typeof document !== 'undefined') {
      downloadTextFile(`flavorum-backup-${new Date().toISOString().slice(0, 10)}.json`, json)
    } else {
      await Clipboard.setStringAsync(json)
    }
    flashBackupMsg('exported')
  }

  const importBackup = async (text) => {
    try {
      await restoreBackup(text)
      await loadAll()
      flashBackupMsg('imported')
    } catch {
      flashBackupMsg('error')
    }
  }

  const handleImportFile = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (file) await importBackup(await file.text())
    e.target.value = ''
  }

  const importBackupNative = async () => {
    const text = await Clipboard.getStringAsync().catch(() => '')
    if (text) await importBackup(text)
    else flashBackupMsg('error')
  }

  // Count flavor usage across recipes and batches
  const usageMap = useMemo(() => {
    const map = new Map()
    const add = (name, type) => {
      if (!name?.trim()) return
      const key = name.trim()
      const prev = map.get(key) || { recipes: 0, batches: 0 }
      if (type === 'recipe') prev.recipes++
      if (type === 'batch') prev.batches++
      map.set(key, prev)
    }
    for (const r of recipes) {
      if (Array.isArray(r.flavors)) for (const f of r.flavors) add(f?.name, 'recipe')
    }
    for (const b of batches) {
      if (Array.isArray(b.flavors)) for (const f of b.flavors) add(f?.name, 'batch')
    }
    return map
  }, [recipes, batches])

  const topFlavors = [...usageMap.entries()]
    .sort((a, b) => (b[1].recipes + b[1].batches) - (a[1].recipes + a[1].batches))
    .slice(0, 10)

  const maxCount = topFlavors.length > 0 ? (topFlavors[0][1].recipes + topFlavors[0][1].batches) : 1

  // Total recipe vs batch usage (for the donut chart)
  const usageTotals = useMemo(() => {
    let recipes = 0
    let batches = 0
    for (const [, c] of usageMap) {
      recipes += c.recipes
      batches += c.batches
    }
    return { recipes, batches }
  }, [usageMap])

  // Cost totals: sum of the price table when it has entries, else inventory meta
  const totalCost = prices.length > 0
    ? prices.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0)
    : inventory.reduce((sum, name) => {
        const m = meta[name]
        if (m?.price && parseFloat(m.price) > 0) sum += parseFloat(m.price)
        return sum
      }, 0)

  const exportCSV = async () => {
    const esc = v => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = ['Flavor,Recipes,Batches,Total']
    const sorted = [...usageMap.entries()]
      .sort((a, b) => (b[1].recipes + b[1].batches) - (a[1].recipes + a[1].batches))
    for (const [name, c] of sorted) {
      lines.push([esc(name), c.recipes, c.batches, c.recipes + c.batches].join(','))
    }
    lines.push('', 'Summary', '')
    lines.push(['Flavors', usageMap.size].join(','))
    lines.push(['Recipes', recipes.length].join(','))
    lines.push(['Batches', batches.length].join(','))
    lines.push(['Total Cost', totalCost.toFixed(2)].join(','))
    const csv = lines.join('\n')

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'flavorum-analytics.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else {
      await Clipboard.setStringAsync(csv)
      setExportDone(true)
      setTimeout(() => setExportDone(false), 2000)
    }
  }

  const heroBlock = (
    <ScreenHero icon="bar-chart" title={t('analytics.title')} subtitle={t('analytics.subtitle')} desktop={desktop} />
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StickyHeader ref={headerRef}>{heroBlock}</StickyHeader>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={onHeaderScroll}
        scrollEventThrottle={16}
      >
        {recipes.length === 0 && batches.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bar-chart-outline" size={48} color={colors.textDim} />
            <Text style={styles.emptyStateTitle}>{t('analytics.emptyState')}</Text>
            <Text style={styles.emptyStateHint}>{t('analytics.emptyStateHint')}</Text>
          </View>
        ) : (
        <>
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Ionicons name="leaf" size={18} color={colors.primaryLight} />
            <Text style={styles.summaryNum}>{usageMap.size}</Text>
            <Text style={styles.summaryLabel}>{t('analytics.flavors')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="bookmark" size={18} color={colors.primaryLight} />
            <Text style={styles.summaryNum}>{recipes.length}</Text>
            <Text style={styles.summaryLabel}>{t('analytics.recipes')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="layers" size={18} color={colors.primaryLight} />
            <Text style={styles.summaryNum}>{batches.length}</Text>
            <Text style={styles.summaryLabel}>{t('analytics.batches')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="cash" size={18} color={colors.success} />
            <Text style={[styles.summaryNum, { color: colors.success }]}>
              {totalCost > 0 ? `${totalCost.toFixed(0)}` : '\u2014'}
            </Text>
            <Text style={styles.summaryLabel}>{t('analytics.totalCost')}</Text>
          </View>
        </View>

        {/* Charts — stacked on narrow, side by side on wide web */}
        <View style={[styles.chartsRow, wide && styles.chartsRowWide]}>
          {/* Top Flavors Bar Chart */}
          <View style={[styles.card, wide && styles.chartCard]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trophy" size={14} color={colors.primaryLight} />
              <Text style={styles.sectionTitle}>{t('analytics.topFlavors')}</Text>
              <TouchableOpacity
                style={styles.exportBtn}
                onPress={exportCSV}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('analytics.exportCsv')}
              >
                <Ionicons name="download-outline" size={14} color={colors.primaryLight} />
                <Text style={styles.exportBtnText}>{exportDone ? t('analytics.exportCopied') : t('analytics.exportCsv')}</Text>
              </TouchableOpacity>
            </View>

            {topFlavors.length === 0 ? (
              <Text style={styles.noData}>{t('analytics.noData')}</Text>
            ) : (
              topFlavors.map(([name, counts]) => {
                const total = counts.recipes + counts.batches
                const pct = Math.max((total / maxCount) * 100, 6)
                return (
                  <View key={name} style={styles.barRow}>
                    <Text style={styles.barLabel} numberOfLines={1}>{name}</Text>
                    <View style={[styles.barTrack, wide ? styles.barTrackWide : styles.barTrackNarrow]}>
                      <View style={[styles.barFill, { width: `${pct}%` }]} />
                    </View>
                    <Text
                      style={styles.barCount}
                      accessible
                      accessibilityLabel={`${counts.recipes} ${t('analytics.legendRecipes')}, ${counts.batches} ${t('analytics.legendBatches')}`}
                      importantForAccessibility="yes"
                    >
                      <Text style={{ color: colors.primaryLight }}>{counts.recipes}r </Text>
                      <Text style={{ color: colors.success }}>{counts.batches}b</Text>
                    </Text>
                  </View>
                )
              })
            )}
          </View>

          {/* Recipes vs Batches Donut Chart */}
          <View style={[styles.card, wide && styles.chartCard]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pie-chart" size={14} color={colors.primaryLight} />
              <Text style={styles.sectionTitle}>{t('analytics.recipeVsBatch')}</Text>
            </View>
            {usageTotals.recipes + usageTotals.batches === 0 ? (
              <Text style={styles.noData}>{t('analytics.noData')}</Text>
            ) : (
              <View style={[styles.donutRow, !wide && styles.donutRowStacked]}>
                <UsageDonut
                  recipeUses={usageTotals.recipes}
                  batchUses={usageTotals.batches}
                  colors={colors}
                  usesLabel={t('analytics.uses')}
                />
                <View style={styles.legend}>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: colors.primaryLight }]} />
                    <Text style={styles.legendText}>{t('analytics.legendRecipes')}</Text>
                    <Text style={styles.legendValue}>{usageTotals.recipes}</Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                    <Text style={styles.legendText}>{t('analytics.legendBatches')}</Text>
                    <Text style={styles.legendValue}>{usageTotals.batches}</Text>
                  </View>
                  <Text style={styles.legendHint}>{t('analytics.donutHint')}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Data backup & restore */}
        <View style={[styles.card, styles.dataCard]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="server-outline" size={14} color={colors.primaryLight} />
            <Text style={styles.sectionTitle}>{t('analytics.dataTitle')}</Text>
          </View>
          <Text style={styles.dataSubtitle}>{t('analytics.dataSubtitle')}</Text>
          <View style={styles.dataActions}>
            <TouchableOpacity style={styles.dataBtn} onPress={exportBackup} activeOpacity={0.7} accessibilityRole="button">
              <Ionicons name="download-outline" size={16} color={colors.primaryLight} />
              <Text style={styles.dataBtnText}>{t('analytics.exportData')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dataBtn}
              onPress={() => { if (isWeb) fileInputRef.current?.click(); else importBackupNative() }}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Ionicons name="cloud-upload-outline" size={16} color={colors.primaryLight} />
              <Text style={styles.dataBtnText}>{t('analytics.importData')}</Text>
            </TouchableOpacity>
          </View>
          {backupMsg && (
            <Text style={[styles.dataMsg, backupMsg === 'error' && { color: colors.danger }]}>
              {backupMsg === 'exported' ? t('analytics.dataExported') : backupMsg === 'imported' ? t('analytics.dataImported') : t('analytics.dataImportError')}
            </Text>
          )}
          {isWeb && typeof document !== 'undefined' && (
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          )}
        </View>
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingHorizontal: 14, paddingBottom: 100 },

  dataCard: { marginTop: spacing.md },
  dataSubtitle: { fontSize: fs(13, scale), color: colors.textMuted, lineHeight: 19, marginBottom: spacing.md },
  dataActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dataBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary + '4D',
    backgroundColor: colors.primary + '14',
  },
  dataBtnText: { fontSize: fs(13, scale), ...font('600'), color: colors.primaryLight },
  dataMsg: { fontSize: fs(12, scale), color: colors.success, marginTop: spacing.sm, ...font('600') },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  summaryNum: { fontSize: fs(22, scale), ...font('700'), color: colors.text },
  summaryLabel: { fontSize: fs(13, scale), color: colors.textMuted, ...font('500'), textAlign: 'center' },

  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  sectionTitle: { fontSize: fs(15, scale), ...font('700'), color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  exportBtnText: { fontSize: fs(13, scale), ...font('600'), color: colors.primaryLight },
  noData: { color: colors.textDim, textAlign: 'center', paddingVertical: 24 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyStateTitle: { fontSize: fs(17, scale), ...font('600'), color: colors.textMuted },
  emptyStateHint: { fontSize: fs(13, scale), color: colors.textDim, textAlign: 'center' },

  // Charts row: stacked on narrow, side by side on wide web.
  // flex:1 is required because react-native-web defaults to flex-shrink:0.
  chartsRow: {},
  chartsRowWide: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  chartCard: { flex: 1, minWidth: 0 },
  donutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingVertical: 8 },
  // Narrow: the fixed 148px donut + legend overflow the card side by side,
  // so stack them vertically instead.
  donutRowStacked: { flexDirection: 'column', gap: spacing.sm },
  legend: { gap: spacing.md },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { flex: 1, fontSize: fs(14, scale), color: colors.textMuted },
  legendValue: { fontSize: fs(15, scale), ...font('700'), color: colors.text },
  legendHint: { fontSize: fs(12, scale), color: colors.textDim, maxWidth: 150, marginTop: 2 },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  // The name keeps the room: on narrow cards the bar is slimmer (74px vs
  // 170px on wide) so long flavor names truncate far less than before.
  barLabel: { flex: 1, fontSize: fs(13, scale), color: colors.textMuted, flexShrink: 1 },
  barTrack: { width: 110, height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden', flexShrink: 1, minWidth: 56 },
  barTrackWide: { width: 170 },
  barTrackNarrow: { width: 74 },
  barFill: { height: 10, borderRadius: 5, backgroundColor: colors.primaryLight },
  barCount: { width: 48, fontSize: fs(13, scale), textAlign: 'right' },
})
