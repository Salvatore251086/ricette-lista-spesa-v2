// app.v18.js
// Ricette & Lista Spesa - Frontend v18 stabile

console.log("Avvio app Ricette & Lista Spesa v18");

const DATA_URL = "assets/json/recipes-it.enriched.json";
const LS_FAVORITES_KEY = "rls_favorites_v1";

window.addEventListener("DOMContentLoaded", () => {
  // -------------------------
  // Cache DOM (allineato a index.html)
  // -------------------------
  const dom = {
    searchInput: document.getElementById("searchInput"),
    updateBtn: document.getElementById("updateDataBtn"),
    favoritesToggle: document.getElementById("favoritesToggle"),
    recipeCount: document.getElementById("recipeCount"),
    recipesContainer: document.getElementById("recipesContainer"),
    videoModal: document.getElementById("videoModal"),
    videoFrame: document.getElementById("videoFrame"),
    closeVideo: document.getElementById("closeVideo"),
  };

  const missing = Object.entries(dom)
    .filter(([, el]) => !el)
    .map(([key]) => key);

  if (missing.length) {
    console.warn(
      "Elementi DOM mancanti (verifica index.html, NON blocco l'app):",
      missing
    );
  }

  // -------------------------
  // Stato
  // -------------------------
  let allRecipes = [];
  let favorites = loadFavorites();

  // -------------------------
  // LocalStorage preferiti
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
      // silenzioso
    }
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
  // Utility
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

  // -------------------------
  // Modale video
  // -------------------------
  function openVideo(url) {
    if (!dom.videoModal || !dom.videoFrame) return;
    dom.videoFrame.src = url;
    dom.videoModal.classList.remove("hidden");
    dom.videoModal.setAttribute("aria-hidden", "false");
  }

  function closeVideo() {
    if (!dom.videoModal || !dom.videoFrame) return;
    dom.videoFrame.src = "";
    dom.videoModal.classList.add("hidden");
    dom.videoModal.setAttribute("aria-hidden", "true");
  }

  // -------------------------
  // Render ricette
  // -------------------------
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

    filtered.forEach((r, index) => {
      const id = (r.id || `r-${index}`).toString();
      const fav = isFavorite(id);

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

      const videoUrl = r.video && r.video.url ? r.video.url : "";
      const hasVideo = Boolean(videoUrl);
      const videoLabel = hasVideo ? "Guarda video" : "Video n/d";

      const card = document.createElement("article");
      card.className = "recipe-card";

      card.innerHTML = `
        <div class="recipe-card-header">
          <button class="fav-btn" data-id="${id}" title="Aggiungi ai preferiti">
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
          <button class="btn ghost" data-show-ingredients="${id}">
            Lista ingredienti
          </button>
          ${
            hasVideo
              ? `<button class="btn video" data-video="${encodeURI(
                  videoUrl
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

    // Lista ingredienti
    dom.recipesContainer
      .querySelectorAll("[data-show-ingredients]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-show-ingredients");
          const recipe = allRecipes.find(
            (r, i) => (r.id || `r-${i}`).toString() === id
          );
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
  // Caricamento dati
  // -------------------------
  async function loadData() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const base = Array.isArray(json) ? json : json.recipes || [];
      allRecipes = base.map((r, index) => ({
        id: (r.id || `r-${index}`).toString(),
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
  // Event listeners globali
  // -------------------------
  if (dom.searchInput) {
    dom.searchInput.addEventListener("input", renderRecipes);
  }

  if (dom.favoritesToggle) {
    dom.favoritesToggle.addEventListener("change", renderRecipes);
  }

  if (dom.updateBtn) {
    dom.updateBtn.addEventListener("click", loadData);
  }

  if (dom.closeVideo) {
    dom.closeVideo.addEventListener("click", closeVideo);
  }

  if (dom.videoModal) {
    dom.videoModal.addEventListener("click", (e) => {
      if (e.target === dom.videoModal) {
        closeVideo();
      }
    });
  }

  // -------------------------
  // Kickoff
  // -------------------------
  loadData();
});
