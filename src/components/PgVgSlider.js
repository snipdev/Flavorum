import { View, Text, StyleSheet } from 'react-native'
import Slider from '@react-native-community/slider'
import { fs, spacing, font } from '../theme'
import { useTheme } from '../ThemeContext'
import { useI18n } from '../i18n'

export default function PgVgSlider({ value, onChangeText, label }) {
  const { theme, textScale } = useTheme()
  const colors = theme
  const styles = createStyles(colors, textScale)
  const PG_COLOR = colors.primaryLight
  const VG_COLOR = colors.vg
  const pg = Math.min(Math.max(parseFloat(value) || 0, 0), 100)
  const vg = 100 - pg

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {label ? (
          <>
            <Text style={styles.label}>{label}</Text>
            <BalanceText vg={vg} pg={pg} pgColor={PG_COLOR} colors={colors} scale={textScale} />
          </>
        ) : (
          <BalanceText vg={vg} pg={pg} pgColor={PG_COLOR} colors={colors} scale={textScale} center />
        )}
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={100}
        step={1}
        value={pg}
        onValueChange={val => onChangeText(String(val))}
        minimumTrackTintColor={PG_COLOR}
        maximumTrackTintColor={VG_COLOR}
        thumbTintColor={PG_COLOR}
        trackHeight={10}
      />
    </View>
  )
}

function BalanceText({ vg, pg, pgColor, colors, center, scale }) {
  const { t } = useI18n()
  const styles = createStyles(colors, scale)
  return (
    <View style={center ? styles.balanceCenter : styles.balanceText}>
      <Text style={[styles.vgText, { color: colors.vg }]}>{vg}% {t('pgvg.vg')}</Text>
      <Text style={[styles.sep, { color: colors.textMuted }]}> / </Text>
      <Text style={[styles.pgText, { color: pgColor }]}>{pg}% {t('pgvg.pg')}</Text>
    </View>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  container: { marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: fs(15, scale), ...font('600'), color: colors.textMuted, letterSpacing: 0.3 },
  slider: { width: '100%', height: 36 },
  balanceText: { flexDirection: 'row', alignItems: 'center' },
  balanceCenter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center' },
  pgText: { fontSize: fs(15, scale), ...font('700') },
  vgText: { fontSize: fs(15, scale), ...font('700') },
  sep: { fontSize: fs(14, scale) },
})
