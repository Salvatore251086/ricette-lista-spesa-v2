// app.js - Ricette & Lista Spesa v18 (UI + Video safe)

console.log('Avvio app Ricette & Lista Spesa v18');

const EL = {
  search: document.getElementById('search'),
  updateBtn: document.getElementById('btn-update'),
  onlyFavorites: document.getElementById('only-favorites'),
  visibleCount: document.getElementById('visible-count'),
  recipesContainer: document.getElementById('recipes'),
};

if (!EL.search || !EL.updateBtn || !EL.recipesContainer) {
  console.error('Errore: elementi DOM mancanti. Controlla ID in index.html.');
}

const FAVORITES_KEY = 'rls_favorites_v1';

// Helpers
function loadFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveFavorites(set) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
}

function isValidVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (['youtube.com', 'youtu.be'].includes(host)) return true;
    if (host === 'vimeo.com') return true;
    return false;
  } catch {
    return false;
  }
}

// Stato
let allRecipes = [];
let favorites = loadFavorites();

// Carica JSON embedded
async function loadRecipes() {
  try {
    const res = await fetch('./assets/json/recipes-it.enriched.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allRecipes = Array.isArray(data.recipes) ? data.recipes : data;
    console.log('Caricate ricette:', allRecipes.length);
    render();
  } catch (err) {
    console.error('Errore nel caricamento ricette:', err);
  }
}

// Filtro principale
function getFilteredRecipes() {
  const q = (EL.search?.value || '').trim().toLowerCase();
  const onlyFav = !!EL.onlyFavorites?.checked;

  return allRecipes.filter((r) => {
    if (!r || !r.title) return false;

    if (onlyFav && !favorites.has(r.id || r.url || r.title)) return false;

    if (!q) return true;

    const haystack = [
      r.title,
      r.subtitle,
      r.source,
      (r.ingredients || []).join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

// Render card singola
function renderRecipeCard(recipe) {
  const id = recipe.id || recipe.url || recipe.title;
  const isFav = favorites.has(id);

  // videoUrl: supporta diverse chiavi possibili
  const candidateVideo =
    recipe.videoUrl ||
    recipe.video_url ||
    recipe.video ||
    recipe.youtube ||
    null;

  const hasValidVideo = isValidVideoUrl(candidateVideo);

  const card = document.createElement('article');
  card.className = 'recipe-card';

  card.innerHTML = `
    <div class="recipe-card__header">
      <button class="fav-btn ${isFav ? 'fav-btn--active' : ''}" data-id="${id}" title="Aggiungi ai preferiti">
        ★
      </button>
      <h2 class="recipe-title">${recipe.title || 'Ricetta senza titolo'}</h2>
    </div>

    <div class="recipe-meta">
      ${recipe.source ? `<span class="badge badge--source">${recipe.source}</span>` : ''}
      ${recipe.difficulty ? `<span class="badge">${recipe.difficulty}</span>` : ''}
      ${recipe.portions ? `<span class="badge">${recipe.portions} porzioni</span>` : ''}
      ${
        hasValidVideo
          ? `<span class="badge badge--video">Video</span>`
          : ''
      }
    </div>

    <div class="recipe-actions">
      ${
        recipe.url
          ? `<a class="btn btn-primary" href="${recipe.url}" target="_blank" rel="noopener noreferrer">Apri ricetta</a>`
          : `<button class="btn btn-disabled" disabled>Nessun link</button>`
      }
      ${
        hasValidVideo
          ? `<a class="btn btn-outline" href="${candidateVideo}" target="_blank" rel="noopener noreferrer">Guarda video</a>`
          : `<button class="btn btn-ghost" disabled>Video n/d</button>`
      }
      <button class="btn btn-outline btn-ingredients" data-id="${id}">
        Lista ingredienti
      </button>
    </div>
  `;

  // Click preferiti
  const favBtn = card.querySelector('.fav-btn');
  favBtn.addEventListener('click', () => {
    if (favorites.has(id)) {
      favorites.delete(id);
      favBtn.classList.remove('fav-btn--active');
    } else {
      favorites.add(id);
      favBtn.classList.add('fav-btn--active');
    }
    saveFavorites(favorites);
    if (EL.onlyFavorites?.checked) {
      render();
    }
  });

  // Click ingredienti (modale semplice / alert temporaneo)
  const ingBtn = card.querySelector('.btn-ingredients');
  ingBtn.addEventListener('click', () => {
    const list = recipe.ingredients || [];
    if (!list.length) {
      alert('Nessun ingrediente disponibile per questa ricetta.');
      return;
    }
    alert(`Ingredienti:\n\n${list.join('\n')}`);
  });

  return card;
}

// Render lista
function render() {
  if (!EL.recipesContainer) return;
  EL.recipesContainer.innerHTML = '';

  const list = getFilteredRecipes();

  if (EL.visibleCount) {
    EL.visibleCount.textContent = list.length;
  }

  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Nessuna ricetta trovata con i filtri attuali.';
    EL.recipesContainer.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  list.forEach((r) => frag.appendChild(renderRecipeCard(r)));
  EL.recipesContainer.appendChild(frag);
}

// Eventi UI
if (EL.search) {
  EL.search.addEventListener('input', () => {
    render();
  });
}

if (EL.onlyFavorites) {
  EL.onlyFavorites.addEventListener('change', () => {
    render();
  });
}

// Aggiorna dati (placeholder: qui potresti agganciare una chiamata reale)
if (EL.updateBtn) {
  EL.updateBtn.addEventListener('click', async () => {
    EL.updateBtn.disabled = true;
    EL.updateBtn.textContent = 'Aggiorno...';
    try {
      await loadRecipes(); // ricarica dal JSON attuale
    } finally {
      EL.updateBtn.disabled = false;
      EL.updateBtn.textContent = 'Aggiorna dati';
    }
  });
}

// Boot
loadRecipes();
