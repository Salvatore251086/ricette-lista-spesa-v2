// app.v18.strapi.js
// Vista principale collegata a Strapi

const CONFIG = window.APP_CONFIG || {}

const state = {
  recipes: [],
  filteredRecipes: [],
  tags: new Set(),
  activeTags: new Set(),
  videoIndex: {},
  isUsingStrapi: true
}

const dom = {
  recipesContainer: document.getElementById('recipes-list'),
  searchInput: document.getElementById('search-input'),
  tagsContainer: document.getElementById('tags-container'),
  suggestButton: document.getElementById('btn-suggerisci-ricette'),
  modalOverlay: document.getElementById('video-modal-overlay'),
  modalDialog: document.querySelector('.modal-dialog'),
  modalClose: document.getElementById('video-modal-close')
}

function logDebug() {
  console.log('[StrapiApp]', ...arguments)
}

document.addEventListener('DOMContentLoaded', () => {
  initApp().catch(err => {
    console.error('Errore in initApp', err)
    renderError('Errore durante il caricamento delle ricette')
  })
})

// Converte rich text Strapi in stringa
function extractPlainText(value) {
  if (!value) return ''
  if (typeof value === 'string') return value

  if (Array.isArray(value)) {
    return value.map(extractPlainText).join(' ')
  }

  if (typeof value === 'object') {
    if (Array.isArray(value.children)) {
      return value.children.map(extractPlainText).join(' ')
    }
    if (typeof value.text === 'string') {
      return value.text
    }
  }

  return String(value)
}

async function initApp() {
  logDebug('Avvio app Strapi')

  await loadVideoIndex()

  const recipes = await loadAllRecipesFromStrapi()
  state.recipes = recipes

  logDebug('Ricette da Strapi, totale su più pagine:', state.recipes.length)

  mergeVideoInfoWithRecipes()

  buildTagsFromRecipes()
  renderTagChips()
  attachEventListeners()

  applyFiltersAndRender()
}

// Carica video_index.resolved.json e video_index.manual.json
async function loadVideoIndex() {
  const basePath = CONFIG.VIDEO_INDEX_BASE || 'assets/json'
  const resolvedUrl = `${basePath}/video_index.resolved.json`
  const manualUrl = `${basePath}/video_index.manual.json`

  const indexBySlug = {}

  // resolved: array di oggetti { title, slug, youtubeId, source, confidence }
  try {
    const res = await fetch(resolvedUrl)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        data.forEach(entry => {
          if (!entry || !entry.slug || !entry.youtubeId) return
          indexBySlug[entry.slug] = {
            youtubeId: entry.youtubeId,
            title: entry.title || null,
            source: entry.source || 'resolved',
            confidence: typeof entry.confidence === 'number' ? entry.confidence : 0.9
          }
        })
      }
    }
  } catch (err) {
    console.warn('[StrapiApp] Impossibile caricare video_index.resolved.json', err)
  }

  // manual: struttura mista, usiamo solo le chiavi slug dirette
  try {
    const res = await fetch(manualUrl)
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(key => {
          if (key === 'schema' || key === 'updated_at' || key === 'by_title') return
          const entry = data[key]
          if (!entry || !entry.youtubeId) return
          indexBySlug[key] = {
            youtubeId: entry.youtubeId,
            title: entry.title || null,
            source: 'manual',
            confidence: 1
          }
        })
      }
    }
  } catch (err) {
    console.warn('[StrapiApp] Impossibile caricare video_index.manual.json', err)
  }

  state.videoIndex = indexBySlug
  logDebug('Video index caricato, slug:', Object.keys(indexBySlug).length)
}

// Recupera tutte le pagine di /api/recipes
async function loadAllRecipesFromStrapi() {
  const base =
    (CONFIG.STRAPI_BASE_URL && CONFIG.STRAPI_BASE_URL.replace(/\/$/, '')) ||
    'http://localhost:1337'

  const pageSize = 100
  let page = 1
  let totalPages = 1
  const all = []

  while (page <= totalPages) {
    const url =
      `${base}/api/recipes?pagination[page]=${page}` +
      `&pagination[pageSize]=${pageSize}&sort=title:asc&populate=coverImage`

    logDebug('Chiamo Strapi su', url)

    const res = await fetch(url)
    if (!res.ok) throw new Error('Errore risposta Strapi ' + res.status)

    const data = await res.json()
    const items = Array.isArray(data.data) ? data.data : []

    if (items.length) {
      logDebug('Esempio record grezzo:', items[0])
    }

    items.forEach(r => {
      const mapped = mapStrapiRecipe(r)
      all.push(mapped)
    })

    const meta = data.meta && data.meta.pagination
    if (meta) {
      totalPages = meta.pageCount || 1
      logDebug('Ricette da Strapi, pagina:', page, 'di', totalPages)
    }

    page += 1
  }

  return all
}

// Mappa record Strapi in oggetto ricetta interno
function mapStrapiRecipe(raw) {
  const attrs = raw.attributes || {}

  const title = attrs.title || 'Ricetta senza titolo'
  const description = extractPlainText(attrs.description)
  const ingredients = Array.isArray(attrs.ingredients) ? attrs.ingredients : []
  const steps = Array.isArray(attrs.steps) ? attrs.steps : []

  const prepTime = attrs.prepTime || 0
  const cookTime = attrs.cookTime || 0
  const difficulty = attrs.difficulty || 'medium'
  const servings = attrs.servings || 0
  const tags = Array.isArray(attrs.tags) ? attrs.tags : []

  // coverImage da Strapi
  let image = null
  const cover =
    attrs.coverImage &&
    attrs.coverImage.data &&
    attrs.coverImage.data.attributes

  if (cover && cover.url) {
    if (cover.url.startsWith('http')) {
      image = cover.url
    } else {
      const base =
        (CONFIG.STRAPI_BASE_URL && CONFIG.STRAPI_BASE_URL.replace(/\/$/, '')) ||
        'http://localhost:1337'
      image = base + cover.url
    }
  }

  const recipe = {
    id: raw.id,
    slug: attrs.slug || `recipe-${raw.id}`,
    title,
    description,
    ingredients,
    steps,
    prepTime,
    cookTime,
    difficulty,
    servings,
    tags,
    image,
    youtubeId: null,
    youtubeTitle: null,
    videoSource: null,
    videoConfidence: null,
    isFavorite: false
  }

  logDebug('Esempio attributes:', attrs)

  return recipe
}

// Collega info video alle ricette, usando lo slug
function mergeVideoInfoWithRecipes() {
  const index = state.videoIndex
  if (!index || !Object.keys(index).length) return

  state.recipes.forEach(r => {
    const key = r.slug
    const entry = index[key]
    if (!entry) return

    r.youtubeId = entry.youtubeId
    r.youtubeTitle = entry.title || r.title
    r.videoSource = entry.source
    r.videoConfidence = entry.confidence
  })
}

// Costruisce set dei tag globali
function buildTagsFromRecipes() {
  const tags = new Set()
  state.recipes.forEach(r => {
    if (Array.isArray(r.tags)) {
      r.tags.forEach(t => {
        if (t && typeof t === 'string') tags.add(t)
      })
    }
  })
  state.tags = tags
}

// Render dei chip tag
function renderTagChips() {
  if (!dom.tagsContainer) return
  dom.tagsContainer.innerHTML = ''

  state.tags.forEach(tag => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'btn-ghost tag-chip'
    btn.textContent = tag

    if (state.activeTags.has(tag)) {
      btn.classList.add('active')
    }

    btn.addEventListener('click', () => {
      if (state.activeTags.has(tag)) {
        state.activeTags.delete(tag)
      } else {
        state.activeTags.add(tag)
      }
      renderTagChips()
      applyFiltersAndRender()
    })

    dom.tagsContainer.appendChild(btn)
  })
}

// Eventi UI
function attachEventListeners() {
  if (dom.searchInput) {
    dom.searchInput.addEventListener('input', () => {
      applyFiltersAndRender()
    })
  }

  if (dom.modalClose) {
    dom.modalClose.addEventListener('click', () => {
      hideVideoModal()
    })
  }

  if (dom.modalOverlay) {
    dom.modalOverlay.addEventListener('click', evt => {
      if (evt.target === dom.modalOverlay) {
        hideVideoModal()
      }
    })
  }

  if (dom.suggestButton) {
    dom.suggestButton.addEventListener('click', () => {
      applySuggestion()
    })
  }
}

// Applica filtro ricerca + tag e renderizza
function applyFiltersAndRender() {
  const term = dom.searchInput
    ? dom.searchInput.value.trim().toLowerCase()
    : ''

  const activeTags = state.activeTags

  const filtered = state.recipes.filter(r => {
    // filtro testo
    let okText = true
    if (term) {
      const haystack = [
        r.title || '',
        r.description || '',
        Array.isArray(r.ingredients) ? r.ingredients.join(' ') : ''
      ]
        .join(' ')
        .toLowerCase()

      okText = haystack.includes(term)
    }

    // filtro tag
    let okTags = true
    if (activeTags.size > 0) {
      const recipeTags = new Set(
        Array.isArray(r.tags) ? r.tags.map(t => String(t)) : []
      )
      okTags = [...activeTags].every(t => recipeTags.has(t))
    }

    return okText && okTags
  })

  state.filteredRecipes = filtered
  renderRecipes()
}

// Semplice suggerimento: ordina per numero di ingredienti che matchano termine
function applySuggestion() {
  const term = dom.searchInput
    ? dom.searchInput.value.trim().toLowerCase()
    : ''

  if (!term) {
    applyFiltersAndRender()
    return
  }

  const termParts = term
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)

  const scored = state.recipes.map(r => {
    const ings = Array.isArray(r.ingredients)
      ? r.ingredients.map(i => i.toLowerCase())
      : []
    const score = termParts.reduce((s, tp) => {
      return s + (ings.some(i => i.includes(tp)) ? 1 : 0)
    }, 0)
    return { recipe: r, score }
  })

  scored.sort((a, b) => b.score - a.score)

  state.filteredRecipes = scored
    .filter(x => x.score > 0)
    .map(x => x.recipe)

  renderRecipes()
}

// Render lista ricette
function renderRecipes() {
  if (!dom.recipesContainer) return

  const list = state.filteredRecipes.length
    ? state.filteredRecipes
    : state.recipes

  dom.recipesContainer.innerHTML = ''

  if (!list.length) {
    const p = document.createElement('p')
    p.textContent = 'Nessuna ricetta trovata.'
    dom.recipesContainer.appendChild(p)
    return
  }

  list.forEach(recipe => {
    const card = createRecipeCard(recipe)
    dom.recipesContainer.appendChild(card)
  })
}

// Crea card singola
function createRecipeCard(recipe) {
  const card = document.createElement('article')
  card.className = 'recipe-card'

  // immagine
  const img = document.createElement('img')
  const thumbFromVideo = recipe.youtubeId
    ? `https://img.youtube.com/vi/${recipe.youtubeId}/hqdefault.jpg`
    : null

  img.src = recipe.image || thumbFromVideo || 'assets/icons/recipe-placeholder.png'
  img.alt = recipe.title || 'Immagine ricetta'
  img.style.width = '100%'
  img.style.borderRadius = '14px'
  img.style.objectFit = 'cover'
  img.style.maxHeight = '180px'
  img.loading = 'lazy'
  img.referrerPolicy = 'no-referrer'

  card.appendChild(img)

  // titolo
  const titleEl = document.createElement('h2')
  titleEl.className = 'recipe-title'
  titleEl.textContent = recipe.title || 'Ricetta senza titolo'
  card.appendChild(titleEl)

  // meta
  const meta = document.createElement('div')
  meta.className = 'recipe-meta'

  const timeSpan = document.createElement('span')
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0)
  timeSpan.textContent = `${totalTime} min`

  const diffSpan = document.createElement('span')
  diffSpan.textContent = recipe.difficulty || 'medium'

  const servSpan = document.createElement('span')
  if (recipe.servings) {
    servSpan.textContent = `${recipe.servings} porzioni`
  }

  meta.appendChild(timeSpan)
  meta.appendChild(diffSpan)
  if (servSpan.textContent) meta.appendChild(servSpan)

  card.appendChild(meta)

  // azioni
  const actions = document.createElement('div')
  actions.className = 'recipe-actions'

  const btnOpen = document.createElement('button')
  btnOpen.type = 'button'
  btnOpen.className = 'btn-outline'
  btnOpen.textContent = 'Apri ricetta'
  btnOpen.addEventListener('click', () => {
    openRecipeDetail(recipe)
  })

  const btnVideo = document.createElement('button')
  btnVideo.type = 'button'
  btnVideo.className = 'btn video'
  btnVideo.textContent = 'Guarda video'
  if (!recipe.youtubeId) {
    btnVideo.disabled = true
    btnVideo.classList.add('disabled')
  } else {
    btnVideo.addEventListener('click', () => {
      openVideoForRecipe(recipe)
    })
  }

  actions.appendChild(btnOpen)
  actions.appendChild(btnVideo)
  card.appendChild(actions)

  return card
}

// Apertura pagina recipe-strapi.html
function openRecipeDetail(recipe) {
  const url = `recipe-strapi.html?slug=${encodeURIComponent(recipe.slug)}`
  window.location.href = url
}

// Modale video con fallback a nuova scheda
function openVideoForRecipe(recipe) {
  if (!recipe.youtubeId) {
    alert('Video non disponibile per questa ricetta.')
    return
  }

  if (!dom.modalOverlay || !dom.modalDialog) {
    const url = `https://www.youtube.com/watch?v=${recipe.youtubeId}`
    window.open(url, '_blank')
    return
  }

  dom.modalDialog.innerHTML = ''

  const title = document.createElement('h3')
  title.textContent = recipe.youtubeTitle || recipe.title || 'Video ricetta'
  dom.modalDialog.appendChild(title)

  const iframe = document.createElement('iframe')
  iframe.width = '100%'
  iframe.height = '480'
  iframe.allow =
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
  iframe.allowFullscreen = true
  iframe.referrerPolicy = 'no-referrer'
  iframe.loading = 'lazy'

  const src = `https://www.youtube-nocookie.com/embed/${recipe.youtubeId}?autoplay=1`
  iframe.src = src

  let loaded = false
  iframe.addEventListener('load', () => {
    loaded = true
  })

  iframe.addEventListener('error', () => {
    console.warn('[StrapiApp] Errore iframe, apro in nuova scheda')
    hideVideoModal()
    const url = `https://www.youtube.com/watch?v=${recipe.youtubeId}`
    window.open(url, '_blank')
  })

  setTimeout(() => {
    if (!loaded) {
      console.warn('[StrapiApp] Timeout iframe, apro in nuova scheda')
      hideVideoModal()
      const url = `https://www.youtube.com/watch?v=${recipe.youtubeId}`
      window.open(url, '_blank')
    }
  }, 2000)

  dom.modalDialog.appendChild(iframe)

  showVideoModal()
}

function showVideoModal() {
  if (!dom.modalOverlay) return
  dom.modalOverlay.classList.remove('hidden')
}

function hideVideoModal() {
  if (!dom.modalOverlay) return
  dom.modalOverlay.classList.add('hidden')
  if (dom.modalDialog) {
    dom.modalDialog.innerHTML = ''
  }
}

function renderError(message) {
  if (!dom.recipesContainer) return
  dom.recipesContainer.innerHTML = ''
  const p = document.createElement('p')
  p.textContent = message
  dom.recipesContainer.appendChild(p)
}
