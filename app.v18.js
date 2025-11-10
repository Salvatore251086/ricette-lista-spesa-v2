console.log("Avvio app Ricette & Lista Spesa v18");

// -------------------------
// Config
// -------------------------
const DATA_URL = "assets/json/recipes-it.enriched.json";
const LS_FAVORITES_KEY = "rls_favorites_v1";

// -------------------------
// DOM refs (allineati a index.html)
// -------------------------
const dom = {
  searchInput: document.getElementById("search"),
  updateBtn: document.getElementById("updateDataBtn"),
  favoritesToggle: document.getElementById("favoritesToggle"),
  recipeCount: document.getElementById("recipeCount"),
  recipesContainer: document.getElementById("recipes"),
  videoModal: document.getElementById("videoModal"),
  videoFrame: document.getElementById("videoFrame"),
  closeVideo: document.getElementById("closeVideo"),
};

// Controllo DOM (non blocca l'app, logga solo se manca qualcosa)
{
  const missing = Object.entries(dom)
    .filter(([, el]) => !el)
    .map(([key]) => key);

  if (missing.length) {
    console.error(
      "Errore: elementi DOM mancanti. Controlla ID in index.html.",
      missing
    );
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
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(favorites));
  } catch {
    // silenzioso, niente drammi in produzione
  }
}

// -------------------------
// Utility rendering
// -------------------------
function normalize(str) {
  return (str || "").toLowerCase();
}

function matchesSearch(recipe, term) {
  if (!term) return true;
  const q = normalize(term);
  const title = normalize(recipe.title);
  const ingredients = normalize((recipe.ingredients || []).join(" "));
  return title.includes(q) || ingredients.includes(q);
}

function isFavorite(id) {
  return Boolean(favorites[id]);
}

function toggleFavorite(id) {
  if (!id) return;
  favorites[id] = !favorites[id];
  if (!favorites[id]) delete favorites[id];
  saveFavorites();
  renderRecipes();
}

// -------------------------
// Video modal
// -------------------------
function openVideo(url) {
  if (!dom.videoModal || !dom.videoFrame) return;
  dom.videoFrame.src = url;
  dom.videoModal.classList.remove("hidden");
}

function closeVideo() {
  if (!dom.videoModal || !dom.videoFrame) return;
  dom.videoFrame.src = "";
  dom.videoModal.classList.add("hidden");
}

// -------------------------
// Render
// -------------------------
function renderRecipes() {
  if (!dom.recipesContainer) return;
  const term = dom.searchInput ? dom.searchInput.value.trim() : "";
  const onlyFav = dom.favoritesToggle ? dom.favoritesToggle.checked : false;

  const filtered = allRecipes.filter((r) => {
    if (onlyFav && !isFavorite(r.id)) return false;
    return matchesSearch(r, term);
  });

  if (dom.recipeCount) {
    dom.recipeCount.textContent = `Ricette visibili: ${filtered.length}`;
  }

  dom.recipesContainer.innerHTML = "";

  filtered.forEach((r) => {
    const card = document.createElement("article");
    card.className = "recipe-card";

    const fav = isFavorite(r.id);

    const difficulty = r.difficulty || r.diff || "";
    const servings = r.servings || r.persone || r.porzioni || r.portions;
    const source = r.source || (r.enrichedFrom && r.enrichedFrom.source) || "";
    const hasVideo = Boolean(r.video && r.video.url);
    const videoLabel = hasVideo ? "Guarda video" : "Video n/d";

    // URL ricetta
    const recipeUrl =
      r.url ||
      (r.links && r.links.source) ||
      (r.enrichedFrom && r.enrichedFrom.url) ||
      null;

    // Badge ingredienti
    const ingredientsCount = Array.isArray(r.ingredients)
      ? r.ingredients.length
      : 0;

    card.innerHTML = `
      <div class="recipe-card-header">
        <button class="fav-btn" data-id="${r.id || ""}" title="Aggiungi ai preferiti">
          ${fav ? "★" : "☆"}
        </button>
        <h2 class="recipe-title">${r.title || "Ricetta senza titolo"}</h2>
      </div>
      <div class="recipe-meta">
        ${
          difficulty
            ? `<span class="badge">Diff: ${difficulty}</span>`
            : ""
        }
        ${
          servings
            ? `<span class="badge">Porzioni: ${servings}</span>`
            : ""
        }
        ${
          source
            ? `<span class="badge badge-source">${source}</span>`
            : ""
        }
        ${
          ingredientsCount
            ? `<span class="badge badge-ingredients">${ingredientsCount} ingredienti</span>`
            : ""
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
        <button class="btn ghost" data-show-ingredients="${
          r.id || ""
        }">Lista ingredienti</button>
        ${
          hasVideo
            ? `<button class="btn video" data-video="${encodeURI(
                r.video.url
              )}">${videoLabel}</button>`
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

  // Preferiti
  dom.recipesContainer.querySelectorAll(".fav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      toggleFavorite(id);
    });
  });

  // Apri ricetta
  dom.recipesContainer
    .querySelectorAll("[data-open-recipe]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-open-recipe");
        if (url) window.open(url, "_blank", "noopener");
      });
    });

  // Ingredienti (popup minimale per ora)
  dom.recipesContainer
    .querySelectorAll("[data-show-ingredients]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-show-ingredients");
        const recipe = allRecipes.find((r) => r.id === id);
        if (!recipe || !Array.isArray(recipe.ingredients)) {
          alert("Nessuna lista ingredienti disponibile.");
          return;
        }
        alert("Ingredienti:\n\n" + recipe.ingredients.join("\n"));
      });
    });

  // Video
  dom.recipesContainer.querySelectorAll("[data-video]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-video");
      if (url) openVideo(url);
    });
  });
}

// -------------------------
// Load data
// -------------------------
async function loadData() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const base = Array.isArray(json) ? json : json.recipes || [];
    allRecipes = base.map((r, index) => ({
      id: r.id || `r-${index}`,
      ...r,
    }));
    console.log("Caricate ricette:", allRecipes.length);
    renderRecipes();
  } catch (err) {
    console.error("Errore nel caricare i dati ricette:", err);
    if (dom.recipeCount) {
      dom.recipeCount.textContent = "Errore nel caricamento dati.";
    }
  }
}

// -------------------------
// Event listeners
// -------------------------
if (dom.searchInput) {
  dom.searchInput.addEventListener("input", () => {
    renderRecipes();
  });
}

if (dom.favoritesToggle) {
  dom.favoritesToggle.addEventListener("change", () => {
    renderRecipes();
  });
}

// Bottone "Aggiorna dati": per ora ricarica il JSON (hook diretto, niente magie)
if (dom.updateBtn) {
  dom.updateBtn.addEventListener("click", () => {
    loadData();
  });
}

// Video modal close
if (dom.closeVideo) {
  dom.closeVideo.addEventListener("click", closeVideo);
}
if (dom.videoModal) {
  dom.videoModal.addEventListener("click", (e) => {
    if (e.target === dom.videoModal) closeVideo();
  });
}

// -------------------------
// Init
// -------------------------
loadData();
