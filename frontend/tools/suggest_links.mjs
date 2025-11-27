const STRAPI_URL = 'http://localhost:1337/api/recipes?pagination[pageSize]=100&populate=*'

// INSERISCI QUI LE TUE CHIAVI
const GOOGLE_API_KEY = "AIzaSyD2Mg0sZ_aHbpC116mO-rHRtYCKITEZjM4";
const GOOGLE_CX = "13e4623a4616f4d48";
const YT_API_KEY = "AIzaSyD2Mg0sZ_aHbpC116mO-rHRtYCKITEZjM4";

const fs = await import('node:fs/promises')

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('HTTP ' + res.status + ' per ' + url)
  }
  return res.json()
}

function buildRecipeQuery(attrs) {
  const parts = []
  if (attrs.title) parts.push(attrs.title)
  if (Array.isArray(attrs.tags) && attrs.tags.length) {
    parts.push(attrs.tags.slice(0, 3).join(' '))
  }
  parts.push('ricetta')
  return parts.join(' ')
}

async function searchRecipeOnGoogle(attrs) {
  if (!GOOGLE_API_KEY || !GOOGLE_CX) return []
  const q = encodeURIComponent(buildRecipeQuery(attrs))
  const url =
    'https://www.googleapis.com/customsearch/v1' +
    '?key=' + GOOGLE_API_KEY +
    '&cx=' + GOOGLE_CX +
    '&num=5&q=' + q

  const json = await fetchJson(url)
  const items = Array.isArray(json.items) ? json.items : []

  return items.map(item => ({
    url: item.link,
    title: item.title,
    snippet: item.snippet
  }))
}

async function searchVideoOnYouTube(attrs) {
  if (!YT_API_KEY) return []
  const q = encodeURIComponent(buildRecipeQuery(attrs) + ' video')
  const url =
    'https://www.googleapis.com/youtube/v3/search' +
    '?part=snippet&type=video&maxResults=5' +
    '&key=' + YT_API_KEY +
    '&q=' + q

  const json = await fetchJson(url)
  const items = Array.isArray(json.items) ? json.items : []

  return items
    .filter(it => it.id && it.id.videoId)
    .map(it => ({
      videoId: it.id.videoId,
      title: it.snippet && it.snippet.title,
      channelTitle: it.snippet && it.snippet.channelTitle
    }))
}

function hasValue(str) {
  return typeof str === 'string' && str.trim().length > 0
}

async function fetchAllRecipesFromStrapi() {
  const json = await fetchJson(STRAPI_URL)
  const data = Array.isArray(json.data) ? json.data : []
  return data.map(entry => ({
    id: entry.id,
    attributes: entry.attributes || {}
  }))
}

async function main() {
  console.log('Scarico ricette da Strapi')
  const recipes = await fetchAllRecipesFromStrapi()
  console.log('Totale ricette ricevute:', recipes.length)

  const toCheck = recipes.filter(r => {
    const a = r.attributes
    return !hasValue(a.sourceUrl) || !hasValue(a.videoId)
  })

  if (!toCheck.length) {
    console.log('Tutte le ricette hanno già sourceUrl e videoId')
    return
  }

  console.log('Ricette con link o video mancanti:', toCheck.length)

  const results = []

  for (const r of toCheck) {
    const a = r.attributes
    console.log('---')
    console.log('ID', r.id, 'titolo:', a.title || '(senza titolo)')

    const missingSource = !hasValue(a.sourceUrl)
    const missingVideo = !hasValue(a.videoId)

    const entry = {
      id: r.id,
      title: a.title || '',
      missing: {
        sourceUrl: missingSource,
        videoId: missingVideo
      },
      sourceCandidates: [],
      videoCandidates: []
    }

    if (missingSource) {
      try {
        const c = await searchRecipeOnGoogle(a)
        entry.sourceCandidates = c
        console.log('Candidati fonte trovati:', c.length)
      } catch (err) {
        console.error('Errore Google per ID', r.id, err.message)
      }
    }

    if (missingVideo) {
      try {
        const v = await searchVideoOnYouTube(a)
        entry.videoCandidates = v
        console.log('Candidati video trovati:', v.length)
      } catch (err) {
        console.error('Errore YouTube per ID', r.id, err.message)
      }
    }

    results.push(entry)
  }

  const out = JSON.stringify(results, null, 2)
  await fs.writeFile('suggested_links.json', out, 'utf8')
  console.log('Scritto file suggested_links.json in frontend/tools')
}

main().catch(err => {
  console.error('Errore esecuzione script', err)
  process.exitCode = 1
})
