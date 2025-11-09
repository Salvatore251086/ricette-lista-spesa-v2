// Percorsi dei file
const RECIPES_URL = './assets/json/recipes-it.json';
const VIDEOS_URL = './assets/json/video_index.resolved.json';

// Funzione principale
async function init() {
  const recipesCounterEl = document.getElementById('recipes-count');
  const searchInput = document.getElementById('search-input');
  const recipesContainer = document.getElementById('recipes-container');

  let recipes = [];
  let videoMap = new Map();

  try {
    const [recipesRes, videosRes] = await Promise.all([
      fetch(RECIPES_URL),
      fetch(VIDEOS_URL)
    ]);

    if (!recipesRes.ok) throw new Error(`Errore caricamento recipes-it.json: ${recipesRes.status}`);
    if (!videosRes.ok) throw new Error(`Errore caricamento video_index.resolved.json: ${videosRes.status}`);

    const recipesData = await recipesRes.json();
    const videosData = await videosRes.json();

    // ✅ FIX — estrai array interno
    if (Array.isArray(recipesData.recipes)) {
      recipes = recipesData.recipes;
    } else {
      console.error('Formato recipes-it.json non previsto:', recipesData);
      recipes = [];
    }

    // Mappa video
    videoMap = new Map();
    if (Array.isArray(videosData)) {
      videosData.forEach(v => {
        if (v.title && v.youtubeId) videoMap.set(v.title.trim().toLowerCase(), v.youtubeId);
      });
    }

    // Render iniziale
    renderRecipes(recipes, videoMap, recipesContainer, recipesCounterEl);

    // Ricerca
    searchInput.addEventListener('input', () => {
      const term = searchInput.value.trim().toLowerCase();
      const filtered = recipes.filter(r =>
        (r.title || '').toLowerCase().includes(term) ||
        (r.ingredients || '').toLowerCase().includes(term)
      );
      renderRecipes(filtered, videoMap, recipesContainer, recipesCounterEl);
    });

  } catch (err) {
    console.error('Errore durante init():', err);
    if (recipesCounterEl) recipesCounterEl.textContent = 'Errore caricamento dati';
  }
}

document.addEventListener('DOMContentLoaded', init);
