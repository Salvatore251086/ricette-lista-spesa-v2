// app.v16.js
// Frontend minimale ma robusto per Ricette & Lista Spesa v2

const RECIPES_URL = 'assets/json/recipes-it.json';
const VIDEO_INDEX_URL = 'assets/json/video_index.resolved.json';

let ALL_RECIPES = [];
let VIDEO_MAP = {}; // slug -> { youtubeId, title, source, confidence }

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Hook elementi base
  const searchInput = document.getElementById('search-input');
  const visibleCountEl = document.getElementById('visible-count');
  const container = document.getElementById('recipes-container');
  const template = document.getElementById('recipe-card-template');

  if (!container || !template) {
    console.error('Mancano container o template per le ricette');
    return;
  }

  // Hook modale video
  const videoModal = document.getElementById('video-modal');
  const videoFrame = document.getElementById('video-frame');
  const videoSourceEl = document.getElementById('video-source');

  // Chiudi modale quando clicchi backdrop o X
  if (videoModal) {
    videoModal.addEventListener('click', (e) => {
      if (e.target.dataset.close === '1') {
        closeVideoModal(videoModal, videoFrame);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !videoModal.hidden) {
        closeVideoModal(videoModal, videoFrame);
      }
    });
  }

  try {
    // Carica dati in parallelo
    const [recipesJson, videoJson] = await Promise.all([
      fetchJSON(RECIPES_URL),
      fetchJSON(VIDEO_INDEX_URL),
    ]);

    ALL_RECIPES = normalizeRecipes(recipesJson);
    VIDEO_MAP = buildVideoMap(videoJson);

    console.log(`Caricate ricette: ${ALL_RECIPES.length}`);
    console.log(`Video indicizzati: ${Object.keys(VIDEO_MAP).length}`);

    renderRecipes(ALL_RECIPES, {
      container,
      template,
      visibleCountEl,
      videoModal,
      videoFrame,
      videoSourceEl,
    });

    // Ricerca live
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const term = searchInput.value.trim().toLowerCase();
        const filtered = filterRecipes(ALL_RECIPES, term);
        renderRecipes(filtered, {
          container,
          template,
          visibleCountEl,
          videoModal,
          videoFrame,
          videoSourceEl,
        });
      });
    }
  } catch (err) {
    console.error('Errore durante init():', err);
    if (visibleCountEl) visibleCountEl.textContent = 'errore';
  }
}

// Helpers ------------------------------------------------------------------

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Fetch fallita per ${url}: ${res.status}`);
  }
  return res.json();
}

function normalizeRecipes(data) {
  // Gestisce sia { recipes:[...] } sia [...]
  const list = Array.isArray(data) ? data : Array.isArray(data.recipes) ? data.recipes : [];
  return list.map((r, i) => {
    const title =
      r.title ||
      r.name ||
      `Ricetta ${i + 1}`;

    const slug =
      r.slug ||
      (typeof r.urlSlug === 'string' && r.urlSlug) ||
      safeSlug(title);

    return {
      id: r.id || i,
      title,
      slug,
      source: r.source || r.autore || r.origin || '',
      url: r.url || r.link || r.permalink || '',
      servings: r.servings || r.porzioni || '',
      prepTime: r.prepTime || r.tempoPrep || '',
      cookTime: r.cookTime || r.tempoCottura || '',
      difficulty: r.difficulty || r.difficolta || '',
      ingredients: r.ingredients || r.ingredienti || [],
    };
  });
}

function buildVideoMap(videoData) {
  const map = {};

  const list = Array.isArray(videoData) ? videoData : videoData.videos || [];
  for (const v of list) {
    if (!v) continue;
    const slug = v.slug || (v.title ? safeSlug(v.title) : null);
    const youtubeId = v.youtubeId || v.youtubeID || v.id;
    if (!slug || !youtubeId) continue;

    map[slug] = {
      youtubeId,
      title: v.title || '',
      source: v.source || 'YouTube',
      confidence: typeof v.confidence === 'number' ? v.confidence : null,
    };
  }

  return map;
}

function filterRecipes(recipes, term) {
  if (!term) return recipes;
  return recipes.filter((r) => {
    const haystack = [
      r.title,
      r.slug,
      r.source,
      Array.isArray(r.ingredients) ? r.ingredients.join(' ') : '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });
}

function renderRecipes(recipes, ctx) {
  const {
    container,
    template,
    visibleCountEl,
    videoModal,
    videoFrame,
    videoSourceEl,
  } = ctx;

  container.innerHTML = '';

  if (!recipes || recipes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Nessuna ricetta trovata.';
    container.appendChild(empty);
    if (visibleCountEl) visibleCountEl.textContent = '0';
    return;
  }

  const frag = document.createDocumentFragment();

  recipes.forEach((recipe) => {
    const card = template.content.firstElementChild.cloneNode(true);

    card.dataset.id = recipe.id;
    card.dataset.slug = recipe.slug;

    // Titolo & fonte
    const titleEl = card.querySelector('.recipe-title');
    if (titleEl) titleEl.textContent = recipe.title;

    const sourceEl = card.querySelector('.recipe-source');
    if (sourceEl) {
      const s =
        recipe.source ||
        (recipe.url ? new URL(recipe.url, location.href).hostname.replace('www.', '') : '');
      sourceEl.textContent = s || '';
    }

    // Meta
    const sEl = card.querySelector('.recipe-servings');
    if (sEl) sEl.textContent = recipe.servings || '-';

    const pEl = card.querySelector('.recipe-prep');
    if (pEl) pEl.textContent = recipe.prepTime || '-';

    const cEl = card.querySelector('.recipe-cook');
    if (cEl) cEl.textContent = recipe.cookTime || '-';

    const dEl = card.querySelector('.recipe-diff');
    if (dEl) dEl.textContent = recipe.difficulty || '-';

    // Pulsante "Apri ricetta"
    const openBtn = card.querySelector('.btn-open-recipe');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        if (recipe.url) {
          window.open(recipe.url, '_blank', 'noopener');
        } else {
          alert('Link ricetta non disponibile per questa voce.');
        }
      });
    }

    // Pulsante "Video"
    const videoBtn = card.querySelector('.btn-open-video');
    const videoInfo = VIDEO_MAP[recipe.slug];

    if (videoBtn) {
      if (videoInfo && videoInfo.youtubeId) {
        videoBtn.disabled = false;
        videoBtn.textContent = 'Guarda video';
        videoBtn.addEventListener('click', () => {
          openVideoModal({
            modal: videoModal,
            frame: videoFrame,
            sourceEl: videoSourceEl,
            video: videoInfo,
            recipeTitle: recipe.title,
          });
        });
      } else {
        videoBtn.disabled = true;
        videoBtn.textContent = 'Video n/d';
      }
    }

    // Pulsante "Aggiungi alla lista spesa"
    const addBtn = card.querySelector('.btn-add-list');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        // Hook per integrazione futura lista spesa
        console.log('TODO lista spesa ->', recipe.title);
        addBtn.textContent = 'Aggiunta ✔';
        addBtn.disabled = true;
      });
    }

    frag.appendChild(card);
  });

  container.appendChild(frag);
  if (visibleCountEl) visibleCountEl.textContent = String(recipes.length);
}

function openVideoModal({ modal, frame, sourceEl, video, recipeTitle }) {
  if (!modal || !frame) return;

  const url = `https://www.youtube.com/embed/${video.youtubeId}`;
  frame.src = url;

  const titleEl = document.getElementById('video-modal-title');
  if (titleEl) {
    titleEl.textContent = recipeTitle || 'Video ricetta';
  }
  if (sourceEl) {
    const conf =
      typeof video.confidence === 'number'
        ? ` (match ${(video.confidence * 100).toFixed(0)}%)`
        : '';
    sourceEl.textContent = `${video.source || 'YouTube'}${conf}`;
  }

  modal.hidden = false;
  document.body.classList.add('modal-open');
}

function closeVideoModal(modal, frame) {
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('modal-open');
  if (frame) frame.src = '';
}

function safeSlug(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
