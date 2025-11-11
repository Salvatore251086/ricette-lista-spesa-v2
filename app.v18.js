// app.v18.js
// Ricette & Lista Spesa – Frontend v18
// Pulito, robusto, niente criceti.

// ------------------------------------
// Config
// ------------------------------------
const DATA_URL = "assets/json/recipes-it.enriched.json";
const LS_FAVORITES_KEY = "rls_favorites_v1";

// Domini da cui accettiamo URL video/ricetta con video incorporato
const VIDEO_HOSTS_ALLOWED = [
  // piattaforme video
  "youtube.com",
  "youtu.be",
  "vimeo.com",

  // portali ricette comuni (aggiungibili)
  "giallozafferano.it",
  "ilgolosomangiarsano.com",
  "fattoincasadabenedetta.it",
  "cucchiaio.it",
  "cookaround.com",
  "misya.info",
  "ricette.giallozafferano.it"
];

// ------------------------------------
// DOM refs (allineati a index.html)
// ------------------------------------
const dom = {
  searchInput: document.getElementById("searchInput"),
  updateBtn: document.getElementById("updateDataBtn"),
  favoritesToggle: document.getElementById("favoritesToggle"),
  recipeCount: document.getElementById("recipeCount"),
  recipesContainer: document.getElementById("recipesContainer"),
  videoModal: document.getElementById("videoModal"),
  videoFrame: document.getElementById("videoFrame"),
  closeVideo: document.getElementById("closeVideo")
};

// Log diagnostico non-bloccante
{
  const missing = Object.entries(dom)
    .filter(([, el]) => !el)
    .map(([key]) => key);

  if (missing.length) {
    console.warn(
      "Elementi DOM mancanti (verifica index.html, NON blocca l'app):",
      missing
    );
  }
}

// ------------------------------------
// Stato
// ------------------------------------
let allRecipes = [];
let favorites = loadFavorites();

// ------------------------------------
// LocalStorage favorites
// ------------------------------------
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
    // silenzioso in produzione
  }
}

// ------------------------------------
// Utility
// ------------------------------------
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

// Controlla se l'URL punta a un host consentito
function isAllowedVideoHost(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    return VIDEO_HOSTS_ALLOWED.some((allowed) => {
      return host === allowed || host.endsWith("." + allowed);
    });
  } catch {
    return false;
  }
}

// Estrae tutti i candidati possibili a URL video
function collectVideoCandidates(recipe) {
  const set = new Set();

  // recipe.video come stringa
  if (typeof recipe.video === "string") {
    set.add(recipe.video);
  }

  // recipe.video.url
  if (recipe.video && typeof recipe.video.url === "string") {
    set.add(recipe.video.url);
  }

  // urlVideo diretto
  if (typeof recipe.urlVideo === "string") {
    set.add(recipe.urlVideo);
  }

  // links come array di stringhe o oggetti
  if (Array.isArray(recipe.links)) {
    recipe.links.forEach((l) => {
      if (typeof l === "string") set.add(l);
      else if (l && typeof l.url === "string") set.add(l.url);
    });
  }

  // links come oggetto { source: "...", video: "..." }
  if (
    recipe.links &&
    typeof recipe.links === "object" &&
    !Array.isArray(recipe.links)
  ) {
    Object.values(recipe.links).forEach((v) => {
      if (typeof v === "string") set.add(v);
      else if (v && typeof v.url === "string") set.add(v.url);
    });
  }

  return Array.from(set);
}

// Sceglie il primo URL valido fra i candidati
function extractVideoUrl(recipe) {
  const candidates = collectVideoCandidates(recipe);

  // 1) prima un URL su host esplicitamente video (youtube, vimeo, ecc)
  for (const url of candidates) {
    if (isAllowedVideoHost(url)) {
      return url;
    }
  }

  // 2) fallback: se non troviamo host whitelisted,
  //    ma c'è almeno un candidato, usiamo il primo.
  //    (pagina di ricetta che incorpora video -> iframe sulla pagina)
  if (candidates.length > 0) {
    return candidates[0];
  }

  return null;
}

// ------------------------------------
// Video modal
// ------------------------------------
function openVideo(url) {
  if (!dom.videoModal || !dom.videoFrame || !url) return;

  // impedisce re-open sporchi
  dom.videoFrame.src = "";
  dom.videoFrame.src = url;

  dom.videoModal.classList.add("open");
  dom.videoModal.classList.remove("hidden");
}

function closeVideo() {
  if (!dom.videoModal || !dom.videoFrame) return;

  dom.videoFrame.src = "";
  dom.videoModal.classList.remove("open");
  dom.videoModal.classList.add("hidden");
}

// ------------------------------------
// Render ricette
// ------------------------------------
function renderRecipes() {
  if (!dom.recipesContainer) return;

  const term = dom.searchInput ? dom.searchInput.value.trim() : "";
  const onlyFav = dom.favoritesToggle
    ? dom.favoritesToggle.checked
    : false;

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
    const servings =
      r.servings || r.persone || r.porzioni || r.portions || "";
    const source =
      r.source ||
      (r.enrichedFrom && r.enrichedFrom.source) ||
      "";
    const ingredientsCount = Array.isArray(r.ingredients)
      ? r.ingredients.length
      : 0;

    const recipeUrl =
      r.url ||
      (r.links && r.links.source) ||
      (r.enrichedFrom && r.enrichedFrom.url) ||
      null;

    const videoUrl = extractVideoUrl(r);
    const hasVideo = Boolean(videoUrl);

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

// ------------------------------------
// Event binding sulle card
// ------------------------------------
function attachCardEvents() {
  if (!dom.recipesContainer) return;

  // Preferiti
  dom.recipesContainer.querySelectorAll(".fav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      toggleFavorite(id);
    });
  });

  // Apri ricetta in nuova tab
  dom.recipesContainer
    .querySelectorAll("[data-open-recipe]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-open-recipe");
        if (url) window.open(url, "_blank", "noopener");
      });
    });

  // Lista ingredienti (popup semplice per ora)
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

  // Video modal
  dom.recipesContainer.querySelectorAll("[data-video]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-video");
      if (url) openVideo(url);
    });
  });
}

// ------------------------------------
// Load data
// ------------------------------------
async function loadData() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const base = Array.isArray(json) ? json : json.recipes || [];
    allRecipes = base.map((r, index) => ({
      id: r.id || `r-${index}`,
      ...r
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

// ------------------------------------
// Event listeners globali
// ------------------------------------
if (dom.searchInput) {
  dom.searchInput.addEventListener("input", renderRecipes);
}

if (dom.favoritesToggle) {
  dom.favoritesToggle.addEventListener("change", renderRecipes);
}

if (dom.updateBtn) {
  dom.updateBtn.addEventListener("click", loadData);
}

// Chiusura modale video
if (dom.closeVideo) {
  dom.closeVideo.addEventListener("click", closeVideo);
}
if (dom.videoModal) {
  dom.videoModal.addEventListener("click", (e) => {
    if (e.target === dom.videoModal) closeVideo();
  });
}

// ------------------------------------
// Init
// ------------------------------------
console.log("Avvio app Ricette & Lista Spesa v18");
loadData();
