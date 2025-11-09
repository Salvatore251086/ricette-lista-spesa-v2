// app.v16.js
// Frontend Ricette & Lista Spesa – versione pulita

// Percorsi JSON
const RECIPES_URL = './assets/json/recipes-it.json';
const VIDEOS_URL = './assets/json/video_index.resolved.json';

// Selettori DOM
const SELECTORS = {
  searchInput: '#search-input',
  recipesContainer: '#recipes-container',
  recipesCount: '#recipes-count',
  cardTemplate: '#recipe-card-template',
  // opzionali per modale video/ricetta: se non esistono usiamo fallback
  videoModal: '#video-modal',
  videoFrame: '#video-frame',
  videoTitle: '#video-title',
  videoClose: '#video-close',
  recipeModal: '#recipe-modal',
  recipeContent: '#recipe-content',
  recipeClose: '#recipe-close'
};

// Entry point
document.addEventListener('DOMContentLoaded', init);

async function init() {
  const searchInput = document.querySelector(SELECTORS.searchInput);
  const container = document.querySelector(SELECTORS.recipesContainer);
  const countEl = document.querySelector(SELECTORS.recipesCount);

  if (!searchInput || !container || !countEl) {
    console.error('Elemento mancante in index.html (search/container/count).');
    return;
  }

  let recipes = [];
  let videoMap = new Map();

  try {
    const [recipesRes, videosRes] = await Promise.all([
      fetch(RECIPES_URL),
      fetch(VIDEOS_URL)
    ]);

    if (!recipesRes.ok) throw new Error(`Errore recipes-it.json: ${recipesRes.status}`);
    if (!videosRes.ok) throw new Error(`Errore video_index.resolved.json: ${videosRes.status}`);

    const recipesData = await recipesRes.json();
    const videosData = await videosRes.json();

    // 🔹 recipes-it.json ha wrapper { "recipes": [...] }
    if (Array.isArray(recipesData.recipes)) {
      recipes = recipesData.recipes;
    } else if (Array.isArray(recipesData)) {
      // fallback nel caso in futuro diventi un array diretto
      recipes = recipesData;
    } else {
      throw new Error('Formato recipes-it.json non riconosciuto.');
    }

    // 🔹 Costruisco mappa video: chiave = slug o titolo normalizzato
    videoMap = buildVideoMap(videosData);

    // 🔹 Render iniziale
    renderRecipes(recipes, videoMap, container, countEl);

    // 🔹 Filtro ricerca
    searchInput.addEventListener('input', () => {
      const term = searchInput.value.trim().toLowerCase();
      const filtered = recipes.filter(r => {
        const title = (r.title || '').toLowerCase();
        const ingredients = (r.ingredients || '').toLowerCase();
        return title.includes(term) || ingredients.includes(term);
      });
      renderRecipes(filtered, videoMap, container, countEl);
    });
  } catch (err) {
    console.error('Errore durante init():', err);
    countEl.textContent = 'Errore caricamento dati';
  }
}

// Costruisce mappa titolo/slug -> youtubeId
function buildVideoMap(videosData) {
  const map = new Map();
  if (!Array.isArray(videosData)) return map;

  videosData.forEach(v => {
    if (!v || !v.youtubeId) return;

    const titleKey = norm(v.title);
    const slugKey = norm(v.slug);

    if (titleKey) {
      if (!map.has(titleKey)) map.set(titleKey, v.youtubeId);
    }
    if (slugKey) {
      if (!map.has(slugKey)) map.set(slugKey, v.youtubeId);
    }
  });

  return map;
}

// Renderizza lista ricette
function renderRecipes(recipes, videoMap, container, countEl) {
  container.innerHTML = '';

  const template = document.querySelector(SELECTORS.cardTemplate);

  recipes.forEach(recipe => {
    const node = template
      ? template.content.cloneNode(true)
      : createFallbackCard();

    const card = node.querySelector('.recipe-card') || node;

    const titleEl = node.querySelector('.recipe-title');
    const imgEl = node.querySelector('.recipe-img');
    const sourceEl = node.querySelector('.recipe-source');

    const title = recipe.title || 'Ricetta senza titolo';
    const img = recipe.image || '';
    const source = recipe.source || '';

    if (titleEl) titleEl.textContent = title;
    if (sourceEl) sourceEl.textContent = source;
    if (imgEl && img) {
      imgEl.src = img;
      imgEl.alt = title;
    }

    // Trova video associato
    const slugKey = norm(recipe.slug);
    const titleKey = norm(recipe.title);
    const videoId =
      videoMap.get(slugKey) ||
      videoMap.get(titleKey) ||
      null;

    // Bottone "Video"
    const videoBtn = node.querySelector('.btn-open-video');
    if (videoBtn) {
      if (videoId) {
        videoBtn.disabled = false;
        videoBtn.textContent = 'Video';
        videoBtn.addEventListener('click', () => openVideo(videoId, title));
      } else {
        videoBtn.disabled = true;
        videoBtn.textContent = 'Video n/d';
      }
    }

    // Bottone "Apri ricetta"
    const openBtn = node.querySelector('.btn-open-recipe');
    if (openBtn) {
      openBtn.addEventListener('click', () => openRecipe(recipe));
    }

    // Bottone "Aggiungi alla lista spesa"
    const addBtn = node.querySelector('.btn-add-list');
    if (addBtn) {
      addBtn.addEventListener('click', () => addToList(recipe));
    }

    container.appendChild(node);
  });

  countEl.textContent = recipes.length.toString();
}

/* Helpers UI */

// Normalizza stringhe per usarle come chiavi
function norm(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase();
}

// Card base nel caso mancasse il <template>
function createFallbackCard() {
  const article = document.createElement('article');
  article.className = 'recipe-card';
  article.innerHTML = `
    <div class="recipe-body">
      <h3 class="recipe-title"></h3>
      <p class="recipe-source"></p>
      <div class="recipe-actions">
        <button class="btn btn-open-recipe">Apri ricetta</button>
        <button class="btn btn-open-video">Video</button>
        <button class="btn btn-add-list">Aggiungi alla lista spesa</button>
      </div>
    </div>
  `;
  return article;
}

// Apertura video: modale se esiste, altrimenti nuova scheda
function openVideo(videoId, title) {
  const modal = document.querySelector(SELECTORS.videoModal);
  const frame = document.querySelector(SELECTORS.videoFrame);
  const titleEl = document.querySelector(SELECTORS.videoTitle);
  const closeBtn = document.querySelector(SELECTORS.videoClose);

  const url = `https://www.youtube.com/embed/${videoId}`;

  if (modal && frame) {
    frame.src = url;
    if (titleEl) titleEl.textContent = title || 'Video ricetta';
    modal.classList.add('is-open');

    if (closeBtn && !closeBtn._bound) {
      closeBtn._bound = true;
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('is-open');
        frame.src = '';
      });
    }
  } else {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
  }
}

// Apertura dettagli ricetta: modale se c'è, altrimenti alert
function openRecipe(recipe) {
  const modal = document.querySelector(SELECTORS.recipeModal);
  const content = document.querySelector(SELECTORS.recipeContent);
  const closeBtn = document.querySelector(SELECTORS.recipeClose);

  if (modal && content) {
    content.innerHTML = `
      <h2>${recipe.title || 'Ricetta'}</h2>
      ${recipe.image ? `<img src="${recipe.image}" alt="${recipe.title || ''}" class="modal-img">` : ''}
      ${recipe.ingredients ? `<h3>Ingredienti</h3><p>${recipe.ingredients}</p>` : ''}
      ${recipe.instructions ? `<h3>Preparazione</h3><p>${recipe.instructions}</p>` : ''}
    `;
    modal.classList.add('is-open');

    if (closeBtn && !closeBtn._bound) {
      closeBtn._bound = true;
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('is-open');
        content.innerHTML = '';
      });
    }
  } else {
    // Fallback barbaro ma efficace
    alert(recipe.title || 'Ricetta');
  }
}

// Placeholder per la lista della spesa
function addToList(recipe) {
  console.log('Aggiungi alla lista spesa:', recipe.title || recipe.id);
  // Qui puoi integrare localStorage o backend
}
