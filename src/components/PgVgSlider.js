import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import Slider from '@react-native-community/slider'
import { Ionicons } from '@expo/vector-icons'
import { fs, spacing, font } from '../theme'
import { useTheme } from '../ThemeContext'
import { useI18n } from '../i18n'

export default function PgVgSlider({ value, onChangeText }) {
  const { theme, textScale } = useTheme()
  const colors = theme
  const styles = createStyles(colors, textScale)
  const PG_COLOR = colors.primaryLight
  const VG_COLOR = colors.vg
  const numVal = parseFloat(value)
  const isSet = !isNaN(numVal) && numVal > 0
  const pg = isSet ? Math.min(Math.max(numVal, 0), 100) : 0
  const vg = isSet ? 100 - pg : 0

  const handleChange = (text) => {
    let cleaned = text.replace(/[^0-9]/g, '')
    let num = parseInt(cleaned, 10)
    if (isNaN(num)) { onChangeText(''); return }
    if (num > 100) num = 100
    onChangeText(String(num))
  }

  const increment = () => {
    const next = Math.min(pg + 1, 100)
    onChangeText(String(next))
  }

  const decrement = () => {
    const next = Math.max(pg - 1, 0)
    onChangeText(String(next))
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.stepBtn} onPress={decrement} activeOpacity={0.7}>
          <Ionicons name="remove" size={16} color={PG_COLOR} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={isSet ? String(pg) : ''}
          onChangeText={handleChange}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={colors.textDim}
          maxLength={3}
        />
        <View style={styles.suffixWrap}>
          <Text style={styles.suffix}>%</Text>
        </View>
        <TouchableOpacity style={styles.stepBtn} onPress={increment} activeOpacity={0.7}>
          <Ionicons name="add" size={16} color={PG_COLOR} />
        </TouchableOpacity>
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
      />

      <View style={styles.balanceRow}>
        <BalanceText vg={vg} pg={pg} pgColor={PG_COLOR} colors={colors} scale={textScale} isSet={isSet} />
      </View>
    </View>
  )
}

function BalanceText({ vg, pg, pgColor, colors, center, scale, isSet }) {
  const { t } = useI18n()
  const styles = createStyles(colors, scale)
  if (!isSet) {
    return (
      <View style={center ? styles.balanceCenter : styles.balanceText}>
        <Text style={[styles.vgText, { color: colors.textDim }]}>—</Text>
      </View>
    )
  }
  return (
    <View style={center ? styles.balanceCenter : styles.balanceText}>
      <Text style={[styles.vgText, { color: colors.vg }]}>{vg}% {t('pgvg.vg')}</Text>
      <Text style={[styles.sep, { color: colors.textDim }]}> / </Text>
      <Text style={[styles.pgText, { color: pgColor }]}>{pg}% {t('pgvg.pg')}</Text>
    </View>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  container: {},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: spacing.sm,
    gap: 4,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '1A',
  },
  input: {
    flex: 1,
    textAlign: 'center',
    fontSize: fs(16, scale),
    ...font('700'),
    color: colors.text,
    minWidth: 40,
  },
  suffixWrap: {
    paddingHorizontal: 4,
  },
  suffix: {
    fontSize: fs(15, scale),
    ...font('500'),
    color: colors.primaryLight,
  },
  slider: { width: '100%', height: 28 },
  balanceRow: {
    alignItems: 'center',
    marginTop: 2,
  },
  balanceText: { flexDirection: 'row', alignItems: 'center' },
  balanceCenter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center' },
  pgText: { fontSize: fs(14, scale), ...font('700') },
  vgText: { fontSize: fs(14, scale), ...font('700') },
  sep: { fontSize: fs(13, scale) },
})
