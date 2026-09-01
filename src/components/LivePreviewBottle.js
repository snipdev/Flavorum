import { useRef, useEffect, useState } from 'react'
import { Animated, Platform } from 'react-native'
import BottleSVG from './BottleSVG'

/**
 * Live preview bottle for the build wizard.
 * Pass `shake` (Animated.Value) to trigger a shake animation.
 */
export default function LivePreviewBottle({ segments = [], visible, style, shake }) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateX = useRef(new Animated.Value(30)).current
  const fillLevel = useRef(new Animated.Value(0)).current
  const fallbackShake = useRef(new Animated.Value(0)).current
  const [mounted, setMounted] = useState(false)

  // Entrance animation: slide in from right + fade
  useEffect(() => {
    if (visible && !mounted) {
      setMounted(true)
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, tension: 50, friction: 10, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
      ]).start()
    } else if (!visible && mounted) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 20, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false))
    }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fill animation: when segments change, animate the fill level
  const totalPct = segments.reduce((a, s) => a + (parseFloat(s.pct) || 0), 0)
  useEffect(() => {
    if (totalPct > 0) {
      Animated.spring(fillLevel, {
        toValue: Math.min(totalPct, 100),
        tension: 30,
        friction: 10,
        useNativeDriver: false,
      }).start()
    }
  }, [totalPct]) // eslint-disable-line react-hooks/exhaustive-deps

  const shakeX = shake || fallbackShake

  if (!visible && !mounted) return null

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateX }, { translateX: shakeX }],
          alignItems: 'center',
          paddingVertical: 4,
        },
      ]}
      pointerEvents="none"
    >
      <BottleSVG segments={segments} totalMl={null} width={120} animateFill />
    </Animated.View>
  )
}
