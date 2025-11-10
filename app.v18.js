// app.v18.js
// Ricette & Lista Spesa - Frontend v18
// Pulito, robusto, niente criceti.

(function () {
  'use strict';

  const JSON_URL = 'assets/json/recipes-it.enriched.json';
  const FAV_KEY = 'rls_favorites_v2';

  const dom = {};
  const state = {
    allRecipes: [],
    filteredRecipes: [],
    favoritesOnly: false,
    favorites: loadFavorites()
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    console.log('Avvio app Ricette & Lista Spesa v18');

    cacheDom();
    warnIfMissingDom();

    if (!dom.recipesContainer) {
      console.error('Impossibile inizializzare: #recipesContainer mancante.');
      return;
    }

    bindUI();
    loadAndRender(false);
  }

  function cacheDom() {
    dom.searchInput      = document.getElementById('searchInput');
    dom.updateDataBtn    = document.getElementById('updateDataBtn');
    dom.favoritesToggle  = document.getElementById('favoritesToggle');
    dom.recipeCount      = document.getElementById('recipeCount');
    dom.recipesContainer = document.getElementById('recipesContainer');
    dom.videoModal       = document.getElementById('videoModal');
    dom.videoFrame       = document.getElementById('videoFrame');
    dom.body             = document.body || document.documentElement;
  }

  function warnIfMissingDom() {
    const required = [
      'searchInput',
      'updateDataBtn',
      'favoritesToggle',
      'recipeCount',
      'recipesContainer'
    ];

    const missing = required.filter(id => !document.getElementById(id));

    if (missing.length) {
      console.warn('Elementi DOM attesi mancanti (warning, non blocco):', missing);
    }
  }

  function bindUI() {
    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', () => {
        applyFilters();
        renderRecipes();
      });
    }

    if (dom.favoritesToggle) {
      dom.favoritesToggle.addEventListener('change', () => {
        state.favoritesOnly = !!dom.favoritesToggle.checked;
        applyFilters();
        renderRecipes();
      });
    }

    if (dom.updateDataBtn) {
      dom.updateDataBtn.addEventListener('click', async () => {
        if (dom.updateDataBtn.disabled) return;
        dom.updateDataBtn.disabled = true;
        dom.updateDataBtn.textContent = 'Aggiornamento...';
        try {
          await loadAndRender(true);
        } finally {
          dom.updateDataBtn.disabled = false;
          dom.updateDataBtn.textContent = 'Aggiorna dati';
        }
      });
    }

    // Modale video
    if (dom.videoModal && dom.videoFrame) {
      dom.videoModal.addEventListener('click', evt => {
        if (evt.target === dom.videoModal || evt.target.hasAttribute('data-close-video')) {
          closeVideoModal();
        }
      });
      document.addEventListener('keydown', evt => {
        if (evt.key === 'Escape') closeVideoModal();
      });
    }
  }

  async function loadAndRender(forceBypassCache) {
    const url = forceBypassCache
      ? `${JSON_URL}?t=${Date.now()}`
      : JSON_URL;

    try {
      const res = await fetch(url, { cache: forceBypassCache ? 'no-store' : 'default' });
      if (!res.ok) {
        console.error('Errore nel caricamento JSON:', res.status, res.statusText);
        return;
      }

      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : (raw.recipes || raw.ricette || []);

      if (!Array.isArray(list)) {
        console.error('Formato JSON non valido: atteso array in `recipes`.');
        return;
      }

      state.allRecipes = normalizeRecipes(list);
      console.log('Caricate ricette:', state.allRecipes.length);

      applyFilters();
      renderRecipes();
    } catch (err) {
      console.error('Eccezione nel caricamento dati:', err);
    }
  }

  function normalizeRecipes(list) {
    return list.map((r, index) => {
      const id =
        r.id ||
        r.slug ||
        r.url ||
        r.link ||
        `recipe-${index}`;

      const title =
        (r.title && String(r.title).trim()) ||
        'Ricetta senza titolo';

      const url = r.url || r.link || null;

      const portions =
        r.portions ||
        r.porzioni ||
        r.servings ||
        null;

      const difficulty =
        r.diff ||
        r.difficulty ||
        r.difficolta ||
        null;

      const ingredients =
        (Array.isArray(r.ingredients) && r.ingredients) ||
        (Array.isArray(r.ingredienti) && r.ingredienti) ||
        [];

      const steps =
        (Array.isArray(r.steps) && r.steps) ||
        (Array.isArray(r.istruzioni) && r.istruzioni) ||
        (Array.isArray(r.metodo) && r.metodo) ||
        [];

      const video =
        r.video ||
        r.videoUrl ||
        r.youtube ||
        null;

      const sources = [];
      if (r.source) sources.push(r.source);
      if (Array.isArray(r.enrichedFrom)) {
        r.enrichedFrom.forEach(s => sources.push(s));
      } else if (r.enrichedFrom) {
        sources.push(r.enrichedFrom);
      }

      return {
        id: String(id),
        title,
        url,
        portions,
        difficulty,
        ingredients,
        steps,
        video,
        sources: sources.filter(Boolean)
      };
    });
  }

  function applyFilters() {
    const term = dom.searchInput
      ? dom.searchInput.value.trim().toLowerCase()
      : '';

    const favSet = new Set(state.favorites);

    let result = state.allRecipes;

    if (term) {
      result = result.filter(r => {
        if (r.title && r.title.toLowerCase().includes(term)) return true;

        if (Array.isArray(r.ingredients)) {
          if (r.ingredients.some(i => String(i).toLowerCase().includes(term))) {
            return true;
          }
        }

        return false;
      });
    }

    if (state.favoritesOnly) {
      result = result.filter(r => favSet.has(r.id));
    }

    state.filteredRecipes = result;
  }

  function renderRecipes() {
    if (!dom.recipesContainer) return;

    dom.recipesContainer.innerHTML = '';

    const data = state.filteredRecipes || [];
    if (dom.recipeCount) {
      dom.recipeCount.textContent = `Ricette visibili: ${data.length}`;
    }

    if (!data.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Nessuna ricetta trovata con i filtri attuali.';
      dom.recipesContainer.appendChild(empty);
      return;
    }

    const favSet = new Set(state.favorites);

    const frag = document.createDocumentFragment();

    data.forEach(recipe => {
      const card = createRecipeCard(recipe, favSet.has(recipe.id));
      frag.appendChild(card);
    });

    dom.recipesContainer.appendChild(frag);
  }

  function createRecipeCard(recipe, isFavorite) {
    const card = document.createElement('article');
    card.className = 'recipe-card';

    // Header
    const header = document.createElement('div');
    header.className = 'recipe-card-header';

    const favBtn = document.createElement('button');
    favBtn.className = 'fav-toggle';
    favBtn.type = 'button';
    favBtn.innerHTML = isFavorite ? '★' : '☆';
    favBtn.title = 'Aggiungi/Rimuovi dai preferiti';

    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(recipe.id, favBtn);
    });

    const title = document.createElement('h3');
    title.className = 'recipe-title';
    title.textContent = recipe.title;

    header.appendChild(favBtn);
    header.appendChild(title);
    card.appendChild(header);

    // Meta
    const meta = document.createElement('div');
    meta.className = 'recipe-meta';

    if (recipe.difficulty) {
      const d = document.createElement('span');
      d.textContent = `Diff: ${recipe.difficulty}`;
      meta.appendChild(d);
    }

    if (recipe.portions) {
      const p = document.createElement('span');
      p.textContent = `Porzioni: ${recipe.portions}`;
      meta.appendChild(p);
    }

    if (recipe.sources && recipe.sources.length) {
      const s = document.createElement('span');
      s.textContent = recipe.sources.join(' · ');
      s.className = 'recipe-source';
      meta.appendChild(s);
    }

    card.appendChild(meta);

    // Buttons row
    const actions = document.createElement('div');
    actions.className = 'recipe-actions';

    if (recipe.url) {
      const openBtn = document.createElement('a');
      openBtn.href = recipe.url;
      openBtn.target = '_blank';
      openBtn.rel = 'noopener noreferrer';
      openBtn.className = 'btn primary';
      openBtn.textContent = 'Apri ricetta';
      actions.appendChild(openBtn);
    } else {
      const disabled = document.createElement('button');
      disabled.type = 'button';
      disabled.className = 'btn disabled';
      disabled.textContent = 'Nessun link';
      disabled.disabled = true;
      actions.appendChild(disabled);
    }

    // Lista ingredienti (se disponibili)
    if (recipe.ingredients && recipe.ingredients.length) {
      const ingBtn = document.createElement('button');
      ingBtn.type = 'button';
      ingBtn.className = 'btn secondary';
      ingBtn.textContent = 'Lista ingredienti';
      ingBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showIngredients(recipe);
      });
      actions.appendChild(ingBtn);
    }

    // Video (se presente)
    if (recipe.video && dom.videoModal && dom.videoFrame) {
      const vBtn = document.createElement('button');
      vBtn.type = 'button';
      vBtn.className = 'btn ghost';
      vBtn.textContent = 'Video';
      vBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openVideo(recipe.video);
      });
      actions.appendChild(vBtn);
    }

    card.appendChild(actions);

    return card;
  }

  function toggleFavorite(id, btn) {
    const idx = state.favorites.indexOf(id);
    if (idx === -1) {
      state.favorites.push(id);
      if (btn) btn.innerHTML = '★';
    } else {
      state.favorites.splice(idx, 1);
      if (btn) btn.innerHTML = '☆';
    }

    saveFavorites();

    if (state.favoritesOnly) {
      applyFilters();
      renderRecipes();
    }
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites));
    } catch (err) {
      console.warn('Impossibile salvare i preferiti:', err);
    }
  }

  function showIngredients(recipe) {
    if (!recipe || !recipe.ingredients || !recipe.ingredients.length) return;

    const text = `Ingredienti per "${recipe.title}":\n\n- ` +
      recipe.ingredients.map(i => String(i)).join('\n- ');

    // Per ora prompt semplice; in futuro modale dedicata.
    alert(text);
  }

  function openVideo(video) {
    if (!dom.videoModal || !dom.videoFrame) return;

    const url = toVideoUrl(video);
    if (!url) {
      console.warn('Formato video non riconosciuto:', video);
      return;
    }

    dom.videoFrame.src = url;
    dom.videoModal.classList.add('open');
  }

  function closeVideoModal() {
    if (!dom.videoModal || !dom.videoFrame) return;
    dom.videoModal.classList.remove('open');
    dom.videoFrame.src = '';
  }

  function toVideoUrl(video) {
    const v = String(video).trim();

    // Se è già un URL
    if (/^https?:\/\//i.test(v)) {
      return v;
    }

    // Se sembra un ID YouTube
    if (/^[\w-]{8,}$/.test(v)) {
      return `https://www.youtube.com/embed/${v}`;
    }

    return null;
  }

})();
