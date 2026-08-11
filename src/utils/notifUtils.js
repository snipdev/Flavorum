/**
 * notifUtils.js — Expo Notifications helper for steep reminders
 * Works on iOS/Android native. On web, falls back to a console simulation.
 */
import { Platform } from 'react-native'

let Notifications = null
try {
  // Dynamic import to avoid crashing on web
  Notifications = require('expo-notifications')
} catch {}

/**
 * Request notification permissions.
 * Returns true if granted, false otherwise.
 */
export async function requestNotifPermission() {
  if (Platform.OS === 'web' || !Notifications) return false
  try {
    const { status } = await Notifications.requestPermissionsAsync()
    return status === 'granted'
  } catch {
    return false
  }
}

const NOTIF_STRINGS = {
  en: {
    title: 'Flavorum — Steep Complete! 🎉',
    body: (name) => `"${name}" is ready to vape, tasting time!`,
    log: (name, fireAt, days) => `[Notif Sim] "${name}" reminder: ${fireAt.toLocaleString()} (${days} days)`,
  },
  tr: {
    title: 'Flavorum — Demlenme Tamam! 🎉',
    body: (name) => `"${name}" içime hazır, tadım vakti!`,
    log: (name, fireAt, days) => `[Notif Sim] "${name}" hatırlatıcı: ${fireAt.toLocaleString()} (${days} gün)`,
  },
}

/**
 * Schedule a steep-ready notification for a batch.
 * @param {string} batchName - Name of the batch
 * @param {number} steepDays - Number of days to steep
 * @param {string} createdAt  - ISO date string of batch creation
 * @param {string} [lang]     - 'en' | 'tr' language for the notification text
 * @returns {string | null} Notification identifier or null on failure
 */
export async function scheduleSteepNotification(batchName, steepDays, createdAt, lang = 'en') {
  const S = NOTIF_STRINGS[lang] || NOTIF_STRINGS.en

  if (Platform.OS === 'web' || !Notifications) {
    const fireAt = new Date(new Date(createdAt).getTime() + steepDays * 24 * 60 * 60 * 1000)
    console.log(S.log(batchName, fireAt, steepDays))
    return '__web_sim__'
  }

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })

    const triggerDate = new Date(new Date(createdAt).getTime() + steepDays * 24 * 60 * 60 * 1000)
    // If the date is in the past, schedule for 5 seconds from now as a test
    const now = new Date()
    const finalTrigger = triggerDate > now ? triggerDate : new Date(now.getTime() + 5000)

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: S.title,
        body: S.body(batchName),
        sound: true,
      },
      trigger: finalTrigger,
    })
    return id
  } catch (e) {
    console.warn('[Notif] Scheduled notification failed:', e)
    return null
  }
}

/**
 * Cancel a scheduled notification by its identifier.
 */
export async function cancelNotification(notifId) {
  if (!notifId || notifId === '__web_sim__' || !Notifications) return
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId)
  } catch {}
}
