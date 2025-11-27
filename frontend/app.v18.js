'use strict';

// Config generale
const CONFIG = {
  // Metti true solo quando avrai Strapi attivo e configurato
  useStrapi: false,
  // Se un giorno userai Strapi, imposta qui il dominio, senza slash finale
  // esempio: 'http://localhost:1337' oppure 'https://ricette-strapi.tuo-dominio.it'
  strapiBaseUrl: 'https://TUO-STRAPI-URL',
  strapiRecipesPath: '/api/recipes?populate=*',
  localRecipesUrl: 'assets/json/recipes-it.json',
  videoIndexUrl: 'assets/json/video_index.manual.json',
  strapiTimeoutMs: 6000
};

// Stato app
const state = {
  recipes: [],
  filteredRecipes: [],
  tags: new Set(),
  activeTags: new Set(),
  videoIndex: {},
  isUsingStrapi: false,
  searchQuery: ''
};

// Riferimenti DOM
const dom = {
  searchInput: null,
  tagChips: null,
  recipeList: null,
  recipeCardTemplate: null,
  videoModal: null,
  videoModalClose: null,
  videoIframe: null,
  modalBackdropElems: null
};

let modalFallbackTimeoutId = null;

document.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  bindEvents();
  bootstrap();
});

function cacheDom() {
  dom.searchInput = document.getElementById('search-input');
  dom.tagChips = document.getElementById('tag-chips');
  dom.recipeList = document.getElementById('recipe-list');
  dom.recipeCardTemplate = document.getElementById('recipe-card-template');

  dom.videoModal = document.getElementById('video-modal');
  dom.videoModalClose = document.getElementById('video-modal-close');
  dom.videoIframe = document.getElementById('video-iframe');
  dom.modalBackdropElems = document.querySelectorAll('[data-modal-close="true"]');
}

function bindEvents() {
  if (dom.searchInput) {
    dom.searchInput.addEventListener('input', onSearchInput);
  }

  if (dom.videoModalClose) {
    dom.videoModalClose.addEventListener('click', closeVideoModal);
  }

  if (dom.modalBackdropElems && dom.modalBackdropElems.length > 0) {
    dom.modalBackdropElems.forEach(el => {
      el.addEventListener('click', closeVideoModal);
    });
  }

  document.addEventListener('keydown', evt => {
    if (evt.key === 'Escape') {
      closeVideoModal();
    }
  });
}

// Avvio app: video_index poi Strapi (se attivo) oppure JSON locale
async function bootstrap() {
  try {
    await loadVideoIndex();
  } catch (err) {
    console.error('Errore caricamento video_index', err);
  }

  const wantStrapi =
    CONFIG.useStrapi === true &&
    CONFIG.strapiBaseUrl &&
    CONFIG.strapiBaseUrl !== 'https://TUO-STRAPI-URL';

  if (wantStrapi) {
    try {
      await loadRecipesFromStrapi();
      state.isUsingStrapi = true;
      console.info('Uso Strapi come sorgente principale');
    } catch (err) {
      console.warn('Strapi non disponibile, uso JSON locale', err);
      await loadRecipesFromLocal();
      state.isUsingStrapi = false;
    }
  } else {
    console.info('Strapi disattivato, uso JSON locale');
    await loadRecipesFromLocal();
    state.isUsingStrapi = false;
  }

  console.info(
    'Video index caricato, slugs con video:',
    Object.keys(state.videoIndex).slice(0, 20)
  );

  collectTags();
  renderTagChips();
  applyFiltersAndRender();
}

// Carica video_index.manual.json
async function loadVideoIndex() {
  const res = await fetch(CONFIG.videoIndexUrl);
  if (!res.ok) {
    throw new Error('HTTP video_index ' + res.status);
  }
  const json = await res.json();
  state.videoIndex = buildVideoIndex(json);
}

// Prova a leggere da Strapi
async function loadRecipesFromStrapi() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.strapiTimeoutMs);

  const base = CONFIG.strapiBaseUrl.replace(/\/$/, '');
  const url = base + CONFIG.strapiRecipesPath;

  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error('HTTP Strapi ' + res.status);
  }

  const data = await res.json();
  const arr = Array.isArray(data.data) ? data.data : [];
  state.recipes = arr
    .map(mapStrapiRecipe)
    .filter(r => r && r.title);
}

// Fallback JSON locale
async function loadRecipesFromLocal() {
  const res = await fetch(CONFIG.localRecipesUrl);
  if (!res.ok) {
    throw new Error('HTTP local JSON ' + res.status);
  }

  const data = await res.json();
  let arr = [];

  if (Array.isArray(data)) {
    arr = data;
  } else if (Array.isArray(data.recipes)) {
    arr = data.recipes;
  }

  state.recipes = arr
    .map(mapLocalRecipe)
    .filter(r => r && r.title);
}

// Normalizza ricetta Strapi
function mapStrapiRecipe(item) {
  if (!item || typeof item !== 'object') return null;
  const attrs = item.attributes || {};

  const title = attrs.title || 'Ricetta senza titolo';
  const slug = attrs.slug || slugify(title);

  const description = attrs.description
    ? extractPlainText(attrs.description)
    : '';

  const ingredients = attrs.ingredients
    ? extractPlainText(attrs.ingredients)
    : '';

  const instructions = attrs.instructions
    ? extractPlainText(attrs.instructions)
    : '';

  let tags = [];
  if (Array.isArray(attrs.tags)) {
    tags = attrs.tags
      .map(t => {
        if (!t) return null;
        if (typeof t === 'string') return t;
        if (typeof t === 'object') {
          return t.name || t.label || null;
        }
        return null;
      })
      .filter(Boolean);
  }

  let coverImageUrl = '';
  if (attrs.coverImageUrl) {
    coverImageUrl = absoluteUrl(attrs.coverImageUrl);
  } else if (
    attrs.coverImage &&
    attrs.coverImage.data &&
    attrs.coverImage.data.attributes &&
    attrs.coverImage.data.attributes.url
  ) {
    coverImageUrl = absoluteUrl(attrs.coverImage.data.attributes.url);
  }

  return {
    id: item.id,
    slug,
    title,
    description,
    ingredients,
    instructions,
    tags,
    coverImageUrl
  };
}

// Normalizza ricetta JSON locale
function mapLocalRecipe(raw, index) {
  if (!raw || typeof raw !== 'object') return null;

  const title = raw.title || raw.name || 'Ricetta senza titolo';
  const slug = raw.slug || slugify(title);
  const description = raw.description || '';
  const ingredients = raw.ingredients || '';
  const instructions = raw.instructions || '';

  let tags = [];
  if (Array.isArray(raw.tags)) {
    tags = raw.tags.filter(Boolean);
  }

  const coverImageUrl = raw.coverImageUrl || raw.image || raw.img || '';

  return {
    id: raw.id || index,
    slug,
    title,
    description,
    ingredients,
    instructions,
    tags,
    coverImageUrl
  };
}

// Costruisce mappa slug -> videoId da video_index
function buildVideoIndex(raw) {
  const index = {};
  if (!raw) return index;

  // Schema 2: { schema: 2, by_slug: { slug: { primary, backups } } }
  if (
    raw.schema === 2 &&
    raw.by_slug &&
    typeof raw.by_slug === 'object'
  ) {
    Object.entries(raw.by_slug).forEach(([slug, value]) => {
      if (!slug || !value) return;
      const primary =
        value.primary ||
        (Array.isArray(value.backups) && value.backups[0]) ||
        null;
      if (!primary) return;
      index[String(slug)] = String(primary);
    });
    return index;
  }

  // Array di oggetti
  if (Array.isArray(raw)) {
    raw.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const slug = item.slug || item.recipe_slug || null;
      const videoId = item.videoId || item.youtubeId || item.yt_id || null;
      if (slug && videoId) {
        index[String(slug)] = String(videoId);
      }
    });
    return index;
  }

  // Mappa slug -> valore
  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([slug, value]) => {
      if (!slug || value == null) return;
      let videoId = null;

      if (typeof value === 'string') {
        videoId = value;
      } else if (typeof value === 'object') {
        videoId = value.videoId || value.youtubeId || value.yt_id || null;
      }

      if (videoId) {
        index[String(slug)] = String(videoId);
      }
    });
  }

  return index;
}

// Unifica testo da rich text Strapi, array, oggetti
function extractPlainText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    return value.map(extractPlainText).join(' ');
  }

  if (typeof value === 'object') {
    if (value.type === 'text' && value.text) {
      return value.text;
    }
    if (Array.isArray(value.children)) {
      return value.children.map(extractPlainText).join(' ');
    }
    return Object.values(value).map(extractPlainText).join(' ');
  }

  return '';
}

// Gestione tag
function collectTags() {
  state.tags.clear();

  state.recipes.forEach(r => {
    if (!r || !Array.isArray(r.tags)) return;
    r.tags.forEach(tag => {
      if (!tag) return;
      state.tags.add(String(tag));
    });
  });
}

function renderTagChips() {
  if (!dom.tagChips) return;
  dom.tagChips.innerHTML = '';

  const fragment = document.createDocumentFragment();

  Array.from(state.tags)
    .sort((a, b) => a.localeCompare(b))
    .forEach(tag => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-chip';
      btn.textContent = tag;
      btn.dataset.tagValue = tag;

      btn.addEventListener('click', () => toggleTag(tag));

      fragment.appendChild(btn);
    });

  dom.tagChips.appendChild(fragment);
  updateTagChipActiveStates();
}

function toggleTag(tag) {
  const value = String(tag);

  if (state.activeTags.has(value)) {
    state.activeTags.delete(value);
  } else {
    state.activeTags.add(value);
  }

  updateTagChipActiveStates();
  applyFiltersAndRender();
}

function updateTagChipActiveStates() {
  if (!dom.tagChips) return;
  const chips = dom.tagChips.querySelectorAll('.tag-chip');

  chips.forEach(chip => {
    const tag = chip.dataset.tagValue;
    if (!tag) return;

    if (state.activeTags.has(tag)) {
      chip.classList.add('tag-chip-active');
    } else {
      chip.classList.remove('tag-chip-active');
    }
  });
}

// Ricerca + filtro tag AND
function onSearchInput(evt) {
  state.searchQuery = String(evt.target.value || '').toLowerCase();
  applyFiltersAndRender();
}

function applyFiltersAndRender() {
  const q = state.searchQuery;
  const active = Array.from(state.activeTags);

  const filtered = state.recipes.filter(r => {
    if (!r) return false;

    if (q) {
      const haystack = (
        (r.title || '') +
        ' ' +
        (r.description || '') +
        ' ' +
        (r.ingredients || '')
      ).toLowerCase();

      if (!haystack.includes(q)) {
        return false;
      }
    }

    if (active.length > 0) {
      if (!Array.isArray(r.tags) || r.tags.length === 0) {
        return false;
      }
      const recipeTagSet = new Set(
        r.tags.map(t => String(t).toLowerCase())
      );

      for (const tag of active) {
        if (!recipeTagSet.has(tag.toLowerCase())) {
          return false;
        }
      }
    }

    return true;
  });

  state.filteredRecipes = filtered;
  renderRecipeList();
}

// Render lista ricette
function renderRecipeList() {
  if (!dom.recipeList || !dom.recipeCardTemplate) return;

  dom.recipeList.innerHTML = '';
  const fragment = document.createDocumentFragment();

  state.filteredRecipes.forEach((recipe, index) => {
    const node = dom.recipeCardTemplate.content.cloneNode(true);

    const card = node.querySelector('.recipe-card');
    const btnMain = node.querySelector('.recipe-main');
    const titleEl = node.querySelector('.recipe-title');
    const descEl = node.querySelector('.recipe-description');
    const tagsEl = node.querySelector('.recipe-tags');
    const imgWrapper = node.querySelector('.recipe-image-wrapper');
    const btnVideo = node.querySelector('.btn-video');

    if (titleEl) {
      titleEl.textContent = recipe.title;
    }

    if (descEl) {
      const text = recipe.description || recipe.ingredients || '';
      descEl.textContent = text.slice(0, 180);
    }

    if (imgWrapper && recipe.coverImageUrl) {
      const img = document.createElement('img');
      img.src = recipe.coverImageUrl;
      img.alt = recipe.title;
      img.loading = 'lazy';
      imgWrapper.appendChild(img);
    }

    if (tagsEl && Array.isArray(recipe.tags)) {
      recipe.tags.forEach(tag => {
        if (!tag) return;
        const t = String(tag);
        const tagBtn = document.createElement('button');
        tagBtn.type = 'button';
        tagBtn.className = 'tag-chip tag-chip-small';
        tagBtn.textContent = t;
        tagBtn.addEventListener('click', () => toggleTag(t));
        tagsEl.appendChild(tagBtn);
      });
    }

    if (btnMain) {
      btnMain.addEventListener('click', () => {
        console.log('Apri ricetta', recipe.slug || recipe.title || index);
      });
    }

    if (btnVideo) {
      const videoId = state.videoIndex[recipe.slug];
      if (!videoId) {
        btnVideo.disabled = true;
        btnVideo.textContent = 'Video non disponibile';
      } else {
        btnVideo.disabled = false;
        btnVideo.textContent = 'Guarda video';
        btnVideo.addEventListener('click', () => openVideoModal(videoId));
      }
    }

    fragment.appendChild(node);
  });

  dom.recipeList.appendChild(fragment);
}

// Gestione modale video con fallback YouTube
function openVideoModal(videoId) {
  if (!videoId) return;

  if (!dom.videoModal || !dom.videoIframe) {
    window.open('https://www.youtube.com/watch?v=' + videoId, '_blank');
    return;
  }

  const src =
    'https://www.youtube-nocookie.com/embed/' +
    encodeURIComponent(videoId) +
    '?autoplay=1';

  dom.videoIframe.src = src;
  dom.videoModal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  if (modalFallbackTimeoutId) {
    clearTimeout(modalFallbackTimeoutId);
  }

  modalFallbackTimeoutId = window.setTimeout(() => {
    if (!dom.videoModal.classList.contains('hidden')) {
      console.warn('Timeout video, apro YouTube in nuova scheda');
      closeVideoModal();
      window.open('https://www.youtube.com/watch?v=' + videoId, '_blank');
    }
  }, 4000);
}

function closeVideoModal() {
  if (!dom.videoModal || !dom.videoIframe) return;

  dom.videoIframe.src = '';
  dom.videoModal.classList.add('hidden');
  document.body.classList.remove('modal-open');

  if (modalFallbackTimeoutId) {
    clearTimeout(modalFallbackTimeoutId);
    modalFallbackTimeoutId = null;
  }
}

// Utilità

function absoluteUrl(path) {
  if (!path) return '';
  const s = String(path);
  if (s.startsWith('http://') || s.startsWith('https://')) {
    return s;
  }
  const base = CONFIG.strapiBaseUrl.replace(/\/$/, '');
  if (!s.startsWith('/')) {
    return base + '/' + s;
  }
  return base + s;
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
