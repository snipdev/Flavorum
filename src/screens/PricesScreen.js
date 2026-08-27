import { useState, useCallback, useRef, useEffect, useReducer } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { fs, spacing, useLayoutMode, font } from '../theme'
import { useTheme } from '../ThemeContext'
import { useI18n } from '../i18n'
import StickyHeader from '../components/StickyHeader'
import ScreenHero from '../components/ScreenHero'
import Input from '../components/Input'
import FlavorAutocomplete from '../components/FlavorAutocomplete'
import ConfirmDialog from '../components/ConfirmDialog'
import UndoToast from '../components/UndoToast'
import { loadPrices, savePrices, pricePerMl } from '../utils/prices'
import { hapticLight } from '../utils/haptics'
import { useUndo } from '../utils/useUndo'

// VG/PG/nicotine are fixed slots — they can't be added or removed, only edited.
// Default bottle size is 1000 ml so the price per ml works out of the box.
const BASE_DEFAULTS = {
  vg: { id: 'base-vg', type: 'vg', amountMl: 1000, price: '' },
  pg: { id: 'base-pg', type: 'pg', amountMl: 1000, price: '' },
  nic: { id: 'base-nic', type: 'nic', amountMl: 100, price: '' },
}

export default function PricesScreen({ navigation, route }) {
  const { t } = useI18n()
  const { theme: colors, textScale } = useTheme()
  const styles = createStyles(colors, textScale)
  const { wide, desktop } = useLayoutMode()
  const headerRef = useRef(null)
  const onHeaderScroll = useCallback((e) => headerRef.current?.handleScroll(e), [])

  // When a batch flavor chip links here ("add price"), pre-fill the add-form
  // name and consume the param. `appliedPrefill` guards against re-applying,
  // and resets once the param is cleared (i.e. after each navigation).
  const [prices, setPrices] = useState([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')

  // When a batch flavor chip links here ("add price"), pre-fill the add-form
  // name and consume the param. `appliedPrefill` guards against re-applying,
  // and resets once the param is cleared (i.e. after each navigation).
  const appliedPrefill = useRef(null)
  useEffect(() => {
    const f = route?.params?.prefillFlavor
    if (!f) {
      appliedPrefill.current = null
      return
    }
    if (f !== appliedPrefill.current) {
      appliedPrefill.current = f
      setName(f)
      setError('')
      navigation?.setParams({ prefillFlavor: undefined })
    }
  }, [route?.params?.prefillFlavor, navigation])

  const pricesRef = useRef(prices)
  useEffect(() => { pricesRef.current = prices }, [prices])
  const [confirmId, setConfirmId] = useState(null)
  // Row that was just auto-saved (base type or flavor id) — shows a brief ✓ badge
  const [savedKey, setSavedKey] = useState(null)
  const savedTimer = useRef(null)
  // Timestamp of the last save — shown as "Saved just now / 2 min ago" under the summary
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [, forceRender] = useReducer(x => x + 1, 0)
  const { undo, showUndo, dismissUndo, applyUndo } = useUndo()

  const flashSaved = (key) => {
    setSavedKey(key)
    setLastSavedAt(Date.now())
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSavedKey(null), 1800)
  }

  // Re-render periodically so the relative "x min ago" stays fresh while mounted
  useEffect(() => {
    if (!lastSavedAt) return
    const id = setInterval(forceRender, 30000)
    return () => clearInterval(id)
  }, [lastSavedAt])

  useFocusEffect(
    useCallback(() => {
      let active = true
      loadPrices().then(list => {
        if (!active) return
        // Keep stored base values (if any), fill in the fixed slots otherwise.
        const merged = Object.entries(BASE_DEFAULTS).map(([type, def]) => {
          const existing = (list || []).find(p => p.type === type)
          return existing ? { ...def, ...existing } : { ...def, name: type }
        })
        const flavors = (list || []).filter(p => p.type === 'flavor')
        setPrices([...merged, ...flavors])
      })
      return () => { active = false }
    }, [])
  )

  const add = async () => {
    const amt = parseFloat(amount)
    const pr = parseFloat(price)
    const finalName = name.trim()
    if (!finalName || !(amt > 0) || !(pr > 0)) {
      setError(t('prices.errEmpty'))
      return
    }
    setError('')
    const next = [...prices, { id: `${Date.now()}`, type: 'flavor', name: finalName, amountMl: amt, price: pr, updatedAt: Date.now() }]
    setPrices(next)
    await savePrices(next)
    setLastSavedAt(Date.now())
    hapticLight()
    setName('')
    setAmount('')
    setPrice('')
  }

  const updateBase = (type, field, value) => {
    const next = prices.map(p => p.type === type ? { ...p, [field]: value, updatedAt: Date.now() } : p)
    setPrices(next)
    savePrices(next)
    flashSaved(type)
  }

  const updateFlavor = (id, field, value) => {
    const next = prices.map(p => p.id === id ? { ...p, [field]: value, updatedAt: Date.now() } : p)
    setPrices(next)
    savePrices(next)
    flashSaved(id)
  }

  const remove = async (id) => {
    const snapshot = pricesRef.current
    const target = snapshot.find(p => p.id === id)
    const next = snapshot.filter(p => p.id !== id)
    setPrices(next)
    setConfirmId(null)
    await savePrices(next)
    setLastSavedAt(Date.now())
    hapticLight()
    if (target) {
      showUndo(t('prices.undoDeleteMsg'), () => {
        setPrices(snapshot)
        savePrices(snapshot)
        setLastSavedAt(Date.now())
      })
    }
  }

  const bases = Object.entries(BASE_DEFAULTS).map(([type, def]) => prices.find(p => p.type === type) || { ...def, name: type })
  const flavors = prices.filter(p => p.type === 'flavor')
  const totalInvested = prices.reduce((s, p) => s + (parseFloat(p.price) || 0), 0)
  const baseLabels = { vg: t('prices.vg'), pg: t('prices.pg'), nic: t('prices.nic') }

  const formatDate = (ts) => {
    const d = new Date(ts)
    const pad = (n) => (n < 10 ? '0' : '') + n
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
  }

  const heroBlock = (
    <ScreenHero icon="pricetag" title={t('prices.title')} subtitle={t('prices.subtitle')} desktop={desktop} />
  )

  const renderRow = (p) => {
    const perMl = pricePerMl(p)
    return (
      <View key={p.id} style={styles.flavorRow}>
        <View style={styles.flavorRowTop}>
          <View style={styles.rowTitleRow}>
            <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
            <View style={[styles.typeBadge, { borderColor: colors.success + '66' }]}>
              <Text style={[styles.typeBadgeText, { color: colors.success }]}>
                {t('prices.flavor')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => setConfirmId(p.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('prices.deleteTitle')}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
        <View style={styles.baseInputs}>
          <TextInput
            style={[styles.baseInput, styles.baseAmount]}
            value={String(p.amountMl)}
            onChangeText={(v) => updateFlavor(p.id, 'amountMl', v)}
            placeholder="10"
            placeholderTextColor={colors.textDim}
            keyboardType="decimal-pad"
            accessibilityLabel={`${p.name} ${t('prices.amount')}`}
          />
          <Text style={styles.baseMl}>ml</Text>
          <TextInput
            style={styles.baseInput}
            value={String(p.price)}
            onChangeText={(v) => updateFlavor(p.id, 'price', v)}
            placeholder="100"
            placeholderTextColor={colors.textDim}
            keyboardType="decimal-pad"
            accessibilityLabel={`${p.name} ${t('prices.price')}`}
          />
          <Text style={[styles.rowPerMl, styles.flavorRowPerMl]}>
            {perMl != null ? `${perMl.toFixed(2)} / ml` : t('prices.noPrice')}
          </Text>
          {savedKey === p.id && (
            <Text style={styles.savedBadge}>✓ {t('prices.saved')}</Text>
          )}
          {p.updatedAt ? (
            <Text style={styles.rowUpdated}>{t('prices.rowUpdated', { date: formatDate(p.updatedAt) })}</Text>
          ) : null}
        </View>
      </View>
    )
  }

  const confirmTarget = prices.find(p => p.id === confirmId)

  let savedAtText = null
  if (lastSavedAt) {
    const sec = Math.floor((Date.now() - lastSavedAt) / 1000)
    if (sec < 5) savedAtText = t('prices.savedJustNow')
    else if (sec < 60) savedAtText = t('prices.savedSecAgo', { n: sec })
    else if (sec < 3600) savedAtText = t('prices.savedMinAgo', { n: Math.floor(sec / 60) })
    else if (sec < 86400) savedAtText = t('prices.savedHrAgo', { n: Math.floor(sec / 3600) })
    else {
      // Older than a day — show the actual date (month/day/year)
      const d = new Date(lastSavedAt)
      savedAtText = t('prices.savedDate', { date: `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` })
    }
  }

  const summaryBlock = (
    <View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>{prices.length}</Text>
          <Text style={styles.summaryLabel}>{t('prices.products')}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: colors.success }]}>{totalInvested > 0 ? totalInvested.toFixed(0) : '\u2014'}</Text>
          <Text style={styles.summaryLabel}>{t('prices.totalInvested')}</Text>
        </View>
      </View>
      {savedAtText && (
        <View style={styles.savedAtRow}>
          <Ionicons name="checkmark-circle" size={12} color={colors.success} />
          <Text style={styles.savedAtText}>{savedAtText}</Text>
        </View>
      )}
    </View>
  )

  const addFormBlock = (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Ionicons name="add-circle" size={14} color={colors.primaryLight} />
        <Text style={styles.sectionTitle}>{t('prices.add')}</Text>
      </View>

      <View style={styles.flavorField}>
        <FlavorAutocomplete
          value={name}
          onChangeText={setName}
          placeholder={t('prices.flavorPlaceholder')}
        />
      </View>

      <View style={styles.row2}>
        <View style={styles.row2Item}>
          <Input label={t('prices.amount')} value={amount} onChangeText={setAmount} placeholder="10" suffix="ml" />
        </View>
        <View style={styles.row2Item}>
          <Input label={t('prices.price')} value={price} onChangeText={setPrice} placeholder="100" />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.addBtn} onPress={add} activeOpacity={0.85} accessibilityRole="button">
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.addBtnText}>{t('prices.add')}</Text>
      </TouchableOpacity>
    </View>
  )

  const basesBlock = (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Ionicons name="flask" size={14} color={colors.primaryLight} />
        <Text style={styles.sectionTitle}>{t('prices.bases')}</Text>
      </View>
      {bases.map(b => {
        const perMl = pricePerMl(b)
        const label = baseLabels[b.type]
        return (
          <View key={b.type} style={styles.baseRow}>
            <View style={styles.baseInfo}>
              <View style={styles.rowTitleRow}>
                <Text style={styles.rowName}>{label}</Text>
                <View style={[styles.typeBadge, { borderColor: colors.primaryLight + '66' }]}>
                  <Text style={[styles.typeBadgeText, { color: colors.primaryLight }]}>{label.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.perMlRow}>
                <Text style={styles.basePerMl}>
                  {perMl != null ? `${perMl.toFixed(2)} / ml` : t('prices.noPrice')}
                </Text>
                {savedKey === b.type && (
                  <Text style={styles.savedBadge}>✓ {t('prices.saved')}</Text>
                )}
              </View>
              {b.updatedAt ? (
                <Text style={styles.rowUpdated}>{t('prices.rowUpdated', { date: formatDate(b.updatedAt) })}</Text>
              ) : null}
            </View>
            <View style={styles.baseInputs}>
              <TextInput
                style={[styles.baseInput, styles.baseAmount]}
                value={String(b.amountMl)}
                onChangeText={(v) => updateBase(b.type, 'amountMl', v)}
                placeholder={String(BASE_DEFAULTS[b.type].amountMl)}
                placeholderTextColor={colors.textDim}
                keyboardType="decimal-pad"
                accessibilityLabel={`${label} ${t('prices.amount')}`}
              />
              <Text style={styles.baseMl}>ml</Text>
              <TextInput
                style={styles.baseInput}
                value={String(b.price)}
                onChangeText={(v) => updateBase(b.type, 'price', v)}
                placeholder="500"
                placeholderTextColor={colors.textDim}
                keyboardType="decimal-pad"
                accessibilityLabel={`${label} ${t('prices.price')}`}
              />
            </View>
          </View>
        )
      })}
    </View>
  )

  const flavorsBlock = (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Ionicons name="leaf" size={14} color={colors.primaryLight} />
        <Text style={styles.sectionTitle}>{t('prices.flavors')}</Text>
      </View>
      {flavors.length === 0 ? (
        <Text style={styles.empty}>{t('prices.empty')}</Text>
      ) : (
        flavors.map(renderRow)
      )}
    </View>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StickyHeader ref={headerRef}>{heroBlock}</StickyHeader>
      {wide ? (
        <View style={styles.wideBody}>
          <ScrollView
            style={styles.wideLeft}
            contentContainerStyle={styles.wideLeftContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={onHeaderScroll}
            scrollEventThrottle={16}
          >
            {addFormBlock}
            {basesBlock}
          </ScrollView>
          <View style={styles.wideRight}>
            <ScrollView
              style={styles.wideRightScroll}
              contentContainerStyle={styles.wideRightContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScroll={onHeaderScroll}
              scrollEventThrottle={16}
            >
              {summaryBlock}
              {flavorsBlock}
            </ScrollView>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onHeaderScroll}
          scrollEventThrottle={16}
        >
          {summaryBlock}
          {addFormBlock}
          {basesBlock}
          {flavorsBlock}
        </ScrollView>
      )}

      <ConfirmDialog
        visible={!!confirmTarget}
        title={t('prices.deleteTitle')}
        message={confirmTarget ? t('prices.deleteMsg', { name: confirmTarget.name }) : ''}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => confirmTarget && remove(confirmTarget.id)}
      />
      {undo && <UndoToast message={undo.message} onUndo={applyUndo} onDismiss={dismissUndo} />}
    </SafeAreaView>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingHorizontal: 14, paddingBottom: 100 },
  // Wide web: two-column desktop layout (matches Build tab) — never on mobile
  wideBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 14,
  },
  wideLeft: { flex: 1 },
  wideLeftContent: { paddingTop: spacing.lg, paddingBottom: 48 },
  wideRight: { width: 420, flexShrink: 0 },
  wideRightScroll: { flex: 1 },
  wideRightContent: { paddingTop: spacing.lg, paddingBottom: 48 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryNum: { fontSize: fs(20, scale), ...font('700'), color: colors.primaryLight },
  summaryLabel: {
    fontSize: fs(9, scale),
    color: colors.textDim,
    ...font('600'),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryDivider: { width: 1, height: 28, backgroundColor: colors.primary + '1F' },
  savedAtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
  savedAtText: { fontSize: fs(11, scale), color: colors.textDim, ...font('600') },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  sectionTitle: {
    fontSize: fs(11, scale),
    ...font('700'),
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  flavorField: { marginBottom: spacing.md },
  row2: { flexDirection: 'row', gap: spacing.md },
  row2Item: { flex: 1, minWidth: 0 },
  error: { fontSize: fs(13, scale), color: colors.danger, marginBottom: spacing.sm },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: spacing.xs,
  },
  addBtnText: { fontSize: fs(15, scale), ...font('700'), color: '#fff' },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  rowName: { flexShrink: 1, fontSize: fs(14, scale), ...font('600'), color: colors.text },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  typeBadgeText: { fontSize: fs(9, scale), ...font('700'), textTransform: 'uppercase' },
  rowPerMl: { fontSize: fs(12, scale), ...font('700'), color: colors.primaryLight },
  deleteBtn: { padding: 4, marginLeft: 'auto' },
  empty: { fontSize: fs(13, scale), color: colors.textDim, paddingVertical: spacing.sm },

  // Flavor rows with inline amount/price editing
  flavorRow: {
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  flavorRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  flavorRowPerMl: { marginLeft: 'auto', fontSize: fs(11, scale) },

  // Fixed base slots with inline editing
  baseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  baseInfo: { flex: 1, gap: 4, minWidth: 0 },
  perMlRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  basePerMl: { fontSize: fs(12, scale), ...font('700'), color: colors.primaryLight },
  savedBadge: {
    fontSize: fs(10, scale),
    ...font('700'),
    color: colors.success,
    backgroundColor: colors.success + '1F',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  baseInputs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowUpdated: { fontSize: fs(11, scale), color: colors.textDim, marginTop: 3 },
  baseInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: fs(14, scale),
    paddingHorizontal: 10,
    textAlign: 'center',
    width: 78,
  },
  baseAmount: { width: 70 },
  baseMl: { fontSize: fs(11, scale), color: colors.textDim, marginRight: 2 },
})
