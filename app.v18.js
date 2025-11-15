// app.v18.js
// Ricette & Lista Spesa – Frontend v18
// UI pulita, ricerca, preferiti, modale video con fallback

(function () {
  'use strict';

  // -------------------------
  // Config
  // -------------------------
  const DATA_URL = 'assets/json/recipes-it.enriched.json';
  const LS_FAVORITES_KEY = 'rls_favorites_v1';

  // -------------------------
  // DOM refs
  // -------------------------
  const dom = {
    searchInput: document.getElementById('search'),
    updateDataBtn: document.getElementById('updateDataBtn'),
    favoritesToggle: document.getElementById('favoritesToggle'),
    recipeCount: document.getElementById('recipeCount'),
    recipesContainer: document.getElementById('recipes'),
    videoModal: document.getElementById('videoModal'),
    videoFrame: document.getElementById('videoFrame'),
    closeVideo: document.getElementById('closeVideo'),
  };

  // Log non bloccante se manca qualcosa
  {
    const missing = Object.entries(dom).filter(([, el]) => !el).map(([k]) => k);
    if (missing.length) {
      console.warn('Elementi DOM mancanti (verifica index.html, NON blocco).', missing);
    }
  }

  // -------------------------
  // Stato
  // -------------------------
  let allRecipes = [];
  let favorites = loadFavorites();

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
    } catch {}
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

  // Normalizza qualsiasi URL video in embed sicuro youtube-nocookie
  function normalizeVideoUrl(videoId) {
    const id = String(videoId || '').trim();
    if (!id) return '';

    // Se è già un URL completo
    if (id.includes('youtube.com') || id.includes('youtu.be')) {
      if (id.includes('/embed/')) {
        return id.replace('youtube.com', 'www.youtube-nocookie.com');
      }
      const short = id.match(/^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{6,})/i);
      if (short) {
        return `https://www.youtube-nocookie.com/embed/${short[1]}?rel=0&modestbranding=1&playsinline=1`;
      }
      const watch = id.match(/[?&]v=([A-Za-z0-9_-]{6,})/i);
      if (watch) {
        return `https://www.youtube-nocookie.com/embed/${watch[1]}?rel=0&modestbranding=1&playsinline=1`;
      }
    }

    // Altrimenti è solo l'ID del video
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
  }

  // -------------------------
  // Modale video con fallback
  // -------------------------
  function openVideo(videoId) {
    if (!dom.videoModal || !dom.videoFrame) return;

    const embed = normalizeVideoUrl(videoId);
    if (!embed) {
      alert('Video non disponibile');
      return;
    }

    dom.videoFrame.setAttribute('title', 'Video ricetta');
    dom.videoFrame.setAttribute(
      'allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
    );
    dom.videoFrame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

    let fallbackTimer = setTimeout(() => {
      try { dom.videoFrame.src = ''; } catch {}
      window.open(embed.replace('youtube-nocookie.com', 'youtube.com'), '_blank', 'noopener');
      closeVideo();
    }, 2000);

    dom.videoFrame.onload = () => { clearTimeout(fallbackTimer); };
    dom.videoFrame.onerror = () => {
      clearTimeout(fallbackTimer);
      try { dom.videoFrame.src = ''; } catch {}
      window.open(embed.replace('youtube-nocookie.com', 'youtube.com'), '_blank', 'noopener');
      closeVideo();
    };

    dom.videoFrame.src = embed;
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
    const onlyFav = dom.favoritesToggle ? dom.favoritesToggle.checked : false;

    const filtered = allRecipes.filter((r) => {
      if (onlyFav && !isFavorite(r.id)) return false;
      return matchesSearch(r, term);
    });

    if (dom.recipeCount) {
      dom.recipeCount.textContent = `Ricette visibili: ${filtered.length}`;
    }

    dom.recipesContainer.innerHTML = '';

    filtered.forEach((r) => {
      const card = document.createElement('article');
      card.className = 'recipe-card';

      const fav = isFavorite(r.id);
      const difficulty = r.difficulty || r.diff || '';
      const servings = r.servings || r.persone || r.porzioni || r.portions;
      const source = r.source || (r.enrichedFrom && r.enrichedFrom.source) || '';
      const hasVideo = Boolean(r.videoId && r.videoId.length > 0);
      const videoLabel = hasVideo ? 'Guarda video' : 'Video n/d';

      const recipeUrl =
        r.url ||
        (r.links && r.links.source) ||
        (r.enrichedFrom && r.enrichedFrom.url) ||
        null;

      const ingredientsCount = Array.isArray(r.ingredients) ? r.ingredients.length : 0;

      card.innerHTML = `
        <div class="recipe-card-header">
          <button class="fav-btn" data-id="${r.id || ''}" title="Aggiungi ai preferiti">
            ${fav ? '★' : '☆'}
          </button>
          <h2 class="recipe-title">${r.title || 'Ricetta senza titolo'}</h2>
        </div>

        <div class="recipe-meta">
          ${difficulty ? `<span class="badge">Diff: ${difficulty}</span>` : ''}
          ${servings ? `<span class="badge">Porzioni: ${servings}</span>` : ''}
          ${source ? `<span class="badge badge-source">${source}</span>` : ''}
          ${ingredientsCount ? `<span class="badge badge-ingredients">${ingredientsCount} ingredienti</span>` : ''}
        </div>

        <div class="recipe-actions">
          ${
            recipeUrl
              ? `<button class="btn primary" data-open-recipe="${encodeURI(recipeUrl)}">Apri ricetta</button>`
              : `<button class="btn disabled" disabled>Nessun link</button>`
          }
          <button class="btn ghost" data-show-ingredients="${r.id || ''}">Lista ingredienti</button>
          ${
            hasVideo
              ? `<button class="btn link" data-video="${r.videoId}">Guarda video</button>`
              : `<button class="btn ghost" disabled>${videoLabel}</button>`
          }
        </div>
      `;

      dom.recipesContainer.appendChild(card);
    });

    attachCardEvents();
  }

  function attachCardEvents() {
    if (!dom.recipesContainer) return;

    dom.recipesContainer.querySelectorAll('.fav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        toggleFavorite(id);
      });
    });

    dom.recipesContainer.querySelectorAll('[data-open-recipe]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-open-recipe');
        if (url) window.open(url, '_blank', 'noopener');
      });
    });

    dom.recipesContainer.querySelectorAll('[data-show-ingredients]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-show-ingredients');
        const recipe = allRecipes.find((r) => r.id === id);
        if (!recipe || !Array.isArray(recipe.ingredients) || !recipe.ingredients.length) {
          alert('Nessuna lista ingredienti disponibile.');
          return;
        }
        alert('Ingredienti:\n\n' + recipe.ingredients.join('\n'));
      });
    });

    dom.recipesContainer.querySelectorAll('[data-video]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const videoId = btn.getAttribute('data-video');
        if (videoId) openVideo(videoId);
      });
    });
  }

  // -------------------------
  // Data
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
      if (dom.recipeCount) dom.recipeCount.textContent = 'Errore nel caricamento dati.';
    }
  }

  // -------------------------
  // Event listeners
  // -------------------------
  if (dom.searchInput) {
    dom.searchInput.addEventListener('input', renderRecipes);
  }
  if (dom.favoritesToggle) {
    dom.favoritesToggle.addEventListener('change', renderRecipes);
  }
  if (dom.updateDataBtn) {
    dom.updateDataBtn.addEventListener('click', loadData);
  }
  if (dom.closeVideo) {
    dom.closeVideo.addEventListener('click', closeVideo);
  }
  if (dom.videoModal) {
    dom.videoModal.addEventListener('click', (e) => {
      if (e.target === dom.videoModal) closeVideo();
    });
  }

  // -------------------------
  // Init
  // -------------------------
  console.log('Avvio app Ricette & Lista Spesa v18');
  loadData();
})();