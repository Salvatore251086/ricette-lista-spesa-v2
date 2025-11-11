// app.v18.js
// Ricette & Lista Spesa - Frontend v18
// Pulito, robusto, niente circo.

(function () {
  'use strict';

  console.log('Avvio app Ricette & Lista Spesa v18');

  // -------------------------
  // Config
  // -------------------------
  const DATA_URL = 'assets/json/recipes-it.enriched.json';
  const LS_FAVORITES_KEY = 'rls_favorites_v1';

  // -------------------------
  // Stato
  // -------------------------
  let allRecipes = [];
  let favorites = loadFavorites();

  // -------------------------
  // DOM refs (devono combaciare con index.html)
  // -------------------------
  const dom = {
    searchInput: null,
    updateBtn: null,
    favoritesToggle: null,
    recipeCount: null,
    recipesContainer: null,
    videoModal: null,
    videoFrame: null,
    closeVideo: null,
  };

  function cacheDom() {
    dom.searchInput = document.getElementById('searchInput');
    dom.updateBtn = document.getElementById('updateDataBtn');
    dom.favoritesToggle = document.getElementById('favoritesToggle');
    dom.recipeCount = document.getElementById('recipeCount');
    dom.recipesContainer = document.getElementById('recipesContainer');
    dom.videoModal = document.getElementById('videoModal');
    dom.videoFrame = document.getElementById('videoFrame');
    dom.closeVideo = document.getElementById('closeVideo');

    const missing = Object.entries(dom)
      .filter(([, el]) => !el)
      .map(([key]) => key);

    if (missing.length) {
      console.error(
        'Errore: elementi DOM mancanti. Controlla ID in index.html.',
        missing
      );
    }
  }

  // -------------------------
  // LocalStorage favorites
  // -------------------------
  function loadFavorites() {
    try {
      const raw = localStorage.getItem(LS_FAVORITES_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(favorites));
    } catch {
      // nessun dramma se localStorage fallisce
    }
  }

  function isFavorite(id) {
    return !!favorites[id];
  }

  function toggleFavorite(id) {
    if (!id) return;
    favorites[id] = !favorites[id];
    if (!favorites[id]) delete favorites[id];
    saveFavorites();
    renderRecipes();
  }

  // -------------------------
  // Utility
  // -------------------------
  function normalize(str) {
    return (str || '').toLowerCase();
  }

  function matchesSearch(recipe, term) {
    if (!term) return true;
    const q = normalize(term);

    const title = normalize(recipe.title);
    const ingredients = normalize((recipe.ingredients || []).join(' '));

    return title.includes(q) || ingredients.includes(q);
  }

  function getRecipeUrl(r) {
    return (
      r.url ||
      (r.links && r.links.source) ||
      (r.enrichedFrom && r.enrichedFrom.url) ||
      null
    );
  }

  function getVideoUrl(r) {
    // Assume che i video validi siano già nel JSON come r.video.url
    return r.video && r.video.url ? r.video.url : null;
  }

  // -------------------------
  // Video modal
  // -------------------------
  function openVideo(url) {
    if (!dom.videoModal || !dom.videoFrame) return;
    dom.videoFrame.src = url;
    dom.videoModal.classList.remove('hidden');
  }

  function closeVideo() {
    if (!dom.videoModal || !dom.videoFrame) return;
    dom.videoFrame.src = '';
    dom.videoModal.classList.add('hidden');
  }

  // -------------------------
  // Render
  // -------------------------
  function renderRecipes() {
    if (!dom.recipesContainer) return;

    const term = dom.searchInput ? dom.searchInput.value.trim() : '';
    const onlyFav = dom.favoritesToggle
      ? dom.favoritesToggle.checked
      : false;

    const visible = allRecipes.filter((r) => {
      if (onlyFav && !isFavorite(r.id)) return false;
      return matchesSearch(r, term);
    });

    if (dom.recipeCount) {
      dom.recipeCount.textContent = `Ricette visibili: ${visible.length}`;
    }

    dom.recipesContainer.innerHTML = '';

    visible.forEach((r) => {
      const card = document.createElement('article');
      card.className = 'recipe-card';

      const fav = isFavorite(r.id);
      const difficulty = r.difficulty || r.diff || '';
      const servings = r.servings || r.persone || r.porzioni || r.portions;
      const source =
        r.source ||
        (r.enrichedFrom && r.enrichedFrom.source) ||
        (r.enrichedFrom && r.enrichedFrom.hostname) ||
        '';
      const recipeUrl = getRecipeUrl(r);
      const videoUrl = getVideoUrl(r);
      const hasVideo = !!videoUrl;
      const ingredientsCount = Array.isArray(r.ingredients)
        ? r.ingredients.length
        : 0;

      card.innerHTML = `
        <div class="recipe-card-header">
          <button class="fav-btn" data-id="${r.id}" title="Preferito">
            ${fav ? '★' : '☆'}
          </button>
          <h2 class="recipe-title">${r.title || 'Ricetta senza titolo'}</h2>
        </div>

        <div class="recipe-meta">
          ${
            difficulty
              ? `<span class="badge">Diff: ${difficulty}</span>`
              : ''
          }
          ${
            servings
              ? `<span class="badge">Porzioni: ${servings}</span>`
              : ''
          }
          ${
            source
              ? `<span class="badge badge-source">${source}</span>`
              : ''
          }
          ${
            ingredientsCount
              ? `<span class="badge badge-ingredients">${ingredientsCount} ingredienti</span>`
              : ''
          }
        </div>

        <div class="recipe-actions">
          ${
            recipeUrl
              ? `<button class="btn primary" data-open-recipe="${encodeURI(
                  recipeUrl
                )}">Apri ricetta</button>`
              : `<button class="btn disabled" disabled>Nessun link</button>`
          }

          <button class="btn ghost" data-show-ingredients="${r.id}">
            Lista ingredienti
          </button>

          ${
            hasVideo
              ? `<button class="btn video" data-video="${encodeURI(
                  videoUrl
                )}">Guarda video</button>`
              : `<button class="btn ghost" disabled>Video n/d</button>`
          }
        </div>
      `;

      dom.recipesContainer.appendChild(card);
    });

    attachCardEvents();
  }

  function attachCardEvents() {
    if (!dom.recipesContainer) return;

    // Preferiti
    dom.recipesContainer.querySelectorAll('.fav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        toggleFavorite(id);
      });
    });

    // Apri ricetta
    dom.recipesContainer
      .querySelectorAll('[data-open-recipe]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const url = btn.getAttribute('data-open-recipe');
          if (url) window.open(url, '_blank', 'noopener');
        });
      });

    // Lista ingredienti (popup semplice)
    dom.recipesContainer
      .querySelectorAll('[data-show-ingredients]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-show-ingredients');
          const recipe = allRecipes.find((r) => r.id === id);
          if (!recipe || !Array.isArray(recipe.ingredients)) {
            alert('Nessuna lista ingredienti disponibile.');
            return;
          }
          alert('Ingredienti:\n\n' + recipe.ingredients.join('\n'));
        });
      });

    // Video
    dom.recipesContainer
      .querySelectorAll('[data-video]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const url = btn.getAttribute('data-video');
          if (url) openVideo(url);
        });
      });
  }

  // -------------------------
  // Load data
  // -------------------------
  async function loadData() {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const base = Array.isArray(json) ? json : json.recipes || [];

      allRecipes = base.map((r, index) => ({
        id: r.id || `r-${index}`,
        ...r,
      }));

      console.log('Caricate ricette:', allRecipes.length);
      renderRecipes();
    } catch (err) {
      console.error('Errore nel caricare i dati ricette:', err);
      if (dom.recipeCount) {
        dom.recipeCount.textContent = 'Errore nel caricamento dati.';
      }
    }
  }

  // -------------------------
  // Bind UI
  // -------------------------
  function bindUI() {
    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', renderRecipes);
    }

    if (dom.favoritesToggle) {
      dom.favoritesToggle.addEventListener('change', renderRecipes);
    }

    if (dom.updateBtn) {
      dom.updateBtn.addEventListener('click', () => {
        loadData();
      });
    }

    if (dom.closeVideo) {
      dom.closeVideo.addEventListener('click', closeVideo);
    }

    if (dom.videoModal) {
      dom.videoModal.addEventListener('click', (e) => {
        if (e.target === dom.videoModal) closeVideo();
      });
    }
  }

  // -------------------------
  // Init
  // -------------------------
  document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    bindUI();
    loadData();
  });
})();
