import { View, Text, StyleSheet } from 'react-native'
import { fs, font } from '../theme'
import { useTheme } from '../ThemeContext'
import { useI18n } from '../i18n'

/**
 * Nicotine info panel shown to the right of the volume ruler once a nicotine
 * base has been picked. Displays the chemical formula (C₁₀H₁₄N₂) together
 * with the selected strength and base type.
 */
export default function NicotineInfo({ strength, baseMode, customPg, customVg, sourceCount }) {
  const { theme: colors, textScale } = useTheme()
  const { t } = useI18n()
  const styles = createStyles(colors, textScale)

  const nicMg = parseFloat(strength) || 0
  if (!(nicMg > 0) && !(sourceCount > 0)) return null

  let baseLabel
  if (!baseMode) {
    baseLabel = '—'
  } else if (baseMode === 'vg') {
    baseLabel = t('build.vg100')
  } else if (baseMode === 'custom') {
    const pg = Math.round(parseFloat(customPg) || 0)
    const vg = Math.round(parseFloat(customVg) || 0)
    baseLabel = `PG ${pg}% / VG ${vg}%`
  } else {
    baseLabel = t('build.pg100')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.formula}>C₁₀H₁₄N₂</Text>
      <Text style={styles.caption}>{t('build.nicotineLabel')}</Text>
      <View style={styles.divider} />
      {nicMg > 0 && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('build.nicStrength')}</Text>
          <Text style={styles.rowValue}>{nicMg} mg/ml</Text>
        </View>
      )}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t('build.nicBaseType')}</Text>
        <Text style={styles.rowValue}>{baseLabel}</Text>
      </View>
    </View>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card + '80',
    minWidth: 108,
  },
  formula: {
    fontSize: fs(15, scale),
    ...font('700'),
    color: colors.primaryLight,
    letterSpacing: 0.5,
  },
  caption: {
    fontSize: fs(8, scale),
    ...font('600'),
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: colors.cardBorder,
    marginVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginVertical: 1,
  },
  rowLabel: {
    fontSize: fs(9, scale),
    ...font('500'),
    color: colors.textDim,
  },
  rowValue: {
    fontSize: fs(9, scale),
    ...font('700'),
    color: colors.textMuted,
  },
})