// app.v17.js
// Ricette & Lista Spesa - Frontend v17
// Single source of truth: assets/json/recipes-it.enriched.json

(function () {
  console.log('Avvio app Ricette & Lista Spesa v17');

  // ---- Config --------------------------------------------------------------

  const DATA_URL = 'assets/json/recipes-it.enriched.json';
  const LS_FAVORITES_KEY = 'rls_favorites_v1';

  // ---- Stato ---------------------------------------------------------------

  const state = {
    all: [],
    filtered: [],
    favorites: loadFavorites(),
    loading: false,
  };

  // ---- DOM refs (NUOVI ID) -------------------------------------------------

  const searchInput = document.getElementById('searchInput');
  const updateBtn = document.getElementById('updateBtn');
  const favoritesOnly = document.getElementById('favoritesOnly');
  const visibleCount = document.getElementById('visibleCount');
  const recipesContainer = document.getElementById('recipesContainer');

  const recipeModal = document.getElementById('recipeModal') || null;
  const closeRecipeModal = document.getElementById('closeRecipeModal') || null;
  const modalTitle = recipeModal
    ? recipeModal.querySelector('[data-modal-title]')
    : null;
  const modalBody = recipeModal
    ? recipeModal.querySelector('[data-modal-body]')
    : null;

  // Controllo DOM: se manca qualcosa, non proseguo (evitiamo bug silenziosi)
  if (!searchInput || !updateBtn || !favoritesOnly || !visibleCount || !recipesContainer) {
    console.error(
      'Errore: elementi DOM mancanti. Controlla che index.html esponga questi ID: ' +
        'searchInput, updateBtn, favoritesOnly, visibleCount, recipesContainer'
    );
    return;
  }

  // ---- Inizializzazione ----------------------------------------------------

  attachEvents();
  loadData(true).catch((err) => {
    console.error('Errore iniziale caricando i dati:', err);
  });

  // ---- Funzioni principali -------------------------------------------------

  async function loadData(initial = false) {
    if (state.loading) return;
    state.loading = true;

    try {
      const url = initial ? DATA_URL : `${DATA_URL}?t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const recipes = Array.isArray(data) ? data : data.recipes || [];

      state.all = normalizeRecipes(recipes);
      applyFilters();
      console.log(`Caricate ricette: ${state.all.length}`);
    } catch (err) {
      console.error('Impossibile caricare le ricette:', err);
    } finally {
      state.loading = false;
    }
  }

  function applyFilters() {
    const q = (searchInput.value || '').trim().toLowerCase();
    const onlyFav = !!favoritesOnly.checked;

    let list = state.all;

    if (q) {
      list = list.filter((r) => {
        const haystack =
          (r.title || '') +
          ' ' +
          (r.ingredientsText || '') +
          ' ' +
          (r.source || '');
        return haystack.toLowerCase().includes(q);
      });
    }

    if (onlyFav) {
      list = list.filter((r) => state.favorites.has(r.id));
    }

    state.filtered = list;
    renderRecipes();
  }

  function renderRecipes() {
    recipesContainer.innerHTML = '';

    if (!state.filtered.length) {
      recipesContainer.innerHTML =
        '<p class="empty-state">Nessuna ricetta trovata. Prova a cambiare i filtri.</p>';
      visibleCount.textContent = '0';
      return;
    }

    const frag = document.createDocumentFragment();

    state.filtered.forEach((recipe) => {
      const card = document.createElement('article');
      card.className = 'recipe-card';

      const isFav = state.favorites.has(recipe.id);

      card.innerHTML = `
        <div class="recipe-header">
          <h3 class="recipe-title">${escapeHtml(recipe.title)}</h3>
          <button class="fav-btn ${isFav ? 'fav-btn--active' : ''}" data-id="${recipe.id}" title="${
        isFav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'
      }">
            ★
          </button>
        </div>
        <div class="recipe-meta">
          ${
            recipe.portions
              ? `<span class="meta-pill">Porzioni: ${recipe.portions}</span>`
              : ''
          }
          ${
            recipe.diff
              ? `<span class="meta-pill">Diff: ${escapeHtml(recipe.diff)}</span>`
              : ''
          }
          ${
            recipe.sourceLabel
              ? `<span class="meta-pill meta-pill--soft">${escapeHtml(
                  recipe.sourceLabel
                )}</span>`
              : ''
          }
        </div>
        <div class="recipe-actions">
          ${
            recipe.url
              ? `<button class="btn btn-primary" data-open-recipe="${encodeURIComponent(
                  recipe.url
                )}">Apri ricetta</button>`
              : `<button class="btn btn-disabled" disabled>Nessun link</button>`
          }
          ${
            recipe.video
              ? `<button class="btn btn-ghost" data-open-video="${encodeURIComponent(
                  recipe.video
                )}">Guarda video</button>`
              : `<button class="btn btn-ghost btn-ghost--muted" disabled>Video n/d</button>`
          }
          ${
            recipe.ingredients && recipe.ingredients.length
              ? `<button class="btn btn-outline" data-show-modal="${
                  recipe.id
                }">Lista ingredienti</button>`
              : ''
          }
        </div>
      `;

      frag.appendChild(card);
    });

    recipesContainer.appendChild(frag);
    visibleCount.textContent = String(state.filtered.length);

    // Attach eventi alle card (delegati sarebbe ancora meglio, ma chiaro così)
    recipesContainer
      .querySelectorAll('[data-open-recipe]')
      .forEach((btn) =>
        btn.addEventListener('click', () => {
          const url = decodeURIComponent(btn.getAttribute('data-open-recipe'));
          if (url) window.open(url, '_blank', 'noopener');
        })
      );

    recipesContainer
      .querySelectorAll('[data-open-video]')
      .forEach((btn) =>
        btn.addEventListener('click', () => {
          const url = decodeURIComponent(btn.getAttribute('data-open-video'));
          if (url) window.open(url, '_blank', 'noopener');
        })
      );

    recipesContainer
      .querySelectorAll('.fav-btn')
      .forEach((btn) =>
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          toggleFavorite(id, btn);
        })
      );

    if (recipeModal && modalTitle && modalBody) {
      recipesContainer
        .querySelectorAll('[data-show-modal]')
        .forEach((btn) =>
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-show-modal');
            const r = state.all.find((x) => x.id === id);
            if (!r) return;
            openRecipeModal(r);
          })
        );
    }
  }

  // ---- Event wiring --------------------------------------------------------

  function attachEvents() {
    searchInput.addEventListener('input', debounce(applyFilters, 150));

    favoritesOnly.addEventListener('change', () => {
      applyFilters();
    });

    updateBtn.addEventListener('click', async () => {
      if (state.loading) return;
      updateBtn.disabled = true;
      updateBtn.textContent = 'Aggiorno...';

      await loadData(false);

      updateBtn.textContent = 'Aggiorna dati';
      updateBtn.disabled = false;
    });

    if (recipeModal && closeRecipeModal) {
      closeRecipeModal.addEventListener('click', closeRecipeModalFn);
      recipeModal.addEventListener('click', (e) => {
        if (e.target === recipeModal) closeRecipeModalFn();
      });
    }
  }

  // ---- Preferiti -----------------------------------------------------------

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(LS_FAVORITES_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr);
    } catch {
      return new Set();
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(
        LS_FAVORITES_KEY,
        JSON.stringify(Array.from(state.favorites))
      );
    } catch {
      // se fallisce, pazienza, non blocchiamo l'app
    }
  }

  function toggleFavorite(id, btn) {
    if (!id) return;
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      btn.classList.remove('fav-btn--active');
      btn.title = 'Aggiungi ai preferiti';
    } else {
      state.favorites.add(id);
      btn.classList.add('fav-btn--active');
      btn.title = 'Rimuovi dai preferiti';
    }
    saveFavorites();
    if (favoritesOnly.checked) {
      applyFilters();
    }
  }

  // ---- Modale --------------------------------------------------------------

  function openRecipeModal(recipe) {
    if (!recipeModal || !modalTitle || !modalBody) return;

    modalTitle.textContent = recipe.title || 'Dettagli ricetta';

    const ing =
      recipe.ingredients && recipe.ingredients.length
        ? `<ul class="modal-ingredients">
            ${recipe.ingredients
              .map(
                (i) =>
                  `<li>${escapeHtml(
                    typeof i === 'string' ? i : i.text || ''
                  )}</li>`
              )
              .join('')}
           </ul>`
        : '<p>Nessun ingrediente strutturato disponibile.</p>';

    const steps =
      recipe.steps && recipe.steps.length
        ? `<ol class="modal-steps">
            ${recipe.steps
              .map((s) => `<li>${escapeHtml(s)}</li>`)
              .join('')}
           </ol>`
        : '';

    modalBody.innerHTML = ing + steps;

    recipeModal.classList.add('is-visible');
    document.body.classList.add('modal-open');
  }

  function closeRecipeModalFn() {
    if (!recipeModal) return;
    recipeModal.classList.remove('is-visible');
    document.body.classList.remove('modal-open');
  }

  // ---- Util ---------------------------------------------------------------

  function normalizeRecipes(list) {
    return list
      .map((r, idx) => {
        if (!r) return null;

        const id =
          r.id ||
          r.slug ||
          (r.url ? String(r.url) : `recipe-${idx}`);

        const ingredients = Array.isArray(r.ingredients)
          ? r.ingredients
          : [];

        const steps = Array.isArray(r.steps) ? r.steps : [];

        const sourceHost = (() => {
          try {
            if (!r.url) return null;
            const u = new URL(r.url);
            return u.hostname.replace('www.', '');
          } catch {
            return null;
          }
        })();

        return {
          id,
          title: r.title || 'Ricetta senza titolo',
          url: r.url || null,
          video: r.video || null,
          portions: r.portions || r.porzioni || null,
          diff: r.diff || r.difficulty || null,
          source: r.source || sourceHost || null,
          sourceLabel: sourceHost || r.source || null,
          ingredients,
          ingredientsText: ingredients
            .map((i) =>
              typeof i === 'string' ? i : i.text || i.name || ''
            )
            .join(' '),
          steps,
        };
      })
      .filter(Boolean);
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
