import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fs, spacing } from '../theme'
import { useTheme } from '../ThemeContext'
import { useI18n } from '../i18n'
import BottleSVG from './BottleSVG'

export default function ResultBox({ items, title, segments = [], totalMl, flat }) {
  const { t } = useI18n()
  const { theme, textScale } = useTheme()
  const colors = theme
  const styles = createStyles(colors, textScale)
  const badgeColors = {
    success: { bg: colors.success + '1F', border: colors.success + '73', text: colors.success },
    danger: { bg: colors.danger + '1F', border: colors.danger + '73', text: colors.danger },
  }
  const header = title || t('results.title')
  const badge = items.find(i => i.badge)

  return (
    <View style={[styles.wrapper, flat && styles.wrapperFlat]}>
      <View style={styles.header}>
        <Text style={styles.title}>{header}</Text>
        <View style={styles.headerLine} />
      </View>

      {badge && (
        <View style={[styles.badge, { backgroundColor: badgeColors[badge.badge].bg, borderColor: badgeColors[badge.badge].border }]}>
          <Ionicons name={badge.badge === 'success' ? 'checkmark-circle' : 'alert-circle'} size={16} color={badgeColors[badge.badge].text} importantForAccessibility="no" />
          <Text style={[styles.badgeText, { color: badgeColors[badge.badge].text }]}>{badge.value}</Text>
        </View>
      )}

      {segments.length > 0 && (
        <View style={styles.composition}>
          <View style={styles.bottleRow}>
            <BottleSVG segments={segments} totalMl={totalMl} />
            <View style={styles.legend}>
              {segments.map((seg, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                  <Text style={styles.legendLabel}>{seg.label}</Text>
                  <Text style={styles.legendPct}>%{seg.pct.toFixed(1)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {items.filter(i => !i.badge).map((item, i) => (
        <View key={i} style={[styles.row, item.sub && styles.subRow, item.total && styles.totalRow]}>
          {item.accent && (
            <View style={[styles.bullet, { backgroundColor: item.accent }]} />
          )}
          <Text style={[styles.label, item.sub && styles.subLabel, item.total && styles.totalLabel]} numberOfLines={2}>
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

const createStyles = (colors, scale = 1) => StyleSheet.create({
  wrapper: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  // Wide web only: the right column already offsets for the hero, so the
  // card must not add its own top margin (single-column keeps it).
  wrapperFlat: { marginTop: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  title: { fontSize: fs(15, scale), fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
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
  badgeText: { fontSize: fs(15, scale), fontWeight: '700' },
  composition: { marginBottom: spacing.md },
  bottleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    justifyContent: 'center',
  },
  legend: {
    flex: 1,
    gap: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: fs(13, scale), color: colors.textMuted },
  legendPct: { fontSize: fs(13, scale), fontWeight: '600', color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '0F',
  },
  totalRow: {
    borderTopWidth: 1,
    borderBottomWidth: 0,
    borderTopColor: colors.primary + '33',
    marginTop: spacing.xs,
    paddingTop: spacing.md,
  },
  subRow: { paddingLeft: 24, paddingVertical: 6 },
  bullet: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  label: { flex: 1, fontSize: fs(16, scale), color: colors.textMuted },
  value: { fontSize: fs(19, scale), fontWeight: '600', color: colors.text },
  subLabel: { fontSize: fs(15, scale), color: colors.textMuted },
  subValue: { fontSize: fs(15, scale), color: colors.textMuted, fontWeight: '500' },
  totalLabel: { fontSize: fs(16, scale), fontWeight: '700', color: colors.text },
  totalValue: { fontSize: fs(22, scale), fontWeight: '700', color: colors.primaryLight },
})
