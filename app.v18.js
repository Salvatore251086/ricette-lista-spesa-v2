// app.v18.js
// Ricette & Lista Spesa – v18 SOLIDO (modale video OK, warning DOM silenziati)

(function () {
  'use strict';

  // -------------------------
  // Config
  // -------------------------
  const DATA_URL = 'assets/json/recipes-it.enriched.json';
  const FAV_KEY  = 'rls_favorites_v1';

  // -------------------------
  // DOM refs (allineati al tuo index.html)
  // -------------------------
  const dom = {
    searchInput:      document.getElementById('searchInput'),
    updateDataBtn:    document.getElementById('updateDataBtn'),
    favoritesToggle:  document.getElementById('favoritesToggle'),
    recipeCount:      document.getElementById('recipeCount'),
    recipesContainer: document.getElementById('recipesContainer'),
    videoModal:       document.getElementById('videoModal'),
    videoFrame:       document.getElementById('videoFrame'),
    closeVideo:       document.getElementById('closeVideo'),
  };

  // Non blocco l’app se manca qualcosa, loggo e continuo
  {
    const missing = Object.entries(dom).filter(([,el]) => !el).map(([k]) => k);
    if (missing.length) {
      console.warn('Elementi DOM mancanti (verifica index.html, NON blocco).', missing);
    }
  }

  // -------------------------
  // Stato
  // -------------------------
  let allRecipes = [];
  let favorites  = loadFavorites();

  // -------------------------
  // LocalStorage
  // -------------------------
  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? obj : {};
    } catch {
      return {};
    }
  }
  function saveFavorites() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); } catch {}
  }
  function isFav(id){ return !!favorites[id]; }
  function toggleFav(id){
    if (!id) return;
    favorites[id] = !favorites[id];
    if (!favorites[id]) delete favorites[id];
    saveFavorites();
    render();
  }

  // -------------------------
  // Utils
  // -------------------------
  const norm = s => (s || '').toLowerCase();
  function matches(recipe, term){
    if (!term) return true;
    const q = norm(term);
    const title = norm(recipe.title);
    const ingr  = norm((recipe.ingredients || []).join(' '));
    return title.includes(q) || ingr.includes(q);
  }

  // -------------------------
  // Video modal
  // -------------------------
  function openVideo(url){
    if (!dom.videoModal || !dom.videoFrame) return;
    dom.videoFrame.src = url;
    dom.videoModal.classList.remove('hidden');
    dom.videoModal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }
  function closeVideo(){
    if (!dom.videoModal || !dom.videoFrame) return;
    dom.videoFrame.src = '';
    dom.videoModal.classList.add('hidden');
    dom.videoModal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }

  // ESC per chiudere
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') closeVideo();
  });
  // Click X e backdrop
  if (dom.closeVideo) dom.closeVideo.addEventListener('click', closeVideo);
  if (dom.videoModal) dom.videoModal.addEventListener('click', (e)=>{
    if (e.target === dom.videoModal) closeVideo();
  });

  // -------------------------
  // Render
  // -------------------------
  function render(){
    if (!dom.recipesContainer) return;

    const term    = dom.searchInput ? dom.searchInput.value.trim() : '';
    const onlyFav = dom.favoritesToggle ? dom.favoritesToggle.checked : false;

    const filtered = allRecipes.filter(r => {
      if (onlyFav && !isFav(r.id)) return false;
      return matches(r, term);
    });

    if (dom.recipeCount) dom.recipeCount.textContent = `Ricette visibili: ${filtered.length}`;

    // Paint
    dom.recipesContainer.innerHTML = '';
    const frag = document.createDocumentFragment();

    filtered.forEach((r, idx)=>{
      const id         = r.id || `r-${idx}`;
      const fav        = isFav(id);
      const difficulty = r.difficulty || r.diff || '';
      const portions   = r.servings || r.porzioni || r.persone || r.portions;
      const srcBadge   = r.source || (r.enrichedFrom && r.enrichedFrom.source) || '';
      const ingrCount  = Array.isArray(r.ingredients) ? r.ingredients.length : 0;

      // Link ricetta affidabile
      const recipeUrl =
        r.url ||
        (r.links && r.links.source) ||
        (r.enrichedFrom && r.enrichedFrom.url) ||
        null;

      // URL video affidabile da varie forme di dato
      const videoUrl =
        (r.video && (r.video.url || r.video.embedUrl)) ||
        r.videoUrl ||
        r.youtubeId ? `https://www.youtube.com/embed/${r.youtubeId}` : null;

      const hasVideo = !!videoUrl;

      const card = document.createElement('article');
      card.className = 'recipe-card';
      card.innerHTML = `
        <div class="recipe-card-header">
          <button class="fav-btn" data-id="${id}" title="Aggiungi ai preferiti">${fav ? '★' : '☆'}</button>
          <h2 class="recipe-title">${r.title || 'Ricetta senza titolo'}</h2>
        </div>

        <div class="recipe-meta">
          ${difficulty ? `<span class="badge">Diff: ${difficulty}</span>` : ''}
          ${portions   ? `<span class="badge">Porzioni: ${portions}</span>` : ''}
          ${srcBadge   ? `<span class="badge badge-source">${srcBadge}</span>` : ''}
          ${ingrCount  ? `<span class="badge badge-ingredients">${ingrCount} ingredienti</span>` : ''}
        </div>

        <div class="recipe-actions">
          ${
            recipeUrl
              ? `<button class="btn primary" data-open-recipe="${encodeURI(recipeUrl)}">Apri ricetta</button>`
              : `<button class="btn disabled" disabled>Nessun link</button>`
          }
          <button class="btn ghost" data-show-ingredients="${id}">Lista ingredienti</button>
          ${
            hasVideo
              ? `<button class="btn video" data-video="${encodeURI(videoUrl)}">Guarda video</button>`
              : `<button class="btn ghost" disabled>Video n/d</button>`
          }
        </div>
      `;
      frag.appendChild(card);
    });

    dom.recipesContainer.appendChild(frag);
    bindCardEvents();
  }

  function bindCardEvents(){
    if (!dom.recipesContainer) return;

    // preferiti
    dom.recipesContainer.querySelectorAll('.fav-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-id');
        toggleFav(id);
      });
    });

    // open recipe
    dom.recipesContainer.querySelectorAll('[data-open-recipe]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const url = btn.getAttribute('data-open-recipe');
        if (url) window.open(url, '_blank', 'noopener');
      });
    });

    // show ingredients
    dom.recipesContainer.querySelectorAll('[data-show-ingredients]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-show-ingredients');
        const r  = allRecipes.find(x => (x.id || '').toString() === id);
        if (!r || !Array.isArray(r.ingredients) || !r.ingredients.length) {
          alert('Nessuna lista ingredienti disponibile.');
          return;
        }
        alert('Ingredienti:\n\n' + r.ingredients.join('\n'));
      });
    });

    // video
    dom.recipesContainer.querySelectorAll('[data-video]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const url = btn.getAttribute('data-video');
        if (url) openVideo(url);
      });
    });
  }

  // -------------------------
  // Data
  // -------------------------
  async function loadData(){
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const base = Array.isArray(json) ? json : (json.recipes || []);

      // Normalizzo id e video url
      allRecipes = base.map((r, i) => {
        const id = r.id || `r-${i}`;
        const videoUrl =
          (r.video && (r.video.url || r.video.embedUrl)) ||
          r.videoUrl ||
          (r.youtubeId ? `https://www.youtube.com/embed/${r.youtubeId}` : null);

        return { id, ...r, video: videoUrl ? { url: videoUrl } : r.video || null };
      });

      console.log('Caricate ricette:', allRecipes.length);
      render();
    } catch (err) {
      console.error('Errore nel caricamento dati:', err);
      if (dom.recipeCount) dom.recipeCount.textContent = 'Errore caricamento dati';
    }
  }

  // -------------------------
  // Listeners UI
  // -------------------------
  if (dom.searchInput)     dom.searchInput.addEventListener('input', render);
  if (dom.favoritesToggle) dom.favoritesToggle.addEventListener('change', render);
  if (dom.updateDataBtn)   dom.updateDataBtn.addEventListener('click', loadData);

  // -------------------------
  // Init
  // -------------------------
  console.log('Avvio app Ricette & Lista Spesa v18');
  loadData();
})();
