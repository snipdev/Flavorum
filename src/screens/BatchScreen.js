import { useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing } from '../theme'
import ConfirmDialog from '../components/ConfirmDialog'
import LangToggle from '../components/LangToggle'
import { loadBatches, saveBatches } from '../utils/recipes'
import { useI18n } from '../i18n'

export default function BatchScreen() {
  const { t } = useI18n()
  const [batches, setBatches] = useState([])
  const [confirmId, setConfirmId] = useState(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      loadBatches().then(list => { if (active) setBatches(list) })
      return () => { active = false }
    }, [])
  )

  const remove = useCallback(async (id) => {
    const updated = batches.filter(b => b.id !== id)
    setBatches(updated)
    await saveBatches(updated)
  }, [batches])

  const formatDate = iso => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name="layers" size={24} color={colors.primaryLight} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.title}>{t('batches.title')}</Text>
            <Text style={styles.subtitle} numberOfLines={2}>{t('batches.subtitle')}</Text>
          </View>
          <View style={styles.heroRight}>
            <LangToggle />
          </View>
        </View>

        {batches.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="layers-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyText}>{t('batches.empty')}</Text>
          </View>
        )}

        {[...batches].reverse().map(b => (
          <View key={b.id} style={styles.batchCard}>
            <TouchableOpacity style={styles.batchDelete} onPress={() => setConfirmId(b.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
            <Text style={styles.batchName}>{b.name}</Text>
            {b.createdAt && <Text style={styles.batchDate}>{formatDate(b.createdAt)}</Text>}

            <View style={styles.tagRow}>
              <View style={[styles.modeBadge, b.ingredientMode === 'mix' ? styles.modeBadgeMix : styles.modeBadgeFlavor]}>
                <Ionicons name={b.ingredientMode === 'mix' ? 'flask' : 'leaf'} size={12} color={b.ingredientMode === 'mix' ? colors.primaryLight : colors.success} />
                <Text style={[styles.modeBadgeText, { color: b.ingredientMode === 'mix' ? colors.primaryLight : colors.success }]}>
                  {b.ingredientMode === 'mix' ? t('build.mix.mode') : t('build.flavor.mode')}
                </Text>
              </View>
              {b.targetStrength ? <View style={styles.tag}><Text style={styles.tagText}>{b.targetStrength}mg</Text></View> : null}
              {b.targetPg ? <View style={styles.tag}><Text style={styles.tagText}>{b.targetPg}% PG</Text></View> : null}
              {(b.totalVolume || b.mixAmount) ? <View style={styles.tag}><Text style={styles.tagText}>{b.totalVolume || b.mixAmount}ml</Text></View> : null}
              {b.nicStrength ? <View style={styles.tag}><Text style={styles.tagText}>{b.nicStrength}mg/ml base</Text></View> : null}
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
                    <View key={i} style={styles.flavorChip}><Text style={styles.flavorChipText}>{f.name || t('recipes.flavorN', { i: i + 1 })} {f.value}%</Text></View>
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

            {b.result && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>{t('batches.result')}</Text>
                <Text style={styles.detailText}>{t('build.resultDetail1', { flavorMl: b.result.flavorMl, nicMl: b.result.nicMl, pgNeeded: b.result.pgNeeded, vgNeeded: b.result.vgNeeded })}</Text>
                <Text style={styles.detailText}>{t('build.resultDetail2', { total: b.result.actualTotal, nic: b.result.actualNic })}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <ConfirmDialog
        visible={confirmId !== null}
        title={t('batches.deleteTitle')}
        message={t('batches.deleteMsg')}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => { remove(confirmId); setConfirmId(null) }}
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
  batchCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
  },
  batchDelete: { position: 'absolute', top: 10, right: 10, zIndex: 1, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  batchName: { fontSize: 19, fontWeight: '600', color: colors.text, marginBottom: 2, paddingRight: 30 },
  batchDate: { fontSize: 13, color: colors.textDim, marginBottom: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  tag: {
    backgroundColor: 'rgba(197, 146, 6, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 13, color: colors.primaryLight, fontWeight: '500' },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  modeBadgeFlavor: { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  modeBadgeMix: { backgroundColor: 'rgba(197, 146, 6, 0.12)', borderWidth: 1, borderColor: 'rgba(197, 146, 6, 0.35)' },
  modeBadgeText: { fontSize: 13, fontWeight: '700' },
  detailBlock: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(197, 146, 6, 0.08)' },
  detailLabel: {
    fontSize: 12,
    color: colors.textDim,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  detailText: { fontSize: 14, color: colors.textMuted, marginBottom: 2 },
  flavorList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flavorChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  flavorChipText: { fontSize: 13, color: colors.success, fontWeight: '500' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 17, color: colors.textDim },
})
