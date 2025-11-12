console.log("Avvio app Ricette & Lista Spesa v18");

// Config
const DATA_URL = "assets/json/recipes-it.enriched.json";
const LS_FAVORITES_KEY = "rls_favorites_v1";
const MANUAL_VIDEO_INDEX_URL = "assets/json/video_index.manual.json";

// DOM
const dom = {
  search: document.getElementById("search"),
  updateDataBtn: document.getElementById("updateDataBtn"),
  favoritesToggle: document.getElementById("favoritesToggle"),
  recipeCount: document.getElementById("recipeCount"),
  recipes: document.getElementById("recipes"),
  videoModal: document.getElementById("videoModal"),
  videoFrame: document.getElementById("videoFrame"),
  closeVideo: document.getElementById("closeVideo")
};

// Avviso non bloccante
{
  const missing = Object.entries(dom).filter(([,el]) => !el).map(([k])=>k);
  if (missing.length) console.warn("Elementi DOM mancanti (verifica index.html, NON blocco).", missing);
}

// Stato
let allRecipes = [];
let favorites = loadFavorites();
let manualVideoIndex = { by_title: {} };

// Utils
function loadFavorites() {
  try { return JSON.parse(localStorage.getItem(LS_FAVORITES_KEY)) || {}; } catch { return {}; }
}
function saveFavorites() {
  try { localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(favorites)); } catch {}
}
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
function isFavorite(id){ return !!favorites[id]; }
function toggleFavorite(id){ if(!id) return; favorites[id] = !favorites[id]; if(!favorites[id]) delete favorites[id]; saveFavorites(); render(); }

// Video modal
function openVideo(url){
  if(!dom.videoModal || !dom.videoFrame) return;
  dom.videoFrame.src = url;
  dom.videoModal.classList.remove("hidden");
  dom.videoModal.setAttribute("aria-hidden","false");
}
function closeVideoModal(){
  if(!dom.videoModal || !dom.videoFrame) return;
  dom.videoFrame.src = "";
  dom.videoModal.classList.add("hidden");
  dom.videoModal.setAttribute("aria-hidden","true");
}

// Data
async function loadManualVideoIndex(){
  try{
    const res = await fetch(MANUAL_VIDEO_INDEX_URL, { cache: "no-store" });
    if(!res.ok) return;
    const json = await res.json();
    manualVideoIndex = json && json.by_title ? json : { by_title: {} };
  }catch{}
}

async function loadData(){
  try{
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const js = await res.json();
    const base = Array.isArray(js) ? js : (js.recipes || []);
    allRecipes = base.map((r,i)=>({ id: r.id || `r-${i}`, ...r }));
    await loadManualVideoIndex();
    console.log("Caricate ricette:", allRecipes.length);
    render();
  }catch(e){
    console.error("Errore nel caricare i dati ricette:", e);
    if(dom.recipeCount) dom.recipeCount.textContent = "Errore nel caricamento dati.";
  }
}

// Render
function matchesSearch(r, term){
  if(!term) return true;
  const q = norm(term);
  const title = norm(r.title);
  const ingredients = norm((r.ingredients || []).join(" "));
  return title.includes(q) || ingredients.includes(q);
}

function pickVideoUrl(r){
  // 1) Se il dato ricetta già contiene r.video.url, usa quello
  if (r.video && r.video.url) return r.video.url;

  // 2) Mappa manuale per titolo normalizzato
  const t = r.title || "";
  const idx = manualVideoIndex && manualVideoIndex.by_title ? manualVideoIndex.by_title : {};
  // match per chiave esatta case-insensitive
  const keys = Object.keys(idx);
  const hitKey = keys.find(k => norm(k) === norm(t));
  if (hitKey && idx[hitKey] && idx[hitKey].url) return idx[hitKey].url;

  return null;
}

function render(){
  if(!dom.recipes) return;

  const term = dom.search ? dom.search.value.trim() : "";
  const onlyFav = dom.favoritesToggle ? dom.favoritesToggle.checked : false;

  const filtered = allRecipes.filter(r => (!onlyFav || isFavorite(r.id)) && matchesSearch(r, term));

  if(dom.recipeCount) dom.recipeCount.textContent = `Ricette visibili: ${filtered.length}`;

  dom.recipes.innerHTML = "";

  filtered.forEach(r=>{
    const card = document.createElement("article");
    card.className = "recipe-card";

    const fav = isFavorite(r.id);
    const difficulty = r.difficulty || r.diff || "";
    const servings = r.servings || r.persone || r.porzioni || r.portions || "";
    const source = r.source || (r.enrichedFrom && r.enrichedFrom.source) || "";
    const ingredientsCount = Array.isArray(r.ingredients) ? r.ingredients.length : 0;

    const recipeUrl =
      r.url ||
      (r.links && r.links.source) ||
      (r.enrichedFrom && r.enrichedFrom.url) ||
      null;

    const vUrl = pickVideoUrl(r);
    const hasVideo = !!vUrl;

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
        ${recipeUrl
          ? `<button class="btn primary" data-open-recipe="${encodeURI(recipeUrl)}">Apri ricetta</button>`
          : `<button class="btn disabled" disabled>Nessun link</button>`
        }
        <button class="btn ghost" data-show-ingredients="${r.id || ""}">Lista ingredienti</button>
        ${hasVideo
          ? `<button class="btn video" data-video="${encodeURI(vUrl)}">Guarda video</button>`
          : `<button class="btn ghost" disabled>Video n/d</button>`
        }
      </div>
    `;

    dom.recipes.appendChild(card);
  });

  bindCardEvents();
}

function bindCardEvents(){
  if(!dom.recipes) return;

  dom.recipes.querySelectorAll(".fav-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-id");
      toggleFavorite(id);
    });
  });

  dom.recipes.querySelectorAll("[data-open-recipe]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const url = btn.getAttribute("data-open-recipe");
      if(url) window.open(url, "_blank", "noopener");
    });
  });

  dom.recipes.querySelectorAll("[data-show-ingredients]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-show-ingredients");
      const r = allRecipes.find(x=>x.id===id);
      if(!r || !Array.isArray(r.ingredients)) { alert("Nessuna lista ingredienti disponibile."); return; }
      alert("Ingredienti:\n\n" + r.ingredients.join("\n"));
    });
  });

  dom.recipes.querySelectorAll("[data-video]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const url = btn.getAttribute("data-video");
      if(url) openVideo(url);
    });
  });
}

// Eventi UI
if(dom.search) dom.search.addEventListener("input", render);
if(dom.favoritesToggle) dom.favoritesToggle.addEventListener("change", render);
if(dom.updateDataBtn) dom.updateDataBtn.addEventListener("click", loadData);
if(dom.closeVideo) dom.closeVideo.addEventListener("click", closeVideoModal);
if(dom.videoModal) dom.videoModal.addEventListener("click", e => { if(e.target === dom.videoModal) closeVideoModal(); });

// Init
loadData();
