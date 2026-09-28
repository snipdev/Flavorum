import { useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Animated, Dimensions } from 'react-native'
import Slider from '@react-native-community/slider'
import { Ionicons } from '@expo/vector-icons'
import { fs, spacing, font } from '../theme'
import { useTheme } from '../ThemeContext'
import { useI18n } from '../i18n'

export default function SliderInput({ label, value, onChangeText, min = 0, max = 100, step = 1, suffix, inputRef, placeholder }) {
  const { t } = useI18n()
  const { theme, textScale } = useTheme()
  const colors = theme
  const styles = createStyles(colors, textScale)
  const [focused, setFocused] = useState(false)
  const [popups, setPopups] = useState([])
  const numVal = parseFloat(value) || 0
  const rangePct = max > min ? Math.min(((numVal - min) / (max - min)) * 100, 100) : 0
  const inDangerZone = numVal > 0 && rangePct >= 80
  const sliderAccent = inDangerZone ? colors.warning : colors.primaryLight

  const addPopup = useCallback((valueStr) => {
    const id = `${String(valueStr).replace(/\./g, '')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setPopups(prev => [...prev, { id, value: valueStr }])
    setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 760)
  }, [])

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

  const handleStep = (direction) => {
    const current = parseFloat(value) || 0
    const delta = direction === 'up' ? step : -step
    let nextVal = current + delta
    if (nextVal < min) nextVal = min
    if (nextVal > max) nextVal = max

    // Avoid float precision issues e.g. 0.30000000000000004
    const decimals = (String(step).split('.')[1] || '').length
    const formatted = parseFloat(nextVal.toFixed(decimals))
    onChangeText(String(formatted))
    addPopup(String(formatted))
  }

  const stepLabel = (verb) => `${verb}${label ? ` ${label}` : ''}`

  return (
    <View style={styles.container}>
      {label !== '' && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, focused && styles.inputFocused]}>
        <TouchableOpacity
          style={styles.stepBtnLeft}
          onPress={() => handleStep('down')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={stepLabel(t('common.decrease'))}
        >
          <Ionicons name="remove" size={18} color={colors.primaryLight} />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={v => onChangeText(sanitize(v))}
          keyboardType="decimal-pad"
          selectTextOnFocus
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {suffix && <View style={styles.suffixBadge}><Text style={styles.suffix}>{suffix}</Text></View>}

        <TouchableOpacity
          style={styles.stepBtnRight}
          onPress={() => handleStep('up')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={stepLabel(t('common.increase'))}
        >
          <Ionicons name="add" size={18} color={colors.primaryLight} />
        </TouchableOpacity>
      </View>

      <View style={styles.popupStage}>
        {popups.map(p => <AnimatedPopup key={p.id} value={p.value} boxStyle={styles.popupInline} textStyle={styles.popupText} onDone={() => setPopups(prev => prev.filter(x => x.id !== p.id))} />)}
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={Math.min(Math.max(numVal, min), max)}
        onValueChange={val => onChangeText(String(val))}
        minimumTrackTintColor={sliderAccent}
        maximumTrackTintColor={colors.primary + '26'}
        thumbTintColor={sliderAccent}
      />
      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{min}</Text>
        <Text style={styles.rangeText}>{max}</Text>
      </View>
    </View>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  container: {},
  label: { fontSize: fs(15, scale), ...font('600'), color: colors.textMuted, marginBottom: 6, letterSpacing: 0.3 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    marginBottom: 4,
    transition: Platform.OS === 'web' ? 'border-color 0.2s ease' : undefined,
  },
  inputFocused: {
    borderColor: colors.primary,
    ...Platform.OS === 'web' ? { boxShadow: `0 0 0 3px ${colors.primary}26` } : {},
  },
  stepBtnLeft: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    borderTopLeftRadius: 10.5,
    borderBottomLeftRadius: 10.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
  },
  stepBtnRight: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    borderTopRightRadius: 10.5,
    borderBottomRightRadius: 10.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
  },
  input: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    height: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
    fontSize: fs(16, scale),
    textAlign: 'center',
    color: colors.text,
  },
  suffixBadge: {
    flexShrink: 0,
    backgroundColor: colors.primary + '26',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  suffix: { fontSize: fs(15, scale), color: colors.primaryLight, ...font('500') },
  slider: { width: '100%', height: 28, marginTop: 0 },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  rangeText: { fontSize: fs(14, scale), color: colors.textMuted },
  popupStage: {
    height: 28,
    position: 'relative',
    zIndex: 5,
  },
  popupInline: Platform.OS === 'web'
    ? { position: 'fixed', top: '55%', left: '50%', pointerEvents: 'none', zIndex: 50 }
    : { position: 'absolute', top: -6, left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' },
  popupText: { fontSize: fs(44, scale), color: colors.primaryLight, ...font('800') },
})

const AnimatedPopup = ({ value, onDone, boxStyle, textStyle }) => {
  const textRef = useRef(null)
  // Created once per popup instance via lazy state (not refs) — the popup is
  // keyed and short-lived, so instance lifetime equals animation lifetime.
  const [anim] = useState(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(0),
    scale: new Animated.Value(0.7),
  }))
  useEffect(() => {
    if (Platform.OS === 'web') {
      const el = textRef.current
      if (el) el.style.animation = 'floatUp 760ms ease-out forwards'
      return
    }
    const driver = true
    const rise = Math.round(Dimensions.get('window').height * 0.35)
    Animated.parallel([
      Animated.timing(anim.opacity, { toValue: 1, duration: 160, useNativeDriver: driver }),
      Animated.timing(anim.translateY, { toValue: -24, duration: 160, useNativeDriver: driver }),
      Animated.timing(anim.scale, { toValue: 1.1, duration: 160, useNativeDriver: driver }),
    ]).start()
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(anim.opacity, { toValue: 0, duration: 560, useNativeDriver: driver }),
        Animated.timing(anim.translateY, { toValue: -rise, duration: 560, useNativeDriver: driver }),
        Animated.timing(anim.scale, { toValue: 0.75, duration: 560, useNativeDriver: driver }),
      ]).start(() => onDone && onDone())
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (Platform.OS === 'web') {
    return <View style={boxStyle}><Text ref={textRef} style={textStyle}>{value}</Text></View>
  }
  return (
    <Animated.View style={[boxStyle, { opacity: anim.opacity, transform: [{ translateY: anim.translateY }, { scale: anim.scale }] }]}>
      <Text style={textStyle}>{value}</Text>
    </Animated.View>
  )
}
