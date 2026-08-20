import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fs, spacing, font } from '../theme'
import { useTheme } from '../ThemeContext'
import ThemeToggle from './ThemeToggle'
import LangToggle from './LangToggle'
import FontToggle from './FontToggle'

/**
 * Shared screen header (hero) block used by every tab screen. On desktop the
 * icon and the theme/language toggles are hidden (the sidebar provides them);
 * on mobile/medium widths they render. `subtitleNumberOfLines` is optional
 * (defaults to the natural single-line/2-line behavior per screen).
 */
export default function ScreenHero({ icon, title, subtitle, subtitleNumberOfLines, desktop }) {
  const { theme: colors, textScale } = useTheme()
  const styles = createStyles(colors, textScale)
  return (
    <View style={[styles.hero, desktop && styles.heroDesktop]}>
      {!desktop && (
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={20} color={colors.primaryLight} />
        </View>
      )}
      <View style={styles.heroText}>
        <Text style={[styles.title, desktop && styles.titleDesktop]}>{title}</Text>
        {subtitle != null && (
          <Text
            style={styles.subtitle}
            {...(subtitleNumberOfLines ? { numberOfLines: subtitleNumberOfLines } : {})}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {!desktop && (
        <View style={styles.heroRight}>
          <ThemeToggle />
          <FontToggle />
          <LangToggle />
        </View>
      )}
    </View>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  heroDesktop: { marginBottom: spacing.sm },
  heroText: { flex: 1, flexShrink: 1 },
  heroRight: { marginLeft: 'auto', flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: fs(23, scale), ...font('700'), color: colors.text, letterSpacing: -0.5 },
  titleDesktop: { fontSize: fs(18, scale) },
  subtitle: { fontSize: fs(13, scale), color: colors.textMuted, marginTop: 1 },
})