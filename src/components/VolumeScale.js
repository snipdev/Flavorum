import { useRef, useEffect } from 'react'
import { Animated, View, Text, StyleSheet } from 'react-native'
import { fs, font } from '../theme'
import { useTheme } from '../ThemeContext'

/**
 * Dynamic ruler that adapts to the selected volume.
 * e.g. 30ml → ruler shows up to ~40ml, 120ml → up to ~150ml
 * Looks like it belongs to the bottle — matched height.
 */
function niceMax(vol) {
  if (vol <= 0) return 500
  if (vol <= 20) return 30
  if (vol <= 40) return 50
  if (vol <= 60) return 80
  if (vol <= 100) return 120
  if (vol <= 150) return 200
  if (vol <= 250) return 300
  if (vol <= 350) return 400
  return 500
}

function tickStep(max) {
  if (max <= 50) return 10
  if (max <= 120) return 20
  return 50
}

export default function VolumeScale({ volume = 0 }) {
  const { theme: colors, textScale } = useTheme()
  const styles = createStyles(colors, textScale)
  const fillAnim = useRef(new Animated.Value(0)).current
  const maxAnim = useRef(new Animated.Value(500)).current

  const maxVolume = niceMax(volume)

  useEffect(() => {
    const pct = maxVolume > 0 ? Math.min(volume / maxVolume, 1) : 0
    Animated.parallel([
      Animated.spring(fillAnim, {
        toValue: pct,
        tension: 40,
        friction: 12,
        useNativeDriver: false,
      }),
      Animated.spring(maxAnim, {
        toValue: maxVolume,
        tension: 30,
        friction: 15,
        useNativeDriver: false,
      }),
    ]).start()
  }, [volume, maxVolume]) // eslint-disable-line react-hooks/exhaustive-deps

  const step = tickStep(maxVolume)
  const ticks = []
  for (let ml = 0; ml <= maxVolume; ml += step) {
    const isMajor = ml % (step * 2) === 0 || ml === maxVolume
    ticks.push({ ml, isMajor })
  }

  const barHeight = 210
  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, barHeight],
  })

  return (
    <View style={styles.container}>
      <View style={styles.connectorLine} />
      <View style={styles.scaleWrapper}>
        <Animated.View style={[styles.fillBar, { height: fillHeight }]} />
        {ticks.map(({ ml, isMajor }) => {
          const yPct = maxVolume > 0 ? ml / maxVolume : 0
          const y = barHeight - yPct * barHeight
          return (
            <View key={ml} style={[styles.tick, { top: y - 1 }]}>
              <View style={[styles.tickLine, isMajor ? styles.tickLineMajor : styles.tickLineMinor]} />
              {isMajor && ml > 0 && (
                <Text style={styles.tickLabel}>{ml}</Text>
              )}
            </View>
          )
        })}
        {/* Current volume indicator */}
        {volume > 0 && (
          <View style={[styles.volumeIndicator, { top: barHeight - (volume / maxVolume) * barHeight - 8 }]}>
            <Text style={styles.volumeIndicatorText}>{Math.round(volume)}</Text>
          </View>
        )}
      </View>
      <Text style={styles.unitLabel}>ml</Text>
    </View>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  container: {
    alignItems: 'center',
    marginLeft: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 0,
  },
  connectorLine: {
    width: 1,
    height: 210,
    backgroundColor: colors.textDim + '25',
    marginRight: 0,
    marginBottom: 24,
  },
  scaleWrapper: {
    width: 52,
    height: 210,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  fillBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 18,
    backgroundColor: colors.primary + '15',
    borderRadius: 3,
  },
  tick: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickLine: {
    height: 1,
  },
  tickLineMajor: {
    width: 14,
    backgroundColor: colors.textDim + '50',
  },
  tickLineMinor: {
    width: 8,
    backgroundColor: colors.textDim + '25',
  },
  tickLabel: {
    marginLeft: 3,
    fontSize: fs(9, scale),
    ...font('600'),
    color: colors.textDim,
  },
  volumeIndicator: {
    position: 'absolute',
    left: -2,
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  volumeIndicatorText: {
    fontSize: fs(8, scale),
    ...font('700'),
    color: '#fff',
  },
  unitLabel: {
    marginLeft: 2,
    marginBottom: 2,
    fontSize: fs(10, scale),
    ...font('700'),
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
})
