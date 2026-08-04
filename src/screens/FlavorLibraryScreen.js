import { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, Platform, Modal, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing } from '../theme'
import { loadRecipes, loadBatches, saveRecipes, saveBatches, loadCustomFlavors, saveCustomFlavors } from '../utils/recipes'
import { ELR_FLAVORS } from '../data/flavors'
import { useI18n } from '../i18n'
import LangToggle from '../components/LangToggle'
import ConfirmDialog from '../components/ConfirmDialog'

export default function FlavorLibraryScreen({ navigation }) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [recipes, setRecipes] = useState([])
  const [batches, setBatches] = useState([])
  const [customFlavors, setCustomFlavors] = useState([])

  useFocusEffect(
    useCallback(() => {
      let active = true
      Promise.all([loadRecipes(), loadBatches(), loadCustomFlavors()]).then(([r, b, c]) => {
        if (!active) return
        setRecipes(r)
        setBatches(b)
        setCustomFlavors(c)
      })
      return () => { active = false }
    }, [])
  )

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
    const q = search.trim().toLowerCase()
    const names = []
    for (const n of ELR_FLAVORS) {
      const rc = stats.rCount.get(n) || 0
      const bc = stats.bCount.get(n) || 0
      names.push({ name: n, k: n.toLowerCase(), local: false, rc, bc })
    }
    for (const n of localFlavors) {
      names.push({ name: n, k: n.toLowerCase(), local: true, rc: stats.rCount.get(n) || 0, bc: stats.bCount.get(n) || 0 })
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
      return names.filter(x => x.k.includes(q)).sort(sorter)
    }
    names.sort(sorter)
    return names
  }, [search, stats, localFlavors, sortBy])

  const [visibleCount, setVisibleCount] = useState(200)
  useEffect(() => { setVisibleCount(200) }, [search, sortBy])
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
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={16} color={colors.textDim} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

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
        renderItem={({ item: f, index }) => {
          const used = f.rc > 0 || f.bc > 0
          return (
            <View style={[styles.row, index < displayed.length - 1 && styles.rowBorder]}>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowName} numberOfLines={1}>{f.name}</Text>
                {f.local && <Text style={styles.rowLocal}>{t('flavors.local')}</Text>}
              </View>
              <View style={styles.rowCounts}>
                {f.rc > 0 && (
                  <TouchableOpacity style={styles.countBadge} onPress={() => setDetailFlavor(f.name)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} activeOpacity={0.6}>
                    <Ionicons name="bookmark" size={11} color={colors.success} /><Text style={styles.countText}>{(f.rc === 1 ? t('flavors.recipe1') : t('flavors.recipes', { count: f.rc }))}</Text>
                  </TouchableOpacity>
                )}
                {f.bc > 0 && (
                  <TouchableOpacity style={styles.countBadge} onPress={() => setDetailFlavor(f.name)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} activeOpacity={0.6}>
                    <Ionicons name="layers" size={11} color={colors.primaryLight} /><Text style={styles.countText}>{(f.bc === 1 ? t('flavors.batch1') : t('flavors.batches', { count: f.bc }))}</Text>
                  </TouchableOpacity>
                )}
                {!used && <Text style={styles.rowUnused}>{t('flavors.unused')}</Text>}
              </View>
              {f.local && (
                <TouchableOpacity onPress={() => setDeleteTarget(f.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.6}>
                  <Ionicons name="trash-outline" size={17} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          )
        }}
      />

      <Modal visible={detail !== null} transparent animationType="fade" onRequestClose={() => setDetailFlavor(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="leaf" size={16} color={colors.primaryLight} />
                <Text style={styles.modalTitle} numberOfLines={2}>{detail ? detail.flavor : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailFlavor(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
      </Modal>

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="add-circle" size={18} color={colors.success} />
                <Text style={styles.modalTitle}>{t('flavors.addTitle')}</Text>
              </View>
              <TouchableOpacity onPress={() => { setAddOpen(false); setAddError('') }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
      </Modal>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title={t('flavors.deleteTitle')}
        message={deleteTarget ? t('flavors.deleteMsg') + `\n\n"${deleteTarget}"` : undefined}
        onConfirm={handleDeleteFlavor}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 100 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  heroText: { flex: 1, flexShrink: 1 },
  heroRight: { marginLeft: 'auto', flexShrink: 0 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(197, 146, 6, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 29, fontWeight: '500', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: colors.textMuted, marginTop: 1 },
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
  searchInput: { flex: 1, color: colors.text, fontSize: 15, height: 44, paddingVertical: 0, outlineStyle: 'none' },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.success },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  sortLabel: { fontSize: 13, color: colors.textDim, fontWeight: '600' },
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
  sortBadgeText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  sortBadgeTextActive: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(197, 146, 6, 0.08)' },
  rowTextWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { flexShrink: 1, fontSize: 15, color: colors.text, fontWeight: '500' },
  rowLocal: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
    textTransform: 'uppercase',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  rowCounts: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  countBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.inputBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  countText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  rowUnused: { fontSize: 12, color: colors.textDim, fontStyle: 'italic' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 17, color: colors.textDim },
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
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md },
  modalTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: colors.text },
  modalBody: { maxHeight: 320, marginBottom: spacing.md },
  modalSectionTitle: { fontSize: 12, color: colors.textDim, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  modalSectionSpaced: { marginTop: spacing.md },
  modalEmptyText: { fontSize: 14, color: colors.textDim, marginBottom: spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(197, 146, 6, 0.08)' },
  detailRowText: { flex: 1 },
  detailRowName: { fontSize: 15, color: colors.text, fontWeight: '500' },
  detailRowMeta: { fontSize: 13, color: colors.textDim, marginTop: 1 },
  prepareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  prepareBtnText: { fontSize: 12, fontWeight: '700', color: colors.success },
  modalBtn: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  addInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
    outlineStyle: 'none',
  },
  addInputError: { borderColor: colors.danger },
  addErrorText: { fontSize: 13, color: colors.danger, marginBottom: spacing.sm },
  addActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  addBtnModal: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  addBtnModalCancel: { backgroundColor: 'rgba(148, 163, 184, 0.1)', borderWidth: 1.5, borderColor: colors.border },
  addBtnModalTextCancel: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  addBtnModalConfirm: { backgroundColor: colors.success },
  addBtnModalTextConfirm: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
