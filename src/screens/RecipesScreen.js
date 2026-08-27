import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, Text, FlatList, ScrollView, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import ConfirmDialog from '../components/ConfirmDialog'
import FlavorAutocomplete from '../components/FlavorAutocomplete'
import Input from '../components/Input'
import StickyHeader from '../components/StickyHeader'
import ScreenHero from '../components/ScreenHero'
import { fs, spacing, tagColors, useLayoutMode, font } from '../theme'
import { useTheme } from '../ThemeContext'
import { loadRecipes, saveRecipes, newRecipeId, seedStarterRecipes, loadInventory, loadFlavorRecs, recomputeFlavorRecs, getRecValue } from '../utils/recipes'
import { formatRecipeText } from '../utils/shareUtils'
import { useUndo } from '../utils/useUndo'
import UndoToast from '../components/UndoToast'
import { useEscToClose } from '../utils/useEscToClose'
import { useI18n } from '../i18n'
import * as Clipboard from 'expo-clipboard'
import QRCode from 'react-native-qrcode-svg'

export default function RecipesScreen({ navigation }) {
  const { t } = useI18n()
  const { theme: colors, textScale } = useTheme()
  const styles = createStyles(colors, textScale)
  // Wide web (viewport >= 820px): recipe cards render as a two-column grid.
  const { wide, desktop } = useLayoutMode()
  const scrollRef = useRef(null)
  const [recipes, setRecipes] = useState([])
  const [inventory, setInventory] = useState([])
  const [flavorRecs, setFlavorRecs] = useState({})
  const [makeableFilter, setMakeableFilter] = useState('all') // 'all' | 'makeable' | 'oneMissing'
  const [name, setName] = useState('')
  const [flavors, setFlavors] = useState([{ id: 1, name: '', value: '' }])
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [confirmCopyId, setConfirmCopyId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [scaleRecipe, setScaleRecipe] = useState(null)
  const [scaleTargetVol, setScaleTargetVol] = useState('100')
  const [shareRecipe, setShareRecipe] = useState(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [shareTab, setShareTab] = useState('text') // 'text' | 'qr'
  useEscToClose(scaleRecipe !== null, () => setScaleRecipe(null))
  useEscToClose(shareRecipe !== null, () => { setShareRecipe(null); setShareTab('text') })
  const [selectedTags, setSelectedTags] = useState([])
  const [tagFilter, setTagFilter] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const headerRef = useRef(null)
  const recipesRef = useRef(recipes)
  const flavorRecsRef = useRef(flavorRecs)
  useEffect(() => { recipesRef.current = recipes }, [recipes])
  useEffect(() => { flavorRecsRef.current = flavorRecs }, [flavorRecs])
  const onHeaderScroll = useCallback((e) => headerRef.current?.handleScroll(e), [])

  const RECIPE_TAGS = ['fruit', 'dessert', 'menthol', 'bakery', 'tobacco', 'beverage', 'candy', 'floral']

  useFocusEffect(
    useCallback(() => {
      let active = true
      Promise.all([seedStarterRecipes().then(loadRecipes), loadInventory(), loadFlavorRecs()]).then(([rData, invData, recData]) => {
        if (!active) return
        setRecipes(rData || [])
        setInventory(invData || [])
        const recs = recData || {}
        setFlavorRecs(recs)
        recomputeFlavorRecs(rData || [], recs).then(next => { if (active) setFlavorRecs(next) })
      })
      return () => { active = false }
    }, [])
  )

  const inventorySet = useMemo(() => {
    return new Set(inventory.map(n => n.trim().toLowerCase()))
  }, [inventory])

  const isMakeable = useCallback((recipe) => {
    if (!Array.isArray(recipe.flavors) || recipe.flavors.length === 0) return false
    return recipe.flavors.every(f => f && f.name && inventorySet.has(f.name.trim().toLowerCase()))
  }, [inventorySet])

  const getMissingFlavors = useCallback((recipe) => {
    if (!Array.isArray(recipe.flavors)) return []
    return recipe.flavors.filter(f => f && f.name && !inventorySet.has(f.name.trim().toLowerCase())).map(f => f.name)
  }, [inventorySet])

  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = [...recipes].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    
    if (makeableFilter === 'makeable') {
      list = list.filter(r => isMakeable(r))
    } else if (makeableFilter === 'oneMissing') {
      list = list.filter(r => getMissingFlavors(r).length === 1)
    }

    if (tagFilter) {
      list = list.filter(r => Array.isArray(r.tags) && r.tags.includes(tagFilter))
    }

    if (!q) return list
    return list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (Array.isArray(r.flavors) && r.flavors.some(f => (f.name || '').toLowerCase().includes(q)))
    )
  }, [recipes, search, makeableFilter, isMakeable, getMissingFlavors, tagFilter])

  function startEdit(recipe) {
    setEditingId(recipe.id)
    setFormOpen(true)
    setName(recipe.name)
    setSelectedTags(Array.isArray(recipe.tags) ? recipe.tags : [])
    setFlavors(
      Array.isArray(recipe.flavors) && recipe.flavors.length > 0
        ? recipe.flavors.map((f, i) => ({ id: Date.now() + i, name: f.name || '', value: String(f.value) }))
        : [{ id: Date.now(), name: '', value: '' }]
    )
    setFormError('')
    setFormSuccess('')
    // Scroll to top so the edit form is visible
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50)
  }

  function resetForm() {
    setEditingId(null)
    setName('')
    setFlavors([{ id: Date.now(), name: '', value: '' }])
    setSelectedTags([])
    setFormError('')
  }

  function addFlavor() {
    setFlavors([...flavors, { id: Date.now(), name: '', value: '' }])
  }

  function updateFlavor(id, field, value) {
    setFlavors(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  function removeFlavor(id) {
    setFlavors(prev => prev.filter(f => f.id !== id))
  }

  const liveTotal = useMemo(() =>
    flavors.reduce((sum, f) => sum + (parseFloat(f.value) || 0), 0),
    [flavors]
  )

  const liveIssues = useMemo(() => {
    const issues = []
    for (const f of flavors) {
      const nm = f.name.trim()
      if (nm !== '' && !(parseFloat(f.value) > 0)) issues.push(t('recipes.percentMissing', { name: nm }))
    }
    if (flavors.some(f => f.name.trim() === '' && (parseFloat(f.value) > 0))) issues.push(t('recipes.nameMissing'))
    const hasValues = flavors.some(f => f.name.trim() !== '' && (parseFloat(f.value) > 0))
    if (hasValues && Math.abs(liveTotal - 100) > 0.01) issues.push(t('recipes.totalHint'))
    return issues
  }, [flavors, liveTotal, t])

  const liveOk = liveIssues.length === 0
  const totalDisplay = liveTotal % 1 === 0 ? String(liveTotal) : liveTotal.toFixed(1)
  const canSave = name.trim() !== '' && flavors.some(f => f.name.trim() !== '' && (parseFloat(f.value) > 0)) && liveTotal <= 100

  function normalize() {
    const sum = flavors.reduce((a, f) => a + (parseFloat(f.value) || 0), 0)
    if (!(sum > 0)) return
    setFlavors(prev => prev.map(f => {
      const v = parseFloat(f.value) || 0
      const scaled = v > 0 ? Math.round((v / sum) * 100 * 10) / 10 : ''
      return { ...f, value: scaled === 0 && v > 0 ? '0.1' : String(scaled) }
    }))
    setFormSuccess(t('recipes.normalizeDone'))
  }

  const save = useCallback(async () => {
    setFormError('')
    setFormSuccess('')
    if (!name.trim()) {
      setFormError(t('recipes.errName'))
      return
    }
    const validFlavors = flavors.filter(f => (parseFloat(f.value) || 0) > 0)
    if (validFlavors.length === 0) {
      setFormError(t('recipes.errFlavor'))
      return
    }
    const total = validFlavors.reduce((a, f) => a + (parseFloat(f.value) || 0), 0)
    if (total > 100) {
      setFormError(t('recipes.totalHint'))
      return
    }
    const flavorList = validFlavors.map(f => ({ name: f.name.trim(), value: parseFloat(f.value) || 0 }))

    if (editingId !== null) {
      const updated = recipes.map(r => r.id === editingId ? { ...r, name: name.trim(), flavors: flavorList, tags: selectedTags } : r)
      setRecipes(updated)
      await saveRecipes(updated)
      const nextRecs = await recomputeFlavorRecs(updated, flavorRecs)
      setFlavorRecs(nextRecs)
      setFormSuccess(`"${name.trim()}" ${t('recipes.updatedOk')}`)
    } else {
      const recipe = {
        id: newRecipeId(),
        name: name.trim(),
        flavors: flavorList,
        tags: selectedTags,
        createdAt: new Date().toISOString(),
      }
      const updated = [...recipes, recipe]
      setRecipes(updated)
      await saveRecipes(updated)
      const nextRecs = await recomputeFlavorRecs(updated, flavorRecs)
      setFlavorRecs(nextRecs)
      setFormSuccess(`"${recipe.name}" ${t('recipes.savedOk')}`)
    }
    resetForm()
    setFormOpen(false)
  }, [recipes, name, flavors, editingId, selectedTags, flavorRecs, t])

  const duplicateRecipe = async (recipe) => {
    const copy = {
      ...recipe,
      id: newRecipeId(),
      name: `${recipe.name}${t('recipes.duplicateSuffix')}`,
      createdAt: new Date().toISOString(),
    }
    const updated = [...recipes, copy]
    setRecipes(updated)
    await saveRecipes(updated)
    const nextRecs = await recomputeFlavorRecs(updated, flavorRecs)
    setFlavorRecs(nextRecs)
  }

  const { undo, showUndo, dismissUndo, applyUndo } = useUndo()

  const remove = useCallback(async (id) => {
    const snapshotRecipes = recipesRef.current
    const snapshotFlavorRecs = flavorRecsRef.current
    const target = snapshotRecipes.find(r => r.id === id)
    const updated = snapshotRecipes.filter(r => r.id !== id)
    setRecipes(updated)
    await saveRecipes(updated)
    const nextRecs = await recomputeFlavorRecs(updated, snapshotFlavorRecs)
    setFlavorRecs(nextRecs)
    if (target) {
      showUndo(t('recipes.undoDeleteMsg'), () => {
        setRecipes(snapshotRecipes)
        saveRecipes(snapshotRecipes).then(() => recomputeFlavorRecs(snapshotRecipes, snapshotFlavorRecs)).then(setFlavorRecs)
      })
    }
  }, [showUndo, t])

  const handleCopyText = async (text) => {
    try {
      await Clipboard.setStringAsync(text)
      setCopyError(false)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      setCopySuccess(false)
      setCopyError(true)
      setTimeout(() => setCopyError(false), 3000)
    }
  }

  const heroBlock = (
    <ScreenHero icon="bookmark" title={t('recipes.title')} subtitle={t('recipes.subtitle')} subtitleNumberOfLines={2} desktop={desktop} />
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StickyHeader ref={headerRef}>{heroBlock}</StickyHeader>
      <FlatList
        ref={scrollRef}
        key={wide ? 'recipes-grid' : 'recipes-list'}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        data={recipes.length > 0 ? filteredRecipes : []}
        keyExtractor={(r) => r.id}
        numColumns={wide ? 2 : 1}
        columnWrapperStyle={wide ? styles.recipeGridRow : undefined}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={onHeaderScroll}
        scrollEventThrottle={16}
        initialNumToRender={30}
        maxToRenderPerBatch={30}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== 'web'}
        ListHeaderComponent={
          <>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.sectionHeaderToggle}
            onPress={() => {
              setFormOpen(o => {
                const next = !o
                if (next) { setFormError(''); setFormSuccess('') }
                return next
              })
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={formOpen ? t('recipes.collapseForm') : t('recipes.new')}
          >
                <Ionicons name={editingId !== null ? 'create' : 'add-circle'} size={16} color={colors.primaryLight} />
            <Text style={styles.sectionTitle}>{editingId !== null ? t('recipes.edit') : t('recipes.new')}</Text>
            <Ionicons name={formOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textDim} style={styles.sectionHeaderChevron} />
          </TouchableOpacity>

          {formOpen && (
          <>
          <Input label={t('recipes.recipeName')} value={name} onChangeText={setName} placeholder={t('recipes.recipeNamePlaceholder')} keyboardType="default" />

          <Text style={styles.fieldLabel}>{t('recipes.flavors')}</Text>
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
                  style={[styles.flavorInput, f.name.trim() !== '' && !(parseFloat(f.value) > 0) && styles.flavorInputError]}
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
                <TouchableOpacity style={styles.flavorRemoveBtn} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} onPress={() => removeFlavor(f.id)} accessibilityRole="button" accessibilityLabel={`${t('recipes.removeFlavor')} ${i + 1}`}>
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </TouchableOpacity>
              </>
            </View>
          ))}

          <TouchableOpacity style={styles.addFlavorBtn} onPress={addFlavor} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={16} color={colors.success} />
            <Text style={styles.addFlavorBtnText}>{t('recipes.addFlavor')}</Text>
          </TouchableOpacity>

          {/* Tag Chips */}
          <Text style={styles.fieldLabel}>{t('recipes.tags')}</Text>
          <View style={styles.tagChipsRow}>
            {RECIPE_TAGS.map(tag => {
              const tc = tagColors[tag]
              const active = selectedTags.includes(tag)
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagChip, { backgroundColor: tc.bg, borderColor: active ? tc.text : tc.border }]}
                  onPress={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(`recipes.tag.${tag}`)}
                >
                  {active && <Ionicons name="checkmark" size={11} color={tc.text} />}
                  <Text style={[styles.tagChipText, { color: tc.text }]}>{t(`recipes.tag.${tag}`)}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {flavors.some(f => f.name.trim() !== '' || (parseFloat(f.value) > 0)) && (
            <View style={[styles.liveSummary, liveOk && styles.liveSummaryOk]} accessibilityLiveRegion="polite">
              <View style={styles.liveTotalRow}>
                <Ionicons name={liveOk ? 'checkmark-circle' : 'alert-circle'} size={16} color={liveOk ? colors.success : colors.warning} />
                <Text style={[styles.liveTotalText, { color: liveOk ? colors.success : colors.warning }]}>
                  {t('recipes.total')}: {totalDisplay}%
                </Text>
              </View>
              {liveIssues.map((issue, i) => (
                <View key={i} style={styles.liveIssueRow}>
                  <View style={styles.liveIssueDot} />
                  <Text style={styles.liveIssueText}>{issue}</Text>
                </View>
              ))}
              {liveTotal > 0 && Math.abs(liveTotal - 100) > 0.01 && (
                <TouchableOpacity style={styles.normalizeBtn} onPress={normalize} activeOpacity={0.7} accessibilityRole="button">
                  <Ionicons name="scale-outline" size={13} color={colors.primaryLight} />
                  <Text style={styles.normalizeBtnText}>{t('recipes.normalize')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {editingId !== null ? (
            <View style={styles.formActionsRow}>
              <TouchableOpacity style={[styles.saveBtn, styles.cancelEditBtn]} onPress={resetForm} activeOpacity={0.9} accessibilityRole="button">
                <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
                <Text style={styles.cancelEditBtnText}>{t('recipes.cancelEdit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, styles.formActionsFlex, !canSave && styles.saveBtnDisabled]} onPress={save} disabled={!canSave} activeOpacity={0.9} accessibilityRole="button" accessibilityState={{ disabled: !canSave }}>
                <Ionicons name="bookmark" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>{t('recipes.update')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]} onPress={save} disabled={!canSave} activeOpacity={0.9} accessibilityRole="button" accessibilityState={{ disabled: !canSave }}>
              <Ionicons name="bookmark" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>{t('recipes.save')}</Text>
            </TouchableOpacity>
          )}

          </>
          )}
        </View>

        {formError !== '' && (
          <View style={styles.feedbackError}>
            <Ionicons name="alert-circle" size={15} color={colors.danger} />
            <Text style={styles.feedbackErrorText} accessibilityRole="alert" accessibilityLiveRegion="polite">{formError}</Text>
          </View>
        )}
        {formSuccess !== '' && (
          <View style={styles.feedbackSuccess}>
            <Ionicons name="checkmark-circle" size={15} color={colors.success} />
            <Text style={styles.feedbackSuccessText} accessibilityRole="alert" accessibilityLiveRegion="polite">{formSuccess}</Text>
          </View>
        )}

        {recipes.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="library" size={16} color={colors.primaryLight} />
              <Text style={styles.sectionTitle}>{t('recipes.saved')} ({recipes.length})</Text>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={colors.textDim} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={t('recipes.searchPlaceholder')}
                placeholderTextColor={colors.textDim}
                autoCorrect={false}
              />
              {search !== '' && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('recipes.clearSearch')}>
                  <Ionicons name="close-circle" size={16} color={colors.textDim} />
                </TouchableOpacity>
              )}
            </View>

            {/* Makeable Stock Filter Tabs */}
            <View style={styles.filterTabs}>
              <TouchableOpacity
                style={[styles.filterTab, makeableFilter === 'all' && styles.filterTabActive]}
                onPress={() => setMakeableFilter('all')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: makeableFilter === 'all' }}
                accessibilityLabel={t('flavors.filterAll')}
              >
                <Text style={[styles.filterTabText, makeableFilter === 'all' && styles.filterTabTextActive]}>{t('flavors.filterAll')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterTab, makeableFilter === 'makeable' && styles.filterTabActive]}
                onPress={() => setMakeableFilter('makeable')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: makeableFilter === 'makeable' }}
                accessibilityLabel={t('recipes.filterMakeable')}
              >
                <Ionicons name="checkmark-circle" size={13} color={makeableFilter === 'makeable' ? colors.success : colors.textDim} />
                <Text style={[styles.filterTabText, makeableFilter === 'makeable' && styles.filterTabTextActive]}>
                  {t('recipes.filterMakeable')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterTab, makeableFilter === 'oneMissing' && styles.filterTabActive]}
                onPress={() => setMakeableFilter('oneMissing')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: makeableFilter === 'oneMissing' }}
                accessibilityLabel={t('recipes.filterOneMissing')}
              >
                <Ionicons name="alert-circle" size={13} color={makeableFilter === 'oneMissing' ? colors.primaryLight : colors.textDim} />
                <Text style={[styles.filterTabText, makeableFilter === 'oneMissing' && styles.filterTabTextActive]}>
                  {t('recipes.filterOneMissing')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tag Filter Row */}
            <View style={styles.tagFilterRow}>
              <TouchableOpacity
                style={[styles.tagFilterChip, tagFilter === null && styles.tagFilterChipActive]}
                onPress={() => setTagFilter(null)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: tagFilter === null }}
                accessibilityLabel={t('flavors.filterAll')}
              >
                <Text style={[styles.tagFilterChipText, tagFilter === null && styles.tagFilterChipTextActive]}>{t('flavors.filterAll')}</Text>
              </TouchableOpacity>
              {RECIPE_TAGS.map(tag => {
                const tc = tagColors[tag]
                const active = tagFilter === tag
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagFilterChip, active && { borderColor: tc.text, backgroundColor: tc.bg }]}
                    onPress={() => setTagFilter(active ? null : tag)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t(`recipes.tag.${tag}`)}
                  >
                    <Text style={[styles.tagFilterChipText, active && { color: tc.text }]}>{t(`recipes.tag.${tag}`)}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {filteredRecipes.length === 0 && (
              <View style={styles.noResults}>
                <Ionicons name="search-outline" size={26} color={colors.textDim} />
                <Text style={styles.noResultsText}>
                  {search.trim() !== '' ? `${t('recipes.noMatch')} "${search}"` : t('recipes.noMatchFilter')}
                </Text>
              </View>
            )}

          </View>
        )}
          </>
        }
        renderItem={({ item: r }) => {
          const canMake = isMakeable(r)
          const missing = getMissingFlavors(r)
          const oneMissing = missing.length === 1
          return (
            <View style={[styles.recipeCard, wide && styles.recipeCardWide]}>
              <View style={styles.recipeTitleRow}>
                <Text style={styles.recipeName}>{r.name}</Text>
                {canMake && (
                  <View style={styles.makeableBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.success} importantForAccessibility="no" />
                    <Text style={styles.makeableBadgeText}>{t('flavors.inStock')}</Text>
                  </View>
                )}
                {oneMissing && (
                  <View style={styles.oneMissingBadge}>
                    <Ionicons name="alert-circle" size={12} color={colors.warning} importantForAccessibility="no" />
                    <Text style={styles.oneMissingBadgeText}>{t('recipes.oneMissing')} ({missing[0]})</Text>
                  </View>
                )}
              </View>

              <View style={styles.recipeActions}>
                <TouchableOpacity
                  style={styles.brewBtn}
                  onPress={() => navigation.navigate('build', { brewRecipe: r })}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('recipes.brew')} ${r.name}`}
                >
                  <Ionicons name="flask" size={14} color="#fff" />
                  <Text style={styles.brewBtnText}>{t('recipes.brew')}</Text>
                </TouchableOpacity>

                <View style={styles.recipeIconBtns}>
                  <TouchableOpacity style={styles.recipeActionBtn} onPress={() => setConfirmCopyId(r.id)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('recipes.copyTitle')}>
                    <Ionicons name="copy-outline" size={16} color={colors.primaryLight} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.recipeActionBtn} onPress={() => { setScaleRecipe(r); setScaleTargetVol('100') }} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('recipes.scale')}>
                    <Ionicons name="resize-outline" size={16} color={colors.primaryLight} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.recipeActionBtn} onPress={() => setShareRecipe(r)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('recipes.share')}>
                    <Ionicons name="share-social-outline" size={16} color={colors.primaryLight} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.recipeActionBtn} onPress={() => startEdit(r)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('recipes.edit')}>
                    <Ionicons name="create-outline" size={16} color={colors.primaryLight} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.recipeActionBtn} onPress={() => setConfirmId(r.id)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('recipes.deleteTitle')}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              {r.source ? <Text style={styles.recipeSource}>{r.source}</Text> : null}
              {Array.isArray(r.tags) && r.tags.length > 0 && (
                <View style={styles.recipeTagPillsRow}>
                  {r.tags.map(tag => {
                    const tc = tagColors[tag]
                    return (
                      <View key={tag} style={[styles.recipeTagPill, { backgroundColor: tc.bg, borderColor: tc.border }]}>
                        <Text style={[styles.recipeTagPillText, { color: tc.text }]}>{t(`recipes.tag.${tag}`)}</Text>
                      </View>
                    )
                  })}
                </View>
              )}
              {Array.isArray(r.flavors) && r.flavors.length > 0 ? (
                <View style={styles.recipeTags}>
                  {r.flavors.map((f, i) => (
                    <View key={i} style={styles.tag}><Text style={styles.tagText}>{f.name || t('recipes.flavorN', { i: i + 1 })} {f.value}%</Text></View>
                  ))}
                </View>
              ) : (
                <Text style={styles.recipeEmptyFlavors}>{t('recipes.noFlavors')}</Text>
              )}
            </View>
          )
        }}
        ListEmptyComponent={
          recipes.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="bookmark-outline" size={40} color={colors.textDim} />
              <Text style={styles.emptyText}>{t('recipes.empty')}</Text>
            </View>
          ) : null
        }
      />
      </KeyboardAvoidingView>

      {/* Scale Modal */}
      <Modal visible={scaleRecipe !== null} transparent animationType="fade" onRequestClose={() => setScaleRecipe(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setScaleRecipe(null)} accessibilityRole="button" accessibilityLabel={t('common.close')} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="resize" size={18} color={colors.primaryLight} />
              <Text style={styles.modalTitle}>{t('recipes.scaleModalTitle')}</Text>
              <TouchableOpacity onPress={() => setScaleRecipe(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <Ionicons name="close-circle" size={20} color={colors.textDim} />
              </TouchableOpacity>
            </View>
            <Text style={styles.scaleRecipeName}>{scaleRecipe?.name}</Text>

            <View style={styles.scalePresetsRow}>
              {[30, 60, 100, 120, 250].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.scalePreset, scaleTargetVol === String(v) && styles.scalePresetActive]}
                  onPress={() => setScaleTargetVol(String(v))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.scalePresetText, scaleTargetVol === String(v) && styles.scalePresetTextActive]}>{v}ml</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.scaleVolumeRow}>
              <Text style={styles.scaleVolumeLabel}>{t('recipes.targetVolume')}</Text>
              <View style={styles.scaleVolumeInputWrap}>
                <TextInput
                  style={styles.scaleVolumeInput}
                  value={scaleTargetVol}
                  onChangeText={v => {
                    const cleaned = v.replace(/[^0-9.]/g, '')
                    if (parseFloat(cleaned) > 1000) return
                    setScaleTargetVol(cleaned)
                  }}
                  keyboardType="decimal-pad"
                  placeholder="100"
                  placeholderTextColor={colors.textDim}
                  accessibilityLabel={t('recipes.targetVolume')}
                />
                <Text style={styles.scaleVolumeSuffix}>ml</Text>
              </View>
            </View>

            <ScrollView style={styles.scaleList}>
              {Array.isArray(scaleRecipe?.flavors) && scaleRecipe.flavors.map((f, i) => {
                const targetVol = parseFloat(scaleTargetVol) || 100
                const ml = Math.round((targetVol * (f.value / 100)) * 100) / 100
                const grams = Math.round((ml * 1.04) * 100) / 100
                return (
                  <View key={i} style={styles.scaleItemRow}>
                    <Text style={styles.scaleItemName} numberOfLines={1}>{f.name}</Text>
                    <Text style={styles.scaleItemVal}>{f.value}% → <Text style={styles.scaleItemHighlight}>{ml}ml</Text> ({grams}g)</Text>
                  </View>
                )
              })}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setScaleRecipe(null)} activeOpacity={0.8}>
              <Text style={styles.modalCloseBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal visible={shareRecipe !== null} transparent animationType="fade" onRequestClose={() => { setShareRecipe(null); setShareTab('text') }}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => { setShareRecipe(null); setShareTab('text') }} accessibilityRole="button" accessibilityLabel={t('common.close')} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="share-social" size={18} color={colors.primaryLight} />
              <Text style={styles.modalTitle}>{t('recipes.share')}</Text>
              <TouchableOpacity onPress={() => { setShareRecipe(null); setShareTab('text') }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <Ionicons name="close-circle" size={20} color={colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Tab switcher */}
            <View style={styles.shareTabRow}>
              <TouchableOpacity
                style={[styles.shareTabBtn, shareTab === 'text' && styles.shareTabBtnActive]}
                onPress={() => setShareTab('text')}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text-outline" size={16} color={shareTab === 'text' ? colors.primaryLight : colors.textDim} />
                <Text style={[styles.shareTabText, shareTab === 'text' && styles.shareTabTextActive]}>{t('recipes.shareText')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shareTabBtn, shareTab === 'qr' && styles.shareTabBtnActive]}
                onPress={() => setShareTab('qr')}
                activeOpacity={0.7}
              >
                <Ionicons name="qr-code-outline" size={16} color={shareTab === 'qr' ? colors.primaryLight : colors.textDim} />
                <Text style={[styles.shareTabText, shareTab === 'qr' && styles.shareTabTextActive]}>{t('recipes.shareQr')}</Text>
              </TouchableOpacity>
            </View>

            {shareTab === 'text' ? (
              <>
                <View style={styles.shareTextWrap}>
                  <Text style={styles.shareText}>{formatRecipeText(shareRecipe)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => handleCopyText(formatRecipeText(shareRecipe))}
                  activeOpacity={0.8}
                >
                  <Ionicons name={copySuccess ? "checkmark-circle" : "copy"} size={16} color="#fff" />
                  <Text style={styles.copyBtnText}>{copySuccess ? t('recipes.copied') : t('recipes.copyToClipboard')}</Text>
                </TouchableOpacity>
                {copyError && <Text style={styles.copyErrorText} accessibilityRole="alert" accessibilityLiveRegion="polite">{t('recipes.copyFailed')}</Text>}
              </>
            ) : (
              <View style={styles.qrWrap}>
                <View style={styles.qrBox}>
                  <QRCode
                    value={JSON.stringify({ n: shareRecipe?.name, f: shareRecipe?.flavors, t: shareRecipe?.tags })}
                    size={190}
                    backgroundColor="#fff"
                    color="#000"
                  />
                </View>
                <Text style={styles.qrHint}>{t('recipes.qrHint')}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setShareRecipe(null); setShareTab('text') }} activeOpacity={0.8}>
              <Text style={styles.modalCloseBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={confirmId !== null}
        title={t('recipes.deleteTitle')}
        message={t('recipes.deleteMsg')}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => { remove(confirmId); setConfirmId(null) }}
      />

      {undo && (
        <UndoToast message={undo.message} onUndo={applyUndo} onDismiss={dismissUndo} />
      )}

      <ConfirmDialog
        visible={confirmCopyId !== null}
        title={t('recipes.copyTitle')}
        message={t('recipes.copyMsg')}
        confirmText={t('recipes.copyConfirm')}
        icon="copy-outline"
        tone="primary"
        onCancel={() => setConfirmCopyId(null)}
        onConfirm={() => {
          const target = recipes.find(r => r.id === confirmCopyId)
          if (target) duplicateRecipe(target)
          setConfirmCopyId(null)
        }}
      />
    </SafeAreaView>
  )
}


const createStyles = (colors, scale = 1) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  kav: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingHorizontal: 14, paddingBottom: 100 },
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
  sectionHeaderToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  sectionHeaderChevron: { marginLeft: 'auto' },
  saveBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 15,
    borderRadius: 12,
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: { fontSize: fs(16, scale), ...font('700'), color: '#fff' },
  formActionsRow: { flexDirection: 'row', gap: spacing.sm },
  formActionsFlex: { flex: 1 },
  cancelEditBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cancelEditBtnText: { fontSize: fs(16, scale), ...font('700'), color: colors.textMuted },
  feedbackError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.danger + '2E',
    borderWidth: 1,
    borderColor: colors.danger + '66',
  },
  feedbackErrorText: { flex: 1, fontSize: fs(13, scale), color: colors.danger, ...font('500') },
  feedbackSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.success + '2E',
    borderWidth: 1,
    borderColor: colors.success + '59',
  },
  feedbackSuccessText: { flex: 1, fontSize: fs(13, scale), color: colors.success, ...font('500') },
  liveSummary: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.warning + '1F',
    borderWidth: 1,
    borderColor: colors.warning + '66',
  },
  liveSummaryOk: {
    backgroundColor: colors.success + '2E',
    borderColor: colors.success + '59',
  },
  liveTotalRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveTotalText: { fontSize: fs(14, scale), ...font('700') },
  liveIssueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  liveIssueDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.warning },
  liveIssueText: { flex: 1, fontSize: fs(13, scale), color: colors.textMuted },
  normalizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary + '26',
    borderWidth: 1,
    borderColor: colors.primary + '59',
  },
  normalizeBtnText: { fontSize: fs(13, scale), ...font('600'), color: colors.primaryLight },
  fieldLabel: { fontSize: fs(15, scale), ...font('600'), color: colors.textMuted, marginBottom: 8, letterSpacing: 0.3 },
  flavorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  flavorIndex: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.success + '33',
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
  flavorInputError: {
    borderColor: colors.danger,
    backgroundColor: colors.danger + '1F',
  },
  flavorPct: { color: colors.textMuted, fontSize: fs(13, scale), ...font('600'), marginLeft: 2 },
  flavorRemoveBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  addFlavorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.success + '99',
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  addFlavorBtnText: { fontSize: fs(13, scale), color: colors.success, ...font('600') },
  recipeCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  // Wide web: two-column grid row + even vertical rhythm
  // Note: react-native-web defaults to flex-shrink:0, so flex:1 is required for the
  // cards to split the row width instead of overflowing at their content width.
  recipeGridRow: { gap: spacing.md },
  recipeCardWide: { flex: 1, marginBottom: spacing.md },
  // Wraps on narrow cards: the icon row (copy/scale/share/edit/delete)
  // drops below the Brew button instead of overflowing to the right.
  recipeActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 8, marginBottom: spacing.sm },
  recipeIconBtns: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  recipeActionBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 40,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  brewBtnText: { color: '#fff', fontSize: fs(13, scale), ...font('700') },
  recipeTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  recipeName: { fontSize: fs(18, scale), ...font('600'), color: colors.text },
  makeableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.success + '33',
    borderWidth: 1,
    borderColor: colors.success + '66',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  makeableBadgeText: { fontSize: fs(13, scale), ...font('700'), color: colors.success },
  oneMissingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warning + '33',
    borderWidth: 1,
    borderColor: colors.warning + '66',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  oneMissingBadgeText: { fontSize: fs(13, scale), ...font('700'), color: colors.warning },
  recipeSource: { fontSize: fs(13, scale), color: colors.textDim, ...font('500'), marginBottom: spacing.sm },
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
  filterTabs: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  filterTabActive: { borderColor: colors.primaryLight, backgroundColor: colors.primary + '33' },
  filterTabText: { fontSize: fs(13, scale), ...font('600'), color: colors.textMuted },
  filterTabTextActive: { color: colors.primaryLight, ...font('700') },

  noResults: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 8 },
  noResultsText: { fontSize: fs(14, scale), color: colors.textDim },
  recipeTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recipeEmptyFlavors: { fontSize: fs(14, scale), color: colors.textDim },
  tag: {
    backgroundColor: colors.primary + '26',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: fs(14, scale), color: colors.primaryLight, ...font('500') },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: fs(17, scale), color: colors.textDim },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.modalBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    padding: spacing.lg,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  modalTitle: { flex: 1, fontSize: fs(17, scale), ...font('600'), color: colors.text },
  scaleRecipeName: { fontSize: fs(15, scale), color: colors.primaryLight, ...font('600'), marginBottom: 12 },
  scalePresetsRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  scalePreset: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  scalePresetActive: { borderColor: colors.primaryLight, backgroundColor: colors.primary + '33' },
  scalePresetText: { fontSize: fs(13, scale), ...font('600'), color: colors.textMuted },
  scalePresetTextActive: { color: colors.primaryLight, ...font('700') },
  scaleVolumeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
  scaleVolumeLabel: { fontSize: fs(14, scale), ...font('600'), color: colors.text },
  scaleVolumeInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.inputBg, paddingHorizontal: 10, minHeight: 44 },
  scaleVolumeInput: { width: 72, fontSize: fs(16, scale), ...font('700'), color: colors.text, paddingVertical: 8, textAlign: 'center' },
  scaleVolumeSuffix: { fontSize: fs(14, scale), ...font('600'), color: colors.textMuted },
  scaleList: { maxHeight: Math.round(Dimensions.get('window').height * 0.4) },
  scaleItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  scaleItemName: { flex: 1, fontSize: fs(14, scale), color: colors.text },
  scaleItemVal: { fontSize: fs(13, scale), color: colors.textMuted },
  scaleItemHighlight: { ...font('700'), color: colors.primaryLight },
  modalCloseBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 12, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  modalCloseBtnText: { fontSize: fs(14, scale), ...font('600'), color: colors.text },
  shareTextWrap: { backgroundColor: colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 12 },
  shareText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: fs(13, scale), color: colors.text, lineHeight: 18 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10 },
  copyBtnText: { color: '#fff', ...font('700'), fontSize: fs(14, scale) },
  copyErrorText: { fontSize: fs(13, scale), color: colors.danger, ...font('600'), textAlign: 'center', marginTop: 8 },

  // Tag chip styles (form)
  tagChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: spacing.md },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  tagChipText: { fontSize: fs(13, scale), ...font('700') },

  // Tag filter row (list)
  tagFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: spacing.sm },
  tagFilterChip: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  tagFilterChipActive: { borderColor: colors.primaryLight, backgroundColor: colors.primary + '33' },
  tagFilterChipText: { fontSize: fs(13, scale), ...font('600'), color: colors.textMuted },
  tagFilterChipTextActive: { color: colors.primaryLight, ...font('700') },

  // Recipe card category tag pills
  recipeTagPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: spacing.xs },
  recipeTagPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  recipeTagPillText: { fontSize: fs(13, scale), ...font('700') },

  // Share tab styles
  shareTabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  shareTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 40,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  shareTabBtnActive: { borderColor: colors.primaryLight, backgroundColor: colors.primary + '33' },
  shareTabText: { fontSize: fs(13, scale), ...font('600'), color: colors.textMuted },
  shareTabTextActive: { color: colors.primaryLight, ...font('700') },

  // QR code view
  qrWrap: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  qrBox: { padding: 14, backgroundColor: '#fff', borderRadius: 12 },
  qrHint: { fontSize: fs(13, scale), color: colors.textDim, textAlign: 'center' },
})


