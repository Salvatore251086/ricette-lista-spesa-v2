// app.v18.js
// Ricette Smart & Risparmio – v18 con modale ricette stabile

;(function () {
  'use strict';

  // -----------------------------
  // Config
  // -----------------------------

  const DEFAULT_CONFIG = {
    strapiBaseUrl: 'http://localhost:1337',
    strapiRecipesPath: '/api/recipes',
    loadRecipesUrl: 'assets/json/recipes-it.json',
    videoIndexUrl: 'assets/json/video_index.resolved.json'
  };

  const CONFIG = Object.assign(
    {},
    DEFAULT_CONFIG,
    (typeof window !== 'undefined' && window.APP_CONFIG) || {}
  );

  // -----------------------------
  // Stato
  // -----------------------------

  const state = {
    recipes: [],
    filtered: [],
    videoIndex: {},
    tags: [],
    activeTags: new Set(),
    searchTerm: '',
    deferredPrompt: null
  };

  // -----------------------------
  // DOM
  // -----------------------------

  const dom = {
    // lista e ricerca
    searchInput: document.getElementById('search-input'),
    listEl: document.getElementById('recipe-list'),
    template: document.getElementById('recipe-card-template'),
    tagBar: document.getElementById('tag-chips'),

    // modale ricetta
    recipeModal: document.getElementById('recipe-modal'),
    recipeModalClose: document.getElementById('recipe-modal-close'),
    recipeModalTitle: document.getElementById('recipe-modal-title'),
    recipeModalDescription: document.getElementById('recipe-modal-description'),
    recipeModalIngredients: document.getElementById('recipe-modal-ingredients'),
    recipeModalSteps: document.getElementById('recipe-modal-steps'),
    recipeModalIngredientsLink: document.getElementById('recipe-modal-ingredients-link'),
    recipeModalPreparationLink: document.getElementById('recipe-modal-preparation-link'),

    // modale video
    videoModal: document.getElementById('video-modal'),
    videoModalClose: document.getElementById('video-modal-close'),
    videoIframe: document.getElementById('video-iframe'),

    // install PWA
    installButton:
      document.querySelector('[data-install]') ||
      document.getElementById('install-button')
  };

  const FALLBACK_IMAGE = 'assets/icons/icon-192.png';

  // -----------------------------
  // Utility
  // -----------------------------

  function logInfo(msg, extra) {
    if (extra !== undefined) console.log(msg, extra);
    else console.log(msg);
  }

  function logWarn(msg, extra) {
    if (extra !== undefined) console.warn(msg, extra);
    else console.warn(msg);
  }

  function logError(msg, extra) {
    if (extra !== undefined) console.error(msg, extra);
    else console.error(msg);
  }

  function normalizeString(str) {
    if (!str) return '';
    return str
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function safeArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return [value];
  }

  function getRecipeSlug(r, index) {
    return (
      r.slug ||
      (r.title && normalizeString(r.title).replace(/\s+/g, '-')) ||
      (r.titolo && normalizeString(r.titolo).replace(/\s+/g, '-')) ||
      'recipe-' + index
    );
  }

  function getRecipeTitle(r) {
    return r.title || r.titolo || 'Ricetta senza titolo';
  }

  function getRecipeUrl(r) {
    return r.url || r.permalink || r.href || null;
  }

  function getRecipeSummary(r) {
    return (
      r.summary ||
      r.descrizioneBreve ||
      r.descrizione ||
      r.subtitle ||
      ''
    );
  }

  function getRecipeMeta(r) {
    const parts = [];
    if (r.difficulty || r.difficolta) {
      parts.push('Difficoltà: ' + (r.difficulty || r.difficolta));
    }
    if (r.prepTime || r.tempo) {
      parts.push('Tempo: ' + (r.prepTime || r.tempo));
    }
    if (r.servings || r.persone) {
      parts.push('Porzioni: ' + (r.servings || r.persone));
    }
    return parts.join(' · ');
  }

  function getRecipeImage(r) {
    return (
      r.image ||
      r.img ||
      (r.images && r.images[0]) ||
      (r.cover && r.cover.url) ||
      FALLBACK_IMAGE
    );
  }

  function extractTagsFromRecipe(r) {
    const set = new Set();

    safeArray(r.tags).forEach(t => t && set.add(String(t)));
    safeArray(r.categories).forEach(t => t && set.add(String(t)));
    safeArray(r.ai_tags).forEach(t => t && set.add(String(t)));
    safeArray(r.top_tags).forEach(t => t && set.add(String(t)));

    if (typeof r.tagline === 'string') {
      r.tagline
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
        .forEach(t => set.add(t));
    }

    return Array.from(set);
  }

  function extractIngredientsList(r) {
    const out = [];
    const fields = [
      r.ingredients,
      r.ingredienti,
      r.ingredients_list,
      r.lista_ingredienti
    ];

    fields.forEach(val => {
      if (!val) return;
      if (Array.isArray(val)) {
        val.forEach(x => out.push(String(x)));
      } else if (typeof val === 'string') {
        val
          .split('\n')
          .map(x => x.trim())
          .filter(Boolean)
          .forEach(x => out.push(x));
      }
    });

    return out.map(x => x.trim()).filter(Boolean);
  }

  function extractPreparationSteps(r) {
    const out = [];
    const fields = [
      r.steps,
      r.step,
      r.preparazione,
      r.istruzioni,
      r.instructions
    ];

    fields.forEach(val => {
      if (!val) return;
      if (Array.isArray(val)) {
        val.forEach(x => out.push(String(x)));
      } else if (typeof val === 'string') {
        val
          .split('\n')
          .map(x => x.trim())
          .filter(Boolean)
          .forEach(x => out.push(x));
      }
    });

    return out.map(x => x.trim()).filter(Boolean);
  }

  // -----------------------------
  // Fetch
  // -----------------------------

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      throw new Error('HTTP ' + res.status + ' su ' + url);
    }
    return res.json();
  }

  async function loadVideoIndex() {
    try {
      const json = await fetchJson(CONFIG.videoIndexUrl);
      const dict = {};

      const list = Array.isArray(json)
        ? json
        : json.items || json.videos || [];

      list.forEach(entry => {
        const slug = entry.slug || entry.recipe_slug;
        if (!slug) return;
        dict[slug] = {
          id: entry.youtube_id || entry.id,
          url: entry.url || null,
          title: entry.title || null
        };
      });

      state.videoIndex = dict;
      logInfo(
        'Video index caricato, slugs con video:',
        Object.keys(dict)
      );
    } catch (err) {
      logWarn('Errore caricando video_index, continuo senza video:', err.message);
      state.videoIndex = {};
    }
  }

  async function loadRecipesFromStrapi() {
    const base = CONFIG.strapiBaseUrl && CONFIG.strapiBaseUrl.trim();
    if (!base) {
      logInfo('Strapi disattivato, uso JSON locale');
      return null;
    }

    const url =
      base.replace(/\/+$/, '') +
      CONFIG.strapiRecipesPath +
      '?pagination[pageSize]=1000';

    try {
      const json = await fetchJson(url);
      const data = safeArray(json.data).map((item, index) => {
        const a = item.attributes || {};
        return {
          id: item.id,
          slug: a.slug || getRecipeSlug(a, index),
          title: a.title || a.titolo,
          descrizione: a.descrizione,
          summary: a.summary,
          url: a.url || a.permalink,
          image: a.image_url || (a.cover && a.cover.url),
          difficolta: a.difficolta,
          tempo: a.tempo,
          persone: a.persone,
          tags: a.tags || a.categorie || [],
          ai_tags: a.ai_tags || []
        };
      });
      logInfo('Ricette caricate da Strapi, totale:', data.length);
      return data;
    } catch (err) {
      logWarn('Strapi non disponibile, uso JSON locale:', err.message);
      return null;
    }
  }

  async function loadRecipesFromLocal() {
    const url = CONFIG.loadRecipesUrl || DEFAULT_CONFIG.loadRecipesUrl;
    const json = await fetchJson(url);

    const arr = Array.isArray(json)
      ? json
      : json.recipes || json.data || [];

    logInfo('Carico ricette JSON locali da ' + url + ' totale:', arr.length);

    const mapped = arr.map((r, index) => {
      const slug = getRecipeSlug(r, index);
      const recipe = Object.assign({}, r, { slug });
      const tags = extractTagsFromRecipe(recipe);
      recipe.tags = tags.length ? tags : safeArray(r.tags);
      return recipe;
    });

    return mapped;
  }

  async function loadAllRecipes() {
    const fromStrapi = await loadRecipesFromStrapi();
    if (fromStrapi && fromStrapi.length) {
      state.recipes = addTagsAndSort(fromStrapi);
    } else {
      const local = await loadRecipesFromLocal();
      state.recipes = addTagsAndSort(local);
    }
    state.filtered = state.recipes.slice(0);
  }

  function addTagsAndSort(recipes) {
    const allTags = new Set();

    recipes.forEach(r => {
      const tags = extractTagsFromRecipe(r);
      r.tags = tags;
      tags.forEach(t => allTags.add(t));
    });

    state.tags = Array.from(allTags).sort((a, b) =>
      a.localeCompare(b, 'it')
    );

    return recipes
      .slice(0)
      .sort((a, b) =>
        getRecipeTitle(a).localeCompare(getRecipeTitle(b), 'it')
      );
  }

  // -----------------------------
  // Rendering lista
  // -----------------------------

  function clearList() {
    if (!dom.listEl) return;
    dom.listEl.innerHTML = '';
  }

  function createCard(recipe) {
    if (!dom.template || !dom.listEl) return null;

    const clone = document.importNode(dom.template.content, true);
    const card = clone.querySelector('.recipe-card') || clone.firstElementChild;
    if (!card) return null;

    const slug = recipe.slug || getRecipeSlug(recipe, 0);
    card.dataset.slug = slug;

    const titleEl =
      card.querySelector('[data-recipe-title]') ||
      card.querySelector('.recipe-title');

    const summaryEl =
      card.querySelector('[data-recipe-summary]') ||
      card.querySelector('.recipe-description');

    const metaEl =
      card.querySelector('[data-recipe-meta]') ||
      null;

    const tagsEl =
      card.querySelector('[data-recipe-tags]') ||
      card.querySelector('.recipe-tags');

    const imgElAttr = card.querySelector('[data-recipe-image]');
    const imgWrapper = card.querySelector('.recipe-image-wrapper');
    const imgElClass = card.querySelector('.recipe-image');
    const imgTarget = imgElAttr || imgElClass;

    if (titleEl) {
      titleEl.textContent = getRecipeTitle(recipe);
    }

    if (summaryEl) {
      const summary = getRecipeSummary(recipe);
      const meta = getRecipeMeta(recipe);
      summaryEl.textContent = summary || meta;
    }

    if (metaEl) {
      metaEl.textContent = getRecipeMeta(recipe);
    }

    if (tagsEl && Array.isArray(recipe.tags) && recipe.tags.length) {
      tagsEl.textContent = recipe.tags.join(' · ');
    }

    const src = getRecipeImage(recipe);
    if (src) {
      if (imgTarget) {
        imgTarget.src = src;
        imgTarget.alt = getRecipeTitle(recipe);
        imgTarget.loading = 'lazy';
      } else if (imgWrapper) {
        imgWrapper.style.backgroundImage = 'url("' + src + '")';
      }
    } else if (imgTarget) {
      imgTarget.removeAttribute('src');
      imgTarget.alt = 'Nessuna immagine';
    }

    return card;
  }

  function renderList(recipes) {
    clearList();
    if (!dom.listEl) return;

    const frag = document.createDocumentFragment();
    recipes.forEach(r => {
      const card = createCard(r);
      if (card) frag.appendChild(card);
    });
    dom.listEl.appendChild(frag);
  }

  // -----------------------------
  // Delega click lista
  // -----------------------------

  function setupListClickDelegation() {
    if (!dom.listEl || dom.listEl._delegationSetup) return;

    dom.listEl.addEventListener('click', evt => {
      const videoBtn = evt.target.closest('.btn-video');
      if (videoBtn) {
        const card = videoBtn.closest('.recipe-card');
        if (!card) return;
        const slug = card.dataset.slug;
        const recipe = findRecipeBySlug(slug);
        if (!recipe) return;
        openVideoForRecipe(recipe);
        return;
      }

      const recipeBtn = evt.target.closest('.btn-details, .recipe-main');
      if (recipeBtn) {
        const card = recipeBtn.closest('.recipe-card');
        if (!card) return;
        const slug = card.dataset.slug;
        const recipe = findRecipeBySlug(slug);
        if (!recipe) return;
        openRecipeModal(recipe);
      }
    });

    dom.listEl._delegationSetup = true;
  }

  function findRecipeBySlug(slug) {
    if (!slug) return null;
    return (
      state.filtered.find(r => r.slug === slug) ||
      state.recipes.find(r => r.slug === slug) ||
      null
    );
  }

  // -----------------------------
  // Tag chips
  // -----------------------------

  function renderTagBar() {
    if (!dom.tagBar) return;

    dom.tagBar.innerHTML = '';

    if (!state.tags.length) {
      dom.tagBar.classList.add('is-hidden');
      return;
    }

    dom.tagBar.classList.remove('is-hidden');

    state.tags.forEach(tag => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = tag;
      btn.dataset.tag = tag;

      btn.addEventListener('click', () => {
        toggleTag(tag, btn);
      });

      dom.tagBar.appendChild(btn);
    });
  }

  function toggleTag(tag, btn) {
    if (state.activeTags.has(tag)) {
      state.activeTags.delete(tag);
      if (btn) btn.classList.remove('chip--active');
    } else {
      state.activeTags.add(tag);
      if (btn) btn.classList.add('chip--active');
    }
    applySearchAndFilters();
  }

  // -----------------------------
  // Ricerca
  // -----------------------------

  function setupSearchListener() {
    if (!dom.searchInput) return;

    dom.searchInput.addEventListener('input', () => {
      state.searchTerm = dom.searchInput.value || '';
      applySearchAndFilters();
    });
  }

  function recipeMatchesSearch(r) {
    const term = normalizeString(state.searchTerm);
    if (!term) return true;

    const haystack =
      normalizeString(getRecipeTitle(r)) +
      ' ' +
      normalizeString(getRecipeSummary(r)) +
      ' ' +
      normalizeString((r.tags || []).join(' '));

    return haystack.includes(term);
  }

  function recipeMatchesTags(r) {
    if (!state.activeTags.size) return true;
    if (!r.tags || !r.tags.length) return false;

    const set = new Set(r.tags.map(String));
    for (const tag of state.activeTags) {
      if (!set.has(tag)) return false;
    }
    return true;
  }

  function applySearchAndFilters() {
    const result = state.recipes.filter(
      r => recipeMatchesSearch(r) && recipeMatchesTags(r)
    );
    state.filtered = result;
    renderList(result);
  }

  // -----------------------------
  // Modale ricetta
  // -----------------------------

  function openRecipeModal(recipe) {
    if (
      !recipe ||
      !dom.recipeModal ||
      !dom.recipeModalTitle ||
      !dom.recipeModalIngredients ||
      !dom.recipeModalSteps
    ) {
      logWarn('Impossibile aprire modale ricetta, DOM incompleto');
      return;
    }

    const title = getRecipeTitle(recipe);
    const url = getRecipeUrl(recipe);

    logInfo('Apro modale ricetta:', title);

    dom.recipeModalTitle.textContent = title;

    if (dom.recipeModalDescription) {
      dom.recipeModalDescription.textContent =
        getRecipeSummary(recipe) || getRecipeMeta(recipe);
    }

    // Ingredienti
    dom.recipeModalIngredients.innerHTML = '';
    const ingredients = extractIngredientsList(recipe);

    if (!ingredients.length) {
      const li = document.createElement('li');
      li.textContent =
        'Consulta la ricetta originale per l’elenco completo degli ingredienti.';
      dom.recipeModalIngredients.appendChild(li);
    } else {
      ingredients.forEach(text => {
        const li = document.createElement('li');
        li.textContent = text;
        dom.recipeModalIngredients.appendChild(li);
      });
    }

    // Preparazione
    dom.recipeModalSteps.innerHTML = '';
    const steps = extractPreparationSteps(recipe);

    if (!steps.length && url) {
      const li = document.createElement('li');

      let host = '';
      try {
        host = new URL(url).hostname.replace(/^www\./, '');
      } catch (e) {}

      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent =
        'Apri la preparazione completa su ' + (host || 'sito originale');

      li.appendChild(a);
      dom.recipeModalSteps.appendChild(li);
    } else if (!steps.length) {
      const li = document.createElement('li');
      li.textContent = 'Preparazione non disponibile.';
      dom.recipeModalSteps.appendChild(li);
    } else {
      steps.forEach(text => {
        const li = document.createElement('li');
        li.textContent = text;
        dom.recipeModalSteps.appendChild(li);
      });
    }

    if (dom.recipeModalIngredientsLink || dom.recipeModalPreparationLink) {
      if (url) {
        if (dom.recipeModalIngredientsLink) {
          dom.recipeModalIngredientsLink.href = url;
          dom.recipeModalIngredientsLink.classList.remove('hidden');
        }
        if (dom.recipeModalPreparationLink) {
          dom.recipeModalPreparationLink.href = url;
          dom.recipeModalPreparationLink.classList.remove('hidden');
        }
      } else {
        if (dom.recipeModalIngredientsLink) {
          dom.recipeModalIngredientsLink.classList.add('hidden');
        }
        if (dom.recipeModalPreparationLink) {
          dom.recipeModalPreparationLink.classList.add('hidden');
        }
      }
    }

    dom.recipeModal.classList.remove('hidden');
    dom.recipeModal.classList.add('is-open');
    document.body.classList.add('modal-open');
  }

  function closeRecipeModal() {
    if (!dom.recipeModal) return;
    dom.recipeModal.classList.remove('is-open');
    dom.recipeModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  // -----------------------------
  // Modale video
  // -----------------------------

  function openVideoForRecipe(recipe) {
    const slug = recipe.slug;
    const entry = slug && state.videoIndex[slug];

    if (!entry) {
      openYoutubeSearch(getRecipeTitle(recipe));
      return;
    }

    const id = entry.id;
    const directUrl = entry.url;

    if (!dom.videoModal || !dom.videoIframe) {
      if (directUrl) {
        window.open(directUrl, '_blank', 'noopener');
      } else if (id) {
        const url = 'https://www.youtube.com/watch?v=' + encodeURIComponent(id);
        window.open(url, '_blank', 'noopener');
      }
      return;
    }

    let src = '';
    if (id) {
      src =
        'https://www.youtube-nocookie.com/embed/' +
        encodeURIComponent(id) +
        '?autoplay=1';
    } else if (directUrl) {
      src = directUrl;
    }

    dom.videoIframe.src = src;
    dom.videoModal.classList.remove('hidden');
    dom.videoModal.classList.add('is-open');

    let failTimeout = null;
    const onError = () => {
      if (failTimeout) {
        clearTimeout(failTimeout);
        failTimeout = null;
      }
      const url =
        directUrl ||
        (id
          ? 'https://www.youtube.com/watch?v=' + encodeURIComponent(id)
          : null);
      if (url) window.open(url, '_blank', 'noopener');
      closeVideoModal();
    };

    dom.videoIframe.addEventListener('error', onError, { once: true });

    failTimeout = setTimeout(() => {
      onError();
    }, 2000);
  }

  function openYoutubeSearch(title) {
    const query = encodeURIComponent((title || '') + ' ricetta');
    const url = 'https://www.youtube.com/results?search_query=' + query;
    window.open(url, '_blank', 'noopener');
  }

  function closeVideoModal() {
    if (!dom.videoModal) return;
    dom.videoModal.classList.remove('is-open');
    dom.videoModal.classList.add('hidden');
    if (dom.videoIframe) {
      dom.videoIframe.src = '';
    }
  }

  // -----------------------------
  // PWA
  // -----------------------------

  function setupInstallPrompt() {
    if (!dom.installButton) return;

    window.addEventListener('beforeinstallprompt', evt => {
      evt.preventDefault();
      state.deferredPrompt = evt;
      dom.installButton.hidden = false;
      dom.installButton.classList.remove('hidden');
    });

    dom.installButton.addEventListener('click', async () => {
      if (!state.deferredPrompt) return;
      state.deferredPrompt.prompt();
      const result = await state.deferredPrompt.userChoice;
      logInfo('Install prompt outcome:', result.outcome);
      state.deferredPrompt = null;
      dom.installButton.hidden = true;
      dom.installButton.classList.add('hidden');
    });
  }

  function setupServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('service-worker.js')
      .then(reg => {
        logInfo('Service worker registrato', reg.scope);
      })
      .catch(err => {
        logWarn('Errore registrando il service worker:', err.message);
      });
  }

  // -----------------------------
  // Bootstrap
  // -----------------------------

  async function bootstrap() {
    try {
      setupInstallPrompt();
      setupServiceWorker();

      await loadVideoIndex();
      await loadAllRecipes();

      renderTagBar();
      setupSearchListener();
      setupListClickDelegation();
      applySearchAndFilters();

      if (dom.recipeModalClose) {
        dom.recipeModalClose.addEventListener('click', closeRecipeModal);
      }
      if (dom.videoModalClose) {
        dom.videoModalClose.addEventListener('click', closeVideoModal);
      }

      document.addEventListener('keydown', evt => {
        if (evt.key === 'Escape') {
          closeRecipeModal();
          closeVideoModal();
        }
      });

      document.addEventListener('click', evt => {
        if (evt.target && evt.target.dataset && evt.target.dataset.modalClose) {
          closeRecipeModal();
          closeVideoModal();
        }
      });
    } catch (err) {
      logError('Errore inizializzando app:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
