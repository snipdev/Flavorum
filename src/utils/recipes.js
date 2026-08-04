import AsyncStorage from '@react-native-async-storage/async-storage'
import { STARTER_RECIPES } from './seedRecipes'

export const STORAGE_KEY = 'flavorum_recipes'
const SEED_FLAG_KEY = 'flavorum_recipes_seeded'
const SEED_VERSION = 3

export async function loadRecipes() {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY)
    if (!json) return []
    const data = JSON.parse(json)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function seedStarterRecipes() {
  try {
    const stored = await AsyncStorage.getItem(SEED_FLAG_KEY)
    const seededVersion = stored ? parseInt(stored, 10) || 0 : 0
    if (seededVersion >= SEED_VERSION) return
    const current = await loadRecipes()
    const existingIds = new Set(current.map(r => r.id))
    const toAdd = STARTER_RECIPES.filter(r => !existingIds.has(r.id))
    if (toAdd.length > 0) {
      await saveRecipes([...current, ...toAdd])
    }
    await AsyncStorage.setItem(SEED_FLAG_KEY, String(SEED_VERSION))
  } catch {}
}

export async function saveRecipes(recipes) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(recipes))
  } catch {}
}

export function newRecipeId() {
  return Date.now()
}

export const BATCHES_KEY = 'flavorum_batches'

export async function loadBatches() {
  try {
    const json = await AsyncStorage.getItem(BATCHES_KEY)
    if (!json) return []
    const data = JSON.parse(json)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function saveBatches(batches) {
  try {
    await AsyncStorage.setItem(BATCHES_KEY, JSON.stringify(batches))
  } catch {}
}

export function newBatchId() {
  return Date.now()
}

export const CUSTOM_FLAVORS_KEY = 'flavorum_custom_flavors'

export async function loadCustomFlavors() {
  try {
    const json = await AsyncStorage.getItem(CUSTOM_FLAVORS_KEY)
    if (!json) return []
    const data = JSON.parse(json)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function saveCustomFlavors(names) {
  try {
    await AsyncStorage.setItem(CUSTOM_FLAVORS_KEY, JSON.stringify(names))
  } catch {}
}
