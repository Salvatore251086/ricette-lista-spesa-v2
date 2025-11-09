// app.v16.js
// Ricette & Lista Spesa v2 - rendering griglia, modale ricetta, modale video, ricerca

const RECIPES_URL = 'assets/json/recipes-it.json';
const VIDEO_INDEX_URL = 'assets/json/video_index.resolved.json';

let ALL_RECIPES = [];
let VIDEO_MAP = {}; // slug -> { youtubeId, title, source, confidence }

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const searchInput = document.getElementById('search-input');
  const visibleCountEl = document.getElementById('visible-count');
  const container = document.getElementById('recipes-container');
  const template = document.getElementById('recipe-card-template');

  if (!container || !template) {
    console.error('Mancano container o template per le ricette');
    return;
  }

  // Modale ricetta
  const recipeModal = document.getElementById('recipe-modal');
  const recipeModalRefs = getRecipeModalRefs();

  // Modale video
  const videoModal = document.getElementById('video-modal');
  const videoFrame = document.getElementById('video-frame');
  const videoSourceEl = document.getElementById('video-source');

  // Chiudi modali con backdrop / X / ESC
  setupModalClose(recipeModal);
  setupModalClose(videoModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (recipeModal && !recipeModal.hidden) closeRecipeModal(recipeModal);
      if (videoModal && !videoModal.hidden) closeVideoModal(videoModal, videoFrame);
    }
  });

  try {
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
      recipeModal,
      recipeModalRefs,
      videoModal,
      videoFrame,
      videoSourceEl,
    });

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const term = searchInput.value.trim().toLowerCase();
        const filtered = filterRecipes(ALL_RECIPES, term);
        renderRecipes(filtered, {
          container,
          template,
          visibleCountEl,
          recipeModal,
          recipeModalRefs,
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

// ---------------------------------------------------------------------------
// Fetch & normalizzazione
// ---------------------------------------------------------------------------

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Fetch fallita per ${url}: ${res.status}`);
  }
  return res.json();
}

function normalizeRecipes(data) {
  // Accetta {recipes:[...]} o [...]
  const list = Array.isArray(data) ? data : Array.isArray(data.recipes) ? data.recipes : [];

  return list.map((r, i) => {
    const title = r.title || r.name || `Ricetta ${i + 1}`;
    const slug = r.slug || (typeof r.urlSlug === 'string' && r.urlSlug) || safeSlug(title);

    // Ingredienti & preparazione: proviamo vari nomi
    const ingredients =
      r.ingredients ||
      r.ingredienti ||
      r.ingredienti_lista ||
      [];

    const steps =
      r.steps ||
      r.metodo ||
      r.preparazione ||
      r.istruzioni ||
      '';

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
      ingredients: Array.isArray(ingredients) ? ingredients : (ingredients ? [ingredients] : []),
      steps,
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

// ---------------------------------------------------------------------------
// Rendering & interazioni
// ---------------------------------------------------------------------------

function filterRecipes(recipes, term) {
  if (!term) return recipes;
  return recipes.filter((r) => {
    const haystack = [
      r.title,
      r.slug,
      r.source,
      Array.isArray(r.ingredients) ? r.ingredients.join(' ') : '',
      typeof r.steps === 'string' ? r.steps : '',
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
    recipeModal,
    recipeModalRefs,
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
        (recipe.url
          ? new URL(recipe.url, location.href).hostname.replace('www.', '')
          : '');
      sourceEl.textContent = s || '';
    }

    // Meta
    setText(card, '.recipe-servings', recipe.servings || '-');
    setText(card, '.recipe-prep', recipe.prepTime || '-');
    setText(card, '.recipe-cook', recipe.cookTime || '-');
    setText(card, '.recipe-diff', recipe.difficulty || '-');

    // Apri ricetta -> se c'è URL lo apre, altrimenti modale interna
    const openBtn = card.querySelector('.btn-open-recipe');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        if (recipe.url) {
          window.open(recipe.url, '_blank', 'noopener');
        } else {
          openRecipeModal(recipeModal, recipeModalRefs, recipe);
        }
      });
    }

    // Video
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

    // Lista spesa (hook futuro)
    const addBtn = card.querySelector('.btn-add-list');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
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

function setText(root, selector, value) {
  const el = root.querySelector(selector);
  if (el) el.textContent = value;
}

// ---------------------------------------------------------------------------
// Modale ricetta
// ---------------------------------------------------------------------------

function getRecipeModalRefs() {
  return {
    title: document.getElementById('recipe-modal-title'),
    source: document.getElementById('recipe-modal-source'),
    servings: document.getElementById('recipe-modal-servings'),
    prep: document.getElementById('recipe-modal-prep'),
    cook: document.getElementById('recipe-modal-cook'),
    diff: document.getElementById('recipe-modal-diff'),
    ingredients: document.getElementById('recipe-modal-ingredients'),
    steps: document.getElementById('recipe-modal-steps'),
    linkWrap: document.getElementById('recipe-modal-link-wrap'),
    link: document.getElementById('recipe-modal-link'),
  };
}

function openRecipeModal(modal, refs, recipe) {
  if (!modal || !refs) return;

  if (refs.title) refs.title.textContent = recipe.title || 'Dettaglio ricetta';
  if (refs.source) refs.source.textContent = recipe.source || 'N/D';
  if (refs.servings) refs.servings.textContent = recipe.servings || '-';
  if (refs.prep) refs.prep.textContent = recipe.prepTime || '-';
  if (refs.cook) refs.cook.textContent = recipe.cookTime || '-';
  if (refs.diff) refs.diff.textContent = recipe.difficulty || '-';

  // Ingredienti
  if (refs.ingredients) {
    refs.ingredients.innerHTML = '';
    const list = Array.isArray(recipe.ingredients)
      ? recipe.ingredients
      : recipe.ingredients
      ? [recipe.ingredients]
      : [];
    if (list.length) {
      list.forEach((ing) => {
        const li = document.createElement('li');
        li.textContent = ing;
        refs.ingredients.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'Ingredienti non disponibili in questo dataset.';
      refs.ingredients.appendChild(li);
    }
  }

  // Preparazione / step
  if (refs.steps) {
    refs.steps.innerHTML = '';
    if (typeof recipe.steps === 'string' && recipe.steps.trim()) {
      const p = document.createElement('p');
      p.textContent = recipe.steps;
      refs.steps.appendChild(p);
    } else if (Array.isArray(recipe.steps) && recipe.steps.length) {
      recipe.steps.forEach((step, idx) => {
        const p = document.createElement('p');
        p.textContent = `${idx + 1}. ${step}`;
        refs.steps.appendChild(p);
      });
    } else {
      const p = document.createElement('p');
      p.textContent =
        'Testo della preparazione non disponibile in questo dataset.';
      refs.steps.appendChild(p);
    }
  }

  // Link originale se presente
  if (refs.linkWrap && refs.link) {
    if (recipe.url) {
      refs.linkWrap.hidden = false;
      refs.link.textContent = recipe.url;
      refs.link.href = recipe.url;
    } else {
      refs.linkWrap.hidden = true;
      refs.link.textContent = '';
      refs.link.href = '#';
    }
  }

  modal.hidden = false;
  document.body.classList.add('modal-open');
}

function closeRecipeModal(modal) {
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('modal-open');
}

// ---------------------------------------------------------------------------
// Modale video
// ---------------------------------------------------------------------------

function openVideoModal({ modal, frame, sourceEl, video, recipeTitle }) {
  if (!modal || !frame || !video) return;

  const url = `https://www.youtube.com/embed/${video.youtubeId}`;
  frame.src = url;

  const titleEl = document.getElementById('video-modal-title');
  if (titleEl) {
    titleEl.textContent = recipeTitle || video.title || 'Video ricetta';
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

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function setupModalClose(modal) {
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target.dataset.close === '1') {
      if (modal.id === 'video-modal') {
        const frame = document.getElementById('video-frame');
        closeVideoModal(modal, frame);
      } else {
        closeRecipeModal(modal);
      }
    }
  });
}

function safeSlug(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
