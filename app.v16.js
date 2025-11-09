// app.v16.js
// Ricette & Lista Spesa - Frontend logico completo

(function () {
  const RECIPES_URL = 'assets/json/recipes-it.json';          // adatta se diverso
  const VIDEO_INDEX_URL = 'assets/json/video_index.resolved.json';

  const SELECTORS = {
    searchInput: '#search-input',
    visibleCount: '#visible-count',
    recipesGrid: '#recipes-grid',
    cardTemplate: '#recipe-card-template',

    videoModal: '#video-modal',
    videoFrame: '#video-frame',
    videoTitle: '#video-title',
    videoClose: '#video-close',

    recipeModal: '#recipe-modal',
    recipeContent: '#recipe-content',
    recipeClose: '#recipe-close',
  };

  let ALL_RECIPES = [];
  let FILTERED_RECIPES = [];
  let VIDEO_MAP = {};
  let SHOPPING_LIST = loadShoppingList();

  // ==========================
  // Init
  // ==========================
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      const [recipesData, videoData] = await Promise.all([
        fetchJson(RECIPES_URL),
        fetchJson(VIDEO_INDEX_URL, true) // opzionale
      ]);

      const recipes = normalizeRecipes(recipesData);
      ALL_RECIPES = recipes;
      FILTERED_RECIPES = recipes;

      VIDEO_MAP = buildVideoMap(videoData || []);

      renderRecipes(FILTERED_RECIPES);

      setupSearch();
      setupModals();
      setupGenerator(); // sezione generatore ingredienti + camera

    } catch (err) {
      console.error('Errore durante init():', err);
      const errSpan = document.querySelector('#load-error');
      if (errSpan) errSpan.textContent = 'Errore caricamento dati';
    }
  }

  // ==========================
  // Fetch & normalize
  // ==========================

  async function fetchJson(url, optional = false) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) {
        if (optional) return null;
        throw new Error(`HTTP ${res.status} per ${url}`);
      }
      return await res.json();
    } catch (e) {
      if (optional) {
        console.warn(`Impossibile caricare opzionale ${url}:`, e.message);
        return null;
      }
      throw e;
    }
  }

  function normalizeRecipes(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.recipes)) return data.recipes;
    console.warn('Formato recipes-it.json non riconosciuto, ritorno []');
    return [];
  }

  function buildVideoMap(list) {
    if (!list) return {};

    const map = {};

    const add = (key, entry) => {
      if (!key) return;
      const k = key.toLowerCase().trim();
      if (!k) return;
      if (!map[k]) map[k] = [];
      map[k].push(entry);
    };

    list.forEach(v => {
      if (!v || !v.youtubeId) return;
      const base = {
        youtubeId: v.youtubeId,
        title: v.title || '',
        source: v.source || 'youtube',
        confidence: typeof v.confidence === 'number' ? v.confidence : 0
      };
      if (v.slug) add(v.slug, base);
      if (v.title) add(slugify(v.title), base);
      if (v.aliases && Array.isArray(v.aliases)) {
        v.aliases.forEach(a => add(slugify(a), base));
      }
    });

    return map;
  }

  // ==========================
  // Rendering ricette
  // ==========================

  function renderRecipes(recipes) {
    const grid = qs(SELECTORS.recipesGrid);
    const tpl = qs(SELECTORS.cardTemplate);
    const countEl = qs(SELECTORS.visibleCount);

    if (!grid || !tpl) {
      console.error('Mancano container o template per le ricette');
      return;
    }

    grid.innerHTML = '';

    recipes.forEach((recipe, index) => {
      const node = tpl.content
        ? tpl.content.firstElementChild.cloneNode(true)
        : tpl.firstElementChild.cloneNode(true);

      const titleEl = node.querySelector('.recipe-title');
      const sourceEl = node.querySelector('.recipe-source');
      const openBtn = node.querySelector('.btn-open-recipe');
      const videoBtn = node.querySelector('.btn-open-video');
      const addBtn = node.querySelector('.btn-add-list');

      const title = recipe.title || `Ricetta ${index + 1}`;
      const source = recipe.source || '';

      if (titleEl) titleEl.textContent = title;
      if (sourceEl) sourceEl.textContent = source;

      // Video mapping
      const videoEntry = findBestVideoForRecipe(recipe);
      const hasVideo = !!(videoEntry && videoEntry.youtubeId);

      if (videoBtn) {
        if (hasVideo) {
          videoBtn.disabled = false;
          videoBtn.textContent = 'Video';
          videoBtn.addEventListener('click', () =>
            openVideo(videoEntry.youtubeId, title)
          );
        } else {
          // fallback: cerca video
          videoBtn.disabled = false;
          videoBtn.textContent = 'Cerca video';
          videoBtn.addEventListener('click', () => {
            const q = encodeURIComponent(title + ' ricetta');
            window.open(
              `https://www.youtube.com/results?search_query=${q}`,
              '_blank'
            );
          });
        }
      }

      // Apri ricetta (modale)
      if (openBtn) {
        openBtn.addEventListener('click', () => openRecipeModal(recipe));
      }

      // Aggiungi alla lista spesa
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          addRecipeToShoppingList(recipe);
        });
      }

      grid.appendChild(node);
    });

    if (countEl) {
      countEl.textContent = `${recipes.length} / ${ALL_RECIPES.length}`;
    }
  }

  function findBestVideoForRecipe(recipe) {
    if (!recipe) return null;
    const bySlug = recipe.slug || slugify(recipe.title || '');
    const slugKey = bySlug && VIDEO_MAP[bySlug.toLowerCase()];
    const titleKey =
      recipe.title && VIDEO_MAP[slugify(recipe.title).toLowerCase()];

    const candidates = []
      .concat(slugKey || [])
      .concat(titleKey || [])
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    return candidates[0] || null;
  }

  // ==========================
  // Search
  // ==========================

  function setupSearch() {
    const input = qs(SELECTORS.searchInput);
    if (!input) return;

    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      if (!q) {
        FILTERED_RECIPES = ALL_RECIPES.slice();
      } else {
        FILTERED_RECIPES = ALL_RECIPES.filter(r => {
          const hay =
            (r.title || '') +
            ' ' +
            (r.ingredients || '') +
            ' ' +
            (r.tags || '') +
            ' ' +
            (r.source || '');
          return hay.toLowerCase().includes(q);
        });
      }
      renderRecipes(FILTERED_RECIPES);
    });
  }

  // ==========================
  // Modali (video + ricetta)
  // ==========================

  function setupModals() {
    // video modal
    const videoModal = qs(SELECTORS.videoModal);
    const videoClose = qs(SELECTORS.videoClose);
    const videoBackdrop = videoModal
      ? videoModal.querySelector('.modal-backdrop')
      : null;

    if (videoModal && videoClose) {
      videoClose.addEventListener('click', closeVideoModal);
    }
    if (videoModal && videoBackdrop) {
      videoBackdrop.addEventListener('click', closeVideoModal);
    }

    // recipe modal
    const recipeModal = qs(SELECTORS.recipeModal);
    const recipeClose = qs(SELECTORS.recipeClose);
    const recipeBackdrop = recipeModal
      ? recipeModal.querySelector('.modal-backdrop')
      : null;

    if (recipeModal && recipeClose) {
      recipeClose.addEventListener('click', closeRecipeModal);
    }
    if (recipeModal && recipeBackdrop) {
      recipeBackdrop.addEventListener('click', closeRecipeModal);
    }

    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') {
        closeVideoModal();
        closeRecipeModal();
      }
    });
  }

  function openVideo(youtubeId, title) {
    const modal = qs(SELECTORS.videoModal);
    const frame = qs(SELECTORS.videoFrame);
    const titleEl = qs(SELECTORS.videoTitle);

    if (!modal || !frame) {
      // fallback se non c'è modale
      window.open(`https://www.youtube.com/watch?v=${youtubeId}`, '_blank');
      return;
    }

    frame.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1`;
    if (titleEl) titleEl.textContent = title || 'Video ricetta';
    modal.classList.add('is-open');
  }

  function closeVideoModal() {
    const modal = qs(SELECTORS.videoModal);
    const frame = qs(SELECTORS.videoFrame);
    if (modal) modal.classList.remove('is-open');
    if (frame) frame.src = '';
  }

  function openRecipeModal(recipe) {
    const modal = qs(SELECTORS.recipeModal);
    const content = qs(SELECTORS.recipeContent);
    if (!modal || !content || !recipe) return;

    const title = recipe.title || 'Ricetta';
    const source = recipe.source ? `<p><strong>Fonte:</strong> ${safe(recipe.source)}</p>` : '';
    const ing =
      recipe.ingredients && recipe.ingredients.length
        ? Array.isArray(recipe.ingredients)
          ? recipe.ingredients
          : String(recipe.ingredients)
              .split(/[\n;,]/)
              .map(x => x.trim())
              .filter(Boolean)
        : [];
    const steps =
      recipe.steps && recipe.steps.length
        ? Array.isArray(recipe.steps)
          ? recipe.steps
          : String(recipe.steps)
              .split(/\n+/)
              .map(x => x.trim())
              .filter(Boolean)
        : [];

    content.innerHTML = `
      <h3>${safe(title)}</h3>
      ${source}
      ${
        ing.length
          ? `<h4>Ingredienti</h4><ul>${ing
              .map(x => `<li>${safe(x)}</li>`)
              .join('')}</ul>`
          : ''
      }
      ${
        steps.length
          ? `<h4>Preparazione</h4><ol>${steps
              .map(x => `<li>${safe(x)}</li>`)
              .join('')}</ol>`
          : ''
      }
    `;

    modal.classList.add('is-open');
  }

  function closeRecipeModal() {
    const modal = qs(SELECTORS.recipeModal);
    if (modal) modal.classList.remove('is-open');
  }

  // ==========================
  // Lista spesa (base)
  // ==========================

  function loadShoppingList() {
    try {
      const raw = localStorage.getItem('shopping-list');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveShoppingList() {
    try {
      localStorage.setItem('shopping-list', JSON.stringify(SHOPPING_LIST));
    } catch {
      // pace
    }
  }

  function addRecipeToShoppingList(recipe) {
    if (!recipe) return;
    const ing =
      recipe.ingredients && recipe.ingredients.length
        ? Array.isArray(recipe.ingredients)
          ? recipe.ingredients
          : String(recipe.ingredients)
              .split(/[\n;,]/)
              .map(x => x.trim())
              .filter(Boolean)
        : [];

    if (!ing.length) {
      alert('Nessun ingrediente disponibile per questa ricetta.');
      return;
    }

    ing.forEach(item => {
      if (!SHOPPING_LIST.includes(item)) SHOPPING_LIST.push(item);
    });

    saveShoppingList();
    alert('Ingredienti aggiunti alla lista spesa.');
  }

  // ==========================
  // Generatore da ingredienti
  // ==========================

  function setupGenerator() {
    const textEl = document.querySelector('#generator-text');
    const runBtn = document.querySelector('#generator-run');
    const resultsEl = document.querySelector('#generator-results');

    const camStart = document.querySelector('#camera-start');
    const camCapture = document.querySelector('#camera-capture');
    const camStatus = document.querySelector('#camera-status');
    const video = document.querySelector('#camera-stream');
    const canvas = document.querySelector('#camera-canvas');

    // Testo → suggerisci ricette
    if (runBtn && textEl && resultsEl) {
      runBtn.addEventListener('click', () => {
        const raw = textEl.value.toLowerCase();
        const terms = raw
          .split(/[,;\n]/)
          .map(t => t.trim())
          .filter(Boolean);

        if (!terms.length) {
          resultsEl.innerHTML =
            '<p>Nessun ingrediente inserito. Aggiungi qualcosa prima.</p>';
          return;
        }

        const matches = suggestRecipesFromIngredients(terms);
        renderGeneratorResults(matches, resultsEl);
      });
    }

    // Fotocamera → snapshot (OCR da integrare)
    if (camStart && camCapture && video && canvas && camStatus) {
      let stream = null;

      camStart.addEventListener('click', async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          camStatus.textContent =
            'Fotocamera non supportata nel browser corrente.';
          return;
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          video.srcObject = stream;
          camCapture.disabled = false;
          camStatus.textContent =
            'Fotocamera attiva. Inquadra gli ingredienti e premi "Cattura & analizza".';
        } catch (err) {
          camStatus.textContent =
            'Impossibile accedere alla fotocamera (permessi negati?).';
          console.error(err);
        }
      });

      camCapture.addEventListener('click', () => {
        if (!video.videoWidth) {
          camStatus.textContent =
            'Attendi che il video sia visibile, poi riprova la cattura.';
          return;
        }
        const w = video.videoWidth;
        const h = video.videoHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);

        // Qui puoi inviare canvas.toDataURL() ad una tua API per OCR/AI.
        camStatus.textContent =
          'Immagine catturata. Collega ora un servizio OCR/AI per estrarre ingredienti.';
        console.log(
          'Snapshot (troncata):',
          canvas.toDataURL('image/jpeg').slice(0, 120) + '...'
        );
      });
    }
  }

  function suggestRecipesFromIngredients(terms) {
    if (!ALL_RECIPES || !ALL_RECIPES.length) return [];

    return ALL_RECIPES
      .map(r => {
        const text =
          (r.title || '') +
          ' ' +
          (r.ingredients || '') +
          ' ' +
          (r.tags || '');
        const hay = text.toLowerCase();
        let score = 0;
        terms.forEach(t => {
          if (hay.includes(t)) score++;
        });
        return { recipe: r, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }

  function renderGeneratorResults(matches, container) {
    if (!matches.length) {
      container.innerHTML =
        '<p>Nessuna ricetta trovata con questi ingredienti.</p>';
      return;
    }

    const html = matches
      .map(
        x => `
      <li>
        <strong>${safe(x.recipe.title || 'Ricetta')}</strong>
        <span class="match-score"> (match ingredienti: ${x.score})</span>
      </li>`
      )
      .join('');

    container.innerHTML = `
      <h3>Ricette suggerite</h3>
      <ul class="generator-list">
        ${html}
      </ul>
    `;
  }

  // ==========================
  // Helpers
  // ==========================

  function qs(sel) {
    return document.querySelector(sel);
  }

  function slugify(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function safe(str) {
    return String(str || '').replace(/[&<>"']/g, c => {
      const m = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return m[c] || c;
    });
  }
})();
