;(function () {
  const RECIPES_URL = 'assets/json/recipes-it.json'
  const VIDEO_INDEX_URL = 'assets/json/video_index.resolved.json'
  const FALLBACK_IMAGE = 'assets/icons/recipe-fallback.png'

  let recipes = []
  let videoIndex = {}
  let activeTags = new Set()
  let showFavoritesOnly = false

  const searchInput = document.getElementById('search-input')
  const recipesCountEl = document.getElementById('recipes-count')
  const recipesContainer = document.getElementById('recipes-container')
  const chipsContainer = document.getElementById('chips-container')
  const refreshBtn = document.getElementById('refresh-data-btn')
  const favoritesToggle = document.getElementById('filter-favorites')

  const modalBackdrop = document.getElementById('modal-backdrop')
  const videoModal = document.getElementById('video-modal')
  const videoTitleEl = document.getElementById('video-modal-title')
  const videoFrameEl = document.getElementById('video-frame')
  const videoErrorEl = document.getElementById('video-error')
  const closeVideoModalBtn = document.getElementById('close-video-modal')

  init()

  function init () {
    loadData()
    bindGlobalEvents()
  }

  function loadData () {
    const recipesUrl = withCacheBust(RECIPES_URL)
    const videoUrl = withCacheBust(VIDEO_INDEX_URL)

    Promise.all([
      fetch(recipesUrl).then(r => r.json()),
      fetch(videoUrl).then(r => (r.ok ? r.json() : []))
    ])
      .then(([recipesData, videoData]) => {
        recipes = Array.isArray(recipesData) ? recipesData : []
        videoIndex = buildVideoIndex(videoData)
        console.log('Caricate ricette:', recipes.length)
        console.log('Video indicizzati:', Object.keys(videoIndex).length)
        renderAll()
      })
      .catch(err => {
        console.error('Errore caricamento dati', err)
      })
  }

  function withCacheBust (url) {
    const stamp = Date.now()
    if (url.includes('?')) {
      return url + '&v=' + stamp
    }
    return url + '?v=' + stamp
  }

  function buildVideoIndex (raw) {
    const map = {}
    if (!Array.isArray(raw)) return map
    raw.forEach(entry => {
      if (!entry) return
      const key = normalizeKey(
        entry.key || entry.title || entry.recipeTitle || ''
      )
      const id = entry.youtubeId || entry.id || ''
      if (key && id) {
        map[key] = id
      }
    })
    return map
  }

  function normalizeKey (str) {
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  function renderAll () {
    updateCount(recipes.length)
    const tags = collectTags(recipes)
    renderChips(tags)
    renderRecipes(recipes)
  }

  function updateCount (n) {
    recipesCountEl.textContent =
      'Ricette visibili: ' + n + ' / ' + recipes.length
  }

  function collectTags (list) {
    const s = new Set()
    list.forEach(r => {
      if (Array.isArray(r.tags)) {
        r.tags.forEach(t => {
          if (t) s.add(String(t))
        })
      }
    })
    return Array.from(s).sort()
  }

  function renderChips (tags) {
    chipsContainer.innerHTML = ''

    const allChip = document.createElement('button')
    allChip.textContent = 'Tutte'
    allChip.className = 'chip active'
    allChip.dataset.all = '1'
    allChip.addEventListener('click', () => {
      activeTags.clear()
      updateChipSelection()
      applyFilters()
    })
    chipsContainer.appendChild(allChip)

    tags.forEach(tag => {
      const btn = document.createElement('button')
      btn.textContent = tag
      btn.className = 'chip'
      btn.dataset.tag = tag
      btn.addEventListener('click', () => {
        if (activeTags.has(tag)) {
          activeTags.delete(tag)
        } else {
          activeTags.add(tag)
        }
        updateChipSelection()
        applyFilters()
      })
      chipsContainer.appendChild(btn)
    })
  }

  function updateChipSelection () {
    const chips = chipsContainer.querySelectorAll('.chip')
    chips.forEach(chip => {
      const tag = chip.dataset.tag
      if (chip.dataset.all === '1') {
        chip.classList.toggle('active', activeTags.size === 0)
      } else {
        chip.classList.toggle('active', activeTags.has(tag))
      }
    })
  }

  function bindGlobalEvents () {
    searchInput.addEventListener('input', applyFilters)

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        console.log('Aggiornamento dati richiesto')
        loadData()
      })
    }

    if (favoritesToggle) {
      favoritesToggle.addEventListener('change', e => {
        showFavoritesOnly = e.target.checked
        applyFilters()
      })
    }

    if (closeVideoModalBtn) {
      closeVideoModalBtn.addEventListener('click', closeVideoModal)
    }

    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', e => {
        if (e.target === modalBackdrop) {
          closeVideoModal()
        }
      })
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeVideoModal()
      }
    })
  }

  function applyFilters () {
    const term = normalizeKey(searchInput.value || '')
    const filtered = recipes.filter(r => matchRecipe(r, term))
    renderRecipes(filtered)
  }

  function matchRecipe (recipe, term) {
    if (showFavoritesOnly && !recipe.favorite) {
      return false
    }

    if (activeTags.size > 0) {
      const tags = Array.isArray(recipe.tags) ? recipe.tags : []
      const hasAll =
        tags.length > 0 &&
        Array.from(activeTags).every(t =>
          tags.map(String).includes(String(t))
        )
      if (!hasAll) return false
    }

    if (term) {
      const title = normalizeKey(recipe.title || '')
      const ingredientsText = normalizeKey(
        Array.isArray(recipe.ingredients)
          ? recipe.ingredients.join(' ')
          : recipe.ingredients || ''
      )
      if (!title.includes(term) && !ingredientsText.includes(term)) {
        return false
      }
    }

    return true
  }

  function renderRecipes (list) {
    recipesContainer.innerHTML = ''
    updateCount(list.length)

    const tpl = document.getElementById('recipe-card-template')
    if (!tpl) {
      console.error('Template card ricetta mancante')
      return
    }

    list.forEach(recipe => {
      const node = tpl.content.cloneNode(true)
      const card = node.querySelector('.recipe-card')
      const titleEl = node.querySelector('.recipe-title')
      const diffEl = node.querySelector('.recipe-diff')
      const servEl = node.querySelector('.recipe-servings')
      const btnOpen = node.querySelector('.btn-open-recipe')
      const btnVideo = node.querySelector('.btn-video')
      const linkAdd = node.querySelector('.link-add')

      const title = recipe.title || 'Ricetta senza titolo'
      titleEl.textContent = title

      const diff = recipe.difficulty || recipe.diff || ''
      diffEl.textContent = diff ? 'Diff: ' + diff : ''

      const servings =
        recipe.servings || recipe.portions || recipe.porzioni
      servEl.textContent = servings ? 'Porzioni: ' + servings : ''

      const url = recipe.url || recipe.link || ''
      btnOpen.addEventListener('click', () => {
        if (url) {
          window.open(url, '_blank', 'noopener')
        }
      })

      linkAdd.addEventListener('click', () => {
        addToList(recipe)
      })

      const videoId = resolveVideoId(recipe)
      if (videoId) {
        btnVideo.disabled = false
        btnVideo.classList.add('enabled')
        btnVideo.textContent = 'Guarda video'
        btnVideo.dataset.videoId = videoId
        btnVideo.dataset.videoTitle = title
        btnVideo.addEventListener('click', () => {
          openVideoModal(videoId, title)
        })
      } else {
        btnVideo.disabled = true
        btnVideo.classList.remove('enabled')
        btnVideo.textContent = 'Video n/d'
      }

      recipesContainer.appendChild(node)
    })
  }

  function resolveVideoId (recipe) {
    if (recipe.youtubeId) {
      return recipe.youtubeId
    }
    if (recipe.videoId) {
      return recipe.videoId
    }
    const key = normalizeKey(recipe.title || '')
    if (key && videoIndex[key]) {
      return videoIndex[key]
    }
    return ''
  }

  function addToList (recipe) {
    const key = 'shopping_list'
    const stored = localStorage.getItem(key)
    let list = []
    if (stored) {
      try {
        list = JSON.parse(stored)
      } catch (e) {
        list = []
      }
    }
    list.push({
      title: recipe.title || 'Ricetta',
      ingredients: recipe.ingredients || [],
      ts: Date.now()
    })
    localStorage.setItem(key, JSON.stringify(list))
    console.log('Aggiunta alla lista spesa:', recipe.title)
  }

  function openVideoModal (videoId, title) {
    if (!videoId) return

    const url =
      'https://www.youtube-nocookie.com/embed/' +
      encodeURIComponent(videoId) +
      '?autoplay=1&rel=0'

    videoTitleEl.textContent = title || 'Video ricetta'
    videoErrorEl.classList.add('hidden')
    videoFrameEl.src = url

    videoFrameEl.onerror = () => {
      videoErrorEl.classList.remove('hidden')
      const directUrl =
        'https://www.youtube.com/watch?v=' +
        encodeURIComponent(videoId)
      window.open(directUrl, '_blank', 'noopener')
      closeVideoModal()
    }

    modalBackdrop.classList.remove('hidden')
    videoModal.classList.remove('hidden')
  }

  function closeVideoModal () {
    videoFrameEl.src = ''
    videoErrorEl.classList.add('hidden')
    modalBackdrop.classList.add('hidden')
    videoModal.classList.add('hidden')
  }
})()
