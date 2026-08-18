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

// Same manufacturer under different spellings/codes, mapped to one canonical
// code (from the actual ELR dataset: TFA/TPA, Cap/Capella, Inawera, Flavorah,
// ooo/OoO, Real Flavors, Flavor Jungle → Jungle Flavors, …).
const BRAND_ALIASES = {
  // The Flavor Apprentice
  'tpa': 'TPA', 'tfa': 'TPA', 'the flavor apprentice': 'TPA', 'flavor apprentice': 'TPA',
  'tpa/tfa': 'TPA', 'tfa/tpa': 'TPA', 'elvora/tfa': 'TPA', 'tfa base': 'TPA',
  // Capella
  'cap': 'CAP', 'capella': 'CAP', 'capellas': 'CAP', 'capella flavors': 'CAP',
  // FlavourArt
  'fa': 'FA', 'flavourart': 'FA', 'flavorart': 'FA', 'flavor art': 'FA', 'flavour art': 'FA',
  // Flavor West
  'fw': 'FW', 'flavor west': 'FW', 'flavorwest': 'FW', 'flavor west flavors': 'FW',
  // Inawera
  'inw': 'INW', 'inawera': 'INW', 'inawera flavors': 'INW',
  // Wonder Flavours
  'wf': 'WF', 'wonder flavours': 'WF', 'wonder flavors': 'WF', 'wonder flavour': 'WF',
  // Flavorah
  'flv': 'FLV', 'flavorah': 'FLV',
  // Jungle Flavors
  'jf': 'JF', 'jungle flavors': 'JF', 'flavor jungle': 'JF', 'jungle flavour': 'JF',
  // LorAnn
  'la': 'LA', 'lorann': 'LA', 'lorann oils': 'LA', 'lorannes': 'LA',
  // One On One
  'ooo': 'OOO', 'oo o': 'OOO', 'one on one': 'OOO', 'oneonone': 'OOO',
  // Real Flavors
  'rf': 'RF', 'real flavors': 'RF', 'real flavour': 'RF', 'real flavors sc': 'RF', 'rfa': 'RF',
  // Hangsen
  'hs': 'HS', 'hangsen': 'HS',
  // Flavor Express
  'fe': 'FE', 'flavor express': 'FE', 'flavour express': 'FE',
}

/**
 * Collapse a raw brand string to its canonical code, so chips merge
 * TFA/TPA, Cap/CAP, Inawera/INW, Flavorah/FLV, ooo/OoO, … under one label.
 * Short all-caps-style codes are uppercased; unknown long names → null.
 */
export function normalizeBrand(raw) {
  if (!raw) return null
  const key = raw.trim().toLowerCase()
  const alias = BRAND_ALIASES[key]
  if (alias) return alias
  if (/^[a-z0-9]{1,5}$/.test(key)) return key.toUpperCase()
  return null
}
