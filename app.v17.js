;(function () {
  const RECIPES_URL = 'assets/json/recipes-it.json'
  const VIDEO_INDEX_URL = 'assets/json/video_index.resolved.json'

  let allRecipes = []
  let videoIndex = {}
  let activeTags = new Set()
  let showFavoritesOnly = false

  const searchInput = document.getElementById('search-input')
  const recipesCountEl = document.getElementById('recipes-count')
  const recipesContainer = document.getElementById('recipes-container')
  const chipsContainer = document.getElementById('chips-container')
  const refreshBtn = document.getElementById('refresh-data-btn')
  const favoritesToggle = document.getElementById('filter-favorites')

  const videoBackdrop = document.getElementById('modal-backdrop')
  const videoModal = document.getElementById('video-modal')
  const videoTitleEl = document.getElementById('video-modal-title')
  const videoFrameEl = document.getElementById('video-frame')
  const videoErrorEl = document.getElementById('video-error')
  const closeVideoModalBtn = document.getElementById('close-video-modal')

  const recipeBackdrop = document.getElementById('recipe-modal-backdrop')
  const recipeModal = document.getElementById('recipe-modal')
  const recipeTitleEl = document.getElementById('recipe-modal-title')
  const recipeMetaEl = document.getElementById('recipe-meta')
  const recipeIngredientsEl = document.getElementById('recipe-ingredients')
  const recipeStepsEl = document.getElementById('recipe-steps')
  const recipeTagsEl = document.getElementById('recipe-tags')
  const recipeSourceLinkEl = document.getElementById('recipe-source-link')
  const closeRecipeModalBtn = document.getElementById('close-recipe-modal')

  init()

  function init () {
    loadData()
    bindEvents()
  }

  function loadData () {
    const recipesUrl = withCacheBust(RECIPES_URL)
    const videosUrl = withCacheBust(VIDEO_INDEX_URL)

    Promise.all([
      fetch(recipesUrl).then(r => r.json()),
      fetch(videosUrl).then(r => (r.ok ? r.json() : []))
    ])
      .then(([recipesData, videosData]) => {
        allRecipes = extractRecipes(recipesData)
        videoIndex = buildVideoIndex(videosData)
        renderAll()
        console.log('Caricate ricette:', allRecipes.length)
        console.log('Video indicizzati:', Object.keys(videoIndex).length)
      })
      .catch(err => console.error('Errore caricamento dati', err))
  }

  function withCacheBust (url) {
    const v = Date.now()
    return url + (url.includes('?') ? '&' : '?') + 'v=' + v
  }

  function extractRecipes (data) {
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.recipes)) return data.recipes
    return []
  }

  function buildVideoIndex (raw) {
    const map = {}
    if (!Array.isArray(raw)) return map
    raw.forEach(entry => {
      if (!entry) return
      const key = normalizeKey(entry.key || entry.title || '')
      const id = entry.youtubeId || entry.id || ''
      if (key && id) map[key] = id
    })
    return map
  }

  function normalizeKey (str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  function bindEvents () {
    if (searchInput) {
      searchInput.addEventListener('input', applyFilters)
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
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

    if (videoBackdrop) {
      videoBackdrop.addEventListener('click', e => {
        if (e.target === videoBackdrop) closeVideoModal()
      })
    }

    if (closeRecipeModalBtn) {
      closeRecipeModalBtn.addEventListener('click', closeRecipeModal)
    }

    if (recipeBackdrop) {
      recipeBackdrop.addEventListener('click', e => {
        if (e.target === recipeBackdrop) closeRecipeModal()
      })
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeVideoModal()
        closeRecipeModal()
      }
    })
  }

  function renderAll () {
    updateCount(allRecipes.length)
    renderChips(collectTags(allRecipes))
    renderRecipes(allRecipes)
  }

  function updateCount (visible) {
    if (!recipesCountEl) return
    recipesCountEl.textContent =
      'Ricette visibili: ' + visible + ' / ' + allRecipes.length
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
    if (!chipsContainer) return
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
    if (!chipsContainer) return
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

  function applyFilters () {
    const term = normalizeKey(searchInput ? searchInput.value : '')
    const filtered = allRecipes.filter(r => matchRecipe(r, term))
    renderRecipes(filtered)
  }

  function matchRecipe (recipe, term) {
    if (showFavoritesOnly && !recipe.favorite) return false

    if (activeTags.size > 0) {
      const tags = Array.isArray(recipe.tags) ? recipe.tags : []
      if (!tags.length) return false
      const hasAll = Array.from(activeTags).every(t => tags.includes(t))
      if (!hasAll) return false
    }

    if (term) {
      const titleKey = normalizeKey(recipe.title)
      const ingredientsKey = normalizeKey((recipe.ingredients || []).join(' '))
      if (!titleKey.includes(term) && !ingredientsKey.includes(term)) {
        return false
      }
    }

    return true
  }

  function renderRecipes (list) {
    if (!recipesContainer) return
    recipesContainer.innerHTML = ''
    updateCount(list.length)

    const tpl = document.getElementById('recipe-card-template')
    if (!tpl) return

    list.forEach(recipe => {
      const node = tpl.content.cloneNode(true)

      const titleEl = node.querySelector('.recipe-title')
      const diffEl = node.querySelector('.recipe-diff')
      const servEl = node.querySelector('.recipe-servings')
      const btnOpen = node.querySelector('.btn-open-recipe')
      const btnVideo = node.querySelector('.btn-video')
      const linkAdd = node.querySelector('.link-add')

      const title = recipe.title || 'Ricetta senza titolo'
      const difficulty = recipe.difficulty || ''
      const servings = recipe.servings || ''

      if (titleEl) titleEl.textContent = title
      if (diffEl) diffEl.textContent = difficulty ? 'Diff: ' + difficulty : ''
      if (servEl) servEl.textContent = servings ? 'Porzioni: ' + servings : ''

      if (btnOpen) {
        btnOpen.addEventListener('click', () => openRecipeModal(recipe))
      }

      if (linkAdd) {
        linkAdd.addEventListener('click', () => addToList(recipe))
      }

      if (btnVideo) {
        const vid = resolveVideoId(recipe)
        if (vid) {
          btnVideo.disabled = false
          btnVideo.classList.add('enabled')
          btnVideo.textContent = 'Guarda video'
          btnVideo.addEventListener('click', () => openVideoModal(vid, title))
        } else {
          btnVideo.disabled = true
          btnVideo.classList.remove('enabled')
          btnVideo.textContent = 'Video n/d'
        }
      }

      recipesContainer.appendChild(node)
    })
  }

  function resolveVideoId (recipe) {
    if (recipe.videoId) return recipe.videoId
    const key = normalizeKey(recipe.title)
    if (key && videoIndex[key]) return videoIndex[key]
    return ''
  }

  function addToList (recipe) {
    const key = 'shopping_list'
    const stored = localStorage.getItem(key)
    let list = []
    if (stored) {
      try {
        list = JSON.parse(stored)
      } catch {
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
    if (!videoId || !videoModal || !videoBackdrop) return

    const url =
      'https://www.youtube-nocookie.com/embed/' +
      encodeURIComponent(videoId) +
      '?autoplay=1&rel=0'

    if (videoTitleEl) videoTitleEl.textContent = title || 'Video ricetta'
    if (videoErrorEl) videoErrorEl.classList.add('hidden')
    if (videoFrameEl) videoFrameEl.src = url

    videoBackdrop.classList.remove('hidden')
    videoModal.classList.remove('hidden')
  }

  function closeVideoModal () {
    if (videoFrameEl) videoFrameEl.src = ''
    if (videoErrorEl) videoErrorEl.classList.add('hidden')
    if (videoBackdrop) videoBackdrop.classList.add('hidden')
    if (videoModal) videoModal.classList.add('hidden')
  }

  function openRecipeModal (recipe) {
    if (!recipe || !recipeModal || !recipeBackdrop) return

    const title = recipe.title || 'Ricetta senza titolo'
    const difficulty = recipe.difficulty || ''
    const servings = recipe.servings || ''
    const prepTime = recipe.prepTime || ''
    const cookTime = recipe.cookTime || ''
    const totalTime = recipe.totalTime || ''
    const cost = recipe.cost || ''
    const category = recipe.category || ''
    const cuisine = recipe.cuisine || ''
    const url = recipe.url || ''
    const tags = Array.isArray(recipe.tags) ? recipe.tags : []
    const steps = Array.isArray(recipe.steps) ? recipe.steps.filter(Boolean) : []

    if (recipeTitleEl) recipeTitleEl.textContent = title

    const meta = []
    if (difficulty) meta.push('Difficoltà: ' + difficulty)
    if (servings) meta.push('Porzioni: ' + servings)
    if (prepTime) meta.push('Prep: ' + prepTime)
    if (cookTime) meta.push('Cottura: ' + cookTime)
    if (totalTime) meta.push('Totale: ' + totalTime)
    if (cost) meta.push('Costo: ' + cost)
    if (category) meta.push('Portata: ' + category)
    if (cuisine) meta.push('Cucina: ' + cuisine)
    if (recipeMetaEl) recipeMetaEl.textContent = meta.join('  •  ')

    // Ingredienti
    fillList(recipeIngredientsEl, recipe.ingredients, 'Ingredienti non disponibili.')

    // Preparazione, logica professionale
    recipeStepsEl.innerHTML = ''
    if (steps.length > 0) {
      steps.forEach(text => {
        const li = document.createElement('li')
        li.textContent = String(text).trim()
        recipeStepsEl.appendChild(li)
      })
    } else if (url) {
      const li = document.createElement('li')
      li.textContent = 'Consulta la preparazione sulla ricetta originale.'
      recipeStepsEl.appendChild(li)
    } else {
      const li = document.createElement('li')
      li.textContent = 'Preparazione non disponibile.'
      recipeStepsEl.appendChild(li)
    }

    // Tag
    if (tags.length && recipeTagsEl) {
      recipeTagsEl.textContent = 'Tag: ' + tags.join(', ')
      recipeTagsEl.classList.remove('hidden')
    } else if (recipeTagsEl) {
      recipeTagsEl.textContent = ''
      recipeTagsEl.classList.add('hidden')
    }

    // Link fonte
    if (url) {
      recipeSourceLinkEl.href = url
      recipeSourceLinkEl.classList.remove('hidden')
    } else {
      recipeSourceLinkEl.classList.add('hidden')
    }

    recipeBackdrop.classList.remove('hidden')
    recipeModal.classList.remove('hidden')
  }

  function fillList (container, data, fallbackText) {
    if (!container) return
    container.innerHTML = ''
    const items = Array.isArray(data) ? data.filter(Boolean) : []
    if (!items.length) {
      const li = document.createElement('li')
      li.textContent = fallbackText
      container.appendChild(li)
      return
    }
    items.forEach(text => {
      const li = document.createElement('li')
      li.textContent = String(text).trim()
      container.appendChild(li)
    })
  }

  function closeRecipeModal () {
    if (recipeBackdrop) recipeBackdrop.classList.add('hidden')
    if (recipeModal) recipeModal.classList.add('hidden')
  }
})()
