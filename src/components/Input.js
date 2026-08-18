import { useState } from 'react'
import { TextInput, View, Text, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fs, spacing } from '../theme'
import { useTheme } from '../ThemeContext'

export default function Input({ label, value, onChangeText, keyboardType = 'decimal-pad', placeholder, suffix, icon }) {
  const [focused, setFocused] = useState(false)
  const { theme, textScale } = useTheme()
  const colors = theme
  const styles = createStyles(colors, textScale)

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputFocused]}>
        {icon && <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.icon} />}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          accessibilityLabel={label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {suffix && <View style={styles.suffixBadge}><Text style={styles.suffix}>{suffix}</Text></View>}
      </View>
    </View>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: fs(15, scale), fontWeight: '600', color: colors.textMuted, marginBottom: 6, letterSpacing: 0.3 },
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
    ...Platform.OS === 'web' ? { boxShadow: `0 0 0 3px ${colors.primary}26` } : {},
  },
  icon: { marginLeft: spacing.md },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    height: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    fontSize: fs(16, scale),
    color: colors.text,
  },
  suffixBadge: {
    backgroundColor: colors.primary + '26',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  suffix: { fontSize: fs(15, scale), color: colors.primaryLight, fontWeight: '500' },
})
