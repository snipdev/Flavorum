import { useState } from 'react'
import { TextInput, View, Text, StyleSheet, Platform } from 'react-native'
import { colors, spacing } from '../theme'

export default function Input({ label, value, onChangeText, keyboardType = 'decimal-pad', placeholder, suffix, icon }) {
  const [focused, setFocused] = useState(false)

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputFocused]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {suffix && <View style={styles.suffixBadge}><Text style={styles.suffix}>{suffix}</Text></View>}
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
    transition: Platform.OS === 'web' ? 'border-color 0.2s ease' : undefined,
  },
  inputFocused: {
    borderColor: colors.primary,
    ...Platform.OS === 'web' ? { boxShadow: '0 0 0 3px rgba(197, 146, 6, 0.15)' } : {},
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 19,
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
})
