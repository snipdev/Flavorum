import { Platform } from 'react-native'

export const colors = {
  primary: '#c59206',
  primaryLight: '#dbaa2e',
  primaryDark: '#a87a05',
  bg: '#0c1830',
  bgGradient: '#0f1e3a',
  card: '#152238',
  cardBorder: 'rgba(197, 146, 6, 0.22)',
  border: 'rgba(197, 146, 6, 0.14)',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textDim: '#64748B',
  accent: '#dbaa2e',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  inputBg: '#101d36',
  tabBarBg: 'rgba(21, 34, 56, 0.98)',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const webMaxWidth = 580
export const isWeb = Platform.OS === 'web'

export const shadows = {
  card: {
    shadowColor: '#c59206',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: '#c59206',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
}
