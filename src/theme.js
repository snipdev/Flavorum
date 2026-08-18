import { useEffect, useMemo, useRef } from 'react'
import { Animated, Platform, useWindowDimensions } from 'react-native'

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const webMaxWidth = 580
// Above this content width the screens switch to their two-column desktop
// layouts (form left, sticky result right). Below it — and on mobile — the
// single phone column is always preserved. The threshold is judged on the
// *content* width (viewport minus the sidebar) so two columns unlock as soon
// as there is genuinely room for them — which also keeps the single column
// from stretching past ~760px.
export const wideWebBreakpoint = 760
// Max width of the wide web content wrapper (the two-column layouts live here).
export const wideWebMaxWidth = 1240
// At/above this viewport width the web UI swaps the mobile-style bottom tab
// bar for a desktop left sidebar. Below it (and on mobile) the bottom bar is
// always preserved.
export const sidebarWebBreakpoint = 820
export const sidebarWebWidth = 200
export const isWeb = Platform.OS === 'web'

export function useWideWeb() {
  const { width } = useWindowDimensions()
  if (!isWeb) return false
  // The left sidebar eats 200px, so the two-column layouts must judge their
  // room by the *content* width, not the viewport. At viewports where the
  // sidebar is present the content is narrower — columns only unlock once it
  // is actually wide enough (viewport >= 820 + 200).
  const contentWidth = width >= sidebarWebBreakpoint ? width - sidebarWebWidth : width
  return contentWidth >= wideWebBreakpoint
}

export function useSidebarWeb() {
  const { width } = useWindowDimensions()
  return isWeb && width >= sidebarWebBreakpoint
}

// Fades a shadow in/out as `active` flips — used by the sticky header and the
// bottom dock so the shadow appears smoothly on scroll instead of snapping.
// Returns an Animated opacity value to apply to a dedicated shadow layer:
// animating the layer's *opacity* works on every platform (web's Animated
// cannot emit an interpolated shadow* style into the DOM, so the layer keeps
// a static box-shadow and only its opacity animates).
export function useShadowFade(active, duration = 200) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? 1 : 0,
      duration,
      useNativeDriver: false,
    }).start()
  }, [active, anim, duration])
  return useMemo(() => anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }), [anim])
}

// Soft shadow applied under the sticky header once the content has scrolled
export const stickyHeaderShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.22,
  shadowRadius: 6,
  elevation: 3,
}

// Mirror of stickyHeaderShadow for the bottom dock: the shadow falls upward
// (shadowOffset height negative) so it appears above the dock, under the
// scrolled content — symmetric with the sticky header's bottom shadow.
export const dockShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -3 },
  shadowOpacity: 0.22,
  shadowRadius: 6,
  elevation: 3,
}

// Base layout of the sticky header — shared by every screen
// (StickyHeader component merges this with stickyHeaderShadow on scroll)
export const stickyHeaderStyle = {
  width: '100%',
  alignSelf: 'center',
  paddingHorizontal: 14,
  paddingTop: spacing.md,
}

export const fs = (n, scale = 1) => Math.round(n * scale)

export const tagColors = {
  fruit:    { bg: '#EF444433', border: '#EF444480', text: '#EF4444' },
  dessert:  { bg: '#F9731633', border: '#F9731680', text: '#F97316' },
  menthol:  { bg: '#10B98133', border: '#10B98180', text: '#10B981' },
  bakery:   { bg: '#D9770633', border: '#D9770680', text: '#D97706' },
  tobacco:  { bg: '#D6A36A33', border: '#D6A36A80', text: '#D6D3D1' },
  beverage: { bg: '#3B82F633', border: '#3B82F680', text: '#3B82F6' },
  candy:    { bg: '#EC489933', border: '#EC489980', text: '#EC4899' },
  floral:   { bg: '#8B5CF633', border: '#8B5CF680', text: '#C4B5FD' },
}

export const themeVariants = {
  ember: {
    key: 'ember',
    name: 'Ember',
    tag: 'Kehribar Cam',
    bg: '#0A0E1A',
    bgGradient: '#101729',
    card: 'rgba(255,255,255,0.09)',
    cardBorder: 'rgba(251,191,36,0.30)',
    border: 'rgba(255,255,255,0.12)',
    inputBg: 'rgba(255,255,255,0.05)',
    text: '#F5F2E8',
    textMuted: '#A8A39A',
    textDim: '#8B867D',
    primary: '#F59E0B',
    primaryLight: '#FBBF24',
    primaryDark: '#C07D06',
    accent: '#FDBA74',
    success: '#34D399',
    danger: '#F87171',
    warning: '#FBBF24',
    vg: '#22D3EE',
    glass: 'rgba(255,255,255,0.08)',
    glassBorder: 'rgba(255,255,255,0.16)',
    glassBorderStrong: 'rgba(251,191,36,0.30)',
    modalBg: '#0C1222',
    blob1: '#F59E0B',
    blob2: '#7C3AED',
    blob3: '#0EA5E9',
    tabBg: 'rgba(10,14,26,0.86)',
  },
  nebula: {
    key: 'nebula',
    name: 'Nebula',
    tag: 'Mor Cam',
    bg: '#0B0616',
    bgGradient: '#150A2B',
    card: 'rgba(255,255,255,0.09)',
    cardBorder: 'rgba(167,139,250,0.32)',
    border: 'rgba(255,255,255,0.12)',
    inputBg: 'rgba(255,255,255,0.05)',
    text: '#F2EFFB',
    textMuted: '#B3A9D6',
    textDim: '#9C93BF',
    primary: '#8B5CF6',
    primaryLight: '#A78BFA',
    primaryDark: '#6D3DF0',
    accent: '#E879F9',
    success: '#34D399',
    danger: '#F87171',
    warning: '#FBBF24',
    vg: '#22D3EE',
    glass: 'rgba(255,255,255,0.08)',
    glassBorder: 'rgba(255,255,255,0.16)',
    glassBorderStrong: 'rgba(167,139,250,0.32)',
    modalBg: '#100A26',
    blob1: '#8B5CF6',
    blob2: '#EC4899',
    blob3: '#06B6D4',
    tabBg: 'rgba(11,6,22,0.86)',
  },
  glacier: {
    key: 'glacier',
    name: 'Glacier',
    tag: 'Cam Buzu',
    bg: '#030E16',
    bgGradient: '#08222F',
    card: 'rgba(255,255,255,0.09)',
    cardBorder: 'rgba(34,211,238,0.30)',
    border: 'rgba(255,255,255,0.12)',
    inputBg: 'rgba(255,255,255,0.05)',
    text: '#ECF7FB',
    textMuted: '#9FC4D4',
    textDim: '#8FB0BE',
    primary: '#06B6D4',
    primaryLight: '#22D3EE',
    primaryDark: '#0891B2',
    accent: '#5EEAD4',
    success: '#34D399',
    danger: '#F87171',
    warning: '#FBBF24',
    vg: '#F472B6',
    glass: 'rgba(255,255,255,0.08)',
    glassBorder: 'rgba(255,255,255,0.16)',
    glassBorderStrong: 'rgba(34,211,238,0.32)',
    modalBg: '#071A28',
    blob1: '#06B6D4',
    blob2: '#8B5CF6',
    blob3: '#10B981',
    tabBg: 'rgba(3,14,22,0.86)',
  },
  obsidian: {
    key: 'obsidian',
    name: 'Obsidian',
    tag: 'OLED Siyah',
    bg: '#000000',
    bgGradient: '#050505',
    card: 'rgba(255,255,255,0.09)',
    cardBorder: 'rgba(255,255,255,0.32)',
    border: 'rgba(255,255,255,0.15)',
    inputBg: 'rgba(255,255,255,0.06)',
    text: '#FFFFFF',
    textMuted: '#B0B0B0',
    textDim: '#828282',
    primary: '#10B981',
    primaryLight: '#34D399',
    primaryDark: '#059669',
    accent: '#6EE7B7',
    success: '#34D399',
    danger: '#F87171',
    warning: '#FBBF24',
    vg: '#22D3EE',
    glass: 'rgba(255,255,255,0.09)',
    glassBorder: 'rgba(255,255,255,0.20)',
    glassBorderStrong: 'rgba(52,211,153,0.35)',
    modalBg: '#0B0B0B',
    blob1: '#10B981',
    blob2: '#3B82F6',
    blob3: '#8B5CF6',
    tabBg: 'rgba(0,0,0,0.92)',
  },
  contrast: {
    key: 'contrast',
    name: 'Contrast',
    tag: 'Yüksek Kontrast',
    bg: '#050505',
    bgGradient: '#0A0A0A',
    card: 'rgba(255,255,255,0.11)',
    cardBorder: 'rgba(255,255,255,0.45)',
    border: 'rgba(255,255,255,0.30)',
    inputBg: 'rgba(255,255,255,0.10)',
    text: '#FFFFFF',
    textMuted: '#D4D4D4',
    textDim: '#A3A3A3',
    primary: '#FACC15',
    primaryLight: '#FDE047',
    primaryDark: '#CA8A04',
    accent: '#FEF08A',
    success: '#4ADE80',
    danger: '#F87171',
    warning: '#FACC15',
    vg: '#60A5FA',
    glass: 'rgba(255,255,255,0.11)',
    glassBorder: 'rgba(255,255,255,0.38)',
    glassBorderStrong: 'rgba(250,204,21,0.55)',
    modalBg: '#0A0A0A',
    blob1: '#FACC15',
    blob2: '#4ADE80',
    blob3: '#60A5FA',
    tabBg: 'rgba(5,5,5,0.94)',
  },
  emberLight: {
    key: 'emberLight',
    name: 'Ember Light',
    tag: 'Açık Kehribar',
    bg: '#FAF5EB',
    bgGradient: '#F3EBDD',
    card: 'rgba(255,255,255,0.85)',
    cardBorder: 'rgba(180,83,9,0.22)',
    border: 'rgba(0,0,0,0.12)',
    inputBg: 'rgba(0,0,0,0.05)',
    text: '#292524',
    textMuted: '#57534E',
    textDim: '#8B8578',
    primary: '#B45309',
    primaryLight: '#D97706',
    primaryDark: '#92400E',
    accent: '#F59E0B',
    success: '#059669',
    danger: '#DC2626',
    warning: '#D97706',
    vg: '#0891B2',
    glass: 'rgba(255,255,255,0.65)',
    glassBorder: 'rgba(0,0,0,0.10)',
    glassBorderStrong: 'rgba(217,119,6,0.35)',
    modalBg: '#FFFFFF',
    blob1: '#FCD34D',
    blob2: '#C4B5FD',
    blob3: '#7DD3FC',
    tabBg: 'rgba(255,255,255,0.92)',
  },
  nebulaLight: {
    key: 'nebulaLight',
    name: 'Nebula Light',
    tag: 'Açık Mor Cam',
    bg: '#F6F3FC',
    bgGradient: '#EDE8F8',
    card: 'rgba(255,255,255,0.85)',
    cardBorder: 'rgba(109,40,217,0.22)',
    border: 'rgba(0,0,0,0.12)',
    inputBg: 'rgba(0,0,0,0.05)',
    text: '#1E1B4B',
    textMuted: '#4C4690',
    textDim: '#7C76AD',
    primary: '#7C3AED',
    primaryLight: '#6D28D9',
    primaryDark: '#5B21B6',
    accent: '#A855F7',
    success: '#059669',
    danger: '#DC2626',
    warning: '#D97706',
    vg: '#0891B2',
    glass: 'rgba(255,255,255,0.65)',
    glassBorder: 'rgba(0,0,0,0.10)',
    glassBorderStrong: 'rgba(124,58,237,0.35)',
    modalBg: '#FFFFFF',
    blob1: '#C4B5FD',
    blob2: '#F9A8D4',
    blob3: '#67E8F9',
    tabBg: 'rgba(255,255,255,0.92)',
  },
  glacierLight: {
    key: 'glacierLight',
    name: 'Glacier Light',
    tag: 'Açık Cam Buzu',
    bg: '#F0F9FC',
    bgGradient: '#E4F2F8',
    card: 'rgba(255,255,255,0.85)',
    cardBorder: 'rgba(8,145,178,0.22)',
    border: 'rgba(0,0,0,0.12)',
    inputBg: 'rgba(0,0,0,0.05)',
    text: '#164E63',
    textMuted: '#4B6B7B',
    textDim: '#7B97A6',
    primary: '#0891B2',
    primaryLight: '#0E7490',
    primaryDark: '#155E75',
    accent: '#06B6D4',
    success: '#059669',
    danger: '#DC2626',
    warning: '#D97706',
    vg: '#DB2777',
    glass: 'rgba(255,255,255,0.65)',
    glassBorder: 'rgba(0,0,0,0.10)',
    glassBorderStrong: 'rgba(8,145,178,0.35)',
    modalBg: '#FFFFFF',
    blob1: '#67E8F9',
    blob2: '#C4B5FD',
    blob3: '#6EE7B7',
    tabBg: 'rgba(255,255,255,0.92)',
  },
  obsidianLight: {
    key: 'obsidianLight',
    name: 'Obsidian Light',
    tag: 'Açık OLED',
    bg: '#F4F7F5',
    bgGradient: '#E9F0EC',
    card: 'rgba(255,255,255,0.85)',
    cardBorder: 'rgba(4,120,87,0.22)',
    border: 'rgba(0,0,0,0.12)',
    inputBg: 'rgba(0,0,0,0.05)',
    text: '#134E4A',
    textMuted: '#4F6360',
    textDim: '#80908D',
    primary: '#059669',
    primaryLight: '#10B981',
    primaryDark: '#047857',
    accent: '#34D399',
    success: '#059669',
    danger: '#DC2626',
    warning: '#D97706',
    vg: '#0891B2',
    glass: 'rgba(255,255,255,0.65)',
    glassBorder: 'rgba(0,0,0,0.10)',
    glassBorderStrong: 'rgba(5,150,105,0.35)',
    modalBg: '#FFFFFF',
    blob1: '#6EE7B7',
    blob2: '#93C5FD',
    blob3: '#C4B5FD',
    tabBg: 'rgba(255,255,255,0.92)',
  },
  contrastLight: {
    key: 'contrastLight',
    name: 'Contrast Light',
    tag: 'Açık Yüksek Kontrast',
    bg: '#FDFDF8',
    bgGradient: '#F7F7EE',
    card: 'rgba(255,255,255,0.9)',
    cardBorder: 'rgba(161,98,7,0.25)',
    border: 'rgba(0,0,0,0.18)',
    inputBg: 'rgba(0,0,0,0.06)',
    text: '#1C1917',
    textMuted: '#57534E',
    textDim: '#87837C',
    primary: '#A16207',
    primaryLight: '#CA8A04',
    primaryDark: '#854D0E',
    accent: '#FACC15',
    success: '#15803D',
    danger: '#B91C1C',
    warning: '#B45309',
    vg: '#2563EB',
    glass: 'rgba(255,255,255,0.75)',
    glassBorder: 'rgba(0,0,0,0.14)',
    glassBorderStrong: 'rgba(202,138,4,0.45)',
    modalBg: '#FFFFFF',
    blob1: '#FDE047',
    blob2: '#86EFAC',
    blob3: '#93C5FD',
    tabBg: 'rgba(255,255,255,0.95)',
  },
}


export const colors = themeVariants.ember
