import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Input from '../components/Input'
import ConfirmDialog from '../components/ConfirmDialog'
import FlavorAutocomplete from '../components/FlavorAutocomplete'
import LangToggle from '../components/LangToggle'
import { colors, spacing } from '../theme'
import { loadRecipes, saveRecipes, newRecipeId, seedStarterRecipes } from '../utils/recipes'
import { useI18n } from '../i18n'

export default function RecipesScreen() {
  const { t } = useI18n()
  const [recipes, setRecipes] = useState([])
  const [name, setName] = useState('')
  const [flavors, setFlavors] = useState([{ id: 1, name: '', value: '' }])
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    await seedStarterRecipes()
    const data = await loadRecipes()
    setRecipes(data)
  }

  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = [...recipes].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    if (!q) return list
    return list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (Array.isArray(r.flavors) && r.flavors.some(f => (f.name || '').toLowerCase().includes(q)))
    )
  }, [recipes, search])

  function startEdit(recipe) {
    setEditingId(recipe.id)
    setName(recipe.name)
    setFlavors(
      Array.isArray(recipe.flavors) && recipe.flavors.length > 0
        ? recipe.flavors.map((f, i) => ({ id: Date.now() + i, name: f.name || '', value: String(f.value) }))
        : [{ id: Date.now(), name: '', value: '' }]
    )
    setFormError('')
    setFormSuccess('')
  }

  function resetForm() {
    setEditingId(null)
    setName('')
    setFlavors([{ id: Date.now(), name: '', value: '' }])
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
    const flavorList = validFlavors.map(f => ({ name: f.name.trim(), value: parseFloat(f.value) || 0 }))

    if (editingId !== null) {
      const updated = recipes.map(r => r.id === editingId ? { ...r, name: name.trim(), flavors: flavorList } : r)
      setRecipes(updated)
      await saveRecipes(updated)
      setFormSuccess(`"${name.trim()}" ${t('recipes.updatedOk')}`)
    } else {
      const recipe = {
        id: newRecipeId(),
        name: name.trim(),
        flavors: flavorList,
        createdAt: new Date().toISOString(),
      }
      const updated = [...recipes, recipe]
      setRecipes(updated)
      await saveRecipes(updated)
      setFormSuccess(`"${recipe.name}" ${t('recipes.savedOk')}`)
    }
    resetForm()
  }, [recipes, name, flavors, editingId, t])

  const remove = useCallback(async (id) => {
    const updated = recipes.filter(r => r.id !== id)
    setRecipes(updated)
    await saveRecipes(updated)
  }, [recipes])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name="bookmark" size={24} color={colors.primaryLight} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.title}>{t('recipes.title')}</Text>
            <Text style={styles.subtitle} numberOfLines={2}>{t('recipes.subtitle')}</Text>
          </View>
          <View style={styles.heroRight}>
            <LangToggle />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name={editingId !== null ? 'create' : 'add-circle'} size={14} color={colors.primaryLight} />
            <Text style={styles.sectionTitle}>{editingId !== null ? t('recipes.edit') : t('recipes.new')}</Text>
          </View>

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
              />
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
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => removeFlavor(f.id)}>
                <Ionicons name="close-circle" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addFlavorBtn} onPress={addFlavor} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={16} color={colors.success} />
            <Text style={styles.addFlavorBtnText}>{t('recipes.addFlavor')}</Text>
          </TouchableOpacity>

          {editingId !== null ? (
            <View style={styles.formActionsRow}>
              <TouchableOpacity style={[styles.saveBtn, styles.cancelEditBtn]} onPress={resetForm} activeOpacity={0.9}>
                <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
                <Text style={styles.cancelEditBtnText}>{t('recipes.cancelEdit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, styles.formActionsFlex]} onPress={save} activeOpacity={0.9}>
                <Ionicons name="bookmark" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>{t('recipes.update')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.9}>
              <Ionicons name="bookmark" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>{t('recipes.save')}</Text>
            </TouchableOpacity>
          )}

          {formError !== '' && (
            <View style={styles.feedbackError}>
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.feedbackErrorText}>{formError}</Text>
            </View>
          )}
          {formSuccess !== '' && (
            <View style={styles.feedbackSuccess}>
              <Ionicons name="checkmark-circle" size={15} color={colors.success} />
              <Text style={styles.feedbackSuccessText}>{formSuccess}</Text>
            </View>
          )}
        </View>

        {recipes.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="library" size={14} color={colors.primaryLight} />
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
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={16} color={colors.textDim} />
                </TouchableOpacity>
              )}
            </View>

            {filteredRecipes.length === 0 && (
              <View style={styles.noResults}>
                <Ionicons name="search-outline" size={26} color={colors.textDim} />
                <Text style={styles.noResultsText}>{t('recipes.noMatch')} "{search}"</Text>
              </View>
            )}

            {filteredRecipes.map(r => (
              <View key={r.id} style={styles.recipeCard}>
                <View style={styles.recipeActions}>
                  <TouchableOpacity style={styles.recipeActionBtn} onPress={() => startEdit(r)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="create-outline" size={18} color={colors.primaryLight} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.recipeActionBtn} onPress={() => setConfirmId(r.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.recipeName}>{r.name}</Text>
                {r.source ? <Text style={styles.recipeSource}>{r.source}</Text> : null}
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
            ))}
          </View>
        )}

        {recipes.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="bookmark-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyText}>{t('recipes.empty')}</Text>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmId !== null}
        title={t('recipes.deleteTitle')}
        message={t('recipes.deleteMsg')}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => { remove(confirmId); setConfirmId(null) }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  kav: { flex: 1 },
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
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: '500', color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  saveBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 15,
    borderRadius: 12,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  formActionsRow: { flexDirection: 'row', gap: spacing.sm },
  formActionsFlex: { flex: 1 },
  cancelEditBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cancelEditBtnText: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
  feedbackError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  feedbackErrorText: { flex: 1, fontSize: 13, color: colors.danger, fontWeight: '500' },
  feedbackSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  feedbackSuccessText: { flex: 1, fontSize: 13, color: colors.success, fontWeight: '500' },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: colors.textMuted, marginBottom: 8, letterSpacing: 0.3 },
  flavorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  flavorIndex: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  flavorInput: {
    flex: 0.3,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: 13,
    height: 40,
    paddingHorizontal: 6,
    outlineStyle: 'none',
  },
  flavorPct: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginLeft: 2 },
  addFlavorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  addFlavorBtnText: { fontSize: 13, color: colors.success, fontWeight: '600' },
  recipeCard: {
    backgroundColor: 'rgba(197, 146, 6, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(197, 146, 6, 0.08)',
    padding: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  recipeActions: { position: 'absolute', top: 8, right: 8, zIndex: 1, flexDirection: 'row', gap: 4 },
  recipeActionBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  recipeName: { fontSize: 19, fontWeight: '500', color: colors.text, marginBottom: spacing.sm, paddingRight: 76 },
  recipeSource: { fontSize: 12, color: colors.textDim, fontWeight: '500', marginBottom: spacing.sm, marginTop: -spacing.sm },
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
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, height: 44, paddingVertical: 0, outlineStyle: 'none' },
  noResults: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 8 },
  noResultsText: { fontSize: 14, color: colors.textDim },
  recipeTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recipeEmptyFlavors: { fontSize: 14, color: colors.textDim },
  tag: {
    backgroundColor: 'rgba(197, 146, 6, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 14, color: colors.primaryLight, fontWeight: '500' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 17, color: colors.textDim },
})
