// recipe_strapi.js
// Pagina dettaglio ricetta collegata a Strapi

const CONFIG = window.APP_CONFIG || {};

const dom = {
  title: document.getElementById('recipe-title'),
  image: document.getElementById('recipe-image'),
  meta: document.getElementById('recipe-meta'),
  tags: document.getElementById('recipe-tags'),
  ingredients: document.getElementById('recipe-ingredients'),
  steps: document.getElementById('recipe-steps'),
  btnVideo: document.getElementById('btn-detail-video'),
  modalOverlay: document.getElementById('video-modal-overlay'),
  modalContent: document.getElementById('video-modal-content'),
  modalClose: document.getElementById('video-modal-close')
};

let currentRecipe = null;

document.addEventListener('DOMContentLoaded', () => {
  initDetail().catch(err => {
    console.error('Errore init dettaglio', err);
    alert('Errore nel caricamento della ricetta');
  });
});

async function initDetail() {
  const slug = getSlugFromUrl();
  if (!slug) {
    alert('Slug ricetta mancante');
    return;
  }

  const recipe = await loadRecipeBySlug(slug);
  if (!recipe) {
    alert('Ricetta non trovata');
    return;
  }

  currentRecipe = recipe;
  renderRecipe(recipe);
  setupEvents();
}

function getSlugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('slug');
}

async function loadRecipeBySlug(slug) {
  const base = CONFIG.strapiBaseUrl;
  if (!base) return null;

  const url =
    base.replace(/\/+$/, '') +
    '/api/recipes?filters[slug][$eq]=' +
    encodeURIComponent(slug) +
    '&populate=*';

  const res = await fetch(url);
  if (!res.ok) return null;

  const json = await res.json();
  if (!json || !Array.isArray(json.data) || json.data.length === 0) {
    return null;
  }

  const item = json.data[0];
  return mapStrapiRecipeDetail(item);
}

function mapStrapiRecipeDetail(item) {
  const a = item.attributes || item;

  const slug =
    a.slug ||
    a.permalink ||
    ('recipe-' + item.id);

  const title =
    a.title ||
    a.name ||
    a.titolo ||
    'Ricetta';

  const description =
    a.description ||
    a.descrizione ||
    '';

  const difficulty =
    a.difficulty ||
    a.difficolta ||
    '';

  const time =
    a.time ||
    a.tempo ||
    a.prepTime ||
    '';

  const servings =
    a.servings ||
    a.porzioni ||
    a.portions ||
    '';

  const ingredients =
    Array.isArray(a.ingredients)
      ? a.ingredients
      : Array.isArray(a.ingredienti)
      ? a.ingredienti
      : [];

  const steps =
    Array.isArray(a.steps)
      ? a.steps
      : Array.isArray(a.istruzioni)
      ? a.istruzioni
      : [];

  const tags =
    Array.isArray(a.tags)
      ? a.tags
      : Array.isArray(a.etichettes)
      ? a.etichettes
      : [];

  const image = getStrapiImageUrlDetail(a);

  const youtubeId =
    a.videoId ||
    a.youtubeId ||
    null;

  return {
    id: item.id,
    slug,
    title,
    description,
    difficulty,
    time,
    servings,
    ingredients,
    steps,
    tags,
    image,
    youtubeId
  };
}

function getStrapiImageUrlDetail(attributes) {
  if (!attributes) {
    return 'assets/screenshots/placeholder.jpg';
  }

  const field =
    attributes.image ||
    attributes.cover ||
    attributes.photo ||
    attributes.mainImage ||
    attributes.thumbnail;

  if (!field || !field.url) {
    return 'assets/screenshots/placeholder.jpg';
  }

  const url = field.url;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const base = CONFIG.strapiBaseUrl || '';
  return base.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '');
}

function renderRecipe(recipe) {
  if (dom.title) {
    dom.title.textContent = recipe.title;
  }

  if (dom.image) {
    dom.image.src = recipe.image;
    dom.image.alt = recipe.title;
    dom.image.onerror = () => {
      dom.image.onerror = null;
      dom.image.src = 'assets/screenshots/placeholder.jpg';
    };
  }

  if (dom.meta) {
    const parts = [];
    if (recipe.time) parts.push(recipe.time);
    if (recipe.difficulty) parts.push(recipe.difficulty);
    if (recipe.servings) parts.push(recipe.servings + ' porzioni');
    dom.meta.textContent = parts.join(' · ');
  }

  if (dom.tags) {
    if (recipe.tags && recipe.tags.length) {
      dom.tags.textContent = 'Tag: ' + recipe.tags.join(', ');
    } else {
      dom.tags.textContent = '';
    }
  }

  if (dom.ingredients) {
    dom.ingredients.innerHTML = '';
    recipe.ingredients.forEach(row => {
      const li = document.createElement('li');
      li.textContent = row;
      dom.ingredients.appendChild(li);
    });
  }

  if (dom.steps) {
    dom.steps.innerHTML = '';
    recipe.steps.forEach(step => {
      const li = document.createElement('li');
      li.textContent = step;
      dom.steps.appendChild(li);
    });
  }

  if (dom.btnVideo) {
    dom.btnVideo.disabled = !recipe.youtubeId;
  }
}

function setupEvents() {
  if (dom.btnVideo) {
    dom.btnVideo.addEventListener('click', () => {
      if (!currentRecipe || !currentRecipe.youtubeId) {
        alert('Video non disponibile per questa ricetta');
        return;
      }
      openVideoModal(currentRecipe.youtubeId);
    });
  }

  if (dom.modalClose) {
    dom.modalClose.addEventListener('click', () => {
      closeVideoModal();
    });
  }

  if (dom.modalOverlay) {
    dom.modalOverlay.addEventListener('click', event => {
      if (event.target === dom.modalOverlay) {
        closeVideoModal();
      }
    });
  }
}

function openVideoModal(youtubeId) {
  if (!dom.modalOverlay || !dom.modalContent) {
    const url = 'https://www.youtube.com/watch?v=' + youtubeId;
    window.open(url, '_blank', 'noopener');
    return;
  }

  dom.modalContent.innerHTML = '';
  dom.modalOverlay.style.display = 'flex';

  const iframe = document.createElement('iframe');
  iframe.width = '100%';
  iframe.height = '100%';
  iframe.allowFullscreen = true;
  iframe.setAttribute(
    'allow',
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
  );
  iframe.src =
    'https://www.youtube-nocookie.com/embed/' + youtubeId + '?autoplay=1';

  dom.modalContent.appendChild(iframe);
  dom.modalOverlay.classList.add('visible');
}

function closeVideoModal() {
  if (!dom.modalOverlay || !dom.modalContent) return;
  dom.modalOverlay.classList.remove('visible');
  dom.modalOverlay.style.display = 'none';
  dom.modalContent.innerHTML = '';
}
