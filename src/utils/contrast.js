/**
 * WCAG contrast utilities + automatic theme audits.
 *
 * Pure module (no react-native imports) so it can run anywhere — the app
 * runs it on startup in dev to verify every theme variant, and it can be
 * reused by scripts or tests.
 */

// Parse '#rgb', '#rrggbb', '#rrggbbaa' and 'rgba(r, g, b, a)' into { r, g, b, a }
export function parseColor(str) {
  if (typeof str !== 'string') return null
  let s = str.trim().toLowerCase()
  if (s.startsWith('#')) {
    let hex = s.slice(1)
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').map(c => c + c).join('')
    if (hex.length === 6) {
      return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 }
    }
    if (hex.length === 8) {
      return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: parseInt(hex.slice(6, 8), 16) / 255 }
    }
    return null
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/)
  if (m) {
    const parts = m[1].split(',').map(x => parseFloat(x.trim()))
    if (parts.length >= 3) return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 }
  }
  return null
}

// Composite a possibly-translucent foreground over a solid base.
export function blendOver(fg, base) {
  const f = parseColor(fg)
  const b = parseColor(base)
  if (!f || !b) return null
  const a = f.a
  return {
    r: Math.round(f.r * a + b.r * (1 - a)),
    g: Math.round(f.g * a + b.g * (1 - a)),
    b: Math.round(f.b * a + b.b * (1 - a)),
    a: 1,
  }
}

export function relativeLuminance({ r, g, b }) {
  const f = (v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

// WCAG contrast ratio between two color strings (fg may be translucent; it is
// composited over bg first). Returns null when either color is unparsable.
export function contrastRatio(fg, bg) {
  const b = parseColor(bg)
  if (!b) return null
  const solidF = fg && parseColor(fg) ? (parseColor(fg).a < 1 ? blendOver(fg, bg) : parseColor(fg)) : null
  if (!solidF) return null
  const L1 = relativeLuminance(solidF)
  const L2 = relativeLuminance(b)
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1]
  return (hi + 0.05) / (lo + 0.05)
}

// WCAG thresholds
export const AA_NORMAL = 4.5
export const AA_LARGE = 3.0

// Representative fg/bg pairs for a theme object. Each entry:
//   [label, fgFn, bgFn, overFn?]
// When `overFn` is set, the bg is blended over that color first (so translucent
// surfaces like `card` / `tabBg` are composited over the real background).
const PAIRS = [
  ['text on bg', t => t.text, t => t.bg],
  ['text on card', t => t.text, t => t.card, t => t.bg],
  ['muted on bg', t => t.textMuted, t => t.bg],
  ['muted on card', t => t.textMuted, t => t.card, t => t.bg],
  ['dim on bg', t => t.textDim, t => t.bg],
  ['dim on card', t => t.textDim, t => t.card, t => t.bg],
  ['primary on bg', t => t.primary, t => t.bg],
  ['primaryLight on bg', t => t.primaryLight, t => t.bg],
  ['white on primary (btn)', () => '#FFFFFF', t => t.primary],
  ['success on bg', t => t.success, t => t.bg],
  ['vg on bg', t => t.vg, t => t.bg],
  ['dim on tabBg', t => t.textDim, t => t.tabBg, t => t.bg],
  ['primaryLight on tabBg', t => t.primaryLight, t => t.tabBg, t => t.bg],
]

export function auditTheme(theme) {
  const results = []
  for (const [label, fgFn, bgFn, overFn] of PAIRS) {
    const fg = fgFn(theme)
    let bg = bgFn(theme)
    if (overFn) bg = blendOver(bg, overFn(theme))
    if (!bg) continue
    const ratio = contrastRatio(fg, bg)
    if (ratio === null) continue
    results.push({ label, fg, bg, ratio })
  }
  return results
}

export function auditAllThemes(themes) {
  return Object.entries(themes).map(([key, t]) => ({
    key,
    name: t.name || key,
    pairs: auditTheme(t),
  }))
}

// Failures only: pairs below AA normal (4.5). `hard` separates those that also
// miss AA large (3.0) — the genuinely broken combinations.
export function summarizeTheme(theme) {
  const pairs = auditTheme(theme)
  const failures = pairs.filter(p => p.ratio < AA_NORMAL)
  const hard = failures.filter(p => p.ratio < AA_LARGE)
  return { name: theme.name, pairs, failures, hard }
}
