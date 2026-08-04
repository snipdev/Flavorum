import { View, Text, TextInput, StyleSheet, Platform } from 'react-native'
import Slider from '@react-native-community/slider'
import { colors, spacing } from '../theme'

export default function SliderInput({ label, value, onChangeText, min = 0, max = 100, step = 1, suffix, inputRef }) {
  const numVal = parseFloat(value) || 0

  function sanitize(v) {
    let s = String(v).replace(/[^0-9.]/g, '')
    const dot = s.indexOf('.')
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
    const num = parseFloat(s)
    if (s !== '' && s !== '.' && !isNaN(num)) {
      if (num > max) return String(max)
      if (num < min) return String(min)
    }
    return s
  }

  return (
    <View style={styles.container}>
      {label !== '' && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={v => onChangeText(sanitize(v))}
          keyboardType="decimal-pad"
          selectTextOnFocus
          placeholderTextColor={colors.textDim}
        />
        {suffix && <View style={styles.suffixBadge}><Text style={styles.suffix}>{suffix}</Text></View>}
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={Math.min(Math.max(numVal, min), max)}
        onValueChange={val => onChangeText(String(val))}
        minimumTrackTintColor={colors.primaryLight}
        maximumTrackTintColor="rgba(197, 146, 6, 0.15)"
        thumbTintColor={colors.primaryLight}
      />
      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{min}</Text>
        <Text style={styles.rangeText}>{max}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: 15, fontWeight: '600', color: colors.textMuted, marginBottom: 6, letterSpacing: 0.3 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 18,
    color: colors.text,
    outlineStyle: 'none',
    ...Platform.OS === 'web' ? { outline: 'none' } : {},
  },
  suffixBadge: {
    backgroundColor: 'rgba(197, 146, 6, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  suffix: { fontSize: 15, color: colors.primaryLight, fontWeight: '500' },
  slider: { width: '100%', height: 36, marginTop: 2 },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 },
  rangeText: { fontSize: 13, color: colors.textDim },
})
