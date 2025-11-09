(function () {
  // --- Config ---------------------------------------------------------

  const RECIPES_URL = "assets/json/recipes-it.json";
  const VIDEO_INDEX_URL = "assets/json/video_index.resolved.json";

  // --- Stato ----------------------------------------------------------

  let ALL_RECIPES = [];
  let VIDEO_MAP = {};

  // --- DOM cache ------------------------------------------------------

  const dom = {
    container: document.getElementById("recipes-container"),
    cardTemplate: document.getElementById("recipe-card-template"),
    searchInput: document.getElementById("search-input"),
    visibleCount: document.getElementById("visible-count"),
    totalCount: document.getElementById("total-count"),
    errorLabel: document.getElementById("error-label"),
    backdrop: document.getElementById("modal-backdrop"),
    modal: document.getElementById("video-modal"),
    modalTitle: document.getElementById("video-modal-title"),
    modalClose: document.getElementById("video-modal-close"),
    videoFrame: document.getElementById("video-frame"),
  };

  if (!dom.container || !dom.cardTemplate) {
    console.error("Mancano container o template per le ricette");
    return;
  }

  // --- Init -----------------------------------------------------------

  init().catch((err) => {
    console.error("Errore durante init():", err);
    showError("Errore caricamento dati.");
  });

  // -------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------

  async function init() {
    // niente service worker aggressivo in sviluppo
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          // per sicurezza, non vogliamo che vecchi SW cachino vecchi JS
          r.unregister().catch(() => {});
        }
      }
    } catch (_) {}

    const [recipesData, videoData] = await Promise.all([
      fetchJSON(RECIPES_URL),
      fetchJSON(VIDEO_INDEX_URL).catch(() => []),
    ]);

    ALL_RECIPES = Array.isArray(recipesData.recipes)
      ? recipesData.recipes
      : Array.isArray(recipesData)
      ? recipesData
      : [];

    VIDEO_MAP = buildVideoMap(videoData);

    dom.totalCount.textContent = ALL_RECIPES.length.toString();

    renderRecipes(ALL_RECIPES);
    wireSearch();
    wireModal();

    console.log("Caricate ricette:", ALL_RECIPES.length);
    console.log("Video indicizzati:", Object.keys(VIDEO_MAP).length);
  }

  // -------------------------------------------------------------------
  // Fetch helper
  // -------------------------------------------------------------------

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} per ${url}`);
    }
    return res.json();
  }

  // -------------------------------------------------------------------
  // Video index
  // -------------------------------------------------------------------

  function buildVideoMap(list) {
    const map = {};
    if (!Array.isArray(list)) return map;

    for (const entry of list) {
      if (!entry || !entry.youtubeId) continue;

      const base =
        (entry.slug && String(entry.slug).toLowerCase()) ||
        slugify(entry.title || "");

      if (!base) continue;
      if (!map[base]) {
        map[base] = entry;
      }
    }
    return map;
  }

  function findVideoForRecipe(recipe) {
    if (!recipe || !VIDEO_MAP) return null;

    // slug da ricetta (se esiste nel JSON originale)
    const slug = (recipe.slug && String(recipe.slug)) || slugify(recipe.title);
    const key = slug.toLowerCase();

    if (VIDEO_MAP[key]) return VIDEO_MAP[key];

    // fallback: normalizzazione più aggressiva
    const norm = key
      .replace(/-con-|-alla-|-alle-|-al-|-ai-|-col-|-coi-/g, "-")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (VIDEO_MAP[norm]) return VIDEO_MAP[norm];

    // fallback: match su titolo pieno
    const lowerTitle = (recipe.title || "").toLowerCase().trim();
    if (!lowerTitle) return null;

    for (const k of Object.keys(VIDEO_MAP)) {
      const v = VIDEO_MAP[k];
      if (
        v.title &&
        v.title.toLowerCase().trim() === lowerTitle
      ) {
        return v;
      }
    }

    return null;
  }

  // -------------------------------------------------------------------
  // Render ricette
  // -------------------------------------------------------------------

  function renderRecipes(list) {
    dom.container.innerHTML = "";

    list.forEach((recipe) => {
      const node = dom.cardTemplate.content.cloneNode(true);
      const card = node.querySelector(".recipe-card");
      const titleEl = node.querySelector(".recipe-title");
      const metaEl = node.querySelector(".recipe-meta");
      const notesEl = node.querySelector(".recipe-notes");
      const btnOpen = node.querySelector(".btn-open-recipe");
      const btnVideo = node.querySelector(".btn-open-video");
      const btnList = node.querySelector(".btn-add-list");

      titleEl.textContent = recipe.title || "Ricetta senza titolo";

      // meta minimale
      metaEl.textContent = buildMeta(recipe);

      // note
      notesEl.innerHTML = "";
      if (recipe.source) {
        const li = document.createElement("li");
        li.textContent = `Dettagli ricetta disponibili nella pagina sorgente.`;
        notesEl.appendChild(li);
      }

      // bottone apri ricetta
      btnOpen.addEventListener("click", () => {
        if (recipe.url) {
          window.open(recipe.url, "_blank", "noopener");
        } else if (recipe.sourceUrl) {
          window.open(recipe.sourceUrl, "_blank", "noopener");
        } else {
          alert("Link ricetta non disponibile per questa voce.");
        }
      });

      // bottone video
      const videoInfo = findVideoForRecipe(recipe);
      if (!videoInfo) {
        btnVideo.textContent = "Video n/d";
        btnVideo.disabled = true;
      } else {
        btnVideo.textContent = "Guarda video";
        btnVideo.disabled = false;
        btnVideo.addEventListener("click", () =>
          openVideoModal(recipe, videoInfo)
        );
      }

      // bottone lista spesa (placeholder)
      btnList.addEventListener("click", () => {
        alert("Qui collegheremo la lista spesa / generatore (prossimo step).");
      });

      dom.container.appendChild(node);
    });

    dom.visibleCount.textContent = list.length.toString();
  }

  function buildMeta(recipe) {
    const bits = [];
    if (recipe.servings) bits.push(`Porzioni: ${recipe.servings}`);
    if (recipe.prepTime) bits.push(`Prep: ${recipe.prepTime}`);
    if (recipe.cookTime) bits.push(`Cottura: ${recipe.cookTime}`);
    if (recipe.difficulty) bits.push(`Diff.: ${recipe.difficulty}`);
    return bits.join(" · ") || "Dettagli ricetta disponibili nella pagina sorgente.";
  }

  // -------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------

  function wireSearch() {
    if (!dom.searchInput) return;

    dom.searchInput.addEventListener("input", () => {
      const q = dom.searchInput.value.toLowerCase().trim();
      if (!q) {
        renderRecipes(ALL_RECIPES);
        return;
      }

      const filtered = ALL_RECIPES.filter((r) => {
        const title = (r.title || "").toLowerCase();
        const ingredients = (Array.isArray(r.ingredients)
          ? r.ingredients.join(" ")
          : String(r.ingredients || "")
        ).toLowerCase();
        return title.includes(q) || ingredients.includes(q);
      });

      renderRecipes(filtered);
    });
  }

  // -------------------------------------------------------------------
  // Modale video
  // -------------------------------------------------------------------

  function wireModal() {
    if (!dom.modal || !dom.backdrop) return;

    dom.modalClose.addEventListener("click", closeVideoModal);
    dom.backdrop.addEventListener("click", closeVideoModal);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeVideoModal();
      }
    });
  }

  function openVideoModal(recipe, videoInfo) {
    if (!videoInfo || !videoInfo.youtubeId) {
      alert("Video non disponibile per questa ricetta.");
      return;
    }

    const url = `https://www.youtube.com/embed/${videoInfo.youtubeId}?autoplay=1&rel=0`;

    dom.modalTitle.textContent = videoInfo.title || recipe.title || "Video ricetta";
    dom.videoFrame.src = url;

    dom.backdrop.classList.remove("hidden");
    dom.modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeVideoModal() {
    dom.videoFrame.src = "";
    dom.modal.classList.add("hidden");
    dom.backdrop.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  // -------------------------------------------------------------------
  // Utils
  // -------------------------------------------------------------------

  function showError(msg) {
    if (dom.errorLabel) {
      dom.errorLabel.textContent = msg;
    } else {
      alert(msg);
    }
  }

  function slugify(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
})();
