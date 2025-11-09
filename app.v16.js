// app.v16.js
// Frontend per Ricette & Lista Spesa v2
// - Carica ricette e video_index.resolved.json
// - Renderizza le card
// - Modale ricetta (preparazione)
// - Modale video YouTube
// Nessuna chiamata API runtime: usa solo dati già verificati.

// Percorsi JSON (adatta solo se li hai messi altrove)
const RECIPES_URL = 'assets/json/recipes-it.json';
const VIDEO_INDEX_URL = 'assets/json/video_index.resolved.json';

// Stato in memoria
let RECIPES = [];
let VIDEO_INDEX = {}; // slug/chiave -> { youtubeId, title, ... }

// Elementi DOM
const container = document.getElementById('recipes-container');
const cardTemplate = document.getElementById('recipe-card-template');
const searchInput = document.getElementById('search-input');
const recipesCountEl = document.getElementById('recipes-count');

const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalCloseBtn = modalOverlay.querySelector('.modal-close');

// Inizializzazione
init().catch(err => {
  console.error('Errore inizializzazione app:', err);
  showError(
    'Si è verificato un problema nel caricamento delle ricette. Riprova più tardi.'
  );
});

async function init() {
  const [recipesRaw, videosRaw] = await Promise.all([
    fetchJson(RECIPES_URL),
    fetchJson(VIDEO_INDEX_URL, [])
  ]);

  const recipes = unwrapRecipes(recipesRaw).map(normalizeRecipe);
  const videoIndex = buildVideoIndex(Array.isArray(videosRaw) ? videosRaw : []);

  RECIPES = recipes;
  VIDEO_INDEX = videoIndex;

  renderRecipes(recipes);
  bindGlobalEvents();
}

// Utils base

async function fetchJson(url, fallback = null) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} per ${url}`);
    return await res.json();
  } catch (e) {
    console.error('fetchJson error', url, e);
    return fallback;
  }
}

function showError(msg) {
  if (!container) return;
  container.innerHTML = `<div class="error-msg">${escapeHtml(msg)}</div>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Normalizzazione ricette (robusta su vari formati)

function unwrapRecipes(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];

  if (Array.isArray(raw.recipes)) return raw.recipes;
  if (Array.isArray(raw.data)) return raw.data;

  if (raw.recipes && typeof raw.recipes === 'object') {
    return Object.values(raw.recipes);
  }
  if (raw.data && typeof raw.data === 'object') {
    return Object.values(raw.data);
  }

  const out = [];
  for (const v of Object.values(raw)) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
      return v;
    }
    if (v && typeof v === 'object') {
      const vals = Object.values(v);
      if (vals.length && typeof vals[0] === 'object') {
        out.push(...vals);
      }
    }
  }
  return out.length ? out : [];
}

function normalizeRecipe(r, index) {
  const title =
    String(
      r.title ||
        r.name ||
        r.recipeTitle ||
        r.nome ||
        r.Titolo ||
        ''
    ).trim() || `Ricetta ${index + 1}`;

  const slug =
    (r.slug && String(r.slug).trim()) ||
    slugify(title) ||
    `ricetta-${index + 1}`;

  const source = String(
    r.source || r.autore || r.autrice || r.font || r.sito || ''
  ).trim();

  const image =
    r.image ||
    r.img ||
    r.photo ||
    r.foto ||
    '';

  const ingredients = extractIngredients(r);
  const preparation = extractPreparation(r);

  return {
    raw: r,
    id: index,
    title,
    slug,
    source,
    image,
    ingredients,
    preparation
  };
}

function extractIngredients(r) {
  if (Array.isArray(r.ingredienti)) return r.ingredienti;
  if (Array.isArray(r.ingredients)) return r.ingredients;
  if (Array.isArray(r.Ingredienti)) return r.Ingredienti;
  if (typeof r.ingredienti === 'string') {
    return r.ingredienti.split('\n').map(s => s.trim()).filter(Boolean);
  }
  if (typeof r.ingredients === 'string') {
    return r.ingredients.split('\n').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function extractPreparation(r) {
  if (Array.isArray(r.preparazione)) return r.preparazione.join('\n');
  if (Array.isArray(r.Preparazione)) return r.Preparazione.join('\n');
  if (Array.isArray(r.steps)) return r.steps.join('\n');
  if (Array.isArray(r.istruzioni)) return r.istruzioni.join('\n');

  if (typeof r.preparazione === 'string') return r.preparazione;
  if (typeof r.Preparazione === 'string') return r.Preparazione;
  if (typeof r.instructions === 'string') return r.instructions;
  if (typeof r.istruzioni === 'string') return r.istruzioni;

  return '';
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Video index

function buildVideoIndex(videos) {
  const map = {};
  videos.forEach(v => {
    if (!v) return;
    const yt = String(v.youtubeId || v.ytId || v.yt || '').trim();
    if (!yt) return;

    const key =
      slugify(v.slug || v.title || '') ||
      null;
    if (!key) return;

    const conf =
      typeof v.confidence === 'number' && v.confidence > 0
        ? v.confidence
        : 0.8;

    if (!map[key] || conf >= (map[key].confidence || 0)) {
      map[key] = {
        title: v.title || '',
        slug: v.slug || key,
        youtubeId: yt,
        source: v.source || '',
        confidence: conf
      };
    }
  });
  return map;
}

function findVideoForRecipe(recipe) {
  if (!recipe) return null;

  // Se la ricetta ha già un youtubeId diretto
  if (recipe.raw && recipe.raw.youtubeId) {
    return {
      youtubeId: String(recipe.raw.youtubeId).trim(),
      title: recipe.title,
      from: 'direct'
    };
  }

  const key = slugify(recipe.slug || recipe.title);
  if (!key) return null;

  const hit = VIDEO_INDEX[key];
  if (hit && hit.youtubeId && hit.confidence >= 0.7) {
    return hit;
  }
  return null;
}

// Rendering lista

function renderRecipes(list) {
  if (!container || !cardTemplate) return;
  container.innerHTML = '';

  list.forEach(recipe => {
    const card = cardTemplate.content
      .cloneNode(true)
      .querySelector('.recipe-card');

    card.dataset.slug = recipe.slug;

    const imgEl = card.querySelector('.recipe-img');
    const titleEl = card.querySelector('.recipe-title');
    const sourceEl = card.querySelector('.recipe-source');
    const tagsEl = card.querySelector('.recipe-tags');
    const btnVideo = card.querySelector('.btn-open-video');

    titleEl.textContent = recipe.title;

    if (recipe.source) {
      sourceEl.textContent = recipe.source;
    } else {
      sourceEl.textContent = '';
    }

    if (imgEl) {
      if (recipe.image) {
        imgEl.src = recipe.image;
        imgEl.alt = recipe.title;
      } else {
        imgEl.src = 'assets/img/placeholder.jpg';
        imgEl.alt = recipe.title;
      }
    }

    // Tag semplici (puoi mappare da recipe.raw se hai categorie)
    tagsEl.innerHTML = '';

    const videoInfo = findVideoForRecipe(recipe);
    if (videoInfo) {
      btnVideo.dataset.youtubeId = videoInfo.youtubeId;
      btnVideo.dataset.videoTitle =
        videoInfo.title || recipe.title || 'Video ricetta';
      btnVideo.classList.remove('is-hidden');
    } else {
      // Nessun video: nascondo il bottone
      btnVideo.classList.add('is-hidden');
      btnVideo.disabled = true;
    }

    container.appendChild(card);
  });

  updateRecipesCount(list.length);
}

function updateRecipesCount(visible) {
  if (!recipesCountEl) return;
  const total = RECIPES.length || visible;
  recipesCountEl.textContent = `Ricette visibili: ${visible} / ${total}`;
}

// Eventi globali

function bindGlobalEvents() {
  // Ricerca live
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      const filtered = !q
        ? RECIPES
        : RECIPES.filter(r => {
            const inTitle = r.title.toLowerCase().includes(q);
            const inSource = (r.source || '').toLowerCase().includes(q);
            const inIngredients = (r.ingredients || [])
              .join(' ')
              .toLowerCase()
              .includes(q);
            return inTitle || inSource || inIngredients;
          });
      renderRecipes(filtered);
    });
  }

  // Delego click sui pulsanti delle card
  container.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const card = e.target.closest('.recipe-card');
    if (!card) return;
    const slug = card.dataset.slug;
    const recipe = RECIPES.find(r => r.slug === slug);
    if (!recipe) return;

    if (btn.classList.contains('btn-open-recipe')) {
      openRecipeModal(recipe);
    } else if (btn.classList.contains('btn-open-video')) {
      const ytId = btn.dataset.youtubeId;
      const vt = btn.dataset.videoTitle || recipe.title;
      if (ytId) {
        openVideoModal(ytId, vt);
      }
    } else if (btn.classList.contains('btn-add-list')) {
      // Qui puoi integrare la logica lista spesa
      alert('Funzione lista spesa da collegare a breve 👀');
    }
  });

  // Modale: chiusura
  modalCloseBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

// Modale ricetta

function openRecipeModal(recipe) {
  const ingredientsHtml = recipe.ingredients.length
    ? `<ul class="ingredients-list">
        ${recipe.ingredients
          .map(i => `<li>${escapeHtml(i)}</li>`)
          .join('')}
       </ul>`
    : '<p class="muted">Ingredienti non disponibili nei dati attuali.</p>';

  const prepText = recipe.preparation.trim();
  const prepHtml = prepText
    ? `<pre class="prep-text">${escapeHtml(prepText)}</pre>`
    : '<p class="muted">Testo della preparazione non disponibile. (Va completato nei dati JSON.)</p>';

  modalContent.innerHTML = `
    <h2>${escapeHtml(recipe.title)}</h2>
    ${
      recipe.source
        ? `<p class="modal-source">Fonte: ${escapeHtml(
            recipe.source
          )}</p>`
        : ''
    }
    <h3>Ingredienti</h3>
    ${ingredientsHtml}
    <h3>Preparazione</h3>
    ${prepHtml}
  `;

  openModal();
}

// Modale video

function openVideoModal(youtubeId, title) {
  const safeId = youtubeId.replace(/[^a-zA-Z0-9_\-]/g, '');
  const safeTitle = escapeHtml(title || 'Video ricetta');

  modalContent.innerHTML = `
    <h2>${safeTitle}</h2>
    <div class="video-wrapper">
      <iframe
        src="https://www.youtube.com/embed/${safeId}"
        title="${safeTitle}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"
      ></iframe>
    </div>
  `;
  openModal();
}

// Gestione modale base

function openModal() {
  modalOverlay.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  document.body.classList.remove('modal-open');
  modalContent.innerHTML = '';
}
