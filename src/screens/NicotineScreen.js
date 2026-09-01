import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Animated, View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import SliderInput from '../components/SliderInput'
import PgVgSlider from '../components/PgVgSlider'
import ResultBox from '../components/ResultBox'
import LivePreviewBottle from '../components/LivePreviewBottle'
import VolumeScale from '../components/VolumeScale'
import FlavorAutocomplete from '../components/FlavorAutocomplete'
import StickyHeader from '../components/StickyHeader'
import ThemeToggle from '../components/ThemeToggle'
import FontToggle from '../components/FontToggle'
import LangToggle from '../components/LangToggle'
import { fs, spacing, useLayoutMode, dockShadow, useShadowFade, font } from '../theme'
import { useTheme } from '../ThemeContext'
import { calculateNicotine } from '../utils/calculations'
import { loadRecipes, loadBatches, saveBatches, newBatchId, loadFlavorRecs, recomputeFlavorRecs, getRecValue } from '../utils/recipes'
import { hapticLight } from '../utils/haptics'
import { useEscToClose } from '../utils/useEscToClose'
import { useI18n } from '../i18n'

const MIX_VOLUMES = [10, 15, 20, 30, 60, 100]
const NIC_PRESETS = [1.5, 2, 3, 6, 10, 12]
const VG_PG_PRESETS = [
  { label: '80/20', pg: 20 },
  { label: '70/30', pg: 30 },
  { label: '50/50', pg: 50 },
]
const WIZARD_STEP_KEYS = ['build.wizardStep1', 'build.wizardStep2', 'build.wizardStep3', 'build.wizardStep4', 'build.wizardStep5', 'build.wizardStep6', 'build.wizardStep7']

function SourceCard({ source, onUpdate, onDelete, amountInputRef }) {
  const { t } = useI18n()
  const { theme: colors, textScale } = useTheme()
  const styles = createStyles(colors, textScale)
  const strength = source.strength
  const baseType = source.baseType
  const customPg = source.customPg || '50'
  const amount = source.amount || ''
  return (
    <View style={styles.sourceCard}>
      <View style={styles.sourceCardHeader}>
        <Text style={styles.sourceCardTitle}>{t('build.source')}</Text>
        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={onDelete} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
          <Ionicons name="close-circle" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>
      <SliderInput label={t('build.nicStrength')} value={strength} onChangeText={v => onUpdate('strength', v)} min={0} max={100} step={1} suffix="mg/ml" />
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t('build.nicBaseType')}</Text>
        <View style={styles.modeRow}>
          {[
            { key: 'pg', label: t('build.pg100') },
            { key: 'vg', label: t('build.vg100') },
            { key: 'custom', label: t('build.custom') },
          ].map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeBtn, baseType === m.key && styles.modeBtnActive]}
              onPress={() => onUpdate('baseType', m.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeBtnText, baseType === m.key && styles.modeBtnTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {baseType === 'custom' && (
          <PgVgSlider value={customPg} onChangeText={v => { onUpdate('customPg', v); const n = parseFloat(v) || 0; onUpdate('customVg', String(100 - n)) }} />
        )}
      </View>
      <View style={styles.sourceAmountRow}>
        <SliderInput label={t('build.available')} value={amount} onChangeText={v => onUpdate('amount', v.replace(/[^\d]/g, ''))} min={0} max={100} step={1} suffix="ml" inputRef={amountInputRef} />
      </View>
    </View>
  )
}

function PresetGrid({ items, value, onSelect, suffix }) {
  const { theme: colors, textScale } = useTheme()
  const styles = createStyles(colors, textScale)
  return (
    <View style={styles.presetGridRows}>
      {[items.slice(0, 3), items.slice(3)].map((row, r) => (
        <View key={r} style={styles.presetGridRow}>
          {row.map((v, i) => {
            const active = parseFloat(value) === v
            return (
              <TouchableOpacity key={i} style={[styles.preset, styles.presetSpread, active && styles.presetActive]} onPress={() => onSelect(String(v))} activeOpacity={0.7}>
                <Text style={[styles.presetText, active && styles.presetTextActive]}>{v}{suffix}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      ))}
    </View>
  )
}

export default function NicotineScreen({ navigation, route }) {
  const { t } = useI18n()
  const { theme: colors, textScale } = useTheme()
  const styles = createStyles(colors, textScale)
  // Wide web (viewport >= 920px) unlocks the two-column desktop layout;
  // everything below that — and all of mobile — keeps the single column.
  const { wide, desktop } = useLayoutMode()
  const volRef = useRef({ isMixMode: false, mixAmount: '0', totalVolume: '0', targetPg: '' })
  const [wizardStep, setWizardStep] = useState(1)
  const stepFade = useRef(new Animated.Value(1)).current
  const stepSlideY = useRef(new Animated.Value(0)).current
  const stepScale = useRef(new Animated.Value(1)).current
  const bottleShake = useRef(new Animated.Value(0)).current

  const goToStep = useCallback((next) => {
    const clamped = Math.max(1, Math.min(7, next))
    if (clamped === wizardStep) return
    const { isMixMode: mix, mixAmount: amt, totalVolume: vol, targetPg: pg } = volRef.current
    // Block going past step 2 if no volume selected
    if (clamped > 2) {
      const v = mix ? (parseFloat(amt) || 0) : (parseFloat(vol) || 0)
      if (v <= 0) { shakeBottle(); return }
    }
    // Block going past step 3 if no VG/PG ratio selected
    if (clamped > 3 && !(parseFloat(pg) > 0)) { shakeBottle(); return }
    setWizardStep(clamped)
  }, [wizardStep])
  const dockShadowOpacity = useShadowFade(false)
  const headerRef = useRef(null)
  const [nicStrength, setNicStrength] = useState('0')
  const [nicBaseMode, setNicBaseMode] = useState('pg')
  const [nicCustomPg, setNicCustomPg] = useState('50')
  const [nicCustomVg, setNicCustomVg] = useState('50')
  const nicPg = useMemo(() => {
    if (nicBaseMode === 'pg') return '100'
    if (nicBaseMode === 'vg') return '0'
    return nicCustomPg
  }, [nicBaseMode, nicCustomPg])
  const [targetStrength, setTargetStrength] = useState('0')
  const [targetPg, setTargetPg] = useState('')
  const [totalVolume, setTotalVolume] = useState('0')
  const [mixAmount, setMixAmount] = useState('0')
  const [mixName, setMixName] = useState('')
  const [flavorPct, setFlavorPct] = useState('0')
  const [ingredientMode, setIngredientMode] = useState('flavor')
  const isMixMode = ingredientMode === 'mix' || ingredientMode === 'single'
  // Keep volRef in sync for goToStep volume check (avoids TDZ)
  useEffect(() => { volRef.current = { isMixMode, mixAmount, totalVolume, targetPg } })
  const mixTotal = useMemo(() => {
    if (!isMixMode) return null
    const vol = parseFloat(mixAmount) || 0
    const pct = parseFloat(flavorPct) || 0
    if (vol <= 0 || pct <= 0) return null
    return Math.round((vol / (pct / 100)) * 10) / 10
  }, [isMixMode, mixAmount, flavorPct])
  const [flavors, setFlavors] = useState([])
  const [nicSources, setNicSources] = useState([])
  const [result, setResult] = useState(null)
  const [resultKey, setResultKey] = useState(0)
  const [warning, setWarning] = useState(null)
  const prevResultRef = useRef(null)
  useEffect(() => {
    if (result && !prevResultRef.current) setResultKey(k => k + 1)
    prevResultRef.current = result
  }, [result])
  const [savedRecipes, setSavedRecipes] = useState([])
  const [savedBatches, setSavedBatches] = useState([])
  const [flavorRecs, setFlavorRecs] = useState({})
  const [saveModalVisible, setSaveModalVisible] = useState(false)
  const [loadModalVisible, setLoadModalVisible] = useState(false)
  const [loadBatchModalVisible, setLoadBatchModalVisible] = useState(false)
  const [loadSearch, setLoadSearch] = useState('')
  const [batchName, setBatchName] = useState('')
  useEscToClose(saveModalVisible, () => setSaveModalVisible(false))
  useEscToClose(loadModalVisible, () => setLoadModalVisible(false))
  useEscToClose(loadBatchModalVisible, () => setLoadBatchModalVisible(false))
  const amountRefs = useRef({})
  const resultWrapRef = useRef(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      loadRecipes().then(list => {
        if (!active) return
        setSavedRecipes(list)
        loadFlavorRecs().then(recs => {
          if (!active) return
          const recMap = recs || {}
          setFlavorRecs(recMap)
          recomputeFlavorRecs(list || [], recMap).then(next => { if (active) setFlavorRecs(next) })
        })
        const pendingId = route.params?.loadRecipeId
        const brewRecipe = route.params?.brewRecipe
        if (brewRecipe) {
          loadRecipe(brewRecipe)
          navigation.setParams({ brewRecipe: undefined })
        } else if (pendingId) {
          const r = list.find(x => x.id === pendingId)
          if (r) loadRecipe(r)
          navigation.setParams({ loadRecipeId: undefined, loadRecipeName: undefined })
        }
      })
      loadBatches().then(list => { if (active) setSavedBatches(list) })
      return () => { active = false }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route.params?.loadRecipeId, route.params?.brewRecipe])
  )


  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const missingSource = nicSources.find(s => !(parseFloat(s.amount) > 0))
    if (missingSource) {
      setWarning(t('build.warnMissingSource'))
      setResult(null)
      return
    }
    setWarning(null)
    const vol = isMixMode ? (parseFloat(mixAmount) || 0) : (parseFloat(totalVolume) || 0)
    const pct = isMixMode
      ? parseFloat(flavorPct) || 0
      : flavors.reduce((a, f) => a + (parseFloat(f.value) || 0), 0)
    if (isMixMode && pct <= 0) {
      setWarning(t('build.warnConcentratePct'))
      setResult(null)
      return
    }
    let computedTotal = vol
    if (isMixMode && pct > 0) {
      computedTotal = vol / (pct / 100)
    }
    if (!(computedTotal > 0)) {
      setResult(null)
      return
    }
    const target = parseFloat(targetStrength) || 0
    const nicStr = parseFloat(nicStrength) || 0

    const sourceNic = nicSources
      .filter(s => parseFloat(s.amount) > 0)
      .map(s => ({
        volume: parseFloat(s.amount) || 0,
        strength: parseFloat(s.strength) || 0,
        pgRatio: parseFloat(s.baseType === 'pg' ? '100' : s.baseType === 'vg' ? '0' : s.customPg || '50'),
      }))

    const r = calculateNicotine({
      nicStrength: nicStr,
      nicPgRatio: parseFloat(nicPg) || 50,
      targetStrength: target,
      totalVolume: computedTotal,
      flavorPct: pct,
      targetPg: parseFloat(targetPg) || 50,
      nicSources: sourceNic,
    })
    const flavorBreakdown = ingredientMode === 'flavor'
      ? flavors
          .filter(f => (parseFloat(f.value) || 0) > 0)
          .map((f, i) => {
            const ml = (computedTotal * (parseFloat(f.value) || 0)) / 100
            return { name: f.name.trim() || t('recipes.flavorN', { i: i + 1 }), ml: Math.round(ml * 100) / 100 }
          })
      : []
    const nicBreakdown = []
    if (sourceNic.length > 0) {
      sourceNic.forEach((s, i) => {
        nicBreakdown.push({ name: `${t('build.source')} ${i + 1} (${s.strength} mg/ml)`, ml: Math.round(s.volume * 100) / 100 })
      })
    }
    if (r.baseNicMl > 0) {
      nicBreakdown.push({ name: `${t('build.nicStrength')} (${nicStr} mg/ml)`, ml: r.baseNicMl })
    }
    setResult({ ...r, flavorBreakdown, nicBreakdown })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nicStrength, nicBaseMode, nicCustomPg, nicPg, targetStrength, targetPg, totalVolume, mixAmount, flavorPct, ingredientMode, flavors, nicSources, t])
  /* eslint-enable react-hooks/set-state-in-effect */

  const liveWarnings = useMemo(() => {
    const w = []
    const nicStr = parseFloat(nicStrength) || 0
    if (nicStr >= 50) w.push({ key: 'highNic', text: t('build.warnHighNic', { strength: nicStr }) })
    const avail = Math.max(nicStr, ...nicSources.filter(s => parseFloat(s.amount) > 0).map(s => parseFloat(s.strength) || 0))
    const target = parseFloat(targetStrength) || 0
    if (avail > 0 && target > avail) w.push({ key: 'targetHigh', text: t('build.warnTargetHigh', { target, source: avail }) })
    const flavorTotal = isMixMode
      ? (parseFloat(flavorPct) || 0)
      : flavors.reduce((a, f) => a + (parseFloat(f.value) || 0), 0)
    if (flavorTotal > 25) w.push({ key: 'highFlavor', text: t('build.warnHighFlavor', { pct: flavorTotal }) })
    return w
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nicStrength, nicSources, targetStrength, ingredientMode, flavorPct, flavors, t])

  const highNicWarn = liveWarnings.find(w => w.key === 'highNic')
  const targetHighWarn = liveWarnings.find(w => w.key === 'targetHigh')
  const highFlavorWarn = liveWarnings.find(w => w.key === 'highFlavor')

  const nicPreview = (() => {
    const nic = parseFloat(nicStrength) || 0
    const target = parseFloat(targetStrength) || 0
    if (!(nic > 0) || !(target > 0)) return null
    let vol = parseFloat(totalVolume) || 0
    if (isMixMode) {
      const amt = parseFloat(mixAmount) || 0
      const pct = parseFloat(flavorPct) || 0
      if (amt <= 0 || pct <= 0) return null
      vol = amt / (pct / 100)
    }
    if (!(vol > 0)) return null
    const ml = Math.round((target * vol / nic) * 10) / 10
    return { ml, vol: Math.round(vol * 10) / 10 }
  })()

  // Live totals for the sticky summary bar (updates as values change, no Calculate needed)
  const liveVol = useMemo(() => {
    if (isMixMode) {
      const amt = parseFloat(mixAmount) || 0
      const pct = parseFloat(flavorPct) || 0
      if (amt <= 0 || pct <= 0) return null
      return Math.round((amt / (pct / 100)) * 10) / 10
    }
    const vol = parseFloat(totalVolume) || 0
    return vol > 0 ? Math.round(vol * 10) / 10 : null
  }, [isMixMode, mixAmount, flavorPct, totalVolume])

  const summaryPgVal = parseFloat(targetPg) || 0
  const summaryPg = summaryPgVal > 0 ? Math.round(summaryPgVal) : 0
  const summaryVg = summaryPgVal > 0 ? Math.round(100 - summaryPgVal) : 0

  const renderWarn = (w) => w ? (
    <View style={styles.inlineWarn} accessibilityLiveRegion="polite">
      <Ionicons name="warning" size={14} color={colors.warning} />
      <Text style={styles.inlineWarnText}>{w.text}</Text>
    </View>
  ) : null

  function addFlavor() {
    setFlavors([...flavors, { id: Date.now(), name: '', value: '' }])
  }

  function updateFlavor(id, field, value) {
    setFlavors(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  function removeFlavor(id) {
    setFlavors(prev => prev.filter(f => f.id !== id))
  }

  function loadRecipe(r) {
    setIngredientMode('flavor')
    setMixName('')
    setFlavors(Array.isArray(r.flavors)
      ? r.flavors.map(f => ({ id: Date.now() + Math.random(), name: f.name || '', value: String(f.value ?? '') }))
      : [])
    setLoadModalVisible(false)
    setResult(null)
    setWarning(null)
  }

  function loadBatch(b) {
    setIngredientMode(b.ingredientMode ?? 'flavor')
    setMixName(b.isMixMode && Array.isArray(b.flavors) && b.flavors.length > 0 ? b.flavors[0].name : '')
    setNicStrength(String(b.nicStrength ?? '100'))
    setNicBaseMode(b.nicBaseMode ?? 'pg')
    setNicCustomPg(String(b.nicCustomPg ?? '50'))
    setNicCustomVg(String(b.nicCustomVg ?? '50'))
    setTargetStrength(String(b.targetStrength ?? '3'))
    setTargetPg(String(b.targetPg ?? '30'))
    setTotalVolume(String(b.totalVolume ?? '100'))
    setMixAmount(String(b.mixAmount ?? '10'))
    setFlavorPct(String(b.flavorPct ?? '15'))
    setFlavors(Array.isArray(b.flavors)
      ? b.flavors.map(f => ({ id: Date.now() + Math.random(), name: f.name || '', value: String(f.value ?? '') }))
      : [])
    setNicSources(Array.isArray(b.nicSources)
      ? b.nicSources.map(s => ({ ...s, amount: String(s.amount ?? '') }))
      : [])
    setLoadBatchModalVisible(false)
    setResult(null)
    setWarning(null)
  }

  async function saveCurrentBatch() {
    const name = batchName.trim()
    if (!name) return
    const batch = {
      id: newBatchId(),
      name,
      createdAt: new Date().toISOString(),
      ingredientMode,
      nicStrength: parseFloat(nicStrength) || 0,
      nicBaseMode,
      nicCustomPg: parseFloat(nicCustomPg) || 50,
      nicCustomVg: parseFloat(nicCustomVg) || 50,
      targetStrength: parseFloat(targetStrength) || 0,
      targetPg: parseFloat(targetPg) || 50,
      totalVolume: parseFloat(totalVolume) || 0,
      mixAmount: parseFloat(mixAmount) || 0,
      flavorPct: parseFloat(flavorPct) || 0,
      flavors: isMixMode
        ? (mixName.trim() ? [{ name: mixName.trim(), value: parseFloat(flavorPct) || 0 }] : [])
        : flavors.map(f => ({ name: f.name.trim(), value: parseFloat(f.value) || 0 })),
      nicSources: nicSources.map(s => ({ strength: s.strength, baseType: s.baseType, customPg: s.customPg, customVg: s.customVg, amount: s.amount })),
      result: result || null,
    }
    const updated = [...savedBatches, batch]
    setSavedBatches(updated)
    await saveBatches(updated)
    setSaveModalVisible(false)
    setBatchName('')
  }

  const items = result ? [
    { value: result.isPossible ? t('build.readyToMix') : t('build.impossibleMix'), badge: result.isPossible ? 'success' : 'danger' },
    { label: isMixMode ? t('build.concentrate') : t('build.flavorToAdd'), value: `${result.flavorMl} ml`, accent: colors.flavor },
    ...(result.flavorBreakdown || []).map(f => ({ label: f.name, value: `${f.ml} ml`, sub: true, accent: colors.flavor })),
    { label: t('build.nicToAdd'), value: `${result.nicMl} ml`, accent: colors.danger },
    ...(result.nicBreakdown || []).map(n => ({ label: n.name, value: `${n.ml} ml`, sub: true, accent: colors.danger })),
    { label: t('build.pgToAdd'), value: `${result.pgNeeded} ml`, accent: colors.warning },
    { label: t('build.vgToAdd'), value: `${result.vgNeeded} ml`, accent: colors.success },
    { label: t('build.totalLiquidRes'), value: `${result.actualTotal} ml`, total: true },
  ] : null

  const composition = result && result.actualTotal > 0
    ? [
        { label: 'PG', pct: (result.pgNeeded / result.actualTotal) * 100, color: colors.warning },
        { label: 'VG', pct: (result.vgNeeded / result.actualTotal) * 100, color: colors.success },
        { label: t('build.nicotine'), pct: (result.nicMl / result.actualTotal) * 100, color: colors.danger },
        { label: t('build.flavor.mode'), pct: (result.flavorMl / result.actualTotal) * 100, color: colors.flavor },
      ].filter(s => s.pct > 0.05)
    : []

  // Live composition for the preview bottle (updates instantly as user types)
  const previewSegments = (() => {
    const pgPct = parseFloat(targetPg)
    if (!(pgPct > 0)) return []
    const nicStr = parseFloat(nicStrength) || 0
    const tgt = parseFloat(targetStrength) || 0
    let vol = 0
    let flavorPctTotal = 0
    if (isMixMode) {
      const amt = parseFloat(mixAmount) || 0
      const pct = parseFloat(flavorPct) || 0
      if (amt > 0 && pct > 0) {
        vol = amt / (pct / 100)
        flavorPctTotal = pct
      }
    } else {
      vol = parseFloat(totalVolume) || 0
      flavorPctTotal = flavors.reduce((a, f) => a + (parseFloat(f.value) || 0), 0)
    }
    if (!(vol > 0)) return []
    const flavorMl = flavorPctTotal > 0 ? (flavorPctTotal / 100) * vol : 0
    const rest = Math.max(0, vol - flavorMl)
    const nicMl = nicStr > 0 && tgt > 0 ? (tgt * vol) / nicStr : 0
    const pgMl = rest * (pgPct / 100)
    const vgMl = rest * (1 - pgPct / 100)
    return [
      { label: 'PG', pct: (pgMl / vol) * 100, color: colors.warning },
      { label: 'VG', pct: (vgMl / vol) * 100, color: colors.success },
      { label: t('build.nicotine'), pct: (nicMl / vol) * 100, color: colors.danger },
      { label: t('build.flavor.mode'), pct: (flavorMl / vol) * 100, color: colors.flavor },
    ].filter(s => s.pct > 0.05)
  })()

  // Shared sections reused by both layouts, so the single-column (mobile) look
  // stays pixel-identical and the wide web layout composes from the same blocks.
  // The hero is kept separate: on wide web it spans the full width above the two
  // columns (so Theme/Lang controls sit at the app's far right, like other tabs),
  // while the narrow layout keeps it as the first scrolled block.
  const heroBlock = (
    <View style={[styles.heroLogoRow, !desktop && styles.heroLogoRowMobile]}>
      <Image source={require('../../assets/flavorum.png')} style={[styles.heroLogo, !desktop && styles.heroLogoMobile]} resizeMode="contain" />
      <View style={styles.heroText}>
        <Text style={[styles.heroTitle, desktop && styles.heroTitleDesktop]}>{t('build.title')}</Text>
        <Text style={styles.heroSubtitle} numberOfLines={2}>{t('app.tagline')}</Text>
      </View>
      {!desktop && (
        <View style={styles.heroRight}>
          <ThemeToggle />
          <FontToggle />
          <LangToggle />
        </View>
      )}
    </View>
  )

  const flavorFields = (
    <>

        {isMixMode && (
          <View style={styles.flavorCard}>
            <Text style={styles.flavorTitle}>{t('build.mixTitle')}</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('build.mixName')}</Text>
              <FlavorAutocomplete
                value={mixName}
                onChangeText={setMixName}
                placeholder={t('build.mixNamePlaceholder')}
              />
              <Text style={styles.fieldHint}>{t('build.mixNameHint')}</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('build.concentrateAmount')}</Text>
              <PresetGrid items={MIX_VOLUMES} value={mixAmount} onSelect={setMixAmount} suffix="ml" />
              <SliderInput label="" value={mixAmount} onChangeText={setMixAmount} min={0} max={500} step={5} suffix="ml" />
            </View>
            <SliderInput label={t('build.concentratePct')} value={flavorPct} onChangeText={setFlavorPct} min={0} max={40} step={0.5} suffix="%" />
            {renderWarn(highFlavorWarn)}
            {mixTotal !== null && (
              <View style={styles.mixPreview}>
                <Ionicons name="flask-outline" size={14} color={colors.primaryLight} />
                <Text style={styles.mixPreviewText}>
                  {t('build.makesAbout')} <Text style={styles.mixPreviewValue}>{mixTotal} ml</Text> {t('build.totalLiquid')}
                </Text>
              </View>
            )}
          </View>
        )}

        {ingredientMode === 'flavor' && (
          <View style={styles.flavorCard}>
            <Text style={styles.flavorTitle}>{t('build.flavorTitle')}</Text>

            <View style={styles.flavorList}>
              {flavors.map((f, i) => (
                <View key={f.id} style={styles.flavorRow}>
                  <Text style={styles.flavorIndex}>{i + 1}</Text>
                  <FlavorAutocomplete
                    value={f.name}
                    onChangeText={v => updateFlavor(f.id, 'name', v)}
                    placeholder={t('common.name')}
                    exclude={flavors.map(o => o.name).filter(o => o !== f.name)}
                    recs={flavorRecs}
                    onPick={(name, rec, val) => {
                      if (val != null) {
                        updateFlavor(f.id, 'value', String(val))
                        return
                      }
                      const rv = getRecValue(rec)
                      if (rv != null && !(parseFloat(f.value) > 0)) {
                        updateFlavor(f.id, 'value', String(rv))
                      }
                    }}
                  />
                  <>
                    <Text style={styles.flavorPct}>%</Text>
                    <TextInput
                      style={styles.flavorInput}
                      value={f.value}
                      onChangeText={v => {
                        let val = v.replace(/[^0-9.]/g, '')
                        if (parseFloat(val) > 100) val = '100'
                        updateFlavor(f.id, 'value', val)
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textDim}
                    />
                    <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => removeFlavor(f.id)} accessibilityRole="button" accessibilityLabel={`${t('recipes.removeFlavor')} ${i + 1}`}>
                      <Ionicons name="close-circle" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.addFlavorBtn} onPress={addFlavor} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={16} color={colors.success} />
              <Text style={styles.addFlavorBtnText}>{t('recipes.addFlavor')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.loadFlavorBtn} onPress={() => { setLoadSearch(''); setLoadModalVisible(true) }} activeOpacity={0.7}>
              <Ionicons name="library-outline" size={16} color={colors.primaryLight} />
              <Text style={styles.loadFlavorBtnText}>{t('build.loadFlavorsFromRecipe')}</Text>
            </TouchableOpacity>
            {renderWarn(highFlavorWarn)}
          </View>
        )}
    </>
  )

  const nicotineFields = (
    <>
      <View style={styles.nicCard}>
          <Text style={styles.nicTitle}>{t('build.nicotine')}</Text>

          <View style={styles.fieldGroup}>
          <SliderInput label={t('build.nicStrength')} value={nicStrength} onChangeText={setNicStrength} min={0} max={100} step={1} suffix="mg/ml" />
          {renderWarn(highNicWarn)}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('build.nicBaseType')}</Text>
            <View style={styles.modeRow}>
              {[
                { key: 'pg', label: t('build.pg100') },
                { key: 'vg', label: t('build.vg100') },
                { key: 'custom', label: t('build.custom') },
              ].map(m => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.modeBtn, nicBaseMode === m.key && styles.modeBtnActive]}
                  onPress={() => setNicBaseMode(m.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modeBtnText, nicBaseMode === m.key && styles.modeBtnTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {nicBaseMode === 'custom' && (
              <View style={styles.customSpacing}>
                <PgVgSlider value={nicCustomPg} onChangeText={v => { setNicCustomPg(v); const n = parseFloat(v) || 0; setNicCustomVg(String(100 - n)) }} />
              </View>
            )}
          </View>
        </View>

        {nicSources.length > 0 && (
          <View style={styles.cardSection}>
            {warning && (
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={16} color={colors.danger} />
                <Text style={styles.warningText}>{warning}</Text>
              </View>
            )}
            <Text style={styles.cardSectionTitle}>{t('build.savedSources')}</Text>
            {nicSources.map(s => (
              <View key={s.id}>
                <SourceCard
                  source={s}
                  onUpdate={(field, value) => {
                    setNicSources(prev => prev.map(x => x.id === s.id ? { ...x, [field]: value } : x))
                  }}
                  onDelete={() => setNicSources(nicSources.filter(x => x.id !== s.id))}
                  amountInputRef={el => { amountRefs.current[s.id] = el }}
                />
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.addNicBtn} onPress={() => {
          setNicSources([...nicSources, { id: Date.now(), strength: nicStrength, baseType: nicBaseMode, customPg: nicCustomPg, customVg: nicCustomVg, amount: '' }])
        }}>
          <Ionicons name="add-circle-outline" size={16} color={colors.primaryLight} />
          <Text style={styles.addNicBtnText}>{t('build.addNicSource')}</Text>
        </TouchableOpacity>
        </View>
    </>
  )

  // Wizard step 2 shows the ingredient fields without the mode picker,
  // because step 1 already asked Flavor vs Mix (and Load Batch lives there).
  // Nicotine moves to step 3, so step 2 only has the flavor/mix fields.
  const wizardIngredientsSection = (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Ionicons name="options" size={14} color={colors.primaryLight} />
        <Text style={styles.sectionTitle}>{t('build.ingredients')}</Text>
      </View>
      {flavorFields}
    </View>
  )



  const resultSection = (
    <View
      ref={resultWrapRef}
    >
      {items && (
        <ResultBox
          key={resultKey}
          items={items}
          title={t('build.recipe')}
          segments={composition}
          totalMl={result.actualTotal}
          flat={wide}
          animateFill
          action={
            <TouchableOpacity style={styles.saveResultBtn} onPress={() => { hapticLight(); setSaveModalVisible(true) }} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('build.save')}>
              <Ionicons name="layers-outline" size={18} color={colors.primaryLight} />
              <Text style={styles.saveResultBtnText}>{t('build.save')}</Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
  )

  // Step 1: Welcome — "What shall we make today?"
  const volumeStep = (
    <View style={styles.welcomeCard}>
      <Text style={styles.welcomeTitle}>{t('build.welcomeTitle')}</Text>
      <Text style={styles.welcomeSubtitle}>{t('build.welcomeSubtitle')}</Text>

      <TouchableOpacity
        style={[styles.welcomeOption, ingredientMode === 'flavor' && styles.welcomeOptionActive]}
        onPress={() => { setIngredientMode('flavor'); goToStep(2) }}
        activeOpacity={0.7}
      >
        <View style={styles.welcomeOptionIcon}>
          <Ionicons name="leaf" size={22} color={colors.success} />
        </View>
        <View style={styles.welcomeOptionInfo}>
          <Text style={styles.welcomeOptionTitle}>{t('build.welcomeFlavorTitle')}</Text>
          <Text style={styles.welcomeOptionDesc}>{t('build.welcomeFlavorDesc')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.welcomeOption, isMixMode && styles.welcomeOptionActive]}
        onPress={() => { setIngredientMode('mix'); goToStep(2) }}
        activeOpacity={0.7}
      >
        <View style={styles.welcomeOptionIcon}>
          <Ionicons name="flask" size={22} color={colors.primaryLight} />
        </View>
        <View style={styles.welcomeOptionInfo}>
          <Text style={styles.welcomeOptionTitle}>{t('build.welcomeReadyMixTitle')}</Text>
          <Text style={styles.welcomeOptionDesc}>{t('build.welcomeReadyMixDesc')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.welcomeLoadBtn} onPress={() => setLoadBatchModalVisible(true)} activeOpacity={0.7}>
        <Ionicons name="layers-outline" size={16} color={colors.primaryLight} />
        <Text style={styles.welcomeLoadBtnText}>{t('build.loadBatch')}</Text>
      </TouchableOpacity>
    </View>
  )

  // Step 2: Target Liquid Amount (no presets, dynamic step, animated)
  const volumeStep2 = (() => {
    const vol = isMixMode ? (parseFloat(mixAmount) || 0) : (parseFloat(totalVolume) || 0)
    const pct = isMixMode ? (parseFloat(flavorPct) || 0) : 0
    const totalVol = isMixMode && pct > 0 ? vol / (pct / 100) : vol
    const dynamicStep = totalVol < 50 ? 1 : totalVol < 200 ? 5 : 10
    return (
      <View style={styles.welcomeCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="water" size={14} color={colors.primaryLight} />
          <Text style={styles.sectionTitle}>{t('build.targetAmount')}</Text>
        </View>

        {!isMixMode ? (
          <View style={styles.fieldGroup}>
            <SliderInput label="" value={totalVolume} onChangeText={setTotalVolume} min={0} max={500} step={dynamicStep} suffix="ml" />
          </View>
        ) : (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('build.concentrateAmount')}</Text>
            <SliderInput label="" value={mixAmount} onChangeText={setMixAmount} min={0} max={500} step={dynamicStep} suffix="ml" />
            <SliderInput label={t('build.concentratePct')} value={flavorPct} onChangeText={setFlavorPct} min={0} max={40} step={0.5} suffix="%" />
            {renderWarn(highFlavorWarn)}
            {mixTotal !== null && (
              <View style={styles.mixPreview}>
                <Ionicons name="flask-outline" size={14} color={colors.primaryLight} />
                <Text style={styles.mixPreviewText}>
                  {t('build.makesAbout')} <Text style={styles.mixPreviewValue}>{mixTotal} ml</Text> {t('build.totalLiquid')}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    )
  })()

  // Step 3: VG / PG Ratio
  const vgPgStep = (
    <View style={styles.targetCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name="contrast" size={14} color={colors.primaryLight} />
        <Text style={styles.sectionTitle}>{t('build.targetPgVg')}</Text>
      </View>
      <View style={styles.fieldGroup}>
        <View style={styles.presetRowSpread}>
          {VG_PG_PRESETS.map((p, i) => {
            const active = parseFloat(targetPg) === p.pg
            return (
              <TouchableOpacity key={i} style={[styles.preset, styles.presetSpread, active && styles.presetActive]} onPress={() => setTargetPg(String(p.pg))} activeOpacity={0.7}>
                <Text style={[styles.presetText, active && styles.presetTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <PgVgSlider value={targetPg} onChangeText={setTargetPg} />
      </View>
    </View>
  )

  // Wizard progress indicator: number circles with labels underneath.
  const wizardProgress = (
    <View style={[styles.wizardProgress, wide && styles.pagerWide]}>
      {[1, 2, 3, 4, 5, 6, 7].map(step => (
        <View key={step} style={styles.wizardStep}>
          <View style={styles.wizardStepCircleRow}>
            {step > 1 && <View style={[styles.wizardStepLine, wizardStep >= step && styles.wizardStepLineActive]} />}
            <TouchableOpacity
              style={[
                styles.wizardStepCircle,
                wizardStep >= step && styles.wizardStepCircleActive,
                wizardStep === step && styles.wizardStepCircleCurrent,
              ]}
              onPress={() => goToStep(step)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={[
                styles.wizardStepNum,
                wizardStep >= step && styles.wizardStepNumActive,
              ]}>{step}</Text>
            </TouchableOpacity>
            {step < 7 && <View style={[styles.wizardStepLine, wizardStep > step && styles.wizardStepLineActive]} />}
          </View>
          <TouchableOpacity onPress={() => goToStep(step)} activeOpacity={0.7} accessibilityRole="button" style={styles.wizardStepLabelWrap}>
            <Text style={[
              styles.wizardStepLabel,
              wizardStep === step && styles.wizardStepLabelActive,
            ]} numberOfLines={2}>
              {t(WIZARD_STEP_KEYS[step - 1])}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  )

  // Step 4: Target Nicotine Strength (was in targetSection)
  const targetStrengthStep = (
    <View style={styles.targetCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name="options" size={14} color={colors.primaryLight} />
        <Text style={styles.sectionTitle}>{t('build.targetStrength')}</Text>
      </View>
      <View style={styles.fieldGroup}>
        <PresetGrid items={NIC_PRESETS} value={targetStrength} onSelect={setTargetStrength} suffix="mg" />
        <SliderInput label="" value={targetStrength} onChangeText={setTargetStrength} min={0} max={50} step={0.5} suffix="mg/ml" />
        {renderWarn(targetHighWarn)}
        {nicPreview && (
          <View style={styles.presetPreview}>
            <Ionicons name="calculator-outline" size={14} color={colors.primaryLight} />
            <Text style={styles.presetPreviewText}>
              {t('build.presetPreview', { ml: nicPreview.ml, strength: parseFloat(nicStrength) || 0, vol: nicPreview.vol, target: parseFloat(targetStrength) || 0 })}
            </Text>
          </View>
        )}
      </View>
    </View>
  )

  // Shared page wrapper for consistent scroll + crossfade styling
  const stepPage = (key, content) => (
    <ScrollView key={key} style={styles.crossfadePage} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.pagerContent}>
      {content}
    </ScrollView>
  )

  const stepPages = [
    stepPage(1, volumeStep),
    stepPage(2, volumeStep2),
    stepPage(3, vgPgStep),
    stepPage(4, nicotineFields),
    stepPage(5, targetStrengthStep),
    stepPage(6, wizardIngredientsSection),
    stepPage(7, (
      <>
        {resultSection}
        {!items && (
          <View style={styles.wizardResultEmpty}>
            <Ionicons name="flask-outline" size={30} color={colors.primary + '80'} />
            <Text style={styles.wideEmptyTitle}>{t('build.wideEmptyTitle')}</Text>
            <Text style={styles.wideEmptyText}>{t('build.wideEmptyText')}</Text>
          </View>
        )}
      </>
    )),
  ]

  const shakeBottle = () => {
    Animated.sequence([
      Animated.timing(bottleShake, { toValue: 10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(bottleShake, { toValue: -10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(bottleShake, { toValue: 8, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(bottleShake, { toValue: -8, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(bottleShake, { toValue: 0, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
    ]).start()
  }

  const handleNext = () => {
    const vol = isMixMode ? (parseFloat(mixAmount) || 0) : (parseFloat(totalVolume) || 0)
    if (vol <= 0 && wizardStep >= 2) { shakeBottle(); return }
    if (wizardStep === 3 && !(parseFloat(targetPg) > 0)) { shakeBottle(); return }
    goToStep(wizardStep + 1)
  }

  // Persistent live-preview bottle — sits between step buttons and page content
  const persistentBottle = (
    <LivePreviewBottle
      segments={wizardStep <= 2 ? [] : previewSegments}
      visible={true}
      shake={bottleShake}
    />
  )

  // Wizard crossfade pager: pages fade + slide in/out (cinematic transition)
  const wizardPager = (
    <View style={styles.wizardStage}>
      <View style={styles.wizardStageContent}>
        {wizardStep > 1 && (
          <View style={styles.bottleRow}>
            {persistentBottle}
            {wizardStep >= 2 && (isMixMode ? (parseFloat(mixAmount) || 0) : (parseFloat(totalVolume) || 0)) > 0 && (
              <VolumeScale
                volume={isMixMode ? (parseFloat(mixAmount) || 0) : (parseFloat(totalVolume) || 0)}
              />
            )}
          </View>
        )}
        <View style={styles.crossfadeContainer}>
          <Animated.View style={[styles.crossfadeTrack, {
            opacity: stepFade,
            transform: [{ translateY: stepSlideY }, { scale: stepScale }],
          }]}>
            {stepPages[wizardStep - 1]}
          </Animated.View>
        </View>
      </View>
      {wizardStep > 1 && (
        <TouchableOpacity style={[styles.wizardFloatArrow, styles.wizardFloatArrowLeft]} onPress={() => goToStep(wizardStep - 1)} activeOpacity={0.8} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={24} color={colors.primaryLight} />
        </TouchableOpacity>
      )}
      {wizardStep < 7 && (
        <TouchableOpacity style={[styles.wizardFloatArrow, styles.wizardFloatArrowRight]} onPress={handleNext} activeOpacity={0.8} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityRole="button" accessibilityLabel={t('common.next')}>
          <Ionicons name="chevron-forward" size={24} color={colors.primaryLight} />
        </TouchableOpacity>
      )}
    </View>
  )
  const dock = (
    <View style={styles.bottomDock}>
      <Animated.View pointerEvents="none" style={[styles.dockShadowLayer, { opacity: dockShadowOpacity }]} />
      <View style={styles.summaryBar} accessibilityLiveRegion="polite">
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('build.summaryBase')}</Text>
          <View style={styles.summaryValueRow}>
            <Ionicons name="flask-outline" size={11} color={colors.primaryLight} />
            <Text style={styles.summaryValue} numberOfLines={1}>{nicPreview ? `${nicPreview.ml} ml` : '—'}</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('build.summaryVol')}</Text>
          <View style={styles.summaryValueRow}>
            <Ionicons name="water-outline" size={11} color={colors.primaryLight} />
            <Text style={styles.summaryValue} numberOfLines={1}>{liveVol != null ? `${liveVol} ml` : '—'}</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('build.summaryVgPg')}</Text>
          <View style={styles.summaryValueRow}>
            <Ionicons name="contrast-outline" size={11} color={colors.primaryLight} />
            <Text style={styles.summaryValue} numberOfLines={1}>{summaryPgVal > 0 ? `${summaryVg}/${summaryPg}` : '—'}</Text>
          </View>
        </View>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {wide ? (
          <>
            <StickyHeader ref={headerRef}>{heroBlock}</StickyHeader>
            <View style={styles.wizardBody}>
              {wizardProgress}
              {wizardPager}
            </View>
            {dock}
          </>
        ) : (
          <>
            <StickyHeader ref={headerRef}>{heroBlock}</StickyHeader>
            <View style={styles.wizardBody}>
              {wizardProgress}
              {wizardPager}
            </View>
            {dock}
          </>
        )}
      </KeyboardAvoidingView>

      <Modal visible={loadBatchModalVisible} transparent animationType="fade" onRequestClose={() => setLoadBatchModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setLoadBatchModalVisible(false)} accessibilityRole="button" accessibilityLabel={t('common.close')} />
          <View style={styles.modalCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="layers" size={14} color={colors.primaryLight} />
              <Text style={styles.sectionTitle}>{t('build.loadBatch')}</Text>
            </View>
            {savedBatches.length === 0 ? (
              <Text style={styles.modalEmptyText}>{t('build.noBatches')}</Text>
            ) : (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {[...savedBatches].reverse().map(b => (
                <TouchableOpacity key={b.id} style={styles.recipeRow} onPress={() => loadBatch(b)} activeOpacity={0.7}>
                  <View style={styles.recipeRowInfo}>
                    <Text style={styles.recipeRowName}>{b.name}</Text>
                    <Text style={styles.recipeRowMetaText}>{b.isMixMode ? t('build.mix.mode') : t('build.flavor.mode')} · {(b.totalVolume || b.mixAmount) ? `${b.totalVolume || b.mixAmount} ml` : ''} · {b.targetStrength ? `${b.targetStrength} mg` : ''}</Text>
                  </View>
                  <Ionicons name="download-outline" size={20} color={colors.primaryLight} />
                </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={[styles.modalBtn, styles.modalCancel, styles.modalClose]} onPress={() => setLoadBatchModalVisible(false)} activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={loadModalVisible} transparent animationType="fade" onRequestClose={() => setLoadModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setLoadModalVisible(false)} accessibilityRole="button" accessibilityLabel={t('common.close')} />
          <View style={styles.modalCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="library" size={14} color={colors.primaryLight} />
              <Text style={styles.sectionTitle}>{t('build.loadFlavorsFromRecipe')}</Text>
            </View>
            {savedRecipes.filter(r => Array.isArray(r.flavors) && r.flavors.length > 0).length === 0 ? (
              <Text style={styles.modalEmptyText}>{t('build.noRecipesWithFlavors')}</Text>
            ) : (
              <>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={16} color={colors.textDim} />
                  <TextInput
                    style={styles.searchInput}
                    value={loadSearch}
                    onChangeText={setLoadSearch}
                    placeholder={t('recipes.searchPlaceholder')}
                    placeholderTextColor={colors.textDim}
                    autoCorrect={false}
                  />
                  {loadSearch !== '' && (
                    <TouchableOpacity onPress={() => setLoadSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('recipes.clearSearch')}>
                      <Ionicons name="close-circle" size={16} color={colors.textDim} />
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                  {savedRecipes
                    .filter(r => Array.isArray(r.flavors) && r.flavors.length > 0)
                    .filter(r => {
                      const q = loadSearch.trim().toLowerCase()
                      if (!q) return true
                      return r.name.toLowerCase().includes(q) ||
                        r.flavors.some(f => (f.name || f.brand || '').toLowerCase().includes(q))
                    })
                    .map(r => (
                    <TouchableOpacity key={r.id} style={styles.recipeRow} onPress={() => loadRecipe(r)} activeOpacity={0.7}>
                      <View style={styles.recipeRowInfo}>
                        <Text style={styles.recipeRowName}>{r.name}</Text>
                        <Text style={styles.recipeRowMetaText}>{t('common.flavorCount', { count: r.flavors.length })}</Text>
                      </View>
                      <Ionicons name="download-outline" size={20} color={colors.primaryLight} />
                    </TouchableOpacity>
                  ))}
                  {loadSearch.trim() !== '' && savedRecipes
                    .filter(r => Array.isArray(r.flavors) && r.flavors.length > 0)
                    .filter(r => {
                      const q = loadSearch.trim().toLowerCase()
                      return r.name.toLowerCase().includes(q) ||
                        r.flavors.some(f => (f.name || f.brand || '').toLowerCase().includes(q))
                    }).length === 0 && (
                    <Text style={styles.modalEmptyText}>{t('recipes.noMatch')} &quot;{loadSearch}&quot;</Text>
                  )}
                </ScrollView>
              </>
            )}
            <TouchableOpacity style={[styles.modalBtn, styles.modalCancel, styles.modalClose]} onPress={() => setLoadModalVisible(false)} activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={saveModalVisible} transparent animationType="fade" onRequestClose={() => setSaveModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setSaveModalVisible(false)} accessibilityRole="button" accessibilityLabel={t('common.close')} />
          <View style={styles.modalCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="layers" size={14} color={colors.primaryLight} />
              <Text style={styles.sectionTitle}>{t('build.saveBatch')}</Text>
            </View>
            <TextInput
              style={styles.modalInput}
              value={batchName}
              onChangeText={setBatchName}
              placeholder={t('build.batchName')}
              placeholderTextColor={colors.textDim}
              autoFocus
            />
            <TouchableOpacity
              style={styles.costHint}
              onPress={() => {
                setSaveModalVisible(false)
                hapticLight()
                navigation.navigate('prices')
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('build.saveCostLink')}
            >
              <Ionicons name="pricetag" size={13} color={colors.primaryLight} />
              <Text style={styles.costHintText}>
                <Text style={styles.costHintMain}>{t('build.saveCostHint')} </Text>
                <Text style={styles.costHintLink}>{t('build.saveCostLink')} →</Text>
              </Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setSaveModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalConfirm]} onPress={saveCurrentBatch} activeOpacity={0.7}>
                <Text style={styles.modalConfirmText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  heroLogoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  heroLogoRowMobile: { gap: spacing.sm },
  heroLogo: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#F3EDE1', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 7 },
  heroLogoMobile: { width: 36, height: 36, borderRadius: 10, padding: 5 },
  heroText: { flex: 1, flexShrink: 1 },
  heroTitle: { fontSize: fs(23, scale), ...font('700'), color: colors.text, letterSpacing: -0.5 },
  heroTitleDesktop: { fontSize: fs(18, scale) },
  heroSubtitle: { fontSize: fs(13, scale), color: colors.textMuted, marginTop: 1 },
  heroRight: { marginLeft: 'auto', flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Wizard styles
  wizardProgress: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  wizardStep: { flex: 1, alignItems: 'center' },
  wizardStepCircleRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  wizardStepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardStepCircleActive: { borderColor: colors.primary, backgroundColor: colors.primary + '26' },
  wizardStepCircleCurrent: { borderColor: colors.primaryLight, backgroundColor: colors.primary },
  wizardStepNum: { fontSize: fs(9, scale), ...font('700'), color: colors.textDim },
  wizardStepNumActive: { color: colors.primaryLight },
  wizardStepLabelWrap: { marginTop: 4, paddingHorizontal: 2 },
  wizardStepLabel: { fontSize: fs(9, scale), color: colors.textDim, ...font('600'), textAlign: 'center' },
  wizardStepLabelActive: { color: colors.primaryLight },
  wizardStepLine: { height: 2, flex: 1, backgroundColor: colors.border, marginHorizontal: 2, borderRadius: 1 },
  wizardStepLineActive: { backgroundColor: colors.primary },
  welcomeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    gap: spacing.md,
  },
  welcomeLogo: { width: 84, height: 84, borderRadius: 22, backgroundColor: '#F3EDE1', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 14, alignSelf: 'center', marginBottom: spacing.md },
  welcomeTitle: { fontSize: fs(22, scale), ...font('800'), color: colors.text, marginBottom: 6 },
  welcomeSubtitle: { fontSize: fs(14, scale), color: colors.textDim, lineHeight: 20, marginBottom: spacing.lg },
  welcomeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    marginBottom: spacing.sm,
  },
  welcomeOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary + '14' },
  welcomeOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '1A',
  },
  welcomeOptionInfo: { flex: 1 },
  welcomeOptionTitle: { fontSize: fs(16, scale), ...font('700'), color: colors.textMuted, marginBottom: 2 },
  welcomeOptionDesc: { fontSize: fs(12, scale), color: colors.textDim, lineHeight: 17 },
  welcomeLoadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary + '4D',
    marginTop: spacing.xs,
  },
  welcomeLoadBtnText: { fontSize: fs(14, scale), color: colors.primaryLight, ...font('600') },

  wizardBody: { flex: 1 },
  wizardStage: { flex: 1 },
  wizardStageContent: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 608,
    paddingHorizontal: 40,
  },
  wizardFloatArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary + '4D',
    backgroundColor: colors.inputBg,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  wizardFloatArrowLeft: { left: 6 },
  wizardFloatArrowRight: { right: 6 },
  pager: { flex: 1, overflow: 'hidden' },
  pagerWide: { alignSelf: 'center', width: '100%', maxWidth: 520 },
  pagerTrack: { flexDirection: 'row', flex: 1, alignItems: 'stretch' },
  pagerPage: { flexShrink: 0 },
  pagerContent: { paddingHorizontal: 14, paddingTop: spacing.xs, paddingBottom: 24 },
  crossfadeContainer: { position: 'relative', flex: 1, overflow: 'visible' },
  crossfadeTrack: { flex: 1 },
  crossfadePage: { flex: 1 },
  bottleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 4,
    pointerEvents: 'none',
    minHeight: 220,
  },

  wizardResultEmpty: {
    alignItems: 'center',
    gap: 10,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  kav: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingHorizontal: 14, paddingBottom: 48 },
  // Sticky header above the layout (narrow & wide — matches other tabs)
  // Two-column desktop layout (wide web only — never used on mobile)
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
  wideRight: { width: 400, flexShrink: 0 },
  wideRightScroll: { flex: 1 },
  wideRightContent: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  wideEmpty: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.md,
  },
  wideEmptyTitle: { fontSize: fs(15, scale), ...font('700'), color: colors.textMuted, textAlign: 'center' },
  wideEmptyText: { fontSize: fs(13, scale), color: colors.textDim, textAlign: 'center', lineHeight: 19 },
  fieldGroup: {},
  fieldLabel: { fontSize: fs(15, scale), ...font('600'), color: colors.textMuted, marginBottom: 8, letterSpacing: 0.3 },
  fieldHint: { fontSize: fs(11, scale), color: colors.textDim, marginTop: 6, lineHeight: 15 },
  modeRow: { flexDirection: 'row', gap: 6 },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '1A' },
  modeBtnText: { fontSize: fs(13, scale), color: colors.textDim, ...font('500') },
  modeBtnTextActive: { color: colors.primaryLight },
  customSpacing: { marginTop: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  cardWithPreview: { position: 'relative', overflow: 'visible' },
  targetCard: {
    backgroundColor: colors.primary + '12',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary + '59',
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  nicCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  nicTitle: { fontSize: fs(14, scale), color: colors.textMuted, ...font('700'), letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center', marginBottom: spacing.md },
  flavorCard: {
    backgroundColor: colors.success + '12',
    borderWidth: 1,
    borderColor: colors.success + '40',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  flavorTitle: { fontSize: fs(14, scale), color: colors.textMuted, ...font('700'), letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center', marginBottom: spacing.md },
  ingredientTypeCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  toggleActive: { borderColor: colors.primary, backgroundColor: colors.primary + '1A' },
  toggleText: { fontSize: fs(16, scale), color: colors.textDim, ...font('600') },
  toggleTextActive: { color: colors.primaryLight },
  loadBatchRow: { alignItems: 'flex-end', marginTop: spacing.sm },
  loadBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
  },
  loadBatchBtnText: { fontSize: fs(13, scale), color: colors.primaryLight, ...font('600') },
  flavorList: { marginBottom: spacing.sm },
  flavorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  flavorIndex: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.success + '26',
    color: colors.success,
    fontSize: fs(13, scale),
    ...font('700'),
    textAlign: 'center',
    lineHeight: 24,
  },
  flavorInput: {
    width: 48,
    flexShrink: 0,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: fs(13, scale),
    height: 48,
    paddingHorizontal: 6,
  },
  flavorPct: { color: colors.textMuted, fontSize: fs(13, scale), ...font('600'), marginLeft: 2 },
  addFlavorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.success + '4D',
    borderStyle: 'dashed',
  },
  addFlavorBtnText: { fontSize: fs(13, scale), color: colors.success, ...font('600') },
  loadFlavorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary + '4D',
    borderStyle: 'dashed',
    marginTop: spacing.sm,
  },
  loadFlavorBtnText: { fontSize: fs(13, scale), color: colors.primaryLight, ...font('600') },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  sectionTitle: { fontSize: fs(15, scale), ...font('700'), color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetRowSpread: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  presetGridRows: { marginBottom: spacing.md },
  presetGridRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  preset: {
    backgroundColor: colors.primary + '14',
    borderWidth: 1,
    borderColor: colors.primary + '26',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  presetSpread: { flex: 1, alignItems: 'center' },
  presetActive: { borderColor: colors.primary, backgroundColor: colors.primary + '2E' },
  presetTextActive: { color: colors.primaryLight, ...font('700') },
  presetText: { fontSize: fs(13, scale), color: colors.primaryLight, ...font('500') },
  bottomDock: {
    borderTopWidth: 1,
    borderTopColor: colors.primary + '1F',
    backgroundColor: colors.bg,
  },
  // Dedicated shadow layer above the dock: only its opacity animates, which
  // works on web (RN-web Animated can't emit an interpolated shadow* style).
  dockShadowLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    height: 8,
    ...dockShadow,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 1 },
  summaryValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryLabel: {
    fontSize: fs(9, scale),
    color: colors.textDim,
    ...font('600'),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryValue: { fontSize: fs(12, scale), ...font('700'), color: colors.primaryLight },
  summaryDivider: { width: 1, height: 18, backgroundColor: colors.primary + '1F' },
  saveResultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary + '4D',
    backgroundColor: colors.primary + '0F',
  },
  saveResultBtnText: { fontSize: fs(15, scale), ...font('600'), color: colors.primaryLight },
  topBtn: {
    position: 'absolute',
    right: 20,
    bottom: 84,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  sourceCard: {
    backgroundColor: colors.primary + '08',
    borderWidth: 1,
    borderColor: colors.primary + '26',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sourceCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sourceCardTitle: { fontSize: fs(13, scale), ...font('600'), color: colors.primaryLight, letterSpacing: 0.3, textTransform: 'uppercase' },
  cardSection: { marginBottom: spacing.sm },
  cardSectionTitle: { fontSize: fs(14, scale), color: colors.textMuted, ...font('600'), marginBottom: 8, letterSpacing: 0.3 },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.danger + '1A',
    borderWidth: 1,
    borderColor: colors.danger + '66',
    borderRadius: 10,
    padding: 10,
    marginBottom: spacing.sm,
  },
  warningText: { flex: 1, fontSize: fs(13, scale), color: colors.danger, ...font('500') },
  inlineWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: spacing.sm,
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.warning + '1F',
    borderWidth: 1,
    borderColor: colors.warning + '59',
  },
  inlineWarnText: { flex: 1, fontSize: fs(13, scale), color: colors.warning, ...font('500') },
  presetPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.primary + '1A',
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  presetPreviewText: { flex: 1, fontSize: fs(13, scale), color: colors.textMuted },
  addNicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary + '33',
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  addNicBtnText: { fontSize: fs(13, scale), color: colors.primaryLight, ...font('600') },
  sourceAmountRow: { marginBottom: 0 },
  mixPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary + '14',
    borderWidth: 1,
    borderColor: colors.primary + '26',
    borderRadius: 10,
    paddingVertical: 10,
  },
  mixPreviewText: { fontSize: fs(14, scale), color: colors.textMuted, ...font('500') },
  mixPreviewValue: { color: colors.primaryLight, ...font('700') },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '0A',
    borderWidth: 1,
    borderColor: colors.primary + '1F',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  recipeRowInfo: { flex: 1, marginRight: spacing.sm },
  recipeRowName: { fontSize: fs(17, scale), ...font('600'), color: colors.text, marginBottom: 4 },
  recipeRowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recipeRowMetaText: { fontSize: fs(13, scale), color: colors.textDim, ...font('500') },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.modalBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  modalList: {
    maxHeight: 320,
    marginBottom: spacing.sm,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: fs(17, scale),
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
    },
  costHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.primary + '12',
    marginBottom: spacing.md,
  },
  costHintText: { flex: 1, flexShrink: 1 },
  costHintMain: { fontSize: fs(12, scale), color: colors.textMuted, lineHeight: 17 },
  costHintLink: { fontSize: fs(12, scale), color: colors.primaryLight, ...font('700') },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: fs(15, scale), height: 44, paddingVertical: 0 },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  modalCancel: { backgroundColor: 'rgba(148, 163, 184, 0.1)', borderWidth: 1.5, borderColor: colors.border },
  modalCancelText: { fontSize: fs(15, scale), ...font('600'), color: colors.textMuted },
  modalConfirm: { backgroundColor: colors.primary },
  modalConfirmText: { fontSize: fs(15, scale), ...font('700'), color: '#fff' },
  modalClose: { marginTop: spacing.md },
  modalEmptyText: { fontSize: fs(15, scale), color: colors.textDim, textAlign: 'center', paddingVertical: spacing.md, marginBottom: spacing.sm },
})
