import { View, Text, StyleSheet } from 'react-native'
import Slider from '@react-native-community/slider'
import { colors, spacing } from '../theme'
import { useI18n } from '../i18n'

const PG_COLOR = colors.primaryLight
const VG_COLOR = '#22d3ee'

export default function PgVgSlider({ value, onChangeText, label }) {
  const { t } = useI18n()
  const pg = Math.min(Math.max(parseFloat(value) || 0, 0), 100)
  const vg = 100 - pg

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {label ? (
          <>
            <Text style={styles.label}>{label}</Text>
            <BalanceText vg={vg} pg={pg} />
          </>
        ) : (
          <BalanceText vg={vg} pg={pg} center />
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

function BalanceText({ vg, pg, center }) {
  const { t } = useI18n()
  return (
    <View style={center ? styles.balanceCenter : styles.balanceText}>
      <Text style={[styles.vgText, { color: VG_COLOR }]}>{vg}% {t('pgvg.vg')}</Text>
      <Text style={styles.sep}> / </Text>
      <Text style={[styles.pgText, { color: PG_COLOR }]}>{pg}% {t('pgvg.pg')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 15, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.3 },
  balanceText: { flexDirection: 'row', alignItems: 'center' },
  balanceCenter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center' },
  pgText: { fontSize: 15, fontWeight: '700' },
  vgText: { fontSize: 15, fontWeight: '700' },
  sep: { fontSize: 14, color: colors.textDim },
  slider: { width: '100%', height: 36 },
})
