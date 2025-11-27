// recipe_strapi.js – dettaglio ricetta da Strapi v18

console.log('Recipe Strapi v18 – script caricato')

const STRAPI_URL = 'http://localhost:1337'

// legge parametri query string (?src=strapi&id=...)
function getQueryParams () {
  const params = new URLSearchParams(window.location.search)
  return {
    src: params.get('src'),
    id: params.get('id')
  }
}

// mostra messaggio di errore sulla pagina
function showError (msg) {
  console.error(msg)
  const main = document.querySelector('main') || document.body
  const p = document.createElement('p')
  p.textContent = msg
  p.style.color = '#bb0020'
  p.style.marginTop = '12px'
  p.style.fontWeight = 'bold'
  main.appendChild(p)
}

// normalizza struttura Strapi v5, con o senza attributes
function normalizeStrapiRecipe (raw) {
  if (!raw) return null

  const node = raw.attributes || raw

  return {
    id: raw.id || node.id,
    documentId: node.documentId,
    title: node.title || '',
    ingredients: Array.isArray(node.ingredients) ? node.ingredients : [],
    steps: Array.isArray(node.steps) ? node.steps : [],
    tags: Array.isArray(node.tags) ? node.tags : [],
    difficulty: node.difficulty || '',
    sourceUrl: node.sourceUrl || '',
    videoRaw: node.videoId || node.youtubeId || node.videoUrl || '',
    cookTime: node.cookTime,
    prepTime: node.prepTime,
    servings: node.servings,
    legacyId: node.legacyId
  }
}

// estrae ID YouTube da URL o stringa
function extractYoutubeId (value) {
  if (!value) return ''

  const str = value.toString().trim()

  const matchV = str.match(/[?&]v=([^&]+)/)
  if (matchV && matchV[1]) return matchV[1]

  const matchShort = str.match(/youtu\.be\/([^?]+)/)
  if (matchShort && matchShort[1]) return matchShort[1]

  return str
}

// renderizza la ricetta nel DOM
function renderRecipe (recipe) {
  if (!recipe) {
    showError('Ricetta non disponibile')
    return
  }

  const norm = normalizeStrapiRecipe(recipe)
  if (!norm) {
    showError('Ricetta non valida')
    return
  }

  const titleEl =
    document.querySelector('#rTitle') ||
    document.querySelector('#recipe-title')
  if (titleEl) {
    titleEl.textContent = norm.title || 'Ricetta'
  }

  const metaEl = document.querySelector('#meta')
  if (metaEl) {
    const parts = []
    if (norm.difficulty) parts.push('Diff: ' + norm.difficulty)
    if (typeof norm.prepTime === 'number') {
      parts.push('Prep: ' + norm.prepTime + ' min')
    }
    if (typeof norm.cookTime === 'number') {
      parts.push('Cottura: ' + norm.cookTime + ' min')
    }
    if (typeof norm.servings === 'number') {
      parts.push('Porzioni: ' + norm.servings)
    }
    metaEl.textContent = parts.join(' • ')
  }

  const tagsEl = document.querySelector('#tags')
  if (tagsEl) {
    tagsEl.innerHTML = ''
    if (Array.isArray(norm.tags) && norm.tags.length > 0) {
      norm.tags.forEach(t => {
        const span = document.createElement('span')
        span.textContent = t
        span.className = 'chip'
        tagsEl.appendChild(span)
      })
    }
  }

  const ingList = document.querySelector('#ingList')
  if (ingList) {
    ingList.innerHTML = ''
    norm.ingredients.forEach(item => {
      const li = document.createElement('li')
      li.textContent = item
      ingList.appendChild(li)
    })
  }

  const stepsList = document.querySelector('#steps')
  if (stepsList) {
    stepsList.innerHTML = ''
    norm.steps.forEach(step => {
      const li = document.createElement('li')
      li.textContent = step
      stepsList.appendChild(li)
    })
  }

  if (norm.sourceUrl) {
    const sourceBtn = document.querySelector('#btnSource')
    if (sourceBtn) {
      sourceBtn.href = norm.sourceUrl
      sourceBtn.style.display = 'inline-block'
    }
  } else {
    const sourceBtn = document.querySelector('#btnSource')
    if (sourceBtn) {
      sourceBtn.style.display = 'none'
    }
  }

  const videoId = extractYoutubeId(norm.videoRaw)
  const wrap = document.querySelector('#videoWrap')
  const iframe = document.querySelector('#yt')

  if (videoId && wrap && iframe) {
    const embedUrl =
      'https://www.youtube-nocookie.com/embed/' +
      encodeURIComponent(videoId) +
      '?rel=0'
    iframe.src = embedUrl
    wrap.style.display = 'block'
  } else if (wrap) {
    wrap.style.display = 'none'
  }

  console.log('Ricetta Strapi renderizzata', norm)
}

// carica una ricetta da Strapi usando il documentId passato nella query
async function loadFromStrapiById (docId) {
  try {
    console.log('Carico ricetta da Strapi usando documentId =', docId)

    const url = `${STRAPI_URL}/api/recipes/${encodeURIComponent(docId)}?populate=*`
    console.log('URL fetch Strapi (v18):', url)

    const res = await fetch(url)
    if (!res.ok) {
      console.error('Errore HTTP da Strapi', res.status, res.statusText)
      throw new Error('Errore Strapi HTTP ' + res.status)
    }

    const json = await res.json()
    console.log('Risposta JSON Strapi (v18):', json)

    if (!json.data) {
      throw new Error('Nessuna ricetta trovata per documentId ' + docId)
    }

    renderRecipe(json.data)
  } catch (err) {
    console.error('Errore caricamento ricetta Strapi (v18):', err)
    showError('Errore nel caricamento della ricetta.')
  }
}

// inizializzazione pagina
async function init () {
  console.log('Init recipe_strapi v18')

  const qp = getQueryParams()
  console.log('QueryParams:', qp)

  if (qp.src !== 'strapi') {
    console.log('Parametro src non è "strapi", nessuna chiamata a Strapi')
    return
  }

  const recipeId = qp.id
  if (!recipeId) {
    showError('ID ricetta non specificato')
    return
  }

  await loadFromStrapiById(recipeId)
}

document.addEventListener('DOMContentLoaded', init)
