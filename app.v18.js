// app.v18.js
// Ricette & Lista Spesa v18
// UI stabile, preferiti, ricerca, modale video funzionante.

console.log("Avvio app Ricette & Lista Spesa v18")

// -------------------------
// Config
// -------------------------
const DATA_URL = "assets/json/recipes-it.enriched.json"
const LS_FAVORITES_KEY = "rls_favorites_v1"

// -------------------------
// DOM refs (coerenti con index.html)
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
}

// Check diagnostico (non blocca)
;(() => {
  const missing = Object.entries(dom)
    .filter(([, el]) => !el)
    .map(([key]) => key)
  if (missing.length) {
    console.warn("Elementi DOM attesi mancanti (solo warning):", missing)
  }
})()

// -------------------------
// Stato
// -------------------------
let allRecipes = []
let favorites = loadFavorites()

// -------------------------
// LocalStorage favorites
// -------------------------
function loadFavorites() {
  try {
    const raw = localStorage.getItem(LS_FAVORITES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(favorites))
  } catch {
    // best effort
  }
}

function isFavorite(id) {
  return !!favorites[id]
}

function toggleFavorite(id) {
  if (!id) return
  favorites[id] = !favorites[id]
  if (!favorites[id]) delete favorites[id]
  saveFavorites()
  renderRecipes()
}

// -------------------------
// Utility
// -------------------------
function normalize(str) {
  return (str || "").toString().toLowerCase()
}

function matchesSearch(recipe, term) {
  if (!term) return true
  const q = normalize(term)

  const title = normalize(recipe.title)
  const ingredients = normalize(
    Array.isArray(recipe.ingredients) ? recipe.ingredients.join(" ") : ""
  )

  return title.includes(q) || ingredients.includes(q)
}

function getRecipeId(r, index) {
  return (r && r.id) || `r-${index}`
}

function getRecipeUrl(r) {
  if (!r || typeof r !== "object") return null
  return (
    r.url ||
    (r.links && r.links.source) ||
    (r.enrichedFrom && r.enrichedFrom.url) ||
    null
  )
}

// Legge il video da vari formati possibili del JSON
function getRawVideoUrl(r) {
  if (!r || typeof r !== "object") return null

  // Caso: { video: { url: "..." } }
  if (r.video && typeof r.video === "object" && typeof r.video.url === "string") {
    return r.video.url
  }

  // Caso: { video: "https://..." } o ID
  if (typeof r.video === "string") {
    return r.video
  }

  // Caso: { videoUrl: "..." }
  if (typeof r.videoUrl === "string") {
    return r.videoUrl
  }

  // Caso: { youtube: "..." }
  if (typeof r.youtube === "string") {
    return r.youtube
  }

  return null
}

// Converte YouTube normali in embed sicuro
function toEmbedUrl(url) {
  if (!url) return null
  const trimmed = url.trim()

  if (!trimmed) return null

  if (/^https?:\/\/youtu\.be\//i.test(trimmed)) {
    const id = trimmed.split("/").pop()
    if (id) return `https://www.youtube.com/embed/${id}?rel=0`
  }

  if (/^https?:\/\/(www\.)?youtube\.com\//i.test(trimmed)) {
    const m = trimmed.match(/[?&]v=([\w-]{6,})/)
    if (m && m[1]) {
      return `https://www.youtube.com/embed/${m[1]}?rel=0`
    }
    if (/\/embed\//i.test(trimmed)) {
      return trimmed
    }
  }

  // Se non è YouTube ma è un URL valido, uso diretto
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  // Se sembra un ID YouTube secco
  if (/^[\w-]{8,}$/.test(trimmed)) {
    return `https://www.youtube.com/embed/${trimmed}?rel=0`
  }

  return null
}

// -------------------------
// Video modal
// -------------------------
function openVideo(rawUrl) {
  if (!dom.videoModal || !dom.videoFrame) return
  const embed = toEmbedUrl(rawUrl)
  if (!embed) {
    console.warn("Video non valido:", rawUrl)
    return
  }
  dom.videoFrame.src = embed
  dom.videoModal.classList.remove("hidden")
  dom.videoModal.setAttribute("aria-hidden", "false")
}

function closeVideo() {
  if (!dom.videoModal || !dom.videoFrame) return
  dom.videoFrame.src = ""
  dom.videoModal.classList.add("hidden")
  dom.videoModal.setAttribute("aria-hidden", "true")
}

// -------------------------
// Render
// -------------------------
function renderRecipes() {
  if (!dom.recipesContainer) return

  const term = dom.searchInput ? dom.searchInput.value.trim() : ""
  const onlyFav = dom.favoritesToggle ? dom.favoritesToggle.checked : false

  const filtered = allRecipes.filter((r, index) => {
    const id = getRecipeId(r, index)
    if (onlyFav && !isFavorite(id)) return false
    return matchesSearch(r, term)
  })

  if (dom.recipeCount) {
    dom.recipeCount.textContent = `Ricette visibili: ${filtered.length}`
  }

  dom.recipesContainer.innerHTML = ""

  if (!filtered.length) {
    const empty = document.createElement("div")
    empty.className = "empty-state"
    empty.textContent = "Nessuna ricetta trovata con i filtri attuali."
    dom.recipesContainer.appendChild(empty)
    return
  }

  filtered.forEach((r, index) => {
    const id = getRecipeId(r, index)
    const fav = isFavorite(id)

    const difficulty = r.difficulty || r.diff || ""
    const servings =
      r.servings || r.persone || r.porzioni || r.portions || ""
    const source =
      r.source ||
      (r.enrichedFrom && (r.enrichedFrom.source || r.enrichedFrom.hostname)) ||
      ""
    const ingredientsCount = Array.isArray(r.ingredients)
      ? r.ingredients.length
      : 0

    const recipeUrl = getRecipeUrl(r)
    const rawVideoUrl = getRawVideoUrl(r)
    const videoUrl = toEmbedUrl(rawVideoUrl)
    const hasVideo = !!videoUrl

    const card = document.createElement("article")
    card.className = "recipe-card"

    card.innerHTML = `
      ${fav
        ? `<div class="favorite-pill">★ Preferita</div>`
        : ""
      }

      <h2 class="recipe-title">
        ${r.title || "Ricetta senza titolo"}
      </h2>

      <div class="recipe-meta">
        ${difficulty ? `<span>Diff: ${difficulty}</span>` : ""}
        ${servings ? `<span>Porzioni: ${servings}</span>` : ""}
        ${source ? `<span>${source}</span>` : ""}
        ${ingredientsCount ? `<span>${ingredientsCount} ingredienti</span>` : ""}
      </div>

      <div class="recipe-actions">
        <button class="btn-outline" data-fav="${id}">
          ${fav ? "Rimuovi preferito" : "Aggiungi preferito"}
        </button>

        ${
          recipeUrl
            ? `<button class="btn primary" data-open-recipe="${encodeURI(
                recipeUrl
              )}">Apri ricetta</button>`
            : `<button class="btn disabled" disabled>Nessun link</button>`
        }

        <button
          class="btn-ghost"
          data-show-ingredients="${id}"
        >
          Lista ingredienti
        </button>

        ${
          hasVideo
            ? `<button class="btn video" data-video="${encodeURI(
                rawVideoUrl
              )}">Guarda video</button>`
            : `<button class="btn-ghost" disabled>Video n/d</button>`
        }
      </div>
    `

    dom.recipesContainer.appendChild(card)
  })

  bindCardEvents()
}

// -------------------------
// Eventi sulle card
// -------------------------
function bindCardEvents() {
  if (!dom.recipesContainer) return

  // Preferiti
  dom.recipesContainer
    .querySelectorAll("[data-fav]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-fav")
        toggleFavorite(id)
      })
    })

  // Apri ricetta sorgente
  dom.recipesContainer
    .querySelectorAll("[data-open-recipe]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-open-recipe")
        if (url) window.open(url, "_blank", "noopener")
      })
    })

  // Lista ingredienti
  dom.recipesContainer
    .querySelectorAll("[data-show-ingredients]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-show-ingredients")
        const recipe = allRecipes.find((r, index) => getRecipeId(r, index) === id)
        if (!recipe || !Array.isArray(recipe.ingredients)) {
          alert("Nessuna lista ingredienti disponibile.")
          return
        }
        alert("Ingredienti:\n\n" + recipe.ingredients.join("\n"))
      })
    })

  // Video
  dom.recipesContainer
    .querySelectorAll("[data-video]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const rawUrl = btn.getAttribute("data-video")
        openVideo(rawUrl)
      })
    })
}

// -------------------------
// Load data
// -------------------------
async function loadData() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const base = Array.isArray(json) ? json : json.recipes || []

    allRecipes = base.map((r, index) => ({
      id: getRecipeId(r, index),
      ...r,
    }))

    console.log("Caricate ricette:", allRecipes.length)
    renderRecipes()
  } catch (err) {
    console.error("Errore nel caricare i dati ricette:", err)
    if (dom.recipeCount) {
      dom.recipeCount.textContent = "Errore nel caricamento dati."
    }
  }
}

// -------------------------
// Eventi globali modale
// -------------------------
if (dom.closeVideo) {
  dom.closeVideo.addEventListener("click", closeVideo)
}

if (dom.videoModal) {
  dom.videoModal.addEventListener("click", (e) => {
    if (
      e.target.id === "videoModal" ||
      e.target.classList.contains("modal-backdrop")
    ) {
      closeVideo()
    }
  })
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeVideo()
})

// -------------------------
// Init
// -------------------------
document.addEventListener("DOMContentLoaded", () => {
  loadData()
})
