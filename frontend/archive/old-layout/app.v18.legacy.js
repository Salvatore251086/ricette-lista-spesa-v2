// app.v18.strapi.js
// Versione collegata a Strapi

const STRAPI_BASE = 'http://localhost:1337';
const STRAPI_RECIPES = `${STRAPI_BASE}/api/recipes`;

// Stato in memoria
let allStrapiRecipes = [];

// Utility DOM
function qs(sel) {
  return document.querySelector(sel);
}

function createEl(tag, opts = {}) {
  const el = document.createElement(tag);
  if (opts.className) el.className = opts.className;
  if (opts.text) el.textContent = opts.text;
  return el;
}

// Normalizza il campo ingredienti (stringa JSON, lista per righe, array)
function getSafeArray(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string' && value.trim()) {
    // Prova prima a interpretare come JSON
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Non è JSON, tratto come testo multilinea
    }

    return value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
  }

  return [];
}

// Crea una card per una ricetta Strapi
function buildCard(recipe) {
  const a = recipe.attributes || {};

  const title = a.title || 'Ricetta senza titolo';
  const difficulty = a.difficulty || 'medium';
  const portions = a.portions || a.servings || 4;
  const ingredients = getSafeArray(a.ingredients);
  const hasSource = !!a.sourceUrl;
  const hasVideo = !!a.videoId;

  const card = createEl('article', { className: 'card strapi-card' });
  card.style.padding = '10px';
  card.style.marginBottom = '12px';

  // Per filtri
  card.dataset.title = title.toLowerCase();
  card.dataset.ingredients = ingredients.join(' ').toLowerCase();

  const h2 = createEl('h2', { text: title });
  card.appendChild(h2);

  const meta = createEl('div', { className: 'muted' });
  meta.textContent = `Strapi · Diff: ${difficulty} · Porzioni: ${portions} · ${ingredients.length} ingredienti`;
  card.appendChild(meta);

  const btnRow = createEl('div');
  btnRow.style.display = 'flex';
  btnRow.style.flexWrap = 'wrap';
  btnRow.style.gap = '6px';
  btnRow.style.marginTop = '8px';

  // Apri ricetta (pagina recipe.html)
  const btnOpen = createEl('button', { className: 'btn', text: 'Apri ricetta' });
  btnOpen.addEventListener('click', () => {
    // Usa l'ID nativo di Strapi
    const url = `recipe.html?src=strapi&id=${recipe.id}`;
    window.location.href = url;
  });
  btnRow.appendChild(btnOpen);

  // Lista ingredienti (popup semplice)
  const btnIng = createEl('button', { className: 'btn', text: 'Lista ingredienti' });
  btnIng.addEventListener('click', () => {
    if (!ingredients.length) {
      alert('Nessun ingrediente presente in Strapi per questa ricetta.');
      return;
    }
    alert('Ingredienti:\n\n' + ingredients.join('\n'));
  });
  btnRow.appendChild(btnIng);

  // Video
  const btnVideo = createEl('button', { className: 'btn' });
  if (hasVideo) {
    btnVideo.textContent = 'Guarda video';
    btnVideo.addEventListener('click', () => {
      const raw = a.videoId;
      if (!raw) return;

      let href = raw;
      if (!raw.startsWith('http')) {
        href = `https://www.youtube.com/watch?v=${raw}`;
      }
      window.open(href, '_blank', 'noopener');
    });
  } else {
    btnVideo.textContent = 'Nessun video';
    btnVideo.disabled = true;
  }
  btnRow.appendChild(btnVideo);

  // Fonte ricetta
  const btnSource = createEl('a', { className: 'btn' });
  if (hasSource) {
    btnSource.textContent = 'Fonte ricetta';
    btnSource.href = a.sourceUrl;
    btnSource.target = '_blank';
    btnSource.rel = 'noopener';
  } else {
    btnSource.textContent = 'Nessun link';
    btnSource.href = '#';
    btnSource.addEventListener('click', ev => ev.preventDefault());
  }
  btnRow.appendChild(btnSource);

  card.appendChild(btnRow);

  return card;
}

// Rendering lista
function renderStrapiList(recipes) {
  const listContainer = qs('#recipes');
  const countSpan = qs('#count');

  if (!listContainer) {
    console.error('Contenitore #recipes non trovato in index-strapi.html');
    return;
  }

  listContainer.innerHTML = '';

  if (!recipes.length) {
    listContainer.innerHTML = '<p>Nessuna ricetta trovata in Strapi.</p>';
    if (countSpan) countSpan.textContent = 'Ricette visibili: 0';
    return;
  }

  recipes.forEach(r => {
    const card = buildCard(r);
    listContainer.appendChild(card);
  });

  if (countSpan) countSpan.textContent = `Ricette visibili: ${recipes.length}`;
}

// Applica filtri locali (ricerca testo)
function applyFilters() {
  const searchInput =
    qs('#searchStrapi') ||
    qs('#search') ||
    qs('input[type="search"]') ||
    qs('input[name="search"]');

  let term = '';
  if (searchInput && typeof searchInput.value === 'string') {
    term = searchInput.value.toLowerCase().trim();
  }

  if (!term) {
    renderStrapiList(allStrapiRecipes);
    return;
  }

  const filtered = allStrapiRecipes.filter(r => {
    const a = r.attributes || {};
    const title = (a.title || '').toLowerCase();
    const ingredients = getSafeArray(a.ingredients)
      .join(' ')
      .toLowerCase();

    return (
      title.includes(term) ||
      ingredients.includes(term)
    );
  });

  renderStrapiList(filtered);
}

// Carica da Strapi
async function loadStrapiRecipes() {
  const listContainer = qs('#recipes');
  const countSpan = qs('#count');

  if (listContainer) {
    listContainer.innerHTML = '<p>Carico ricette da Strapi...</p>';
  }
  if (countSpan) countSpan.textContent = 'Ricette visibili: 0';

  try {
    console.log('Avvio app Ricette & Lista Spesa v18 (Strapi)');
    console.log('Scarico ricette da Strapi…');

    const res = await fetch(`${STRAPI_RECIPES}?populate=*`);
    if (!res.ok) {
      throw new Error(`Errore Strapi HTTP ${res.status}`);
    }

    const json = await res.json();
    const items = json.data || [];

    allStrapiRecipes = items;

    console.log('Risposta Strapi:', json);
    console.log('Ricette da Strapi:', items.length);

    const videosCount = items.filter(r => r.attributes?.videoId).length;
    console.log('Ricette con video:', videosCount);

    renderStrapiList(allStrapiRecipes);
  } catch (err) {
    console.error('Errore nel caricamento da Strapi', err);
    if (listContainer) {
      listContainer.innerHTML =
        '<p style="color:#b00020">Errore nel caricamento delle ricette da Strapi.</p>';
    }
    if (countSpan) countSpan.textContent = 'Ricette visibili: 0';
  }
}

// Inizializzazione
window.addEventListener('DOMContentLoaded', () => {
  // Pulsante Aggiorna dati
  const btnRefresh =
    qs('#refreshStrapi') ||
    qs('#btnRefresh') ||
    qs('button[data-refresh="strapi"]') ||
    qs('input[data-refresh="strapi"]');

  if (btnRefresh) {
    btnRefresh.addEventListener('click', ev => {
      ev.preventDefault();
      loadStrapiRecipes();
    });
  }

  // Ricerca in tempo reale se presente un campo di ricerca
  const searchInput =
    qs('#searchStrapi') ||
    qs('#search') ||
    qs('input[type="search"]') ||
    qs('input[name="search"]');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      applyFilters();
    });
  }

  // Primo caricamento
  loadStrapiRecipes();
});
