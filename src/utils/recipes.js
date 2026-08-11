import AsyncStorage from '@react-native-async-storage/async-storage'
import { STARTER_RECIPES } from './seedRecipes'

export const STORAGE_KEY = 'flavorum_recipes'
const SEED_FLAG_KEY = 'flavorum_recipes_seeded'
const SEED_VERSION = 8

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

export const FLAVOR_RECS_KEY = 'flavorum_flavor_recs'

/**
 * Loads per-flavor recommended percentages:
 * { [flavorName]: { avg: number, mode?: number, count: number } }
 */
export async function loadFlavorRecs() {
  try {
    const json = await AsyncStorage.getItem(FLAVOR_RECS_KEY)
    if (!json) return {}
    const data = JSON.parse(json)
    return (data && typeof data === 'object') ? data : {}
  } catch {
    return {}
  }
}

export async function saveFlavorRecs(recs) {
  try {
    await AsyncStorage.setItem(FLAVOR_RECS_KEY, JSON.stringify(recs))
  } catch {}
}

/**
 * Recomputes recommended % from recipes and merges into existing recs.
 * Entries flagged `manual: true` are kept untouched. Returns the merged map.
 */
export function mergeRecsFromRecipes(recipes, currentRecs) {
  const averages = computeFlavorAverages(recipes)
  const next = { ...(currentRecs || {}) }
  for (const key in averages) {
    const prev = next[key]
    if (prev && prev.manual) continue
    next[key] = { avg: averages[key].avg, mode: averages[key].mode, count: averages[key].count, values: averages[key].values }
  }
  return next
}

/** Recomputes recs from recipes, persists them, and returns the new map. */
export async function recomputeFlavorRecs(recipes, currentRecs) {
  const next = mergeRecsFromRecipes(recipes, currentRecs)
  await saveFlavorRecs(next)
  return next
}

export const normFlavorKey = (name) => (name || '').trim().toLowerCase()

/** Normalized key ignoring concentration suffixes like "5%", "0.5%" so that
 * recipe names ("Acetyl Pyrazine 5% (TPA)") match library names
 * ("Acetyl Pyrazine (TPA)"). */
export const normRecKey = (name) =>
  (name || '')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\d+(?:\.\d+)?%(\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Looks up a rec by exact normalized key first, then by concentration-free key. */
export function findRec(recs, name) {
  if (!recs || !name) return null
  const exact = recs[normFlavorKey(name)]
  if (exact) return exact
  const free = normRecKey(name)
  if (free) {
    for (const key in recs) {
      if (normRecKey(key) === free) return recs[key]
    }
  }
  return null
}

/**
 * Returns the mode (most frequent value) of a numeric list, or null when
 * every value is unique (no repetition). On ties, prefers the value closest
 * to the mean; if still tied, prefers the larger value.
 */
function computeMode(values) {
  if (!values.length) return null
  const freq = {}
  for (const v of values) freq[v] = (freq[v] || 0) + 1
  const max = Math.max(...Object.values(freq))
  if (max === 1) return null
  const modes = Object.keys(freq).filter(k => freq[k] === max).map(Number)
  if (modes.length === 1) return modes[0]
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  modes.sort((a, b) => {
    const da = Math.abs(a - mean)
    const db = Math.abs(b - mean)
    if (da !== db) return da - db
    return b - a
  })
  return modes[0]
}

/** The value to suggest/autofill for a rec entry. Mode (most used % in recipes)
 * is preferred; a single-use flavor recommends its own value. Returns null when
 * there are multiple distinct values with no repeat (no single suggestion). */
export function getRecValue(rec) {
  if (!rec) return null
  if (rec.manual && rec.avg != null && rec.avg > 0) return rec.avg
  if (rec.mode != null && rec.mode > 0) return rec.mode
  if (Array.isArray(rec.values) && rec.values.length === 1 && rec.values[0] > 0) return rec.values[0]
  return null
}

/** Values to display for a rec entry: the mode when one exists, otherwise all
 * distinct % values used in recipes (so the user can see every option). */
export function getRecValues(rec) {
  if (!rec) return []
  if (rec.manual && rec.avg != null && rec.avg > 0) return [rec.avg]
  if (rec.mode != null && rec.mode > 0) return [rec.mode]
  if (Array.isArray(rec.values) && rec.values.length > 0) return rec.values
  return []
}

/** Human-readable label for a rec entry, e.g. "3.5%" or "3.5% · 3%". */
export function formatRecValues(rec) {
  return getRecValues(rec).map(v => `${v}%`).join(' · ')
}

/**
 * Computes per-flavor usage stats across saved recipes:
 * returns { [normalizedKey]: { avg, mode, count, values } } where avg = mean % used
 * (rounded to 2 decimals, kept for reference only), mode = most frequent % used
 * (null if all distinct), values = sorted distinct % values used, and count =
 * number of recipes using that flavor.
 * Pass excludeId to skip the recipe currently being edited.
 */
export function computeFlavorAverages(recipes, excludeId = null) {
  const valuesByKey = {}
  const counts = {}
  for (const r of Array.isArray(recipes) ? recipes : []) {
    if (excludeId != null && r.id === excludeId) continue
    if (!Array.isArray(r.flavors)) continue
    for (const f of r.flavors) {
      if (!f || !f.name) continue
      const val = parseFloat(f.value)
      if (!(val > 0)) continue
      const key = normFlavorKey(f.name)
      if (!valuesByKey[key]) valuesByKey[key] = []
      valuesByKey[key].push(val)
      counts[key] = (counts[key] || 0) + 1
    }
  }
  const stats = {}
  for (const key in valuesByKey) {
    const values = valuesByKey[key]
    const sum = values.reduce((a, b) => a + b, 0)
    stats[key] = {
      avg: Math.round((sum / counts[key]) * 100) / 100,
      mode: computeMode(values),
      count: counts[key],
      values: [...new Set(values)].sort((a, b) => a - b),
    }
  }
  return stats
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

export const INVENTORY_KEY = 'flavorum_inventory'

export async function loadInventory() {
  try {
    const json = await AsyncStorage.getItem(INVENTORY_KEY)
    if (!json) return []
    const data = JSON.parse(json)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function saveInventory(names) {
  try {
    await AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(names))
  } catch {}
}

export const INVENTORY_META_KEY = 'flavorum_inventory_meta'

/**
 * Loads per-flavor metadata: { [flavorName]: { bottleMl: number, price: number, usedMl: number } }
 */
export async function loadInventoryMeta() {
  try {
    const json = await AsyncStorage.getItem(INVENTORY_META_KEY)
    if (!json) return {}
    const data = JSON.parse(json)
    return (data && typeof data === 'object') ? data : {}
  } catch {
    return {}
  }
}

export async function saveInventoryMeta(meta) {
  try {
    await AsyncStorage.setItem(INVENTORY_META_KEY, JSON.stringify(meta))
  } catch {}
}
