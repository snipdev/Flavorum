import AsyncStorage from '@react-native-async-storage/async-storage'

// Every user-data key that should be part of a backup. Settings (theme,
// language, seed flags) are intentionally excluded.
export const BACKUP_KEYS = {
  recipes: 'flavorum_recipes',
  batches: 'flavorum_batches',
  prices: 'flavorum_prices',
  customFlavors: 'flavorum_custom_flavors',
  inventory: 'flavorum_inventory',
  inventoryMeta: 'flavorum_inventory_meta',
  flavorRecs: 'flavorum_flavor_recs',
}

/** Reads every data key and returns a pretty JSON backup string. */
export async function buildBackup() {
  const data = {}
  for (const [name, key] of Object.entries(BACKUP_KEYS)) {
    const raw = await AsyncStorage.getItem(key)
    if (raw != null) {
      try { data[name] = JSON.parse(raw) } catch { data[name] = null }
    }
  }
  return JSON.stringify({
    app: 'flavorum',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }, null, 2)
}

/** Validates a backup JSON string and writes every key back to storage. */
export async function restoreBackup(json) {
  let parsed
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON')
  }
  if (!parsed || parsed.app !== 'flavorum' || !parsed.data || typeof parsed.data !== 'object') {
    throw new Error('Not a Flavorum backup')
  }
  for (const [name, key] of Object.entries(BACKUP_KEYS)) {
    if (name in parsed.data && parsed.data[name] != null) {
      await AsyncStorage.setItem(key, JSON.stringify(parsed.data[name]))
    }
  }
  return true
}

/** Downloads a string as a file (web only). */
export function downloadTextFile(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8;` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
