import { useId, useRef, useEffect, useState } from 'react'
import { View, Text, Animated, Easing } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Path, Rect, ClipPath, Defs, G, Ellipse, LinearGradient, Stop } from 'react-native-svg'
import { fs, isWeb } from '../theme'
import { useTheme } from '../ThemeContext'

/**
 * Gentle surface ripple driven by react-native's Animated (web only; no-op on
 * mobile). Values are pushed into local state each frame so the SVG wave is
 * rendered with plain numeric transforms — only this tiny component re-renders.
 */
function SurfaceRipple({ y }) {
  const ripple = useRef(new Animated.Value(0)).current
  const [t, setT] = useState(0)

  useEffect(() => {
    if (!isWeb) return
    const id = ripple.addListener(({ value }) => setT(value))
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ripple, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(ripple, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    )
    loop.start()
    return () => {
      loop.stop()
      ripple.removeListener(id)
    }
  }, [ripple])

  if (!isWeb) return null

  // Traveling wave: drifts sideways (half an 18-unit period), bobs gently up,
  // and pulses opacity 0.08 → 0.16 → 0.08.
  const drift = 9 * t
  const bob = t < 0.5 ? -2.2 * t : -2.2 * (1 - t)
  const op = 0.08 + 0.08 * (1 - Math.abs(2 * t - 1))
  const base = y + 0.6
  const d =
    `M 15 ${base} Q 24 ${base - 1.2} 33 ${base}` +
    ` Q 42 ${base + 1.2} 51 ${base}` +
    ` Q 60 ${base - 1.2} 69 ${base}` +
    ` Q 78 ${base + 1.2} 87 ${base}` +
    ` Q 96 ${base - 1.2} 105 ${base}`

  return (
    <G transform={`translate(${drift} ${bob})`}>
      <Path d={d} stroke="#ffffff" strokeWidth={0.8} fill="none" opacity={op} />
    </G>
  )
}

/**
 * Stylized dropper bottle showing the liquid composition as stacked layers.
 * `segments` items: { label, pct, color } — first item sits at the bottom.
 * Layers below 1% of the total render as a thin colored boundary line only.
 * `totalMl` (optional) renders a small volume label under the bottle.
 * Size is responsive: bigger on web, compact on mobile. Pass `width` to override.
 */
export default function BottleSVG({ segments, totalMl, width }) {
  const { theme, textScale } = useTheme()
  const colors = theme
  const bottleWidth = width || (isWeb ? 112 : 96)
  const rawId = useId()
  const clipId = 'bottleclip' + rawId.replace(/[^a-zA-Z0-9]/g, '')

  const vbW = 110
  const vbH = 166
  const height = bottleWidth * (vbH / vbW)

  // Bottle silhouette: neck (47..63) tapers out to body (22..88).
  const bodyPath =
    'M 47 62 L 35 74 Q 22 84 22 96 L 22 148 Q 22 158 32 158 L 78 158 Q 88 158 88 148 L 88 96 Q 88 84 75 74 L 63 62 Z'

  const bodyBottom = 158
  const fillTopMax = 100 // liquid never rises above the straight body walls
  const liquidMax = bodyBottom - fillTopMax

  const total = segments.reduce((a, s) => a + (parseFloat(s.pct) || 0), 0)

  // Stack layers from the bottom up. Sub-1% layers collapse into a colored line.
  let cursor = bodyBottom
  const layers = []
  const thinLines = []
  let lastThin = false
  if (total > 0) {
    segments.forEach((seg, i) => {
      const rawPct = parseFloat(seg.pct) || 0
      const pctOfTotal = (rawPct / total) * 100
      if (pctOfTotal < 1) {
        thinLines.push({ key: i, y: cursor, color: seg.color })
        lastThin = true
      } else {
        const h = (rawPct / total) * liquidMax
        cursor -= h
        layers.push({ key: i, y: cursor, h, color: seg.color })
        lastThin = false
      }
    })
  }
  const surfaceY = layers.length > 0 ? layers[layers.length - 1].y : bodyBottom

  // Surface reflection adapts to the top layer: if the topmost segment is a
  // sub-1% line (lastThin) or a very thin fill, the shine shrinks and dims so
  // it never swamps a barely-visible layer.
  const topSeg = total > 0 && segments.length > 0 ? segments[segments.length - 1] : null
  const topColor = topSeg ? topSeg.color : colors.primaryLight || '#ffffff'
  const topLayerH = layers.length > 0 ? layers[layers.length - 1].h : 0
  const surfaceThin = lastThin || topLayerH < 4
  const glareId = 'glare' + rawId.replace(/[^a-zA-Z0-9]/g, '')
  const sheenId = 'sheen' + rawId.replace(/[^a-zA-Z0-9]/g, '')

  // Sub-1% layer lines and layer boundaries keep a roughly constant rendered
  // thickness (~1.4px / ~1px) so they stay readable in small bottles (batch cards).
  const thinLineH = Math.max(1.5, 1.4 * (vbW / bottleWidth))
  const boundH = Math.max(1, 0.9 * (vbW / bottleWidth))

  // Graduation marks along the right side of the bottle body (measuring scale)
  const marks = []
  for (let y = 108; y <= 148; y += 10) marks.push({ y, len: 7 })
  for (let y = 113; y <= 153; y += 10) marks.push({ y, len: 4 })

  const glass = colors.glass || 'rgba(255,255,255,0.09)'
  const stroke = colors.cardBorder || colors.border || 'rgba(255,255,255,0.25)'

  const volLabel = totalMl != null
    ? (Number.isInteger(totalMl) ? String(totalMl) : String(Math.round(totalMl * 10) / 10)) + ' ml'
    : null

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={bottleWidth} height={height} viewBox={`0 0 ${vbW} ${vbH}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Path d={bodyPath} />
          </ClipPath>
          {/* Surface glare: bright at the center, fading to the edges */}
          <LinearGradient id={glareId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <Stop offset="0.5" stopColor="#ffffff" stopOpacity={surfaceThin ? 0.28 : 0.45} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </LinearGradient>
          {/* Window reflection sheen: fades out at both ends along the band */}
          <LinearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <Stop offset="0.3" stopColor="#ffffff" stopOpacity="0.14" />
            <Stop offset="0.7" stopColor="#ffffff" stopOpacity="0.14" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Dropper tip */}
        <Rect x={49} y={6} width={12} height={10} rx={3} fill={glass} stroke={stroke} strokeWidth={1.5} />
        {/* Cap */}
        <Rect x={40} y={18} width={30} height={30} rx={7} fill={glass} stroke={stroke} strokeWidth={1.5} />
        <Rect x={42} y={26} width={26} height={2.5} rx={1.25} fill={stroke} opacity={0.8} />
        <Rect x={42} y={34} width={26} height={2.5} rx={1.25} fill={stroke} opacity={0.8} />
        {/* Neck */}
        <Rect x={47} y={48} width={16} height={16} rx={3} fill={glass} stroke={stroke} strokeWidth={1.5} />

        {/* Glass body */}
        <Path d={bodyPath} fill={glass} stroke={stroke} strokeWidth={1.5} />

        {/* Liquid layers (clipped to the bottle interior) */}
        <G clipPath={`url(#${clipId})`}>
          {layers.map(layer => (
            <Rect key={layer.key} x={20} y={layer.y} width={70} height={layer.h + 0.6} fill={layer.color} />
          ))}
          {/* Boundaries between filled layers */}
          {layers.slice(1).map((layer, i) => (
            <Rect key={'b' + i} x={20} y={layer.y - boundH / 2} width={70} height={boundH} fill="rgba(0,0,0,0.28)" />
          ))}
          {/* Sub-1% layers: colored line (with dark edge) instead of a fill */}
          {thinLines.map(line => (
            <G key={'t' + line.key}>
              <Rect x={20} y={line.y - thinLineH / 2 - 0.5} width={70} height={thinLineH + 1} fill="rgba(0,0,0,0.30)" />
              <Rect x={20} y={line.y - thinLineH / 2} width={70} height={thinLineH} fill={line.color} />
            </G>
          ))}
          {/* Liquid surface reflection: contact line, glare, subsurface glow, meniscus */}
          {layers.length > 0 && (
            <G>
              {/* Contact line: crisp highlight where the liquid meets the glass */}
              <Rect x={23} y={surfaceY - (surfaceThin ? 0.4 : 0.6)} width={64} height={surfaceThin ? 0.8 : 1.2} fill="rgba(255,255,255,0.5)" rx={0.6} />
              {/* Glare: gradient streak across the surface */}
              <Ellipse cx={55} cy={surfaceY} rx={surfaceThin ? 22 : 30} ry={surfaceThin ? 1 : 1.8} fill={`url(#${glareId})`} />
              {/* Subsurface glow: light penetrating the top liquid */}
              <Ellipse cx={55} cy={surfaceY + (surfaceThin ? 1.5 : 3)} rx={surfaceThin ? 20 : 27} ry={surfaceThin ? 0.8 : 2.2} fill={topColor} opacity={surfaceThin ? 0.12 : 0.20} />
              {/* Meniscus: surface dips slightly toward the middle */}
              <Path d={`M 23 ${surfaceY} Q 55 ${surfaceY + (surfaceThin ? 0.5 : 1.3)} 87 ${surfaceY}`} stroke="rgba(255,255,255,0.30)" strokeWidth={surfaceThin ? 0.6 : 1} fill="none" />
            </G>
          )}
          {/* Surface ripple: slow traveling wave (web only, no-op on mobile) */}
          {layers.length > 0 && (
            <SurfaceRipple y={surfaceY} />
          )}
          {/* Graduation marks (measuring scale on the right side) */}
          {marks.map((m, i) => (
            <Rect key={'m' + i} x={81 - m.len} y={m.y - 0.5} width={m.len} height={1} fill="rgba(255,255,255,0.30)" />
          ))}
          {/* Glass highlight */}
          <Rect x={28} y={100} width={6} height={48} rx={3} fill="rgba(255,255,255,0.10)" />
          {/* Diagonal window reflection: light from the upper-left, two tilted bands */}
          <G transform={`rotate(-16 55 130)`}>
            <Rect x={46} y={84} width={16} height={102} fill={`url(#${sheenId})`} />
            <Rect x={50} y={84} width={3.5} height={102} fill="rgba(255,255,255,0.10)" />
          </G>
        </G>
      </Svg>
      {volLabel && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Ionicons name="leaf-outline" size={12} color={colors.primaryLight} />
          <Text style={{ fontSize: fs(12, textScale), fontWeight: '600', color: colors.textMuted }}>
            {volLabel}
          </Text>
        </View>
      )}
    </View>
  )
}
