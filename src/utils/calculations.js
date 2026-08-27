export function calculateNicotine({
  nicStrength,
  nicPgRatio,
  targetStrength,
  totalVolume,
  flavorPct,
  targetPg,
  nicSources = [],
}) {
  let sourceMl = 0
  let sourceMg = 0
  let pgFromNic = 0
  let vgFromNic = 0

  nicSources.forEach(s => {
    const vol = parseFloat(s.volume) || 0
    const str = parseFloat(s.strength) || 0
    const pg = parseFloat(s.pgRatio) ?? 50
    sourceMl += vol
    sourceMg += vol * str
    pgFromNic += vol * (pg / 100)
    vgFromNic += vol - (vol * (pg / 100))
  })

  const targetMg = targetStrength * totalVolume
  const baseNicMl = nicStrength > 0 && sourceMg < targetMg ? (targetMg - sourceMg) / nicStrength : 0
  const totalNicMl = sourceMl + baseNicMl
  const totalNicMg = sourceMg + baseNicMl * nicStrength

  pgFromNic += baseNicMl * (nicPgRatio / 100)
  vgFromNic += baseNicMl * (1 - nicPgRatio / 100)

  const flavorMl = totalVolume * (flavorPct / 100)
  const pgFromFlavor = flavorMl
  const vgFromFlavor = 0

  const targetPgMl = totalVolume * (targetPg / 100)
  const targetVgMl = totalVolume - targetPgMl

  const pgNeeded = targetPgMl - pgFromNic - pgFromFlavor
  const vgNeeded = targetVgMl - vgFromNic - vgFromFlavor

  const actualTotal = totalNicMl + flavorMl + Math.max(pgNeeded, 0) + Math.max(vgNeeded, 0)
  const actualNic = actualTotal > 0 ? totalNicMg / actualTotal : 0

  return {
    nicMl: round(totalNicMl),
    flavorMl: round(flavorMl),
    pgNeeded: round(Math.max(pgNeeded, 0)),
    vgNeeded: round(Math.max(vgNeeded, 0)),
    actualNic: round(actualNic, 2),
    actualTotal: round(actualTotal),
    isPossible: pgNeeded >= 0 && vgNeeded >= 0,
    baseNicMl: round(baseNicMl),
    sourceMl: round(sourceMl),
    sourceMg: round(sourceMg),
  }
}

function round(value, decimals = 1) {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}
