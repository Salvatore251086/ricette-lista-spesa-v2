console.log("Avvio app Ricette & Lista Spesa v17");

// Elementi DOM
const searchInput = document.getElementById("searchInput");
const recipesContainer = document.getElementById("recipesContainer");
const updateButton = document.getElementById("updateButton");
const favoriteToggle = document.getElementById("favoriteToggle");
const visibleCount = document.getElementById("visibleCount");

// Modali
const recipeModal = document.getElementById("recipeModal");
const videoModal = document.getElementById("videoModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const videoFrame = document.getElementById("videoFrame");

// Dataset
let allRecipes = [];
let filteredRecipes = [];

// Inizializzazione
window.addEventListener("DOMContentLoaded", async () => {
  if (!recipesContainer || !updateButton) {
    console.error("Errore: elementi DOM mancanti. Controlla ID in index.html.");
    return;
  }

  await loadRecipes();
  renderRecipes(allRecipes);
  console.log(`Caricate ricette: ${allRecipes.length}`);

  // Listener
  if (searchInput) searchInput.addEventListener("input", handleSearch);
  if (updateButton) updateButton.addEventListener("click", handleUpdate);
});

// Funzione caricamento ricette
async function loadRecipes() {
  try {
    const res = await fetch("assets/json/recipes-it.enriched.json");
    const data = await res.json();
    allRecipes = Array.isArray(data.recipes) ? data.recipes : [];
    filteredRecipes = allRecipes;
  } catch (err) {
    console.error("Errore caricamento ricette:", err);
  }
}

// Render card ricette
function renderRecipes(list) {
  if (!recipesContainer) return;
  recipesContainer.innerHTML = "";

  list.forEach((r) => {
    const card = document.createElement("div");
    card.className = "recipe-card";
    card.innerHTML = `
      <h4>${r.title || "Ricetta senza titolo"}</h4>
      <p>Porzioni: ${r.portions || 4}</p>
      <button class="btn" onclick="openRecipeModal(${JSON.stringify(r).replace(/"/g, '&quot;')})">Apri ricetta</button>
      ${
        r.videoId
          ? `<button class="btn-secondary" onclick="openVideo('${r.videoId}')">Guarda video</button>`
          : `<button class="btn-disabled" disabled>Video n/d</button>`
      }
    `;
    recipesContainer.appendChild(card);
  });

  if (visibleCount) visibleCount.textContent = `Ricette visibili: ${list.length}`;
}

// Ricerca
function handleSearch(e) {
  const q = e.target.value.toLowerCase();
  filteredRecipes = allRecipes.filter(
    (r) =>
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.ingredients &&
        Array.isArray(r.ingredients) &&
        r.ingredients.join(" ").toLowerCase().includes(q))
  );
  renderRecipes(filteredRecipes);
}

// Aggiorna dati
async function handleUpdate() {
  console.log("Aggiornamento dati in corso...");
  await loadRecipes();
  renderRecipes(allRecipes);
}

// Modali
function openRecipeModal(r) {
  if (!modalTitle || !modalBody || !recipeModal) return;
  modalTitle.textContent = r.title || "Ricetta";
  const ingredients = (r.ingredients || []).map((i) => `<li>${i}</li>`).join("");
  const steps = (r.steps || []).map((s) => `<li>${s}</li>`).join("");
  modalBody.innerHTML = `
    <h4>Ingredienti</h4>
    <ul>${ingredients}</ul>
    <h4>Preparazione</h4>
    <ol>${steps}</ol>
  `;
  recipeModal.classList.remove("hidden");
}

function closeRecipeModal() {
  recipeModal.classList.add("hidden");
}

// Video
function openVideo(videoId) {
  if (!videoModal || !videoFrame) return;
  const url = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`;
  let fallback = false;
  videoFrame.src = url;

  const timeout = setTimeout(() => {
    if (!fallback) {
      fallback = true;
      window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
      closeVideoModal();
    }
  }, 2000);

  videoFrame.onload = () => clearTimeout(timeout);
  videoModal.classList.remove("hidden");
}

function closeVideoModal() {
  videoFrame.src = "";
  videoModal.classList.add("hidden");
}
