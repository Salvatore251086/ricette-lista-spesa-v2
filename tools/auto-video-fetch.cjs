const fs = require('fs')
const path = require('path')
const https = require('https')
const { execSync } = require('child_process')

const CONFIG = {
  API_KEY: 'AIzaSyBKKznPBMik6T5KLq5np5jIWP4hFRhN7so',
  MAX_RESULTS_PER_RECIPE: 8,
  MIN_CONFIDENCE_STRICT: 0.65,
  MIN_CONFIDENCE_LOOSE: 0.5
}

const ROOT = path.join(__dirname, '..')
const RECIPES_PATH = path.join(ROOT, 'assets', 'json', 'recipes-it.json')
const RAW_PATH = path.join(ROOT, 'assets', 'json', 'video_index.raw.json')
const RESOLVED_PATH = path.join(ROOT, 'assets', 'json', 'video_index.resolved.json')
const AUDIT_PATH = path.join(ROOT, 'assets', 'json', 'video_audit_report.json')
const BUILD_SCRIPT = path.join(__dirname, 'build-video-map.cjs')

main().catch(err => {
  console.error('ERRORE FATALE auto-video-fetch:', err)
  process.exit(1)
})

async function main () {
  assertApiKey()

  const recipesRaw = readJson(RECIPES_PATH, [])
  const recipes = unwrapRecipes(recipesRaw).map(normalizeRecipe)

  console.log('Ricette totali trovate:', recipes.length)

  const results = []

  for (const recipe of recipes) {
    if (!recipe.title || !recipe.slug) {
      console.log('[SKIP] ricetta senza titolo o slug valido')
      continue
    }

    if (recipe.youtubeId) {
      results.push({
        title: recipe.title,
        slug: recipe.slug,
        youtubeId: recipe.youtubeId,
        source: 'direct',
        confidence: 1
      })
      console.log('[DIRECT]', recipe.title, '=>', recipe.youtubeId)
      continue
    }

    const video = await findYoutubeVideoForRecipe(recipe)

    if (video) {
      results.push({
        title: recipe.title,
        slug: recipe.slug,
        youtubeId: video.youtubeId,
        source: video.channelTitle,
        confidence: video.confidence
      })
      console.log('[OK]', recipe.title, '=>', video.youtubeId, '@', video.channelTitle, 'conf', video.confidence.toFixed(2))
    } else {
      console.log('[NO VIDEO]', recipe.title)
    }
  }

  const compact = compactAndSort(results)

  writeJson(RAW_PATH, compact)

  console.log('Video totali scritti in raw:', compact.length)

  runBuildMap()

  const audit = readJson(AUDIT_PATH, null)
  if (audit) {
    console.log('Report finale:')
    console.log('Ricette totali:', audit.totalRecipes)
    console.log('Video mappati:', audit.withVideo)
    console.log('Ricette senza video proposto:', audit.missingVideo)
  } else {
    console.log('ATTENZIONE: nessun audit letto, controlla build-video-map.cjs')
  }
}

function assertApiKey () {
  if (!CONFIG.API_KEY) {
    console.error('Manca CONFIG.API_KEY YouTube Data API v3')
    process.exit(1)
  }
}

function readJson (file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    return JSON.parse(raw)
  } catch (e) {
    return fallback
  }
}

function writeJson (file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
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

  const keys = Object.keys(raw)
  for (const k of keys) {
    const v = raw[k]
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v
  }
  for (const k of keys) {
    const v = raw[k]
    if (v && typeof v === 'object') {
      const vals = Object.values(v)
      if (vals.length && typeof vals[0] === 'object') return vals
    }
  }
  return []
}

function normalizeRecipe (r, index) {
  const rawTitle = String(r.title || r.name || r.recipeTitle || '').trim()
  const cleanTitle = decodeHtml(rawTitle.replace(/^Ricetta\s*/i, '')).trim()

  const slug = (r.slug && String(r.slug).trim()) || slugify(cleanTitle || rawTitle || 'ricetta-' + index)

  const directYt = String(
    r.youtubeId ||
    r.youtube_id ||
    r.ytId ||
    r.yt ||
    r.youtube ||
    ''
  ).trim()

  return {
    id: index,
    title: cleanTitle || rawTitle,
    slug,
    youtubeId: directYt
  }
}

function decodeHtml (str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&egrave;/g, 'è')
    .replace(/&eacute;/g, 'é')
    .replace(/&ograve;/g, 'ò')
    .replace(/&agrave;/g, 'à')
    .replace(/&ugrave;/g, 'ù')
    .replace(/&igrave;/g, 'ì')
}

function compactAndSort (arr) {
  const byKey = {}
  for (const v of arr) {
    if (!v || !v.youtubeId) continue
    const k = v.slug || slugify(v.title)
    if (!k) continue
    const existing = byKey[k]
    if (!existing || (v.confidence || 0) > (existing.confidence || 0)) {
      byKey[k] = {
        title: v.title,
        slug: k,
        youtubeId: v.youtubeId,
        source: v.source || '',
        confidence: typeof v.confidence === 'number' ? v.confidence : 0.8
      }
    }
  }
  return Object.values(byKey).sort((a, b) => a.slug.localeCompare(b.slug))
}

async function findYoutubeVideoForRecipe (recipe) {
  const query = buildQuery(recipe)
  if (!query) {
    console.log('[SKIP QUERY VUOTA]', recipe.title)
    return null
  }

  const url =
    'https://www.googleapis.com/youtube/v3/search' +
    '?part=snippet' +
    '&type=video' +
    '&maxResults=' + CONFIG.MAX_RESULTS_PER_RECIPE +
    '&q=' + encodeURIComponent(query) +
    '&key=' + CONFIG.API_KEY

  const data = await httpGetJson(url)

  if (!data) {
    console.log('[ERRORE API]', recipe.title, 'risposta nulla')
    return null
  }

  if (data.error) {
    console.log('[ERRORE API YOUTUBE]', JSON.stringify(data.error))
    return null
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    return null
  }

  let bestStrict = null
  let bestStrictScore = 0
  let bestLoose = null
  let bestLooseScore = 0

  for (const item of data.items) {
    const vid = item.id && item.id.videoId
    const snippet = item.snippet || {}
    const title = String(snippet.title || '')
    const channel = String(snippet.channelTitle || '')

    if (!vid) continue
    if (isShortOrSpam(title)) continue

    const score = scoreMatch(recipe.title, title)
    if (score <= 0) continue

    if (score > bestStrictScore) {
      bestStrictScore = score
      bestStrict = {
        youtubeId: vid,
        title,
        channelTitle: channel,
        confidence: score
      }
    }

    if (score > bestLooseScore) {
      bestLooseScore = score
      bestLoose = {
        youtubeId: vid,
        title,
        channelTitle: channel,
        confidence: score
      }
    }
  }

  if (bestStrict && bestStrict.confidence >= CONFIG.MIN_CONFIDENCE_STRICT) {
    return bestStrict
  }

  if (bestLoose && bestLoose.confidence >= CONFIG.MIN_CONFIDENCE_LOOSE) {
    return bestLoose
  }

  return null
}

function isShortOrSpam (title) {
  const t = title.toLowerCase()
  if (t.includes('#shorts')) return true
  if (t.includes('trailer')) return true
  if (t.includes('spot pubblicitario')) return true
  return false
}

function buildQuery (recipe) {
  return recipe.title
}

function scoreMatch (recipeTitle, videoTitle) {
  const r = normalizeText(recipeTitle)
  const v = normalizeText(videoTitle)

  if (!r || !v) return 0

  let score = 0

  if (v.includes(r)) score += 0.7
  if (r.includes(v)) score += 0.5

  const rt = r.split(' ')
  let hits = 0
  for (const t of rt) {
    if (t.length < 3) continue
    if (v.includes(t)) hits += 1
  }
  if (rt.length > 0) {
    const frac = hits / rt.length
    if (frac > 0.4) {
      score += 0.3
    } else if (frac > 0.25) {
      score += 0.15
    }
  }

  if (videoTitle.toLowerCase().includes('ricetta')) score += 0.05

  if (score > 1) score = 1
  return score
}

function normalizeText (str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function httpGetJson (url) {
  return new Promise(resolve => {
    https
      .get(url, res => {
        let data = ''
        res.on('data', chunk => {
          data += chunk
        })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve(json)
          } catch (e) {
            console.error('Errore parse JSON YouTube:', e.message)
            resolve(null)
          }
        })
      })
      .on('error', err => {
        console.error('Errore HTTP YouTube:', err.message)
        resolve(null)
      })
  })
}

function runBuildMap () {
  try {
    if (fs.existsSync(BUILD_SCRIPT)) {
      console.log('Eseguo build-video-map.cjs...')
      execSync('node "' + BUILD_SCRIPT + '"', { stdio: 'inherit' })
    } else {
      console.log('build-video-map.cjs non trovato, salta build automatica')
    }
  } catch (e) {
    console.error('Errore durante build-video-map.cjs', e.message)
  }
}

function slugify (str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
