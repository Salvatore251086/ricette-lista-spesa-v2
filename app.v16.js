// app.v16.js
// Ricette & Lista Spesa v2
// Caricamento ricette, mapping video, azioni bottoni

// === PATH CORRETTI AI JSON ===
const RECIPES_URL = "assets/json/recipes-it.json";
const VIDEO_INDEX_URL = "assets/json/video_index.resolved.json";
const SOURCES_URL = "assets/json/sources.json"; // opzionale: se non c'è lo ignoriamo

let ALL_RECIPES = [];
let VIDEO_MAP = {};
let SOURCES_MAP = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const [recipesData, videoIndexData, sourcesData] = await Promise.all([
      fetchJSONSafe(RECIPES_URL),
      fetchJSONSafe(VIDEO_INDEX_URL),
      fetchJSONSafe(SOURCES_URL, true) // opzionale
    ]);

    // --- Normalizza ricette ---
    if (Array.isArray(recipesData)) {
      ALL_RECIPES = recipesData;
    } else if (recipesData && Array.isArray(recipesData.recipes)) {
      ALL_RECIPES = recipesData.recipes;
    } else {
      console.error("Formato recipes-it.json non valido", recipesData);
      showFatalMessage("Errore caricamento dati ricette.");
      return;
    }

    // --- Normalizza mappa sorgenti (se presente) ---
    if (sourcesData) {
      if (Array.isArray(sourcesData)) {
        SOURCES_MAP = {};
        for (const entry of sourcesData) {
          const key =
            entry.slug ||
            entry.id ||
            (entry.title ? slugify(entry.title) : null);
          if (key && entry.url) {
            SOURCES_MAP[key] = entry.url;
          }
        }
      } else if (typeof sourcesData === "object") {
        SOURCES_MAP = sourcesData;
      }
    }

    // --- Costruisci mappa video ---
    VIDEO_MAP = buildVideoMap(videoIndexData || []);

    console.log("Caricate ricette:", ALL_RECIPES.length);
    console.log("Video indicizzati:", Object.keys(VIDEO_MAP).length);

    setupUI();
    renderRecipes(ALL_RECIPES);
  } catch (err) {
    console.error("Errore durante init():", err);
    showFatalMessage("Errore caricamento dati.");
  }
}

// ---------- Utils fetch ----------

async function fetchJSONSafe(url, optional = false) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      if (optional) return null;
      throw new Error(`HTTP ${res.status} per ${url}`);
    }
    return await res.json();
  } catch (err) {
    if (optional) {
      console.warn(`Impossibile caricare opzionale ${url}:`, err.message);
      return null;
    }
    throw err;
  }
}

// ---------- Video map ----------

function buildVideoMap(data) {
  const map = {};
  if (!data) return map;

  if (Array.isArray(data)) {
    for (const item of data) {
      if (!item) continue;
      const slug =
        item.slug ||
        (item.title ? slugify(item.title) : null);
      const yt =
        item.youtubeId ||
        item.youtube_id ||
        item.ytId;
      if (slug && yt) {
        map[slug] = {
          youtubeId: yt,
          title: item.title || slug
        };
      }
    }
  } else if (typeof data === "object") {
    for (const [slug, val] of Object.entries(data)) {
      const yt =
        val.youtubeId ||
        val.youtube_id ||
        val.ytId;
      if (yt) {
        map[slug] = {
          youtubeId: yt,
          title: val.title || slug
        };
      }
    }
  }

  return map;
}

// ---------- UI setup ----------

function setupUI() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", handleSearch);
  }

  const backdrop = document.getElementById("modal-backdrop");
  const closeBtn = document.getElementById("modal-close");
  if (backdrop && closeBtn) {
    closeBtn.addEventListener("click", closeModal);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
  }
}

// ---------- Rendering ricette ----------

function renderRecipes(list) {
  const container = document.getElementById("recipes-container");
  const template = document.getElementById("recipe-card-template");

  if (!container || !template) {
    console.error("Mancano container o template per le ricette");
    return;
  }

  container.innerHTML = "";

  list.forEach((recipe, index) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".recipe-card");

    const titleEl = node.querySelector(".recipe-title");
    const metaEl = node.querySelector(".recipe-meta");
    const statsEl = node.querySelector(".recipe-stats");
    const btnRecipe = node.querySelector(".btn-open-recipe");
    const btnVideo = node.querySelector(".btn-open-video");
    const btnAdd = node.querySelector(".btn-add-list");

    const title = recipe.title || `Ricetta ${index + 1}`;
    const slug = (recipe.slug || slugify(title)).trim();

    card.dataset.index = index;
    card.dataset.slug = slug;

    if (titleEl) titleEl.textContent = title;

    const src = recipe.source || recipe.sourceName || "";
    if (metaEl) metaEl.textContent = src ? `Fonte: ${src}` : "";

    if (statsEl) {
      statsEl.innerHTML = "";
      const parts = [];

      if (recipe.portions || recipe.porzioni) {
        parts.push(`Porzioni: ${recipe.portions || recipe.porzioni}`);
      }
      if (recipe.difficulty || recipe.difficolta) {
        parts.push(`Diff.: ${recipe.difficulty || recipe.difficolta}`);
      }
      if (recipe.prepTime || recipe.prep_time) {
        parts.push(`Prep.: ${recipe.prepTime || recipe.prep_time}`);
      }
      if (recipe.cookTime || recipe.cook_time) {
        parts.push(`Cottura: ${recipe.cookTime || recipe.cook_time}`);
      }

      if (!parts.length) {
        parts.push("Dettagli ricetta disponibili nella pagina sorgente.");
      }

      for (const txt of parts) {
        const li = document.createElement("li");
        li.textContent = txt;
        statsEl.appendChild(li);
      }
    }

    // Apri ricetta
    if (btnRecipe) {
      btnRecipe.addEventListener("click", () => handleOpenRecipe(index));
    }

    // Video
    if (btnVideo) {
      btnVideo.dataset.slug = slug;
      const hasVideo = !!findVideoForSlug(slug, recipe);
      btnVideo.textContent = hasVideo ? "Guarda video" : "Video n/d";
      btnVideo.disabled = !hasVideo;
      btnVideo.addEventListener("click", () =>
        handleOpenVideo(slug, recipe)
      );
    }

    // Lista spesa (placeholder)
    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        alert("Funzione lista spesa: in sviluppo. (Dati ricetta già pronti)");
      });
    }

    container.appendChild(node);
  });

  updateVisibleCount(list.length);
}

function updateVisibleCount(n) {
  const el = document.getElementById("visible-count");
  if (el) el.textContent = String(n);
}

// ---------- Search ----------

function handleSearch(e) {
  const q = (e.target.value || "").toLowerCase().trim();
  if (!q) {
    renderRecipes(ALL_RECIPES);
    return;
  }

  const filtered = ALL_RECIPES.filter((r) => {
    const haystack = [
      r.title,
      r.slug,
      r.source,
      r.sourceName,
      r.ingredients && r.ingredients.join(" ")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  renderRecipes(filtered);
}

// ---------- Azioni bottoni ----------

function handleOpenRecipe(index) {
  const recipe = ALL_RECIPES[index];
  if (!recipe) {
    alert("Ricetta non trovata.");
    return;
  }

  const title = recipe.title || "Ricetta";

  // 1) campi diretti nella ricetta
  const directKeys = ["sourceUrl", "url", "href", "link"];
  for (const k of directKeys) {
    if (recipe[k]) {
      window.open(recipe[k], "_blank", "noopener");
      return;
    }
  }

  // 2) lookup tramite slug / id in SOURCES_MAP
  const slug = (recipe.slug || slugify(title)).trim();
  if (SOURCES_MAP && typeof SOURCES_MAP === "object") {
    if (SOURCES_MAP[slug]) {
      window.open(SOURCES_MAP[slug], "_blank", "noopener");
      return;
    }
    if (recipe.id && SOURCES_MAP[recipe.id]) {
      window.open(SOURCES_MAP[recipe.id], "_blank", "noopener");
      return;
    }
    if (SOURCES_MAP.sources && SOURCES_MAP.sources[slug]) {
      window.open(SOURCES_MAP.sources[slug], "_blank", "noopener");
      return;
    }
  }

  // 3) fallback: ricerca Google
  const query = encodeURIComponent(`${title} ricetta`);
  const url = `https://www.google.com/search?q=${query}`;
  window.open(url, "_blank", "noopener");
}

function handleOpenVideo(slug, recipe) {
  const match = findVideoForSlug(slug, recipe);
  if (!match) {
    alert("Video non disponibile per questa voce.");
    return;
  }

  const { youtubeId, title } = match;
  const embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1`;

  const html = `
    <h2>${escapeHtml(title || (recipe && recipe.title) || "Video ricetta")}</h2>
    <div class="video-wrapper">
      <iframe
        src="${embedUrl}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>
  `;

  openModal(html);
}

function findVideoForSlug(slug, recipe) {
  if (VIDEO_MAP[slug]) return VIDEO_MAP[slug];

  if (recipe && recipe.title) {
    const alt = slugify(recipe.title);
    if (VIDEO_MAP[alt]) return VIDEO_MAP[alt];
  }

  return null;
}

// ---------- Modal ----------

function openModal(html) {
  const backdrop = document.getElementById("modal-backdrop");
  const content = document.getElementById("modal-content");
  if (!backdrop || !content) return;

  content.innerHTML = html;
  backdrop.classList.remove("hidden");
}

function closeModal() {
  const backdrop = document.getElementById("modal-backdrop");
  const content = document.getElementById("modal-content");
  if (backdrop) backdrop.classList.add("hidden");
  if (content) content.innerHTML = "";
}

// ---------- Helpers ----------

function slugify(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showFatalMessage(msg) {
  const container = document.getElementById("recipes-container");
  if (container) {
    container.innerHTML = `<p class="error">${msg}</p>`;
  }
}
