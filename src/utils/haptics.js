import { Platform, Vibration } from 'react-native'
import * as Haptics from 'expo-haptics'

// Light tactile feedback for taps.
//  - iOS & Android: real haptics via expo-haptics (UIImpactFeedbackGenerator /
//    Android vibration pattern).
//  - Web: navigator.vibrate (Vibration API).
// Always wrapped so feedback can never break UI.
export function hapticLight() {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(8)
      }
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // expo-haptics failed on this device — fall back to Android Vibration
      if (Platform.OS === 'android') Vibration.vibrate(8)
    })
  } catch (e) {
    // ignore — haptics are a nice-to-have
  }
}
