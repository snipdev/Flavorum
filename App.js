import { StatusBar } from 'expo-status-bar'
import { View, StyleSheet, Platform } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useEffect } from 'react'
import * as NavigationBar from 'expo-navigation-bar'
import { Ionicons } from '@expo/vector-icons'
import NicotineScreen from './src/screens/NicotineScreen'
import BatchScreen from './src/screens/BatchScreen'
import RecipesScreen from './src/screens/RecipesScreen'
import FlavorLibraryScreen from './src/screens/FlavorLibraryScreen'
import { colors, webMaxWidth, isWeb } from './src/theme'
import { LanguageProvider, useI18n } from './src/i18n'

const Tab = createBottomTabNavigator()

const tabs = [
  { key: 'build', icon: 'flask', component: NicotineScreen },
  { key: 'batches', icon: 'layers', component: BatchScreen },
  { key: 'recipes', icon: 'bookmark', component: RecipesScreen },
  { key: 'flavors', icon: 'leaf', component: FlavorLibraryScreen },
]

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(colors.bg).catch(() => {})
      NavigationBar.setButtonStyleAsync('light').catch(() => {})
    }
  }, [])

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <NavigationContainer>
          <StatusBar style="light" backgroundColor={colors.bg} />
          {isWeb ? (
            <View style={styles.webContainer}>
              <View style={styles.webWrapper}>
                <TabNavigator />
              </View>
            </View>
          ) : (
            <TabNavigator />
          )}
        </NavigationContainer>
      </LanguageProvider>
    </SafeAreaProvider>
  )
}

function TabNavigator() {
  const { t } = useI18n()
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#152238',
          borderTopWidth: 0,
        },
        tabBarActiveTintColor: colors.primaryLight,
        tabBarInactiveTintColor: colors.textDim,
        tabBarIcon: ({ color, focused }) => {
          const tab = tabs.find(x => x.key === route.name)
          return <Ionicons name={tab?.icon} size={22} color={color} />
        },
        tabBarLabel: t(`tab.${route.name}`),
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 1 },
        tabBarItemStyle: { borderRadius: 12, marginHorizontal: 6, marginVertical: 6 },
        tabBarActiveBackgroundColor: 'rgba(124, 58, 237, 0.15)',
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
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  webWrapper: {
    width: '100%',
    maxWidth: webMaxWidth,
    flex: 1,
    ...Platform.OS === 'web' ? { boxShadow: '0 0 60px rgba(124, 58, 237, 0.08)' } : {},
  },
})
