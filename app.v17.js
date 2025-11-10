// app.v17.js — build stabile 10.11.2025

console.log("Avvio app Ricette & Lista Spesa v17");

// Elementi base
const searchInput = document.getElementById("searchInput");
const recipesContainer = document.getElementById("recipesContainer");
const updateButton = document.getElementById("updateButton");
const favoriteToggle = document.getElementById("favoriteToggle");

// Dataset
let allRecipes = [];
let filteredRecipes = [];

// Inizializzazione
document.addEventListener("DOMContentLoaded", async () => {
  await loadRecipes();
  renderRecipes(allRecipes);
  console.log(`Caricate ricette: ${allRecipes.length}`);
});

// Caricamento ricette dal JSON arricchito
async function loadRecipes() {
  try {
    const response = await fetch("assets/json/recipes-it.enriched.json?_=" + Date.now());
    const data = await response.json();
    allRecipes = data.recipes || [];
  } catch (err) {
    console.error("Errore caricamento ricette:", err);
    allRecipes = [];
  }
}

// Render principale
function renderRecipes(recipes) {
  recipesContainer.innerHTML = "";
  recipes.forEach((r) => {
    const card = document.createElement("div");
    card.className = "recipe-card";

    const title = document.createElement("h3");
    title.textContent = r.title || "Ricetta senza titolo";

    const diff = document.createElement("p");
    diff.textContent = r.difficulty ? `Diff: ${r.difficulty}` : "Diff: easy";

    const servings = document.createElement("p");
    servings.textContent = `Porzioni: ${r.servings || 4}`;

    const openBtn = document.createElement("button");
    openBtn.textContent = "Apri ricetta";
    openBtn.className = "btn btn-primary";
    openBtn.onclick = () => openRecipeModal(r);

    const videoBtn = document.createElement("button");
    videoBtn.textContent = "Guarda video";
    videoBtn.className = "btn btn-success";
    videoBtn.disabled = !r.youtubeId;
    videoBtn.onclick = () => openVideoModal(r.youtubeId);

    const listBtn = document.createElement("button");
    listBtn.textContent = "Aggiungi alla lista spesa";
    listBtn.className = "btn btn-outline-secondary";
    listBtn.onclick = () => addToShoppingList(r);

    card.appendChild(title);
    card.appendChild(diff);
    card.appendChild(servings);
    card.appendChild(openBtn);
    card.appendChild(videoBtn);
    card.appendChild(listBtn);

    recipesContainer.appendChild(card);
  });

  document.getElementById("visibleCount").textContent = `Ricette visibili: ${recipes.length}`;
}

// Ricerca e filtri
searchInput.addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  filteredRecipes = allRecipes.filter(
    (r) =>
      r.title?.toLowerCase().includes(term) ||
      r.ingredients?.some((i) => i.toLowerCase().includes(term))
  );
  renderRecipes(filteredRecipes);
});

// Pulsante Aggiorna dati
updateButton.addEventListener("click", async () => {
  updateButton.disabled = true;
  updateButton.textContent = "Aggiornamento...";
  await loadRecipes();
  renderRecipes(allRecipes);
  updateButton.textContent = "Aggiorna dati";
  updateButton.disabled = false;
});

// Apertura modale ricetta
function openRecipeModal(recipe) {
  const modal = document.getElementById("recipeModal");
  const modalTitle = modal.querySelector(".modal-title");
  const modalBody = modal.querySelector(".modal-body");

  if (!recipe) return;

  modalTitle.textContent = recipe.title || "Ricetta senza titolo";

  const ingredients = recipe.ingredients?.length
    ? `<h4>Ingredienti</h4><ul>${recipe.ingredients.map(i => `<li>${i}</li>`).join("")}</ul>`
    : "<p>Nessun ingrediente disponibile.</p>";

  const steps = recipe.steps?.length
    ? `<h4>Preparazione</h4><ol>${recipe.steps.map(s => `<li>${s}</li>`).join("")}</ol>`
    : "<p>Nessuna preparazione disponibile.</p>";

  const source = recipe.enrichedFrom?.length
    ? `<p><small>Fonte: ${recipe.enrichedFrom.join(", ")}</small></p>`
    : "";

  modalBody.innerHTML = `${ingredients}${steps}${source}`;

  modal.style.display = "block";
  document.body.classList.add("modal-open");
}

// Chiusura modale ricetta
function closeRecipeModal() {
  const modal = document.getElementById("recipeModal");
  modal.style.display = "none";
  document.body.classList.remove("modal-open");
}

// Apertura modale video YouTube
function openVideoModal(youtubeId) {
  const videoModal = document.getElementById("videoModal");
  const iframe = videoModal.querySelector("iframe");
  const url = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1`;

  iframe.src = url;

  const fallbackTimeout = setTimeout(() => {
    if (!iframe.contentWindow) {
      window.open(`https://www.youtube.com/watch?v=${youtubeId}`, "_blank");
      closeVideoModal();
    }
  }, 2000);

  iframe.onerror = () => {
    clearTimeout(fallbackTimeout);
    window.open(`https://www.youtube.com/watch?v=${youtubeId}`, "_blank");
    closeVideoModal();
  };

  videoModal.style.display = "block";
  document.body.classList.add("modal-open");
}

// Chiusura modale video
function closeVideoModal() {
  const videoModal = document.getElementById("videoModal");
  const iframe = videoModal.querySelector("iframe");
  iframe.src = "";
  videoModal.style.display = "none";
  document.body.classList.remove("modal-open");
}

// Aggiungi alla lista spesa
function addToShoppingList(recipe) {
  if (!recipe || !recipe.ingredients?.length) return;
  alert(`Aggiunti ${recipe.ingredients.length} ingredienti alla lista spesa.`);
}
