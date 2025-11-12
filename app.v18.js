console.log("Avvio app Ricette & Lista Spesa v18");

const DATA_URL = "assets/json/recipes-it.enriched.json";
const LS_FAVORITES_KEY = "rls_favorites_v1";

const dom = {
  searchInput: document.getElementById("search"),
  updateBtn: document.getElementById("updateDataBtn"),
  favoritesToggle: document.getElementById("favoritesToggle"),
  recipeCount: document.getElementById("recipeCount"),
  recipesContainer: document.getElementById("recipes"),
  videoModal: document.getElementById("videoModal"),
  videoFrame: document.getElementById("videoFrame"),
  closeVideo: document.getElementById("closeVideo")
};

{
  const missing = Object.entries(dom)
    .filter(([, el]) => !el)
    .map(([k]) => k);
  if (missing.length)
    console.warn("Elementi DOM mancanti (verifica index.html, NON blocco).", missing);
}

let allRecipes = [];
let favorites = loadFavorites();
let videoIndex = {};

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
  } catch {}
}

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

function normVideoUrl(u) {
  if (!u) return "";
  const s = String(u).trim();
  if (!s) return "";
  if (s.includes("<iframe")) {
    const m = s.match(/src\s*=\s*"(.*?)"/i);
    return m ? m[1] : "";
  }
  if (s.includes("youtube.com/watch") || s.includes("youtu.be")) {
    try {
      const url = new URL(s);
      let id = url.searchParams.get("v");
      if (!id) id = s.split("/").pop();
      return id ? `https://www.youtube.com/embed/${id}` : "";
    } catch {
      return s;
    }
  }
  return s;
}

function openVideo(url) {
  const u = normVideoUrl(url);
  if (!dom.videoModal || !dom.videoFrame || !u) return;
  dom.videoFrame.src = u;
  dom.videoModal.classList.remove("hidden");
  dom.videoModal.setAttribute("aria-hidden", "false");
}

function closeVideoFn() {
  if (!dom.videoModal || !dom.videoFrame) return;
  dom.videoFrame.src = "";
  dom.videoModal.classList.add("hidden");
  dom.videoModal.setAttribute("aria-hidden", "true");
}

function renderRecipes() {
  if (!dom.recipesContainer) return;
  const term = dom.searchInput ? dom.searchInput.value.trim() : "";
  const onlyFav = dom.favoritesToggle ? dom.favoritesToggle.checked : false;

  const filtered = allRecipes.filter(r => {
    if (onlyFav && !isFavorite(r.id)) return false;
    return matchesSearch(r, term);
  });

  if (dom.recipeCount)
    dom.recipeCount.textContent = `Ricette visibili: ${filtered.length}`;

  dom.recipesContainer.innerHTML = "";

  filtered.forEach(r => {
    const card = document.createElement("article");
    card.className = "recipe-card";

    const fav = isFavorite(r.id);

    const difficulty = r.difficulty || r.diff || "";
    const servings = r.servings || r.persone || r.porzioni || r.portions;
    const source = r.source || (r.enrichedFrom && r.enrichedFrom.source) || "";

    const rawVideo =
      (r.video && r.video.url) || videoIndex[r.id] || "";
    const videoUrl = normVideoUrl(rawVideo);
    const hasVideo = !!videoUrl;

    const recipeUrl =
      r.url ||
      (r.links && r.links.source) ||
      (r.enrichedFrom && r.enrichedFrom.url) ||
      null;

    const ingredientsCount = Array.isArray(r.ingredients)
      ? r.ingredients.length
      : 0;

    card.innerHTML = `
      <div class="recipe-card-header">
        <button class="fav-btn" data-id="${r.id || ""}" title="Aggiungi ai preferiti">${fav ? "★" : "☆"}</button>
        <h2 class="recipe-title">${r.title || "Ricetta senza titolo"}</h2>
      </div>
      <div class="recipe-meta">
        ${difficulty ? `<span class="badge">Diff: ${difficulty}</span>` : ""}
        ${servings ? `<span class="badge">Porzioni: ${servings}</span>` : ""}
        ${source ? `<span class="badge badge-source">${source}</span>` : ""}
        ${ingredientsCount ? `<span class="badge badge-ingredients">${ingredientsCount} ingredienti</span>` : ""}
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

function attachCardEvents() {
  if (!dom.recipesContainer) return;

  dom.recipesContainer.querySelectorAll(".fav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      toggleFavorite(id);
    });
  });

  dom.recipesContainer.querySelectorAll("[data-open-recipe]").forEach(btn => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-open-recipe");
      if (url) window.open(url, "_blank", "noopener");
    });
  });

  dom.recipesContainer.querySelectorAll("[data-show-ingredients]").forEach(
    btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-show-ingredients");
        const recipe = allRecipes.find(r => r.id === id);
        if (!recipe || !Array.isArray(recipe.ingredients)) {
          alert("Nessuna lista ingredienti disponibile.");
          return;
        }
        alert("Ingredienti:\n\n" + recipe.ingredients.join("\n"));
      });
    }
  );

  dom.recipesContainer.querySelectorAll("[data-video]").forEach(btn => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-video");
      if (url) openVideo(url);
    });
  });
}

async function loadVideoIndex() {
  try {
    const r = await fetch("assets/json/video_index.manual.json", {
      cache: "no-store"
    });
    if (r.ok) videoIndex = await r.json();
    else videoIndex = {};
  } catch {
    videoIndex = {};
  }
}

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

    allRecipes = allRecipes.map(r => {
      if ((!r.video || !r.video.url) && videoIndex[r.id]) {
        r.video = { url: videoIndex[r.id] };
      }
      return r;
    });

    console.log("Caricate ricette:", allRecipes.length);
    renderRecipes();
  } catch (err) {
    console.error("Errore nel caricare i dati ricette:", err);
    if (dom.recipeCount)
      dom.recipeCount.textContent = "Errore nel caricamento dati.";
  }
}

if (dom.searchInput) dom.searchInput.addEventListener("input", renderRecipes);
if (dom.favoritesToggle)
  dom.favoritesToggle.addEventListener("change", renderRecipes);
if (dom.updateBtn) dom.updateBtn.addEventListener("click", loadData);

if (dom.closeVideo) dom.closeVideo.addEventListener("click", closeVideoFn);
if (dom.videoModal) {
  dom.videoModal.addEventListener("click", e => {
    if (e.target === dom.videoModal) closeVideoFn();
  });
}

(async () => {
  await loadVideoIndex();
  await loadData();
})();
