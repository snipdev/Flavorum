import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold'
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold'
import { SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk/400Regular'
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium'
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold'
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold'
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular'
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium'
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold'
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold'
import { Poppins_800ExtraBold } from '@expo-google-fonts/poppins/800ExtraBold'
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat/400Regular'
import { Montserrat_500Medium } from '@expo-google-fonts/montserrat/500Medium'
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold'
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat/700Bold'
import { Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat/800ExtraBold'

// Single source of truth for the font picker. Each option maps a font key to
// its family names per text weight (the exact names expo-font registers the
// TTFs under). A missing weight falls back to the nearest available one.
export const FONT_OPTIONS = [
  {
    key: 'system',
    name: 'System',
    nameTr: 'Sistem',
    families: {},
  },
  {
    key: 'inter',
    name: 'Inter',
    nameTr: 'Inter',
    families: {
      400: 'Inter_400Regular',
      500: 'Inter_500Medium',
      600: 'Inter_600SemiBold',
      700: 'Inter_700Bold',
      800: 'Inter_800ExtraBold',
    },
  },
  {
    key: 'spaceGrotesk',
    name: 'Space Grotesk',
    nameTr: 'Space Grotesk',
    families: {
      400: 'SpaceGrotesk_400Regular',
      500: 'SpaceGrotesk_500Medium',
      600: 'SpaceGrotesk_600SemiBold',
      700: 'SpaceGrotesk_700Bold',
    },
  },
  {
    key: 'poppins',
    name: 'Poppins',
    nameTr: 'Poppins',
    families: {
      400: 'Poppins_400Regular',
      500: 'Poppins_500Medium',
      600: 'Poppins_600SemiBold',
      700: 'Poppins_700Bold',
      800: 'Poppins_800ExtraBold',
    },
  },
  {
    key: 'montserrat',
    name: 'Montserrat',
    nameTr: 'Montserrat',
    families: {
      400: 'Montserrat_400Regular',
      500: 'Montserrat_500Medium',
      600: 'Montserrat_600SemiBold',
      700: 'Montserrat_700Bold',
      800: 'Montserrat_800ExtraBold',
    },
  },
]

// Every font file the app ships — passed straight to useFonts() so the family
// names above resolve to real assets on native and web alike.
export const FONT_ASSETS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
}

export function fontOption(key) {
  return FONT_OPTIONS.find(o => o.key === key)
}

// Family name for a specific font + weight, independent of the active font —
// used by the picker to preview each option in its own typeface.
export function familyFor(fontKey, weight = 400) {
  const opt = fontOption(fontKey)
  if (!opt) return undefined
  const fam = opt.families[weight]
  if (fam) return fam
  const weights = Object.keys(opt.families).map(Number).sort((a, b) => a - b)
  if (weights.length === 0) return undefined
  const nearest = weights.reduce((best, w) =>
    Math.abs(w - weight) < Math.abs(best - weight) ? w : best
  , weights[0])
  return opt.families[nearest]
}

// ---- Active font (global) ------------------------------------------------
// The ThemeContext keeps the selected font key in sync here; every style that
// calls font(weight) then resolves against it. Kept as a module-level mutable
// so the existing createStyles(theme, scale) pattern doesn't need a font
// argument threaded through every screen.

let activeFontKey = 'system'

export function setActiveFontKey(key) {
  activeFontKey = key
}

export function fontFamilyFor(weight = 400) {
  return familyFor(activeFontKey, weight)
}

// Spread into any text style that previously used fontWeight alone, e.g.
// { fontSize: 14, ...font('700') }. Returns the original fontWeight plus the
// weight-specific font family, or just the fontWeight for the system font.
export function font(weight = 400) {
  const fam = fontFamilyFor(weight)
  return fam ? { fontWeight: String(weight), fontFamily: fam } : { fontWeight: String(weight) }
}