import fs from 'node:fs'
import path from 'node:path'

const OUT_JSON = path.resolve('scripts/flavors-checkpoint.json')
const OUT_JS = path.resolve('src/data/flavors.js')
const TOTAL_PAGES = 5625
const CONCURRENCY = 12
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

const isLatin = s => /^[\x00-\x7F\u00A0-\u024F\u1E00-\u1EFF\u2018\u2019\u201C\u201D]+$/.test(s)

function parsePage(html) {
  const out = []
  const re = /class="blklink">([\s\S]*?)<\/a>[\s\S]*?<\/span>\s*<\/td>\s*<td>[\s\S]*?(\d+)/g
  let m
  while ((m = re.exec(html)) !== null) {
    const name = m[1].replace(/\s+/g, ' ').trim()
    const recipes = parseInt(m[2], 10)
    if (!name) continue
    if (!name.includes('(')) continue
    if (!isLatin(name)) continue
    if (recipes < 1) continue
    if (name.includes('invalid')) continue
    if (name.startsWith('(') && name.endsWith(')')) continue
    out.push(name)
  }
  return out
}

async function fetchWithRetry(page) {
  const url = `https://e-liquid-recipes.com/flavors?page=${page}`
  let lastErr
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30000) })
      if (res.ok) return await res.text()
      lastErr = new Error(`HTTP ${res.status} for page ${page}`)
    } catch (e) {
      lastErr = e
    }
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
  }
  throw lastErr
}

function saveCheckpoint(state) {
  fs.writeFileSync(OUT_JSON, JSON.stringify(state))
}

function writeFlavorsJs(names) {
  const lines = names.map(n => `  ${JSON.stringify(n)},`)
  fs.writeFileSync(OUT_JS, `export const ELR_FLAVORS = [\n${lines.join('\n')}\n]\n`)
}

let state = { done: [], names: [] }
if (fs.existsSync(OUT_JSON)) {
  state = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'))
  state.done = state.done || []
  state.names = state.names || []
}
const doneSet = new Set(state.done)
const nameSet = new Set(state.names)

let pending = []
for (let p = 1; p <= TOTAL_PAGES; p++) {
  if (!doneSet.has(p)) pending.push(p)
}

console.log(`Total pages: ${TOTAL_PAGES}, already done: ${doneSet.size}, remaining: ${pending.length}, names so far: ${nameSet.size}`)

let queue = [...pending]
let active = 0
let doneCount = 0
let totalNames = 0
const startedAt = Date.now()

function maybeStart() {
  while (active < CONCURRENCY && queue.length > 0) {
    const page = queue.shift()
    active++
    worker(page)
  }
}

async function worker(page) {
  try {
    const html = await fetchWithRetry(page)
    for (const name of parsePage(html)) {
      if (!nameSet.has(name)) {
        nameSet.add(name)
        state.names.push(name)
        totalNames++
      }
    }
    doneSet.add(page)
    state.done.push(page)
  } catch (e) {
    console.error(`Page ${page} FAILED (${e.message}) — requeueing`)
    queue.push(page)
  } finally {
    active--
    doneCount++
    if (doneCount % 100 === 0) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000)
      const rate = elapsed > 0 ? Math.round(doneCount / elapsed) : 0
      console.log(`Progress: ${doneCount} pages processed, ${nameSet.size} names, ${elapsed}s, ${rate} pages/s`)
      saveCheckpoint(state)
    }
    maybeStart()
  }
}

maybeStart()

const finishTimer = setInterval(() => {
  if (active === 0 && queue.length === 0) {
    clearInterval(finishTimer)
    const sorted = [...nameSet].sort((a, b) => a.localeCompare(b, 'en'))
    writeFlavorsJs(sorted)
    state.names = sorted
    saveCheckpoint(state)
    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    console.log(`DONE in ${elapsed}s. Pages: ${doneSet.size}/${TOTAL_PAGES}. Unique names: ${sorted.length}. Wrote ${OUT_JS}`)
    process.exit(0)
  }
}, 1000)
