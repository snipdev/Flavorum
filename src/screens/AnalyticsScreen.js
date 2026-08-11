import { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { fs, spacing } from '../theme'
import { useTheme } from '../ThemeContext'
import { useI18n } from '../i18n'
import LangToggle from '../components/LangToggle'
import {
  loadRecipes, loadBatches, loadInventory,
  loadInventoryMeta, saveInventoryMeta,
} from '../utils/recipes'

export default function AnalyticsScreen() {
  const { t } = useI18n()
  const { theme: colors, textScale } = useTheme()
  const styles = createStyles(colors, textScale)

  const [recipes, setRecipes] = useState([])
  const [batches, setBatches] = useState([])
  const [inventory, setInventory] = useState([])
  const [meta, setMeta] = useState({})
  const [exportDone, setExportDone] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let active = true
      Promise.all([loadRecipes(), loadBatches(), loadInventory(), loadInventoryMeta()]).then(([r, b, inv, m]) => {
        if (!active) return
        setRecipes(r)
        setBatches(b)
        setInventory(inv)
        setMeta(m || {})
      })
      return () => { active = false }
    }, [])
  )

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

  // Cost totals from inventory meta
  const totalCost = inventory.reduce((sum, name) => {
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name="bar-chart" size={24} color={colors.primaryLight} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.title}>{t('analytics.title')}</Text>
            <Text style={styles.subtitle}>{t('analytics.subtitle')}</Text>
          </View>
          <View style={styles.heroRight}>
            <LangToggle />
          </View>
        </View>

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

        {/* Top Flavors Bar Chart */}
        <View style={styles.card}>
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
                  <View style={styles.barTrack}>
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
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingHorizontal: 14, paddingBottom: 100 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  heroText: { flex: 1 },
  heroRight: { marginLeft: 'auto' },
  iconCircle: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: colors.primary + '33',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: fs(29, scale), fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: fs(16, scale), color: colors.textMuted, marginTop: 1 },

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
  summaryNum: { fontSize: fs(22, scale), fontWeight: '700', color: colors.text },
  summaryLabel: { fontSize: fs(13, scale), color: colors.textMuted, fontWeight: '500', textAlign: 'center' },

  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  sectionTitle: { fontSize: fs(15, scale), fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  exportBtnText: { fontSize: fs(13, scale), fontWeight: '600', color: colors.primaryLight },
  noData: { color: colors.textDim, textAlign: 'center', paddingVertical: 24 },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  barLabel: { flex: 1, fontSize: fs(13, scale), color: colors.textMuted },
  barTrack: { width: 110, height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, backgroundColor: colors.primaryLight },
  barCount: { width: 56, fontSize: fs(13, scale), textAlign: 'right' },
})
