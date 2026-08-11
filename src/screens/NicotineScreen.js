import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Keyboard, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import SliderInput from '../components/SliderInput'
import PgVgSlider from '../components/PgVgSlider'
import ResultBox from '../components/ResultBox'
import FlavorAutocomplete from '../components/FlavorAutocomplete'
import LangToggle from '../components/LangToggle'
import ThemePickerModal from '../components/ThemePickerModal'
import { fs, spacing } from '../theme'
import { useTheme } from '../ThemeContext'
import { calculateNicotine } from '../utils/calculations'
import { loadRecipes, saveRecipes, loadBatches, saveBatches, newBatchId, loadFlavorRecs, recomputeFlavorRecs, getRecValue } from '../utils/recipes'
import { useI18n } from '../i18n'

const TARGET_VOLUMES = [30, 60, 100, 120, 200, 250]
const MIX_VOLUMES = [10, 15, 20, 30, 60, 100]
const NIC_PRESETS = [1.5, 2, 3, 6, 10, 12]
const VG_PG_PRESETS = [
  { label: '80/20', pg: 20 },
  { label: '70/30', pg: 30 },
  { label: '50/50', pg: 50 },
]

function SourceCard({ source, onUpdate, onDelete, amountInputRef }) {
  const { t } = useI18n()
  const { theme: colors, textScale } = useTheme()
  const styles = createStyles(colors, textScale)
  const strength = source.strength
  const baseType = source.baseType
  const customPg = source.customPg || '50'
  const customVg = source.customVg || '50'
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
  const [nicStrength, setNicStrength] = useState('100')
  const [nicBaseMode, setNicBaseMode] = useState('pg')
  const [nicCustomPg, setNicCustomPg] = useState('50')
  const [nicCustomVg, setNicCustomVg] = useState('50')
  const nicPg = useMemo(() => {
    if (nicBaseMode === 'pg') return '100'
    if (nicBaseMode === 'vg') return '0'
    return nicCustomPg
  }, [nicBaseMode, nicCustomPg])
  const [targetStrength, setTargetStrength] = useState('3')
  const [targetPg, setTargetPg] = useState('30')
  const [totalVolume, setTotalVolume] = useState('100')
  const [mixAmount, setMixAmount] = useState('10')
  const [flavorPct, setFlavorPct] = useState('15')
  const [ingredientMode, setIngredientMode] = useState('flavor')
  const [themeModalVisible, setThemeModalVisible] = useState(false)
  const mixTotal = useMemo(() => {
    if (ingredientMode !== 'mix') return null
    const vol = parseFloat(mixAmount) || 0
    const pct = parseFloat(flavorPct) || 0
    if (vol <= 0 || pct <= 0) return null
    return Math.round((vol / (pct / 100)) * 10) / 10
  }, [ingredientMode, mixAmount, flavorPct])
  const [flavors, setFlavors] = useState([])
  const [nicSources, setNicSources] = useState([])
  const [result, setResult] = useState(null)
  const [warning, setWarning] = useState(null)
  const [savedRecipes, setSavedRecipes] = useState([])
  const [savedBatches, setSavedBatches] = useState([])
  const [flavorRecs, setFlavorRecs] = useState({})
  const [saveModalVisible, setSaveModalVisible] = useState(false)
  const [loadModalVisible, setLoadModalVisible] = useState(false)
  const [loadBatchModalVisible, setLoadBatchModalVisible] = useState(false)
  const [loadSearch, setLoadSearch] = useState('')
  const [batchName, setBatchName] = useState('')
  const amountRefs = useRef({})
  const scrollRef = useRef(null)
  const resultWrapRef = useRef(null)
  const resultYRef = useRef(0)
  const pendingScrollRef = useRef(false)

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
    }, [route.params?.loadRecipeId, route.params?.brewRecipe])
  )


  useEffect(() => {
    setResult(null)
    setWarning(null)
  }, [nicStrength, nicBaseMode, nicCustomPg, targetStrength, targetPg, totalVolume, mixAmount, flavorPct, ingredientMode, flavors, nicSources])

  const liveWarnings = useMemo(() => {
    const w = []
    const nicStr = parseFloat(nicStrength) || 0
    if (nicStr >= 50) w.push({ key: 'highNic', text: t('build.warnHighNic', { strength: nicStr }) })
    const avail = Math.max(nicStr, ...nicSources.filter(s => parseFloat(s.amount) > 0).map(s => parseFloat(s.strength) || 0))
    const target = parseFloat(targetStrength) || 0
    if (avail > 0 && target > avail) w.push({ key: 'targetHigh', text: t('build.warnTargetHigh', { target, source: avail }) })
    const flavorTotal = ingredientMode === 'mix'
      ? (parseFloat(flavorPct) || 0)
      : flavors.reduce((a, f) => a + (parseFloat(f.value) || 0), 0)
    if (flavorTotal > 25) w.push({ key: 'highFlavor', text: t('build.warnHighFlavor', { pct: flavorTotal }) })
    return w
  }, [nicStrength, nicSources, targetStrength, ingredientMode, flavorPct, flavors, t])

  const highNicWarn = liveWarnings.find(w => w.key === 'highNic')
  const targetHighWarn = liveWarnings.find(w => w.key === 'targetHigh')
  const highFlavorWarn = liveWarnings.find(w => w.key === 'highFlavor')

  const nicPreview = (() => {
    const nic = parseFloat(nicStrength) || 0
    const target = parseFloat(targetStrength) || 0
    if (!(nic > 0) || !(target > 0)) return null
    const vol = ingredientMode === 'mix'
      ? ((parseFloat(mixAmount) || 0) / ((parseFloat(flavorPct) || 0) / 100))
      : (parseFloat(totalVolume) || 0)
    if (!(vol > 0)) return null
    const ml = Math.round((target * vol / nic) * 10) / 10
    return { ml, vol }
  })()

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
    setFlavors(Array.isArray(r.flavors)
      ? r.flavors.map(f => ({ id: Date.now() + Math.random(), name: f.name || '', value: String(f.value ?? '') }))
      : [])
    setLoadModalVisible(false)
    setResult(null)
    setWarning(null)
  }

  function loadBatch(b) {
    setIngredientMode(b.ingredientMode ?? 'flavor')
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
      flavors: flavors.map(f => ({ name: f.name.trim(), value: parseFloat(f.value) || 0 })),
      nicSources: nicSources.map(s => ({ strength: s.strength, baseType: s.baseType, customPg: s.customPg, customVg: s.customVg, amount: s.amount })),
      result: result || null,
    }
    const updated = [...savedBatches, batch]
    setSavedBatches(updated)
    await saveBatches(updated)
    setSaveModalVisible(false)
    setBatchName('')
  }

  function calc() {
    Keyboard.dismiss()
    const missingSource = nicSources.find(s => !(parseFloat(s.amount) > 0))
    if (missingSource) {
      setWarning(t('build.warnMissingSource'))
      setResult(null)
      const input = amountRefs.current[missingSource.id]
      if (input && typeof input.focus === 'function') input.focus()
      return
    }
    setWarning(null)
    const vol = ingredientMode === 'mix' ? (parseFloat(mixAmount) || 0) : (parseFloat(totalVolume) || 0)
    const pct = ingredientMode === 'mix'
      ? parseFloat(flavorPct) || 0
      : flavors.reduce((a, f) => a + (parseFloat(f.value) || 0), 0)
    if (ingredientMode === 'mix' && pct <= 0) {
      setWarning(t('build.warnConcentratePct'))
      setResult(null)
      return
    }
    let computedTotal = vol
    if (ingredientMode === 'mix' && pct > 0) {
      computedTotal = vol / (pct / 100)
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
    pendingScrollRef.current = true
  }

  const items = result ? [
    { value: result.isPossible ? t('build.readyToMix') : t('build.impossibleMix'), badge: result.isPossible ? 'success' : 'danger' },
    { label: ingredientMode === 'mix' ? t('build.concentrate') : t('build.flavorToAdd'), value: `${result.flavorMl} ml`, accent: '#3b82f6' },
    ...(result.flavorBreakdown || []).map(f => ({ label: f.name, value: `${f.ml} ml`, sub: true, accent: '#3b82f6' })),
    { label: t('build.nicToAdd'), value: `${result.nicMl} ml`, accent: '#ef4444' },
    ...(result.nicBreakdown || []).map(n => ({ label: n.name, value: `${n.ml} ml`, sub: true, accent: '#ef4444' })),
    { label: t('build.pgToAdd'), value: `${result.pgNeeded} ml`, accent: '#f97316' },
    { label: t('build.vgToAdd'), value: `${result.vgNeeded} ml`, accent: '#22c55e' },
    { label: t('build.totalLiquidRes'), value: `${result.actualTotal} ml`, total: true },
  ] : null

  const composition = result && result.actualTotal > 0
    ? [
        { label: 'PG', pct: (result.pgNeeded / result.actualTotal) * 100, color: '#f97316' },
        { label: 'VG', pct: (result.vgNeeded / result.actualTotal) * 100, color: '#22c55e' },
        { label: t('build.nicotine'), pct: (result.nicMl / result.actualTotal) * 100, color: '#ef4444' },
        { label: t('build.flavor.mode'), pct: (result.flavorMl / result.actualTotal) * 100, color: '#3b82f6' },
      ].filter(s => s.pct > 0.05)
    : []

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name="flask" size={24} color={colors.primaryLight} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.title}>Flavorum</Text>
            <Text style={styles.subtitle} numberOfLines={2}>{t('app.tagline')}</Text>
          </View>
          <View style={styles.heroRight}>
            <TouchableOpacity
              style={styles.themeBtn}
              onPress={() => setThemeModalVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('theme.title')}
            >
              <Ionicons name="color-palette" size={20} color={colors.primaryLight} />
            </TouchableOpacity>
            <LangToggle />
          </View>
        </View>

        {flavors.length === 0 && !result && nicSources.length === 0 && (
          <View style={styles.hintBox}>
            <View style={styles.hintHeader}>
              <Ionicons name="sparkles" size={15} color={colors.primaryLight} />
              <Text style={styles.hintTitle}>{t('build.hintTitle')}</Text>
            </View>
            <Text style={styles.hintSteps}>{t('build.hintSteps')}</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="options" size={14} color={colors.primaryLight} />
            <Text style={styles.sectionTitle}>{t('build.ingredients')}</Text>
          </View>

          <View style={styles.ingredientTypeCard}>
            <View style={styles.toggleRow}>
              <TouchableOpacity style={[styles.toggle, ingredientMode === 'flavor' && styles.toggleActive]} onPress={() => setIngredientMode('flavor')} activeOpacity={0.7}>
                <Ionicons name="leaf" size={16} color={ingredientMode === 'flavor' ? colors.primaryLight : colors.textDim} />
                <Text style={[styles.toggleText, ingredientMode === 'flavor' && styles.toggleTextActive]}>{t('build.flavor.mode')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggle, ingredientMode === 'mix' && styles.toggleActive]} onPress={() => setIngredientMode('mix')} activeOpacity={0.7}>
                <Ionicons name="flask" size={16} color={ingredientMode === 'mix' ? colors.primaryLight : colors.textDim} />
                <Text style={[styles.toggleText, ingredientMode === 'mix' && styles.toggleTextActive]}>{t('build.mix.mode')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.loadBatchRow}>
              <TouchableOpacity style={styles.loadBatchBtn} onPress={() => setLoadBatchModalVisible(true)} activeOpacity={0.7}>
                <Ionicons name="layers-outline" size={15} color={colors.primaryLight} />
                <Text style={styles.loadBatchBtnText}>{t('build.loadBatch')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {ingredientMode === 'mix' && (
            <View style={styles.flavorCard}>
              <Text style={styles.flavorTitle}>{t('build.mixTitle')}</Text>

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
        </View>

        <View style={styles.targetCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="options" size={14} color={colors.primaryLight} />
            <Text style={styles.sectionTitle}>{t('build.target')}</Text>
          </View>

          {ingredientMode !== 'mix' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('build.targetAmount')}</Text>
              <PresetGrid items={TARGET_VOLUMES} value={totalVolume} onSelect={setTotalVolume} suffix="ml" />
              <SliderInput label="" value={totalVolume} onChangeText={setTotalVolume} min={0} max={500} step={5} suffix="ml" />
            </View>
          )}

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
            <PgVgSlider label={t('build.targetPgVg')} value={targetPg} onChangeText={setTargetPg} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('build.targetStrength')}</Text>
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

        <View
          ref={resultWrapRef}
          onLayout={e => {
            resultYRef.current = e.nativeEvent.layout.y
            if (pendingScrollRef.current && items) {
              pendingScrollRef.current = false
              scrollRef.current?.scrollTo({ y: Math.max(resultYRef.current - 16, 0), animated: true })
            }
          }}
        >
          {items && <ResultBox items={items} title={t('build.recipe')} segments={composition} />}
        </View>
      </ScrollView>

      <View style={styles.stickyBar}>
        <TouchableOpacity style={styles.saveBatchBtn} onPress={() => setSaveModalVisible(true)} activeOpacity={0.8} hitSlop={{ top: 4, bottom: 4 }}>
          <Ionicons name="layers-outline" size={18} color={colors.primaryLight} />
          <Text style={styles.saveBatchBtnText}>{t('build.save')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.calcBtn} onPress={calc} activeOpacity={0.9} hitSlop={{ top: 4, bottom: 4 }}>
          <Ionicons name="calculator" size={18} color="#fff" />
          <Text style={styles.calcBtnText}>{t('build.calculate')}</Text>
        </TouchableOpacity>
      </View>
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
                    <Text style={styles.recipeRowMetaText}>{b.ingredientMode === 'mix' ? t('build.mix.mode') : t('build.flavor.mode')} · {(b.totalVolume || b.mixAmount) ? `${b.totalVolume || b.mixAmount} ml` : ''} · {b.targetStrength ? `${b.targetStrength} mg` : ''}</Text>
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
                    <Text style={styles.modalEmptyText}>{t('recipes.noMatch')} "{loadSearch}"</Text>
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

      <ThemePickerModal visible={themeModalVisible} onClose={() => setThemeModalVisible(false)} />
    </SafeAreaView>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  kav: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingHorizontal: 14, paddingBottom: 48 },
  fieldGroup: { marginBottom: spacing.md },
  fieldLabel: { fontSize: fs(15, scale), fontWeight: '600', color: colors.textMuted, marginBottom: 8, letterSpacing: 0.3 },
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
  modeBtnText: { fontSize: fs(13, scale), color: colors.textDim, fontWeight: '500' },
  modeBtnTextActive: { color: colors.primaryLight },
  customSpacing: { marginTop: spacing.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  heroText: { flex: 1, flexShrink: 1 },
  heroRight: { marginLeft: 'auto', flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  themeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hintBox: {
    backgroundColor: colors.primary + '12',
    borderWidth: 1,
    borderColor: colors.primary + '40',
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  hintHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  hintTitle: { fontSize: fs(14, scale), fontWeight: '700', color: colors.primaryLight, letterSpacing: 0.3, textTransform: 'uppercase' },
  hintSteps: { fontSize: fs(14, scale), color: colors.textMuted, fontWeight: '500', lineHeight: 22 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: fs(29, scale), fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: fs(16, scale), color: colors.textMuted, marginTop: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  targetCard: {
    backgroundColor: colors.primary + '12',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary + '59',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  nicCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  nicTitle: { fontSize: fs(14, scale), color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center', marginBottom: spacing.md },
  flavorCard: {
    backgroundColor: colors.success + '12',
    borderWidth: 1,
    borderColor: colors.success + '40',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  flavorTitle: { fontSize: fs(14, scale), color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center', marginBottom: spacing.md },
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
  toggleText: { fontSize: fs(16, scale), color: colors.textDim, fontWeight: '600' },
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
  loadBatchBtnText: { fontSize: fs(13, scale), color: colors.primaryLight, fontWeight: '600' },
  flavorList: { marginBottom: spacing.sm },
  flavorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  flavorIndex: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.success + '26',
    color: colors.success,
    fontSize: fs(13, scale),
    fontWeight: '700',
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
  flavorPct: { color: colors.textMuted, fontSize: fs(13, scale), fontWeight: '600', marginLeft: 2 },
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
  addFlavorBtnText: { fontSize: fs(13, scale), color: colors.success, fontWeight: '600' },
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
  loadFlavorBtnText: { fontSize: fs(13, scale), color: colors.primaryLight, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  sectionTitle: { fontSize: fs(15, scale), fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
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
  presetTextActive: { color: colors.primaryLight, fontWeight: '700' },
  presetText: { fontSize: fs(13, scale), color: colors.primaryLight, fontWeight: '500' },
  stickyBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.primary + '1F',
  },
  calcBtn: {
    flex: 1.6,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: 14,
  },
  calcBtnText: { fontSize: fs(16, scale), fontWeight: '700', color: '#fff' },
  saveBatchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary + '4D',
    backgroundColor: colors.primary + '0F',
  },
  saveBatchBtnText: { fontSize: fs(15, scale), fontWeight: '600', color: colors.primaryLight },
  sourceCard: {
    backgroundColor: colors.primary + '08',
    borderWidth: 1,
    borderColor: colors.primary + '26',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sourceCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sourceCardTitle: { fontSize: fs(13, scale), fontWeight: '600', color: colors.primaryLight, letterSpacing: 0.3, textTransform: 'uppercase' },
  cardSection: { marginBottom: spacing.sm },
  cardSectionTitle: { fontSize: fs(14, scale), color: colors.textMuted, fontWeight: '600', marginBottom: 8, letterSpacing: 0.3 },
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
  warningText: { flex: 1, fontSize: fs(13, scale), color: colors.danger, fontWeight: '500' },
  inlineWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.warning + '1F',
    borderWidth: 1,
    borderColor: colors.warning + '59',
  },
  inlineWarnText: { flex: 1, fontSize: fs(13, scale), color: colors.warning, fontWeight: '500' },
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
  addNicBtnText: { fontSize: fs(13, scale), color: colors.primaryLight, fontWeight: '600' },
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
  mixPreviewText: { fontSize: fs(14, scale), color: colors.textMuted, fontWeight: '500' },
  mixPreviewValue: { color: colors.primaryLight, fontWeight: '700' },
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
  recipeRowName: { fontSize: fs(17, scale), fontWeight: '600', color: colors.text, marginBottom: 4 },
  recipeRowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recipeRowMetaText: { fontSize: fs(13, scale), color: colors.textDim, fontWeight: '500' },
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
    marginBottom: spacing.md,
    },
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
  modalCancelText: { fontSize: fs(15, scale), fontWeight: '600', color: colors.textMuted },
  modalConfirm: { backgroundColor: colors.primary },
  modalConfirmText: { fontSize: fs(15, scale), fontWeight: '700', color: '#fff' },
  modalClose: { marginTop: spacing.md },
  modalEmptyText: { fontSize: fs(15, scale), color: colors.textDim, textAlign: 'center', paddingVertical: spacing.md, marginBottom: spacing.sm },
})
