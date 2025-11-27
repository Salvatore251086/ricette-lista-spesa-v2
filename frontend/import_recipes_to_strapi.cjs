const fs = require('fs')
const path = require('path')

const STRAPI_URL = 'http://localhost:1337'
const RAW_TOKEN = 'a7b0280faa95adbdda5e494bc4011b87a72c81548d848a05e4b68c423c1bc6c9bec29cf30df010f30df45db42d258d89a41bb160016b1214fe15d69c7300a15f3770ba76d8802e2807a49e9945be8c4edfc78ff15f88d192de0e2035e1cfd887c52f9e9f2bd333a43d0a2a22f4f16a17db03987bc1f196fc1391584d2cc2a24f'
const API_TOKEN = RAW_TOKEN.trim()
const JSON_PATH = path.join(__dirname, 'new_recipes.json')

// null = tutte le ricette, numero = limite
const LIMIT = null

function toMinutes (value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value !== 'string') {
    return null
  }

  const m = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/)
  if (!m) {
    return null
  }
  const hours = m[1] ? parseInt(m[1], 10) : 0
  const minutes = m[2] ? parseInt(m[2], 10) : 0
  return hours * 60 + minutes
}

function slugify (str) {
  if (!str) {
    return ''
  }
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80)
}

function mapDifficulty (r) {
  if (r.difficulty === 'easy' || r.difficulty === 'medium' || r.difficulty === 'hard') {
    return r.difficulty
  }
  return 'medium'
}

// forza legacyId ad essere un numero
function getNumericLegacyId (r, index) {
  const candidates = [r.legacyId, r.id, r.strapiId, index + 1]

  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) {
      return c
    }
    if (typeof c === 'string') {
      const n = parseInt(c, 10)
      if (!Number.isNaN(n)) {
        return n
      }
    }
  }

  return index + 1
}

function mapRecipeToStrapi (r, index) {
  const legacyId = getNumericLegacyId(r, index)

  const title = r.title || `Ricetta senza titolo ${index + 1}`

  const baseSlug =
    r.slug ||
    r.slug_it ||
    r.slug_en ||
    slugify(title) ||
    `ricetta-${legacyId}`

  const slug = `${baseSlug}-${legacyId}`

  return {
    data: {
      title,
      slug,
      description: r.description || '',
      ingredients: r.ingredients || [],
      steps: r.steps || [],
      sourceUrl: r.sourceUrl || '',
      videoId: r.videoId || null,
      tags: r.tags || [],
      prepTime: toMinutes(r.prepTime),
      cookTime: toMinutes(r.cookTime),
      servings: r.servings ?? null,
      difficulty: mapDifficulty(r),
      legacyId
    }
  }
}

// controlla se esiste già una ricetta con quel legacyId (numerico)
async function recipeExists (legacyId) {
  const url = `${STRAPI_URL}/api/recipes?filters[legacyId][$eq]=${encodeURIComponent(
    legacyId
  )}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`
    }
  })

  if (!res.ok) {
    console.error('Errore Strapi durante il check esistenza', res.status, res.statusText)
    return false
  }

  const json = await res.json()
  return Array.isArray(json.data) && json.data.length > 0
}

async function importOne (recipe, index) {
  const payload = mapRecipeToStrapi(recipe, index)
  const legacyId = payload.data.legacyId

  console.log('---')
  console.log('Ricetta indice', index, 'legacyId', legacyId)

  const exists = await recipeExists(legacyId)
  if (exists) {
    console.log('Già presente in Strapi, salto import per legacyId', legacyId)
    return
  }

  console.log('Slug usato:', payload.data.slug)

  const res = await fetch(`${STRAPI_URL}/api/recipes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`
    },
    body: JSON.stringify(payload)
  })

  const text = await res.text()

  if (!res.ok) {
    console.error('Errore Strapi', res.status, res.statusText)
    console.error('Risposta:', text)
    return
  }

  console.log('OK Strapi, risposta breve:', text.slice(0, 120), '...')
}

async function main () {
  if (!API_TOKEN) {
    console.error('API_TOKEN mancante')
    process.exit(1)
  }

  if (typeof fetch !== 'function') {
    console.error('Serve Node 18 o superiore con fetch globale')
    process.exit(1)
  }

  const raw = fs.readFileSync(JSON_PATH, 'utf8')
  const data = JSON.parse(raw)

  let recipes
  if (Array.isArray(data)) {
    recipes = data
  } else if (Array.isArray(data.recipes)) {
    recipes = data.recipes
  } else if (Array.isArray(data.items)) {
    recipes = data.items
  } else {
    console.error('Formato JSON non riconosciuto, nessun array di ricette trovato')
    process.exit(1)
  }

  console.log('Totale ricette nel JSON:', recipes.length)

  const max = LIMIT && LIMIT > 0 ? Math.min(LIMIT, recipes.length) : recipes.length
  console.log('Ricette da importare in questa esecuzione:', max)

  for (let i = 0; i < max; i++) {
    try {
      await importOne(recipes[i], i)
    } catch (err) {
      console.error('Errore durante import ricetta indice', i, err)
    }
  }

  console.log('Import terminato, ricette processate:', max)
}

main().catch(err => {
  console.error('Errore generale nello script di import', err)
})
