import AsyncStorage from '@react-native-async-storage/async-storage'

// Price products: { id, type: 'vg' | 'pg' | 'nic' | 'flavor', name, amountMl, price }
// VG/PG/nicotine have no brand — name is free text ("VG", "Nikotin 100 mg", …);
// flavors are picked from the saved flavor list.
const PRICES_KEY = 'flavorum_prices'

export async function loadPrices() {
  try {
    const raw = await AsyncStorage.getItem(PRICES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function savePrices(list) {
  await AsyncStorage.setItem(PRICES_KEY, JSON.stringify(list))
}

// Price per ml, or null when amount/price are missing or zero.
export function pricePerMl(p) {
  if (!p) return null
  const amt = parseFloat(p.amountMl)
  const price = parseFloat(p.price)
  if (!(amt > 0) || !(price > 0)) return null
  return price / amt
}

/**
 * Estimate what a batch costs to make, from the price table.
 * Includes flavor concentrates (matched by name) and the base liquids
 * (VG/PG/nicotine from the saved result when available; otherwise the split
 * is derived from targetPg and the mix formula).
 * `meta` (inventory per-flavor price metadata) is used as a fallback for
 * flavors without an entry in the price table.
 * Returns { cost, breakdown: [{ label, ml, cost }], baseMl: { vg, pg, nic } }.
 */
export function estimateBatchCost(batch, prices, meta = {}) {
  const result = batch && batch.result
  // When a saved result exists it already contains the combined, rounded
  // volumes (flavorMl, pgNeeded, vgNeeded, nicMl) — prefer it over recomputing.
  // nicMl covers every nicotine source: the added base (baseNicMl) plus any
  // extra source bottles (sourceMl) that were poured into the mix.
  let vol = 0
  let pgMl = 0
  let vgMl = 0
  let nicMl = 0
  if (result && parseFloat(result.actualTotal) > 0) {
    vol = parseFloat(result.actualTotal) || 0
    pgMl = parseFloat(result.pgNeeded) || 0
    vgMl = parseFloat(result.vgNeeded) || 0
    nicMl = parseFloat(result.nicMl) || 0
  } else {
    // Mix mode: total volume derives from the concentrate amount and its %
    // (mixAmount / (flavorPct/100)); flavor mode uses the total volume directly.
    if (batch && batch.ingredientMode === 'mix') {
      const amt = parseFloat(batch.mixAmount) || 0
      const pct = parseFloat(batch.flavorPct) || 0
      if (amt > 0 && pct > 0) vol = amt / (pct / 100)
    } else {
      vol = parseFloat(batch && batch.totalVolume) || 0
    }
    if (vol <= 0) return { cost: 0, breakdown: [] }
    const pgPct = parseFloat(batch && batch.targetPg) || 0
    vgMl = vol * ((100 - pgPct) / 100)
    pgMl = vol * (pgPct / 100)
    nicMl = parseFloat(batch && batch.result && batch.result.baseNicMl) || 0
  }
  const breakdown = []
  let cost = 0
  const push = (label, ml, perMl) => {
    if (!(ml > 0) || perMl == null) return
    const c = ml * perMl
    cost += c
    breakdown.push({ label, ml: Math.round(ml * 100) / 100, cost: c })
  }

  // Flavor concentrates
  if (Array.isArray(batch.flavors)) {
    for (const f of batch.flavors) {
      const ml = vol * ((parseFloat(f.value) || 0) / 100)
      const prod = prices.find(p => p.type === 'flavor' && p.name === f.name)
      let perMl = prod ? pricePerMl(prod) : null
      if (perMl == null) {
        // Fallback: per-flavor bottle price metadata (Stock & Price Entry)
        const m = meta[f.name]
        const price = m && parseFloat(m.price)
        const bottle = m && parseFloat(m.bottleMl)
        if (price > 0 && bottle > 0) perMl = price / bottle
      }
      push(f.name, ml, perMl)
    }
  }

  // Base liquids: VG/PG/nicotine (from the saved result when available)
  const baseMl = [['vg', vgMl], ['pg', pgMl], ['nic', nicMl]]
  for (const [type, ml] of baseMl) {
    const prod = prices.find(p => p.type === type)
    push(type.toUpperCase(), ml, prod ? pricePerMl(prod) : null)
  }

  return { cost, breakdown, baseMl: { vg: vgMl, pg: pgMl, nic: nicMl } }
}
