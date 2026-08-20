import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, Dimensions } from 'react-native'
import { useTheme } from '../ThemeContext'
import { fs, font } from '../theme'
import { ELR_FLAVORS } from '../data/flavors'
import { parseFlavorName } from '../utils/flavorUtils'
import { findRec, getRecValues, normFlavorKey, normRecKey } from '../utils/recipes'
import DropdownPortal from './DropdownPortal'

const MAX_SUGGESTIONS = 12
const MAX_BRAND_CHIPS = 6
const INPUT_HEIGHT = 48
const DROPDOWN_TOP = INPUT_HEIGHT + 6

const normBrand = (b) => (b || '').trim().toUpperCase()

const getMatchSegments = (text, query) => {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const mask = new Array(text.length).fill(false)
  for (const tok of tokens) {
    let idx = lower.indexOf(tok)
    while (idx !== -1) {
      for (let i = idx; i < idx + tok.length && i < mask.length; i++) mask[i] = true
      idx = lower.indexOf(tok, idx + tok.length)
    }
  }
  const segs = []
  let cur = ''
  let curM = mask[0] || false
  for (let i = 0; i < text.length; i++) {
    if (mask[i] === curM) cur += text[i]
    else {
      segs.push({ text: cur, match: curM })
      cur = text[i]
      curM = mask[i]
    }
  }
  if (cur) segs.push({ text: cur, match: curM })
  return segs
}

export default function FlavorAutocomplete({ value, onChangeText, placeholder, exclude = [], recs, onPick, onActiveChange }) {
  const { theme, textScale } = useTheme()
  const colors = theme
  const styles = createStyles(colors, textScale)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const menuRef = useRef(null)
  const hideTimer = useRef(null)
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [brands, setBrands] = useState([])
  const [selectedBrand, setSelectedBrand] = useState(null)
  const [menuPos, setMenuPos] = useState(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const justPicked = useRef(false)
  const listId = useRef(`flavor-list-${Math.random().toString(36).slice(2)}`).current

  const handleBlur = (e) => {
    const related = e && e.relatedTarget
    const inContainer = related && containerRef.current && typeof containerRef.current.contains === 'function' && containerRef.current.contains(related)
    const inMenu = related && menuRef.current && typeof menuRef.current.contains === 'function' && menuRef.current.contains(related)
    if (inContainer || inMenu) return
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      setFocused(false)
      setSuggestions([])
      setBrands([])
      setSelectedBrand(null)
      setMenuPos(null)
    }, 250)
  }

  const getMatches = (q) => {
    const ex = new Set(exclude.map(n => n.toLowerCase()))
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return []
    return ELR_FLAVORS.filter(n => {
      const low = n.toLowerCase()
      return !ex.has(low) && tokens.every(tok => low.includes(tok))
    })
  }

  const applyFilters = (v, brand) => {
    const matches = getMatches(v)
    const counts = {}
    for (const n of matches) {
      const b = normBrand(parseFlavorName(n).brand)
      if (b) counts[b] = (counts[b] || 0) + 1
    }
    let chips = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_BRAND_CHIPS)
      .map(([k]) => k)
    if (brand && !chips.includes(brand)) chips = [brand, ...chips]
    setBrands(chips)
    const filtered = brand ? matches.filter(n => normBrand(parseFlavorName(n).brand) === brand) : matches
    const recMap = recs || {}
    const keys = Object.keys(recMap)
    const exact = new Set(keys)
    const free = new Set(keys.map(normRecKey))
    const hasRec = (n) => exact.has(normFlavorKey(n)) || free.has(normRecKey(n))
    const withRec = []
    const withoutRec = []
    for (const n of filtered) {
      if (hasRec(n)) withRec.push(n)
      else withoutRec.push(n)
    }
    setSuggestions(withRec.concat(withoutRec).slice(0, MAX_SUGGESTIONS))
  }

  const handleChange = (v) => {
    justPicked.current = false
    onChangeText(v)
    if (!v.trim()) {
      setSuggestions([])
      setBrands([])
      return
    }
    applyFilters(v, selectedBrand)
  }

  const toggleBrand = (b) => {
    const next = selectedBrand === b ? null : b
    setSelectedBrand(next)
    applyFilters(value, next)
  }

  const pick = (n) => {
    onChangeText(n)
    if (onPick) {
      const rec = recs ? findRec(recs, n) : null
      onPick(n, rec || null)
    }
    setSuggestions([])
    setBrands([])
    setSelectedBrand(null)
    justPicked.current = true
    if (isWeb) inputRef.current?.focus()
  }

  const pickValue = (n, rec, val, e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation()
    onChangeText(n)
    if (onPick) onPick(n, rec || null, val)
    setSuggestions([])
    setBrands([])
    setSelectedBrand(null)
    justPicked.current = true
    if (isWeb) inputRef.current?.focus()
  }

  const closeDropdown = () => {
    setSuggestions([])
    setBrands([])
    setSelectedBrand(null)
    setMenuPos(null)
    setActiveIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (!isWeb) return
    if (!showDropdown) {
      if (e.key === 'ArrowDown' && value.trim()) {
        e.preventDefault()
        applyFilters(value, selectedBrand)
        setActiveIndex(0)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => (i < suggestions.length - 1 ? i + 1 : i))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => (i > 0 ? i - 1 : i))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault()
        pick(suggestions[activeIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeDropdown()
    }
  }

  const showChips = focused && value.trim() && brands.length > 0
  const showDropdown = showChips || (focused && suggestions.length > 0)

  useEffect(() => {
    if (!showDropdown) setActiveIndex(-1)
  }, [showDropdown, value])

  useEffect(() => {
    if (onActiveChange) onActiveChange(showDropdown)
  }, [showDropdown])

  const isWeb = Platform.OS === 'web'
  const nativeMinWidth = isWeb ? undefined : Math.min(280, Dimensions.get('window').width - 40)

  useLayoutEffect(() => {
    if (!showDropdown || !isWeb) return
    const measure = () => {
      const el = inputRef.current
      const rect = el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null
      if (!rect) return
      const viewport = (window.innerWidth || document.documentElement.clientWidth) || 0
      const extend = Math.min(44, rect.left - 12)
      const left = rect.left - extend
      const maxW = viewport ? viewport - left - 12 : 0
      const width = maxW > 0 ? Math.min(Math.max(rect.width + extend, 300), maxW) : rect.width
      setMenuPos({ top: rect.bottom + 6, left, width })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      if (inputRef.current) ro.observe(inputRef.current)
    }
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      if (ro) ro.disconnect()
    }
  }, [showDropdown, isWeb])

  const dropdownPos = isWeb
    ? {
        position: 'fixed',
        top: menuPos ? menuPos.top : DROPDOWN_TOP,
        left: menuPos ? menuPos.left : 0,
        width: menuPos ? menuPos.width : undefined,
        zIndex: 99999,
      }
    : null

  const dropdown = (
    <View ref={menuRef} style={[styles.dropdown, !isWeb && { minWidth: nativeMinWidth }, dropdownPos]}>
      {showChips && (
        <View style={styles.chipsWrap}>
          {brands.map(b => (
            <TouchableOpacity
              key={b}
              style={[styles.chip, selectedBrand === b && styles.chipActive]}
              onPress={() => toggleBrand(b)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={b}
              accessibilityState={{ selected: selectedBrand === b }}
            >
              <Text style={[styles.chipText, selectedBrand === b && styles.chipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {focused && suggestions.length > 0 && (
        <ScrollView style={styles.list} nativeID={listId} accessibilityRole="listbox" keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {suggestions.map((n, i) => {
            const { name, brand } = parseFlavorName(n)
            const rec = recs ? findRec(recs, n) : null
            return (
              <TouchableOpacity
                key={n + i}
                style={[styles.item, i === activeIndex && styles.itemActive]}
                onPress={() => pick(n)}
                onFocus={() => setActiveIndex(i)}
                onMouseEnter={isWeb ? () => setActiveIndex(i) : undefined}
                activeOpacity={0.6}
                accessibilityRole="option"
                accessibilityLabel={name}
                accessibilityState={{ selected: i === activeIndex }}
              >
                <View style={styles.itemRow}>
                  <Text style={styles.itemText} numberOfLines={1}>
                    {getMatchSegments(name, value).map((seg, j) => (
                      <Text key={j} style={seg.match && styles.itemTextHighlight}>{seg.text}</Text>
                    ))}
                  </Text>
                  {rec && getRecValues(rec).length > 0 && (
                    <View style={styles.rateChips}>
                      {getRecValues(rec).map(v => (
                        <TouchableOpacity
                          key={v}
                          style={styles.rateChip}
                          onPress={(e) => pickValue(n, rec, v, e)}
                          activeOpacity={0.6}
                          accessibilityRole="button"
                          accessibilityLabel={`${v}% ${name}`}
                        >
                          <Text style={styles.rateChipText}>{v}%</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {brand && (
                    <View style={styles.brandBadge}>
                      <Text style={styles.brandBadgeText}>{brand}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </View>
  )

  return (
    <View ref={containerRef} style={styles.container}>
      <TextInput
        ref={inputRef}
        style={[styles.input, focused && styles.inputFocused]}
        value={value}
        onChangeText={handleChange}
        onFocus={() => {
          setFocused(true)
          clearTimeout(hideTimer.current)
          if (justPicked.current) {
            justPicked.current = false
            return
          }
          handleChange(value)
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        autoCorrect={false}
        autoCapitalize="words"
        onKeyDown={handleKeyDown}
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        aria-controls={showDropdown ? listId : undefined}
      />
      {showDropdown && (
        isWeb ? (
          <DropdownPortal>
            {dropdown}
          </DropdownPortal>
        ) : dropdown
      )}
    </View>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  container: { flex: 1.6, position: 'relative', zIndex: 9999, minWidth: 0, flexShrink: 1 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: fs(16, scale),
    height: INPUT_HEIGHT,
    paddingHorizontal: 12,
    minWidth: 0,
    flexShrink: 1,
    transition: Platform.OS === 'web' ? 'border-color 0.2s ease' : undefined,
  },
  inputFocused: {
    borderColor: colors.primary,
    ...Platform.OS === 'web' ? { boxShadow: `0 0 0 3px ${colors.primary}26` } : {},
  },
  dropdown: {
    position: 'absolute',
    top: DROPDOWN_TOP,
    left: 0,
    right: 0,
    zIndex: 9999,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.modalBg,
    overflow: 'hidden',
    ...Platform.OS === 'web' ? { boxShadow: '0 8px 24px rgba(0,0,0,0.25)' } : { elevation: 12 },
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { fontSize: fs(12, scale), ...font('600'), color: colors.textMuted },
  chipTextActive: { color: '#fff' },
  list: { maxHeight: 360 },
  item: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  itemActive: {
    backgroundColor: colors.primary + '26',
  },
  itemTextHighlight: {
    ...font('700'),
    color: colors.primaryLight,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemText: { flex: 1, fontSize: fs(14, scale), color: colors.text },
  brandBadge: {
    backgroundColor: colors.primary + '22',
    borderWidth: 1,
    borderColor: colors.primary + '44',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  brandBadgeText: { fontSize: fs(12, scale), ...font('700'), color: colors.primaryLight },
  rateChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    maxWidth: '60%',
  },
  rateChip: {
    minHeight: 36,
    backgroundColor: colors.success + '2E',
    borderWidth: 1,
    borderColor: colors.success + '66',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateChipText: { fontSize: fs(12, scale), ...font('700'), color: colors.success },
})
