/**
 * Helper to split a flavor string like "Strawberry Ripe (TPA)"
 * into base name "Strawberry Ripe" and brand "TPA".
 */
export function parseFlavorName(fullName) {
  if (!fullName) return { name: '', brand: null }
  const match = fullName.match(/^(.*?)\s*\(([^()]+)\)$/)
  if (match) {
    return {
      name: match[1].trim(),
      brand: match[2].trim(),
    }
  }
  return { name: fullName.trim(), brand: null }
}
