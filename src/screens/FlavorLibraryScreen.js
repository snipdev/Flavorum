import { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, Platform, Modal, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { fs, spacing } from '../theme'
import { useTheme } from '../ThemeContext'
import { loadRecipes, loadBatches, saveRecipes, saveBatches, loadCustomFlavors, saveCustomFlavors, loadInventory, saveInventory, loadInventoryMeta, saveInventoryMeta, loadFlavorRecs, saveFlavorRecs, recomputeFlavorRecs, getRecValue, formatRecValues, findRec } from '../utils/recipes'
import { ELR_FLAVORS } from '../data/flavors'
import { parseFlavorName } from '../utils/flavorUtils'
import { useI18n } from '../i18n'
import LangToggle from '../components/LangToggle'
import ConfirmDialog from '../components/ConfirmDialog'

function fuzzyScore(text, query) {
  const t = text.toLowerCase()
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  let score = 0
  for (const tok of tokens) {
    let s = -1
    if (t.startsWith(tok)) s = 40
    else if (t.includes(tok)) s = 25
    else if (tok.length >= 2) {
      let ti = 0
      let ok = true
      for (let i = 0; i < tok.length; i++) {
        const idx = t.indexOf(tok[i], ti)
        if (idx === -1) { ok = false; break }
        ti = idx + 1
      }
      if (ok) s = 12
    }
    if (s === -1) return -1
    score += s
  }
  return score
}

export default function FlavorLibraryScreen({ navigation }) {
  const { t } = useI18n()
  const { theme: colors, textScale } = useTheme()
  const styles = createStyles(colors, textScale)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(id)
  }, [search])
  const [recipes, setRecipes] = useState([])
  const [batches, setBatches] = useState([])
  const [customFlavors, setCustomFlavors] = useState([])
  const [inventory, setInventory] = useState([])
  const [inventoryMeta, setInventoryMeta] = useState({})
  const [flavorRecs, setFlavorRecs] = useState({})
  const [stockFilter, setStockFilter] = useState('all') // 'all' | 'stock'
  const [stockModalFlavor, setStockModalFlavor] = useState(null)
  const [stockBottleMl, setStockBottleMl] = useState('')
  const [stockPrice, setStockPrice] = useState('')
  const [stockRec, setStockRec] = useState('')

  useFocusEffect(
    useCallback(() => {
      let active = true
      setLoading(true)
      Promise.all([loadRecipes(), loadBatches(), loadCustomFlavors(), loadInventory(), loadInventoryMeta(), loadFlavorRecs()]).then(([r, b, c, inv, meta, recs]) => {
        if (!active) return
        setLoading(false)
        setRecipes(r)
        setBatches(b)
        setCustomFlavors(c)
        setInventory(inv)
        setInventoryMeta(meta || {})
        const recMap = recs || {}
        setFlavorRecs(recMap)
        recomputeFlavorRecs(r || [], recMap).then(next => { if (active) setFlavorRecs(next) })
      }).catch(() => { if (active) setLoading(false) })
      return () => { active = false }
    }, [])
  )

  const inventorySet = useMemo(() => {
    return new Set(inventory.map(n => n.trim().toLowerCase()))
  }, [inventory])

  const openStockModal = (flavorName) => {
    setStockModalFlavor(flavorName)
    const m = inventoryMeta[flavorName] || {}
    setStockBottleMl(m.bottleMl ? String(m.bottleMl) : '')
    setStockPrice(m.price ? String(m.price) : '')
    const rec = findRec(flavorRecs, flavorName)
    const rv = getRecValue(rec)
    setStockRec(rv != null ? String(rv) : '')
  }

  const handleSaveStock = async () => {
    if (!stockModalFlavor) return
    const key = stockModalFlavor.trim().toLowerCase()
    let nextInv = inventory
    if (!inventorySet.has(key)) {
      nextInv = [...inventory, stockModalFlavor]
      setInventory(nextInv)
      await saveInventory(nextInv)
    }
    const nextMeta = {
      ...inventoryMeta,
      [stockModalFlavor]: {
        ...(inventoryMeta[stockModalFlavor] || {}),
        bottleMl: parseFloat(stockBottleMl) || 0,
        price: parseFloat(stockPrice) || 0,
      }
    }
    setInventoryMeta(nextMeta)
    await saveInventoryMeta(nextMeta)

    const recValue = parseFloat(stockRec)
    const nextRecs = { ...flavorRecs }
    if (recValue > 0) {
      const prev = nextRecs[key] || {}
      nextRecs[key] = { avg: Math.round(recValue * 100) / 100, count: prev.count || 0, manual: true }
    } else {
      delete nextRecs[key]
    }
    setFlavorRecs(nextRecs)
    await saveFlavorRecs(nextRecs)

    setStockModalFlavor(null)
  }

  const handleRemoveFromStock = async () => {
    if (!stockModalFlavor) return
    const key = stockModalFlavor.trim().toLowerCase()
    const nextInv = inventory.filter(n => n.trim().toLowerCase() !== key)
    setInventory(nextInv)
    await saveInventory(nextInv)

    const nextMeta = { ...inventoryMeta }
    delete nextMeta[stockModalFlavor]
    setInventoryMeta(nextMeta)
    await saveInventoryMeta(nextMeta)

    const nextRecs = { ...flavorRecs }
    delete nextRecs[key]
    setFlavorRecs(nextRecs)
    await saveFlavorRecs(nextRecs)

    setStockModalFlavor(null)
  }

  const stats = useMemo(() => {
    const rCount = new Map()
    const bCount = new Map()
    const add = (map, name) => {
      if (!name) return
      const key = name.trim()
      if (!key) return
      map.set(key, (map.get(key) || 0) + 1)
    }
    for (const rec of recipes) {
      if (Array.isArray(rec.flavors)) for (const f of rec.flavors) add(rCount, f && f.name)
    }
    for (const b of batches) {
      if (Array.isArray(b.flavors)) for (const f of b.flavors) add(bCount, f && f.name)
    }
    return { rCount, bCount }
  }, [recipes, batches])

  const localFlavors = useMemo(() => {
    const set = new Set()
    for (const name of stats.rCount.keys()) set.add(name)
    for (const name of stats.bCount.keys()) set.add(name)
    for (const name of customFlavors) set.add(name)
    return [...set].filter(n => !ELR_FLAVORS.includes(n)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [stats, customFlavors])

  const total = ELR_FLAVORS.length + localFlavors.length

  const [sortBy, setSortBy] = useState('used')
  const [detailFlavor, setDetailFlavor] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState('')

  const handleDeleteFlavor = async () => {
    if (!deleteTarget) return
    const key = deleteTarget.trim()
    const stripFlavor = f => !(f && f.name && f.name.trim() === key)
    const updatedRecipes = recipes
      .map(r => ({ ...r, flavors: Array.isArray(r.flavors) ? r.flavors.filter(stripFlavor) : r.flavors }))
      .filter(r => !Array.isArray(r.flavors) || r.flavors.length > 0)
    const updatedBatches = batches
      .map(b => ({ ...b, flavors: Array.isArray(b.flavors) ? b.flavors.filter(stripFlavor) : b.flavors }))
      .filter(b => !Array.isArray(b.flavors) || b.flavors.length > 0)
    await saveRecipes(updatedRecipes)
    await saveBatches(updatedBatches)
    const updatedCustom = customFlavors.filter(n => n.trim().toLowerCase() !== key.toLowerCase())
    if (updatedCustom.length !== customFlavors.length) {
      await saveCustomFlavors(updatedCustom)
      setCustomFlavors(updatedCustom)
    }
    setRecipes(updatedRecipes)
    setBatches(updatedBatches)
    const nextRecs = await recomputeFlavorRecs(updatedRecipes, flavorRecs)
    setFlavorRecs(nextRecs)
    setDeleteTarget(null)
  }

  const handleAddFlavor = async () => {
    const name = addName.trim()
    if (!name) {
      setAddError(t('flavors.addErrorEmpty'))
      return
    }
    const key = name.toLowerCase()
    const exists = ELR_FLAVORS.some(n => n.toLowerCase() === key) || localFlavors.some(n => n.toLowerCase() === key)
    if (exists) {
      setAddError(t('flavors.addErrorExists'))
      return
    }
    const next = [...customFlavors, name].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    setCustomFlavors(next)
    await saveCustomFlavors(next)
    setAddOpen(false)
    setAddName('')
    setAddError('')
  }

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    let names = []
    for (const n of ELR_FLAVORS) {
      const rc = stats.rCount.get(n) || 0
      const bc = stats.bCount.get(n) || 0
      names.push({ name: n, k: n.toLowerCase(), local: false, rc, bc })
    }
    for (const n of localFlavors) {
      names.push({ name: n, k: n.toLowerCase(), local: true, rc: stats.rCount.get(n) || 0, bc: stats.bCount.get(n) || 0 })
    }

    if (stockFilter === 'stock') {
      names = names.filter(x => inventorySet.has(x.k))
    }

    const cmp = (a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : 0
    const byUsedThenName = (a, b) => {
      const au = (a.rc > 0 || a.bc > 0) ? 1 : 0
      const bu = (b.rc > 0 || b.bc > 0) ? 1 : 0
      if (au !== bu) return bu - au
      return cmp(a, b)
    }
    const sorter = sortBy === 'name' ? cmp : byUsedThenName
    if (q) {
      const scored = names.map(x => ({ ...x, score: fuzzyScore(x.k, q) })).filter(x => x.score >= 0)
      scored.sort((a, b) => b.score - a.score || sorter(a, b))
      return scored
    }
    names.sort(sorter)
    return names
  }, [debouncedSearch, stats, localFlavors, sortBy, stockFilter, inventorySet])

  const [visibleCount, setVisibleCount] = useState(200)
  useEffect(() => { setVisibleCount(200) }, [debouncedSearch, sortBy, stockFilter])
  const displayed = visibleCount >= filtered.length ? filtered : filtered.slice(0, visibleCount)

  const detail = useMemo(() => {
    if (!detailFlavor) return null
    const key = detailFlavor
    const usedRecipes = recipes.filter(r => Array.isArray(r.flavors) && r.flavors.some(f => (f && f.name && f.name.trim()) === key))
    const usedBatches = batches.filter(b => Array.isArray(b.flavors) && b.flavors.some(f => (f && f.name && f.name.trim()) === key))
    return {
      flavor: key,
      recipes: usedRecipes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
      batches: usedBatches.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })),
    }
  }, [detailFlavor, recipes, batches])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {loading ? (
        <View style={styles.loadingWrap} accessibilityRole="progressbar" accessibilityLabel={t('flavors.loading')}>
          <ActivityIndicator size="large" color={colors.primaryLight} />
          <Text style={styles.loadingText}>{t('flavors.loading')}</Text>
        </View>
      ) : (
      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.content}
        data={displayed}
        keyExtractor={(item, i) => `${item.local ? 'L' : 'E'}-${item.name}-${i}`}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.4}
        onEndReached={() => setVisibleCount(c => (c >= filtered.length ? c : Math.min(c + 500, filtered.length)))}
        initialNumToRender={30}
        maxToRenderPerBatch={30}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== 'web'}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <View style={styles.iconCircle}>
                <Ionicons name="leaf" size={24} color={colors.primaryLight} />
              </View>
              <View style={styles.heroText}>
                <Text style={styles.title}>{t('flavors.title')}</Text>
                <Text style={styles.subtitle} numberOfLines={2}>{t('flavors.subtitle', { total: total.toLocaleString() })}</Text>
              </View>
              <View style={styles.heroRight}>
                <LangToggle />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={colors.textDim} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('flavors.search')}
                  placeholderTextColor={colors.textDim}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {search !== '' && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('recipes.clearSearch')}>
                    <Ionicons name="close-circle" size={16} color={colors.textDim} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Filter Tabs: Tümü / Stoktakiler */}
              <View style={styles.filterTabs}>
                <TouchableOpacity
                  style={[styles.filterTab, stockFilter === 'all' && styles.filterTabActive]}
                  onPress={() => setStockFilter('all')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterTabText, stockFilter === 'all' && styles.filterTabTextActive]}>{t('flavors.filterAll')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterTab, stockFilter === 'stock' && styles.filterTabActive]}
                  onPress={() => setStockFilter('stock')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="cube" size={13} color={stockFilter === 'stock' ? colors.primaryLight : colors.textDim} />
                  <Text style={[styles.filterTabText, stockFilter === 'stock' && styles.filterTabTextActive]}>
                    {t('flavors.filterStock')} ({inventory.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {(search.trim() !== '' || stockFilter === 'stock') && (
              <Text style={styles.resultCount}>
                {t('flavors.resultCount', { shown: filtered.length.toLocaleString(), total: total.toLocaleString() })}
              </Text>
            )}

            <View style={styles.sortRow}>
              <TouchableOpacity style={styles.addBtn} onPress={() => setAddOpen(true)} activeOpacity={0.7}>
                <Ionicons name="add" size={16} color={colors.success} />
                <Text style={styles.addBtnText}>{t('flavors.add')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sortBtn} onPress={() => setSortBy(sortBy === 'name' ? 'used' : 'name')} activeOpacity={0.7}>
                <Text style={styles.sortLabel}>{t('flavors.sort')}</Text>
                <View style={[styles.sortBadge, sortBy === 'name' && styles.sortBadgeActive]}>
                  <Ionicons name={sortBy === 'name' ? 'text-outline' : 'checkmark-circle-outline'} size={12} color={sortBy === 'name' ? '#fff' : colors.textMuted} />
                  <Text style={[styles.sortBadgeText, sortBy === 'name' && styles.sortBadgeTextActive]}>{sortBy === 'name' ? t('flavors.sortAz') : t('flavors.sortUsed')}</Text>
                </View>
                <Ionicons name="swap-vertical" size={14} color={colors.textDim} />
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyText}>{t('flavors.noMatch')} "{search}"</Text>
          </View>
        }
        ListFooterComponent={visibleCount < filtered.length ? (
          <View style={styles.loadMoreRow}>
            <ActivityIndicator size="small" color={colors.primaryLight} />
            <Text style={styles.loadMoreText}>{t('flavors.loading')}</Text>
          </View>
        ) : null}
        renderItem={({ item: f, index }) => {
          const used = f.rc > 0 || f.bc > 0
          const inStock = inventorySet.has(f.k)
          const metaInfo = inventoryMeta[f.name] || {}
          const recInfo = findRec(flavorRecs, f.name)
          const { name, brand } = parseFlavorName(f.name)
          return (
            <View style={[styles.row, index < displayed.length - 1 && styles.rowBorder]}>
              <TouchableOpacity
                style={styles.stockToggleBtn}
                onPress={() => openStockModal(f.name)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${f.name} — ${t('flavors.stockModalTitle')}`}
              >
                <Ionicons
                  name={inStock ? "cube" : "cube-outline"}
                  size={18}
                  color={inStock ? colors.primaryLight : colors.textDim}
                />
              </TouchableOpacity>

              <View style={styles.rowTextWrap}>
                <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
                <View style={styles.rowMetaLine}>
                  {(brand) && (
                    <View style={styles.brandPill}>
                      <Text style={styles.brandPillText}>{brand}</Text>
                    </View>
                  )}
                  {recInfo && (
                    <View style={styles.recPill}>
                      <Text style={styles.recPillText}>{t('flavors.recBadge', { val: formatRecValues(recInfo) })}</Text>
                    </View>
                  )}
                  {inStock && (metaInfo.bottleMl > 0 || metaInfo.price > 0) && (
                    <View style={styles.stockMetaPill}>
                      <Text style={styles.stockMetaPillText}>
                        {metaInfo.bottleMl > 0 ? `${metaInfo.bottleMl}ml` : ''}
                        {metaInfo.bottleMl > 0 && metaInfo.price > 0 ? ' · ' : ''}
                        {metaInfo.price > 0 ? `₺${metaInfo.price}` : ''}
                      </Text>
                    </View>
                  )}
                  {f.local && <Text style={styles.rowLocal}>{t('flavors.local')}</Text>}
                </View>
              </View>
              <View style={styles.rowCounts}>
                {f.rc > 0 && (
                  <TouchableOpacity style={styles.countBadge} onPress={() => setDetailFlavor(f.name)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel={`${f.name} — ${t('flavors.recipesSection')}`}>
                    <Ionicons name="bookmark" size={11} color={colors.success} /><Text style={styles.countText}>{(f.rc === 1 ? t('flavors.recipe1') : t('flavors.recipes', { count: f.rc }))}</Text>
                  </TouchableOpacity>
                )}
                {f.bc > 0 && (
                  <TouchableOpacity style={styles.countBadge} onPress={() => setDetailFlavor(f.name)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel={`${f.name} — ${t('flavors.batchesSection')}`}>
                    <Ionicons name="layers" size={11} color={colors.primaryLight} /><Text style={styles.countText}>{(f.bc === 1 ? t('flavors.batch1') : t('flavors.batches', { count: f.bc }))}</Text>
                  </TouchableOpacity>
                )}
                {!used && <Text style={styles.rowUnused}>{t('flavors.unused')}</Text>}
              </View>
              {f.local && (
                <TouchableOpacity onPress={() => setDeleteTarget(f.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel={`${f.name} — ${t('flavors.deleteTitle')}`}>
                  <Ionicons name="trash-outline" size={17} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          )
        }}
      />
      )}

      <Modal visible={detail !== null} transparent animationType="fade" onRequestClose={() => setDetailFlavor(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setDetailFlavor(null)} accessibilityRole="button" accessibilityLabel={t('common.close')} />
          <View style={styles.modalCard}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="leaf" size={16} color={colors.primaryLight} />
                <Text style={styles.modalTitle} numberOfLines={2}>{detail ? detail.flavor : ''}</Text>
              </View>
                <TouchableOpacity onPress={() => setDetailFlavor(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={22} color={colors.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionTitle}>{t('flavors.recipesSection')} ({detail ? detail.recipes.length : 0})</Text>
              {detail && detail.recipes.length === 0 && <Text style={styles.modalEmptyText}>{t('flavors.notInRecipe')}</Text>}
              {detail && detail.recipes.map((r, i) => (
                <View key={`r-${i}`} style={styles.detailRow}>
                  <Ionicons name="bookmark" size={13} color={colors.success} />
                  <View style={styles.detailRowText}>
                    <Text style={styles.detailRowName}>{r.name}</Text>
                    {Array.isArray(r.flavors) && (
                      <Text style={styles.detailRowMeta} numberOfLines={1}>
                        {r.flavors.map(x => x && x.name).filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.prepareBtn}
                    onPress={() => {
                      navigation.navigate('build', { loadRecipeId: r.id, loadRecipeName: r.name })
                      setDetailFlavor(null)
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="flask" size={13} color={colors.success} />
                    <Text style={styles.prepareBtnText}>{t('flavors.prepare')}</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <Text style={[styles.modalSectionTitle, styles.modalSectionSpaced]}>{t('flavors.batchesSection')} ({detail ? detail.batches.length : 0})</Text>
              {detail && detail.batches.length === 0 && <Text style={styles.modalEmptyText}>{t('flavors.notInBatch')}</Text>}
              {detail && detail.batches.map((b, i) => (
                <View key={`b-${i}`} style={styles.detailRow}>
                  <Ionicons name="layers" size={13} color={colors.primaryLight} />
                  <View style={styles.detailRowText}>
                    <Text style={styles.detailRowName}>{b.name || t('common.untitledBatch')}</Text>
                    {b.createdAt && <Text style={styles.detailRowMeta}>{new Date(b.createdAt).toLocaleDateString()}</Text>}
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.modalBtn} onPress={() => setDetailFlavor(null)} activeOpacity={0.8}>
              <Text style={styles.modalBtnText}>{t('flavors.close')}</Text>
            </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => { setAddOpen(false); setAddError('') }} accessibilityRole="button" accessibilityLabel={t('common.close')} />
          <View style={styles.modalCard}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="add-circle" size={18} color={colors.success} />
                <Text style={styles.modalTitle}>{t('flavors.addTitle')}</Text>
              </View>
                <TouchableOpacity onPress={() => { setAddOpen(false); setAddError('') }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={22} color={colors.textDim} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.addInput, addError && styles.addInputError]}
              value={addName}
              onChangeText={setAddName}
              placeholder={t('flavors.addPlaceholder')}
              placeholderTextColor={colors.textDim}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleAddFlavor}
            />
            {addError !== '' && <Text style={styles.addErrorText}>{addError}</Text>}

            <View style={styles.addActions}>
              <TouchableOpacity style={[styles.addBtnModal, styles.addBtnModalCancel]} onPress={() => { setAddOpen(false); setAddError('') }} activeOpacity={0.7}>
                <Text style={styles.addBtnModalTextCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addBtnModal, styles.addBtnModalConfirm]} onPress={handleAddFlavor} activeOpacity={0.7}>
                <Text style={styles.addBtnModalTextConfirm}>{t('flavors.add')}</Text>
              </TouchableOpacity>
            </View>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title={t('flavors.deleteTitle')}
        message={deleteTarget ? t('flavors.deleteMsg') + `\n\n"${deleteTarget}"` : undefined}
        onConfirm={handleDeleteFlavor}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Stock & Price Entry Modal */}
      <Modal visible={stockModalFlavor !== null} transparent animationType="fade" onRequestClose={() => setStockModalFlavor(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setStockModalFlavor(null)} accessibilityRole="button" accessibilityLabel={t('common.close')} />
          <View style={styles.modalCard}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="cube" size={18} color={colors.primaryLight} />
                <Text style={styles.modalTitle}>{t('flavors.stockModalTitle')}</Text>
              </View>
                <TouchableOpacity onPress={() => setStockModalFlavor(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={22} color={colors.textDim} />
              </TouchableOpacity>
            </View>

            <Text style={styles.stockFlavorName} numberOfLines={2}>{stockModalFlavor}</Text>

            <Text style={styles.stockLabel}>{t('flavors.bottleMlLabel')}</Text>
            <TextInput
              style={styles.stockInput}
              value={stockBottleMl}
              onChangeText={setStockBottleMl}
              keyboardType="decimal-pad"
              placeholder="örn. 30"
              placeholderTextColor={colors.textDim}
            />

            <Text style={styles.stockLabel}>{t('flavors.priceLabel')}</Text>
            <TextInput
              style={styles.stockInput}
              value={stockPrice}
              onChangeText={setStockPrice}
              keyboardType="decimal-pad"
              placeholder="örn. 45"
              placeholderTextColor={colors.textDim}
            />

            <Text style={styles.stockLabel}>{t('flavors.recLabel')}</Text>
            <TextInput
              style={styles.stockInput}
              value={stockRec}
              onChangeText={setStockRec}
              keyboardType="decimal-pad"
              placeholder={t('flavors.recPlaceholder')}
              placeholderTextColor={colors.textDim}
            />

            <View style={styles.stockModalActions}>
              {inventorySet.has(stockModalFlavor?.trim().toLowerCase()) && (
                <TouchableOpacity style={styles.removeStockBtn} onPress={handleRemoveFromStock} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <Text style={styles.removeStockText}>{t('flavors.removeFromStock')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.saveStockBtn} onPress={handleSaveStock} activeOpacity={0.7}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.saveStockText}>{t('flavors.saveStock')}</Text>
              </TouchableOpacity>
            </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: fs(14, scale), color: colors.textMuted },
  loadMoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  loadMoreText: { fontSize: fs(13, scale), color: colors.textMuted },
  content: { paddingTop: spacing.lg, paddingHorizontal: 14, paddingBottom: 100 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  heroText: { flex: 1, flexShrink: 1 },
  heroRight: { marginLeft: 'auto', flexShrink: 0 },
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
    padding: spacing.md,
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
  },
  searchInput: { flex: 1, color: colors.text, fontSize: fs(15, scale), height: 44, paddingVertical: 0 },
  filterTabs: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  filterTabActive: { borderColor: colors.primaryLight, backgroundColor: colors.primary + '20' },
  filterTabText: { fontSize: fs(13, scale), fontWeight: '600', color: colors.textMuted },
  filterTabTextActive: { color: colors.primaryLight },
  stockToggleBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -12, paddingRight: 4 },
  brandPill: {
    backgroundColor: colors.primary + '22',
    borderWidth: 1,
    borderColor: colors.primary + '44',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  brandPillText: { fontSize: fs(12, scale), fontWeight: '700', color: colors.primaryLight },

  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md },
  resultCount: { fontSize: fs(13, scale), color: colors.textDim, fontWeight: '500', marginTop: -spacing.xs, marginBottom: spacing.sm, paddingHorizontal: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 40,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.success + '66',
    backgroundColor: colors.success + '1A',
  },
  addBtnText: { fontSize: fs(13, scale), fontWeight: '700', color: colors.success },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  sortLabel: { fontSize: fs(13, scale), color: colors.textDim, fontWeight: '600' },
  sortBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: colors.inputBg,
  },
  sortBadgeActive: { backgroundColor: colors.primary },
  sortBadgeText: { fontSize: fs(12, scale), fontWeight: '700', color: colors.textMuted },
  sortBadgeTextActive: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.primary + '14' },
  rowTextWrap: { flex: 1, flexDirection: 'column', gap: 5, minWidth: 0 },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 },
  rowName: { flexShrink: 1, fontSize: fs(15, scale), color: colors.text, fontWeight: '500', minWidth: 0 },
  rowLocal: {
    fontSize: fs(12, scale),
    fontWeight: '700',
    color: colors.success,
    textTransform: 'uppercase',
    backgroundColor: colors.success + '26',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  rowCounts: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  countBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.inputBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  countText: { fontSize: fs(13, scale), color: colors.textMuted, fontWeight: '600' },
  rowUnused: { fontSize: fs(13, scale), color: colors.textDim, fontStyle: 'italic' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: fs(17, scale), color: colors.textDim },
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
    position: 'relative',
    zIndex: 1,
  },
  modalContent: { position: 'relative', zIndex: 2 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md },
  modalTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { flex: 1, fontSize: fs(18, scale), fontWeight: '600', color: colors.text },
  modalBody: { maxHeight: 320, marginBottom: spacing.md },
  modalSectionTitle: { fontSize: fs(12, scale), color: colors.textDim, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  modalSectionSpaced: { marginTop: spacing.md },
  modalEmptyText: { fontSize: fs(14, scale), color: colors.textDim, marginBottom: spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.primary + '14' },
  detailRowText: { flex: 1 },
  detailRowName: { fontSize: fs(15, scale), color: colors.text, fontWeight: '500' },
  detailRowMeta: { fontSize: fs(13, scale), color: colors.textDim, marginTop: 1 },
  prepareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    backgroundColor: colors.success + '1F',
    borderWidth: 1,
    borderColor: colors.success + '59',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  prepareBtnText: { fontSize: fs(12, scale), fontWeight: '700', color: colors.success },
  modalBtn: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalBtnText: { fontSize: fs(15, scale), fontWeight: '700', color: '#fff' },
  addInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fs(16, scale),
    color: colors.text,
    marginBottom: spacing.sm,
    },
  addInputError: { borderColor: colors.danger },
  addErrorText: { fontSize: fs(13, scale), color: colors.danger, marginBottom: spacing.sm },
  addActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  addBtnModal: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  addBtnModalCancel: { backgroundColor: 'rgba(148, 163, 184, 0.1)', borderWidth: 1.5, borderColor: colors.border },
  addBtnModalTextCancel: { fontSize: fs(15, scale), fontWeight: '600', color: colors.textMuted },
  addBtnModalConfirm: { backgroundColor: colors.success },
  addBtnModalTextConfirm: { fontSize: fs(15, scale), fontWeight: '700', color: '#fff' },

  stockMetaPill: {
    backgroundColor: colors.success + '1F',
    borderWidth: 1,
    borderColor: colors.success + '44',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  stockMetaPillText: { fontSize: fs(12, scale), fontWeight: '700', color: colors.success },
  recPill: {
    backgroundColor: colors.primary + '1F',
    borderWidth: 1,
    borderColor: colors.primary + '44',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  recPillText: { fontSize: fs(12, scale), fontWeight: '700', color: colors.primaryLight },
  stockFlavorName: { fontSize: fs(15, scale), fontWeight: '700', color: colors.primaryLight, marginBottom: spacing.sm },
  stockLabel: { fontSize: fs(13, scale), fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginTop: spacing.xs },
  stockInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    fontSize: fs(15, scale),
    padding: 10,
    marginBottom: spacing.xs,
    },
  stockModalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  removeStockBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.danger + '44', backgroundColor: colors.danger + '14' },
  removeStockText: { color: colors.danger, fontWeight: '600', fontSize: fs(13, scale) },
  saveStockBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: colors.primary },
  saveStockText: { color: '#fff', fontWeight: '700', fontSize: fs(14, scale) },
})
