import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native'
import { colors, spacing } from '../theme'
import { ELR_FLAVORS } from '../data/flavors'

const MAX_SUGGESTIONS = 8

export default function FlavorAutocomplete({ value, onChangeText, placeholder, exclude = [] }) {
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState([])

  const handleChange = (v) => {
    onChangeText(v)
    const q = v.trim().toLowerCase()
    if (!q) {
      setSuggestions([])
      return
    }
    const ex = new Set(exclude.map(n => n.toLowerCase()))
    const matches = ELR_FLAVORS
      .filter(n => n.toLowerCase().includes(q) && !ex.has(n.toLowerCase()))
      .slice(0, MAX_SUGGESTIONS)
    setSuggestions(matches)
  }

  const pick = (n) => {
    onChangeText(n)
    setSuggestions([])
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={handleChange}
        onFocus={() => {
          setFocused(true)
          handleChange(value)
        }}
        onBlur={() => setTimeout(() => setSuggestions([]), 150)}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        autoCorrect={false}
        autoCapitalize="words"
      />
      {focused && suggestions.length > 0 && (
        <View style={styles.listWrap}>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {suggestions.map((n, i) => (
              <TouchableOpacity
                key={n + i}
                style={styles.item}
                onPress={() => pick(n)}
                activeOpacity={0.6}
              >
                <Text style={styles.itemText} numberOfLines={1}>{n}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1.6, zIndex: 1000 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: 16,
    height: 40,
    paddingHorizontal: 12,
    outlineStyle: 'none',
    ...Platform.OS === 'web' ? { outline: 'none' } : {},
  },
  listWrap: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...Platform.OS === 'web' ? { boxShadow: '0 8px 24px rgba(0,0,0,0.25)' } : { elevation: 12 },
  },
  list: { maxHeight: 220 },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  itemText: { fontSize: 14, color: colors.text },
})
