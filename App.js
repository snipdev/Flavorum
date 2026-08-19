import { StatusBar } from 'expo-status-bar'
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity, useWindowDimensions, Image } from 'react-native'
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEffect, useRef, useCallback } from 'react'
import * as NavigationBar from 'expo-navigation-bar'
import { useFonts } from 'expo-font'
import { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import NicotineScreen from './src/screens/NicotineScreen'
import BatchScreen from './src/screens/BatchScreen'
import RecipesScreen from './src/screens/RecipesScreen'
import FlavorLibraryScreen from './src/screens/FlavorLibraryScreen'
import AnalyticsScreen from './src/screens/AnalyticsScreen'
import PricesScreen from './src/screens/PricesScreen'
import { ThemeProvider, useTheme } from './src/ThemeContext'
import ThemeToggle from './src/components/ThemeToggle'
import LangToggle from './src/components/LangToggle'
import { webMaxWidth, wideWebMaxWidth, sidebarWebWidth, isWeb, useLayoutMode } from './src/theme'
import { LanguageProvider, useI18n } from './src/i18n'
import { hapticLight } from './src/utils/haptics'

const Tab = createBottomTabNavigator()

const tabs = [
  { key: 'build', icon: 'flask', component: NicotineScreen },
  { key: 'batches', icon: 'layers', component: BatchScreen },
  { key: 'recipes', icon: 'bookmark', component: RecipesScreen },
  { key: 'flavors', icon: 'leaf', component: FlavorLibraryScreen },
  { key: 'prices', icon: 'pricetag', component: PricesScreen },
  { key: 'analytics', icon: 'bar-chart', component: AnalyticsScreen },
]

export default function App() {
  const [fontsLoaded] = useFonts({
    Ionicons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
  })

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AppInner />
        </ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  )
}

const navRef = createNavigationContainerRef()

function AppInner() {
  const { theme } = useTheme()
  const [routeName, setRouteName] = useState('build')

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(theme.bg).catch(() => {})
      NavigationBar.setButtonStyleAsync('light').catch(() => {})
    }
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'expo-vector-icons-web-fonts'
      if (!document.getElementById(styleId)) {
        try {
          let localIonicons = ''
          try {
            const asset = require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf')
            localIonicons = typeof asset === 'string' ? asset : (asset?.default || '')
          } catch {}

          const cdnIonicons = 'https://cdn.jsdelivr.net/npm/@expo/vector-icons@15.0.2/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'
          const cdnMaterial = 'https://cdn.jsdelivr.net/npm/@expo/vector-icons@15.0.2/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'
          const cdnFontAwesome = 'https://cdn.jsdelivr.net/npm/@expo/vector-icons@15.0.2/build/vendor/react-native-vector-icons/Fonts/FontAwesome.ttf'

          const srcIonicons = localIonicons ? `url('${localIonicons}') format('truetype'), url('${cdnIonicons}') format('truetype')` : `url('${cdnIonicons}') format('truetype')`

          const style = document.createElement('style')
          style.id = styleId
          style.type = 'text/css'
          style.appendChild(document.createTextNode(`
            @font-face {
              font-family: 'Ionicons';
              src: ${srcIonicons};
            }
            @font-face {
              font-family: 'ionicons';
              src: ${srcIonicons};
            }
            @font-face {
              font-family: 'MaterialIcons';
              src: url('${cdnMaterial}') format('truetype');
            }
            @font-face {
              font-family: 'FontAwesome';
              src: url('${cdnFontAwesome}') format('truetype');
            }
          `))
          document.head.appendChild(style)
        } catch (e) {
          console.warn('Font face injection warning:', e)
        }
      }

      // Desktop interaction polish, injected once: hover/press feedback on
      // every clickable element plus a visible keyboard focus ring. RN-web
      // marks every touchable with its cursor utility classes
      // (`.r-cursor-…`, all `pointer` in this app), so one global rule covers
      // buttons, cards, sidebar items and chips alike — no per-component
      // plumbing needed. The focus ring color follows the active theme
      // through the --fl-focus CSS variable set just below.
      const interactionId = 'flavorum-web-interactions'
      if (!document.getElementById(interactionId)) {
        const iStyle = document.createElement('style')
        iStyle.id = interactionId
        iStyle.type = 'text/css'
        iStyle.appendChild(document.createTextNode(`
          [class*="r-cursor-"]:not(input):not(textarea) {
            transition: filter 0.15s ease !important;
          }
          [class*="r-cursor-"]:not(input):not(textarea):hover {
            filter: brightness(1.12);
          }
          [class*="r-cursor-"]:not(input):not(textarea):active {
            filter: brightness(0.94);
          }
          :focus-visible {
            outline: 2px solid var(--fl-focus, #FBBF24) !important;
            outline-offset: 2px;
          }
        `))
        document.head.appendChild(iStyle)
      }
      document.documentElement.style.setProperty('--fl-focus', theme.primaryLight)
    }
  }, [theme.bg])

  return (
    <NavigationContainer
      ref={navRef}
      documentTitle={{ enabled: false }}
      onStateChange={() => {
        if (navRef.isReady()) setRouteName(navRef.getCurrentRoute()?.name || 'build')
      }}
    >
      <StatusBar style="light" backgroundColor={theme.bg} />
      {isWeb ? (
        <View style={[styles.webContainer, { backgroundColor: theme.bg }]}>
          <WebShell routeName={routeName} />
        </View>
      ) : (
        <TabNavigator />
      )}
    </NavigationContainer>
  )
}

// Desktop shell: a fixed left sidebar replaces the mobile bottom tab bar on
// large viewports. The content wrapper stays centered with its own max width,
// so the two-column screen layouts keep their proportions.
function WebShell({ routeName }) {
  const { desktop, wide, contentWidth } = useLayoutMode()
  if (desktop) {
    // Desktop viewports: left sidebar replaces the bottom bar. The wrapper
    // is fluid — it fills whatever room the sidebar leaves (up to the wide
    // max width) instead of parking a fixed phone-width column beside the
    // sidebar with dead space on the right. Once the content is wide enough
    // the screens switch to two columns inside that same full width.
    const width = Math.min(Math.max(contentWidth, 320), wideWebMaxWidth)
    return (
      <View style={styles.desktopRow}>
        <DesktopSidebar routeName={routeName} />
        <View style={styles.desktopMain}>
          <View style={[styles.webWrapper, { maxWidth: width }]}>
            <TabNavigator />
          </View>
        </View>
      </View>
    )
  }
  // Medium viewports: the screens switch to two-column layouts at the wide
  // breakpoint but the bottom tab bar stays — so the wrapper must widen too.
  return (
    <View style={[styles.webWrapper, wide && styles.webWrapperWide]}>
      <TabNavigator />
    </View>
  )
}

// Sidebar navigation + app chrome (theme/language) for the desktop shell.
// Works both as the navigator's tabBar (gets state/navigation) and as a
// standalone shell element (uses routeName + the global navRef).
function DesktopSidebar({ routeName, state, navigation }) {
  const { t } = useI18n()
  const { theme, textScale } = useTheme()
  const styles = createStyles(theme, textScale)
  const active = state ? state.routes[state.index]?.name : routeName
  const go = (name) => {
    hapticLight()
    if (navigation) navigation.navigate(name)
    else if (navRef.isReady()) navRef.navigate(name)
  }
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarBrand}>
        <Image source={require('./assets/flavorum.png')} style={styles.sidebarLogo} resizeMode="contain" />
        <Text style={styles.sidebarBrandText}>Flavorum</Text>
      </View>

      <View style={styles.sidebarNav}>
        {tabs.map(tab => {
          const focused = active === tab.key
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.sidebarItem, focused && styles.sidebarItemActive]}
              onPress={() => go(tab.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
            >
              <Ionicons name={tab.icon} size={17} color={focused ? theme.primaryLight : theme.textDim} />
              <Text style={[styles.sidebarItemText, focused && styles.sidebarItemTextActive]}>
                {t(`tab.${tab.key}`)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <View style={styles.sidebarFooter}>
        <ThemeToggle />
        <LangToggle />
      </View>
    </View>
  )
}

// Scrollable bottom tab bar for mobile/narrow web viewports. The tabs keep a
// comfortable minimum width and spread evenly when they fit; on very narrow
// screens the bar scrolls horizontally instead of squeezing the labels.
function MobileTabBar({ state, descriptors, navigation, insets }) {
  const { t } = useI18n()
  const { theme, textScale } = useTheme()
  const safe = useSafeAreaInsets()
  const styles = createStyles(theme, textScale)
  const bottomPad = insets?.bottom ?? safe.bottom
  const web = Platform.OS === 'web'
  // 6 labeled tabs need 504px (6×72 + margins). Below that the labels are
  // hidden and the bar becomes a compact icon-only row — every tab stays
  // visible without scrolling (the scroll/arrows remain as a fallback for
  // ultra-narrow viewports below the icon-only minimum).
  const { width: winWidth } = useWindowDimensions()
  const compact = winWidth < 504
  const scrollRef = useRef(null)
  const [showArrows, setShowArrows] = useState({ left: false, right: false })

  // Refresh the edge-arrow visibility from the scroll position of the bar.
  const updateArrows = useCallback(() => {
    const node = scrollRef.current?.getScrollableNode?.()
    if (!node) return
    const left = node.scrollLeft > 2
    const right = node.scrollLeft + node.clientWidth < node.scrollWidth - 2
    setShowArrows(prev => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [])

  // Measure once after mount so the right arrow appears when tabs overflow.
  useEffect(() => {
    const id = setTimeout(updateArrows, 80)
    return () => clearTimeout(id)
  }, [updateArrows])

  // Desktop: a vertical mouse wheel over the tab bar scrolls the tabs
  // horizontally (the native overflow only reacts to horizontal gestures).
  const handleWheel = useCallback((e) => {
    const node = scrollRef.current?.getScrollableNode?.()
    if (!node) return
    const dy = e.deltaY ?? e.nativeEvent?.deltaY ?? 0
    const dx = e.deltaX ?? e.nativeEvent?.deltaX ?? 0
    const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
    if (!delta) return
    const max = node.scrollWidth - node.clientWidth
    const next = Math.max(0, Math.min(node.scrollLeft + delta, max))
    if (next === node.scrollLeft) return
    node.scrollLeft = next
    // Note: no preventDefault here — the listener is passive, so it would
    // throw. The page may scroll vertically at the same time, which is fine.
    updateArrows()
  }, [updateArrows])

  const scrollByPage = useCallback((dir) => {
    const node = scrollRef.current?.getScrollableNode?.()
    if (!node) return
    const max = node.scrollWidth - node.clientWidth
    const target = Math.max(0, Math.min(node.scrollLeft + dir * (node.clientWidth - 72), max))
    if (typeof node.scroll === 'function') node.scroll({ left: target, behavior: 'smooth' })
    else node.scrollLeft = target
  }, [])

  return (
    <View
      style={[styles.mobileTabBar, { backgroundColor: theme.tabBg, paddingBottom: bottomPad }]}
      accessibilityRole="tablist"
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={updateArrows}
        scrollEventThrottle={16}
        contentContainerStyle={styles.mobileTabContent}
        {...(web ? { onWheel: handleWheel } : {})}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index
          const tab = tabs.find(x => x.key === route.name)
          const { options } = descriptors[route.key]
          const label = options.tabBarLabel ?? t(`tab.${route.name}`)
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              aria-selected={focused}
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
                if (!focused && !ev.defaultPrevented) navigation.navigate(route.name)
              }}
              style={[styles.mobileTabItem, compact && styles.mobileTabItemCompact, focused && { backgroundColor: theme.primary + '26' }]}
              activeOpacity={0.7}
            >
              <Ionicons name={tab?.icon} size={compact ? 20 : 22} color={focused ? theme.primaryLight : theme.textDim} />
              {!compact && (
                <Text style={[styles.mobileTabLabel, { color: focused ? theme.primaryLight : theme.textDim }]}>
                  {label}
                </Text>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      {web && showArrows.left && (
        <View style={[styles.tabArrow, { left: 2, pointerEvents: 'none' }]}>
          <TouchableOpacity
            style={[styles.tabArrowBtn, { pointerEvents: 'auto' }]}
            onPress={() => scrollByPage(-1)}
            accessibilityRole="button"
            accessibilityLabel={t('tab.scrollLeft')}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={15} color={theme.primaryLight} />
          </TouchableOpacity>
        </View>
      )}
      {web && showArrows.right && (
        <View style={[styles.tabArrow, { right: 2, pointerEvents: 'none' }]}>
          <TouchableOpacity
            style={[styles.tabArrowBtn, { pointerEvents: 'auto' }]}
            onPress={() => scrollByPage(1)}
            accessibilityRole="button"
            accessibilityLabel={t('tab.scrollRight')}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={15} color={theme.primaryLight} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// The bottom tab bar stays for mobile/medium widths; on desktop viewports
// WebShell renders the left sidebar and this bar renders nothing at all.
function ResponsiveTabBar(props) {
  const { desktop } = useLayoutMode()
  if (desktop) return null
  return <MobileTabBar {...props} />
}

function TabNavigator() {
  const { t } = useI18n()
  const { theme } = useTheme()
  return (
    <Tab.Navigator
      tabBar={props => <ResponsiveTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.tabBg,
          borderTopWidth: 0,
        },
        tabBarActiveTintColor: theme.primaryLight,
        tabBarInactiveTintColor: theme.textDim,
        tabBarIcon: ({ color, focused }) => {
          const tab = tabs.find(x => x.key === route.name)
          return <Ionicons name={tab?.icon} size={22} color={color} />
        },
        tabBarLabel: t(`tab.${route.name}`),
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 1 },
        tabBarItemStyle: { borderRadius: 12, marginHorizontal: 6, marginVertical: 6 },
        tabBarActiveBackgroundColor: theme.primary + '26',
        tabBarIconStyle: { marginTop: 2 },
      })}
    >
      {tabs.map(tab => (
        <Tab.Screen
          key={tab.key}
          name={tab.key}
          component={tab.component}
          listeners={{ tabPress: () => hapticLight() }}
        />
      ))}
    </Tab.Navigator>
  )
}

const createStyles = (colors, scale = 1) => StyleSheet.create({
  sidebar: {
    width: sidebarWebWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: 12,
    gap: 18,
  },
  sidebarBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6 },
  sidebarLogo: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F3EDE1', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 4 },
  sidebarBrandText: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  sidebarNav: { flex: 1, gap: 3 },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sidebarItemActive: { backgroundColor: colors.primary + '26' },
  sidebarItemText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  sidebarItemTextActive: { color: colors.primaryLight },
  sidebarFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  mobileTabBar: {
    borderTopWidth: 0,
    width: '100%',
  },
  mobileTabContent: {
    flexGrow: 1,
  },
  // Edge arrows on the scrollable tab bar: shown only while tabs overflow.
  // The wrapper spans the bar height but ignores pointer events — only the
  // small circular button is interactive.
  tabArrow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  tabArrowBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  mobileTabItem: {
    flex: 1,
    minWidth: 72,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 12,
    marginHorizontal: 6,
    marginVertical: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  // Icon-only variant (narrow viewports): slimmer so all six tabs fit.
  mobileTabItemCompact: {
    minWidth: 44,
    minHeight: 42,
    marginHorizontal: 3,
    paddingHorizontal: 4,
  },
  mobileTabLabel: { fontSize: 10, fontWeight: '600', marginTop: 1 },
})

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    alignItems: 'center',
  },
  webWrapper: {
    width: '100%',
    maxWidth: webMaxWidth,
    flex: 1,
  },
  webWrapperNarrow: {
    alignSelf: 'center',
  },
  webWrapperWide: {
    maxWidth: wideWebMaxWidth,
  },
  desktopRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
  },
  desktopMain: {
    flex: 1,
    alignItems: 'center',
  },
})
