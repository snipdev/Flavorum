import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing } from '../theme'
import { useI18n } from '../i18n'

const badgeColors = {
  success: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.45)', text: colors.success },
  danger: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.45)', text: colors.danger },
}

export default function ResultBox({ items, title }) {
  const { t } = useI18n()
  const header = title || t('results.title')
  const badge = items.find(i => i.badge)

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.title}>{header}</Text>
        <View style={styles.headerLine} />
      </View>

      {badge && (
        <View style={[styles.badge, { backgroundColor: badgeColors[badge.badge].bg, borderColor: badgeColors[badge.badge].border }]}>
          <View style={[styles.badgeDot, { backgroundColor: badgeColors[badge.badge].text }]} />
          <Text style={[styles.badgeText, { color: badgeColors[badge.badge].text }]}>{badge.value}</Text>
        </View>
      )}

      {items.filter(i => !i.badge).map((item, i) => (
        <View key={i} style={[styles.row, item.sub && styles.subRow, item.total && styles.totalRow]}>
          <Text style={[styles.label, item.sub && styles.subLabel, item.total && styles.totalLabel]} numberOfLines={1}>
            {item.label}
          </Text>
          <Text style={[styles.value, item.accent && { color: item.accent }, item.sub && styles.subValue, item.total && styles.totalValue]}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  title: { fontSize: 16, fontWeight: '500', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  headerLine: { flex: 1, height: 1, backgroundColor: colors.cardBorder },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 15, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(197, 146, 6, 0.06)',
  },
  totalRow: {
    borderTopWidth: 1,
    borderBottomWidth: 0,
    borderTopColor: 'rgba(197, 146, 6, 0.2)',
    marginTop: spacing.xs,
    paddingTop: spacing.md,
  },
  subRow: { paddingLeft: 24, paddingVertical: 6 },
  label: { flex: 1, fontSize: 16, color: colors.textMuted },
  value: { fontSize: 19, fontWeight: '600', color: colors.text },
  subLabel: { fontSize: 14, color: colors.textDim },
  subValue: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 22, fontWeight: '700', color: colors.primaryLight },
})
