import { StatusBar } from 'expo-status-bar'
import { View, StyleSheet, Platform } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useEffect } from 'react'
import * as NavigationBar from 'expo-navigation-bar'
import { useFonts } from 'expo-font'
import { Ionicons } from '@expo/vector-icons'
import NicotineScreen from './src/screens/NicotineScreen'
import BatchScreen from './src/screens/BatchScreen'
import RecipesScreen from './src/screens/RecipesScreen'
import FlavorLibraryScreen from './src/screens/FlavorLibraryScreen'
import AnalyticsScreen from './src/screens/AnalyticsScreen'
import { ThemeProvider, useTheme } from './src/ThemeContext'
import { webMaxWidth, isWeb } from './src/theme'
import { LanguageProvider, useI18n } from './src/i18n'

const Tab = createBottomTabNavigator()

const tabs = [
  { key: 'build', icon: 'flask', component: NicotineScreen },
  { key: 'batches', icon: 'layers', component: BatchScreen },
  { key: 'recipes', icon: 'bookmark', component: RecipesScreen },
  { key: 'flavors', icon: 'leaf', component: FlavorLibraryScreen },
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

function AppInner() {
  const { theme } = useTheme()

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
    }
  }, [theme.bg])

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={theme.bg} />
      {isWeb ? (
        <View style={[styles.webContainer, { backgroundColor: theme.bg }]}>
          <View style={styles.webWrapper}>
            <TabNavigator />
          </View>
        </View>
      ) : (
        <TabNavigator />
      )}
    </NavigationContainer>
  )
}

function TabNavigator() {
  const { t } = useI18n()
  const { theme } = useTheme()
  return (
    <Tab.Navigator
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
        <Tab.Screen key={tab.key} name={tab.key} component={tab.component} />
      ))}
    </Tab.Navigator>
  )
}

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
})
