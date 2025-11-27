// tools/enrich-video-index.cjs
// Uso: node tools/enrich-video-index.cjs
// Cerca video YouTube per le ricette mancanti e aggiorna:
// - assets/json/video_index.raw.json
// - assets/json/video_index.resolved.json
// - assets/json/video_audit_report.json

const fs = require('fs')
const path = require('path')

// 🔑 Chiave YouTube Data API v3
const API_KEY = 'AIzaSyD2Mg0sZ_aHbpC116mO-rHRtYCKITEZjM4'

// Config
const MAX_NEW_PER_RUN = 50
const MIN_CONF = 0.8

// Percorsi file
const BASE = path.join(__dirname, '..', 'assets', 'json')
const RECIPES_PATH = path.join(BASE, 'recipes-it.json')
const RAW_PATH = path.join(BASE, 'video_index.raw.json')
const RESOLVED_PATH = path.join(BASE, 'video_index.resolved.json')
const REPORT_PATH = path.join(BASE, 'video_audit_report.json')

// ----------------- Utils base -----------------

function readJson (file, fallback) {
  try {
    const txt = fs.readFileSync(file, 'utf8')
    return JSON.parse(txt)
  } catch (e) {
    return fallback
  }
}

function writeJson (file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

function slugify (str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function unwrapRecipes (raw) {
  if (Array.isArray(raw)) return raw
  if (!raw || typeof raw !== 'object') return []

  if (Array.isArray(raw.recipes)) return raw.recipes
  if (Array.isArray(raw.data)) return raw.data

  if (raw.recipes && typeof raw.recipes === 'object') {
    return Object.values(raw.recipes)
  }
  if (raw.data && typeof raw.data === 'object') {
    return Object.values(raw.data)
  }

  const vals = Object.values(raw)
  if (vals.length && typeof vals[0] === 'object') return vals

  return []
}

function normalizeRecipe (r, index) {
  const title = String(r.title || r.name || r.recipeTitle || '').trim()
  const slug = (r.slug && String(r.slug).trim()) || slugify(title || 'ricetta-' + index)
  const directYt = String(
    r.youtubeId ||
    r.youtube_id ||
    r.ytId ||
    r.yt ||
    r.youtube ||
    ''
  ).trim()

  return { title, slug, youtubeId: directYt }
}

function normalizeVideos (arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .map((v, i) => {
      const title = String(v.title || '').trim()
      const slug = String(v.slug || slugify(title || ('v-' + i))).trim()
      const yt = String(v.youtubeId || v.ytId || v.yt || '').trim()
      const source = String(v.source || '').trim()
      const confidence = typeof v.confidence === 'number'
        ? v.confidence
        : (yt ? 1 : 0)

      if (!slug || !yt) return null

      return { title, slug, youtubeId: yt, source, confidence }
    })
    .filter(Boolean)
}

function dedupVideos (videos) {
  const seen = new Set()
  const out = []
  for (const v of videos) {
    const key = `${v.slug}|${v.youtubeId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

function buildMappedSet (videos) {
  const s = new Set()
  videos.forEach(v => {
    if (v.slug) s.add(v.slug)
  })
  return s
}

// ----------------- YouTube helpers -----------------

async function youtubeSearch (q) {
  const url =
    'https://www.googleapis.com/youtube/v3/search' +
    '?part=snippet' +
    '&type=video' +
    '&maxResults=5' +
    '&videoEmbeddable=true' +
    '&safeSearch=strict' +
    '&q=' + encodeURIComponent(q) +
    '&key=' + API_KEY

  const res = await fetch(url)

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('YouTube status', res.status, 'for query:', q)
    if (body) {
      console.error('Body:', body.slice(0, 400))
    }
    return []
  }

  const data = await res.json().catch(() => ({}))
  return Array.isArray(data.items) ? data.items : []
}

function scoreMatch (recipeTitle, videoTitle, channelTitle) {
  const t = String(recipeTitle || '').toLowerCase()
  const v = String(videoTitle || '').toLowerCase()
  const c = String(channelTitle || '').toLowerCase()

  let score = 0

  // titolo video che contiene il titolo ricetta
  if (v.includes(t) && t.length > 0) score += 0.6

  // overlap parole chiave
  const tokens = t.split(/[^a-z0-9]+/).filter(Boolean)
  const hits = tokens.filter(tok => v.includes(tok)).length
  if (hits >= 4) score += 0.3
  else if (hits >= 3) score += 0.25
  else if (hits >= 2) score += 0.15

  // canali affidabili
  if (
    c.includes('giallozafferano') ||
    c.includes('il cucchiaio d') ||
    c.includes('cucchiaio.it') ||
    c.includes('chef max mariola')
  ) {
    score += 0.2
  }

  if (score > 1) score = 1
  return score
}

async function findVideoForRecipe (r) {
  // se la ricetta ha già youtubeId diretto
  if (r.youtubeId) {
    return {
      title: r.title,
      slug: r.slug,
      youtubeId: r.youtubeId,
      source: 'direct',
      confidence: 1
    }
  }

  if (!r.title) return null

  const items = await youtubeSearch(r.title)
  if (!items.length) return null

  let best = null
  let bestScore = 0

  for (const it of items) {
    const vid = it.id && it.id.videoId
    const sn = it.snippet || {}
    if (!vid) continue

    const s = scoreMatch(r.title, sn.title, sn.channelTitle)
    if (s > bestScore) {
      bestScore = s
      best = {
        title: r.title,
        slug: r.slug,
        youtubeId: vid,
        source: sn.channelTitle || '',
        confidence: Number(s.toFixed(2))
      }
    }
  }

  if (!best || bestScore < MIN_CONF) return null
  return best
}

// ----------------- Main -----------------

async function main () {
  if (!API_KEY || API_KEY === 'LA_TUA_API_KEY_YT') {
    console.error('API_KEY mancante o non valida.')
    process.exit(1)
  }

  const recipesRaw = readJson(RECIPES_PATH, [])
  const recipes = unwrapRecipes(recipesRaw).map(normalizeRecipe)

  const resolved = normalizeVideos(readJson(RESOLVED_PATH, []))
  const raw = normalizeVideos(readJson(RAW_PATH, []))

  const existing = dedupVideos([...resolved, ...raw])
  const mappedSlugs = buildMappedSet(existing)

  const missing = recipes.filter(r => r.slug && !mappedSlugs.has(r.slug))

  console.log('Ricette totali:', recipes.length)
  console.log('Video già risolti:', existing.length)
  console.log('Ricette candidate a nuova ricerca:', missing.length)

  const newVideos = []
  let checked = 0

  for (const r of missing) {
    if (newVideos.length >= MAX_NEW_PER_RUN) break
    checked++

    const found = await findVideoForRecipe(r)

    if (found) {
      console.log('OK', found.slug, found.youtubeId, `[${found.source}]`, found.confidence)
      newVideos.push(found)
    } else {
      console.log('NO', r.slug)
    }
  }

  const updatedRaw = dedupVideos([...raw, ...newVideos])
  const updatedResolved = dedupVideos([...resolved, ...newVideos])

  writeJson(RAW_PATH, updatedRaw)
  writeJson(RESOLVED_PATH, updatedResolved)

  const report = {
    totalRecipes: recipes.length,
    existingVideos: existing.length,
    checkedMissing: checked,
    newVideosAdded: newVideos.length,
    rawCount: updatedRaw.length,
    resolvedCount: updatedResolved.length,
    generatedAt: new Date().toISOString()
  }

  writeJson(REPORT_PATH, report)

  console.log('Nuovi video proposti:', newVideos.length)
  console.log('Video in raw:', updatedRaw.length)
  console.log('Video in resolved:', updatedResolved.length)
  console.log('Fine enrich-video-index')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
