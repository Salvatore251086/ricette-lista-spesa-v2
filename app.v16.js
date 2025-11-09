// app.v16.js (root version)

(async () => {
  // Config
  const RECIPES_URL = 'assets/json/recipes-it.json';
  const VIDEOS_URL = 'assets/json/video_index.resolved.json';

  // Elementi base
  const listEl = document.getElementById('recipes-container');
  const countEl = document.getElementById('recipes-count');
  const template = document.getElementById('recipe-card-template');

  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalClose = document.getElementById('modal-close');

  if (!listEl || !template) {
    console.error('Manca #recipes-container o #recipe-card-template in index.html');
    return;
  }

  // Utility
  const slugify = (str) =>
    (str || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const createVideoMap = (videos) => {
    const map = new Map();
    (videos || []).forEach(v => {
      if (!v) return;
      const slug = v.slug || slugify(v.title);
      if (!slug || !v.youtubeId) return;
      map.set(slug, v);
    });
    return map;
  };

  // Modal base
  const openModal = (title, html) => {
    if (!modal) {
      alert(title + '\n\n' + html.replace(/<[^>]+>/g, ''));
      return;
    }
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modal.classList.add('is-open');
  };

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove('is-open');
    modalBody.innerHTML = '';
  };

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Lista spesa (semplice)
  const LIST_KEY = 'rls-lista-spesa';
  const loadList = () => {
    try {
      return JSON.parse(localStorage.getItem(LIST_KEY) || '[]');
    } catch {
      return [];
    }
  };
  const saveList = (items) => {
    localStorage.setItem(LIST_KEY, JSON.stringify(items || []));
  };
  const addRecipeToList = (recipe) => {
    const items = loadList();
    const name = recipe.title || recipe.nome || recipe.titolo || 'Ricetta senza nome';
    if (!items.includes(name)) {
      items.push(name);
      saveList(items);
    }
    alert(`Aggiunta alla lista spesa: ${name}`);
  };

  // Fetch dati
  let recipes = [];
  let videoMap = new Map();

  try {
    const [recipesRes, videosRes] = await Promise.all([
      fetch(RECIPES_URL),
      fetch(VIDEOS_URL)
    ]);

    recipes = await recipesRes.json();
    const videos = await videosRes.json();
    videoMap = createVideoMap(videos);
  } catch (err) {
    console.error('Errore nel caricamento dati:', err);
    return;
  }

  // Render ricette + wiring bottoni
  const renderRecipes = () => {
    listEl.innerHTML = '';

    recipes.forEach((recipe, index) => {
      const title =
        recipe.title || recipe.nome || recipe.titolo || `Ricetta ${index + 1}`;
      const source =
        recipe.source || recipe.autore || recipe.url || '';

      const slug = recipe.slug || slugify(title);
      const video = videoMap.get(slug);

      const fragment = template.content.cloneNode(true);
      const card = fragment.querySelector('.recipe-card');

      fragment.querySelector('.recipe-title').textContent = title;
      fragment.querySelector('.recipe-source').textContent = source || '';

      const openRecipeBtn = fragment.querySelector('.btn-open-recipe');
      const openVideoBtn = fragment.querySelector('.btn-open-video');
      const addListBtn = fragment.querySelector('.btn-add-list');

      // Apri ricetta
      if (openRecipeBtn) {
        openRecipeBtn.addEventListener('click', () => {
          const ingredients =
            recipe.ingredients ||
            recipe.ingredienti ||
            recipe.listaIngredienti ||
            [];
          const steps =
            recipe.preparazione ||
            recipe.preparation ||
            recipe.metodo ||
            '';

          const ingHtml = Array.isArray(ingredients)
            ? `<ul>${ingredients.map(i => `<li>${i}</li>`).join('')}</ul>`
            : `<p>${ingredients}</p>`;

          const stepsHtml = steps
            ? `<h4>Preparazione</h4><p>${steps}</p>`
            : '<p>Nessuna preparazione disponibile.</p>';

          openModal(title, `<h4>Ingredienti</h4>${ingHtml}${stepsHtml}`);
        });
      }

      // Video
      if (openVideoBtn) {
        if (video && video.youtubeId) {
          openVideoBtn.disabled = false;
          openVideoBtn.textContent = 'Video';
          openVideoBtn.addEventListener('click', () => {
            const iframe = `
              <div class="video-wrapper">
                <iframe
                  width="560"
                  height="315"
                  src="https://www.youtube.com/embed/${video.youtubeId}"
                  title="Video ricetta"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                ></iframe>
              </div>
            `;
            openModal(`Video - ${title}`, iframe);
          });
        } else {
          openVideoBtn.disabled = true;
          openVideoBtn.textContent = 'Video non disponibile';
        }
      }

      // Aggiungi alla lista spesa
      if (addListBtn) {
        addListBtn.addEventListener('click', () => addRecipeToList(recipe));
      }

      listEl.appendChild(fragment);
    });

    if (countEl) {
      countEl.textContent = `Ricette visibili: ${recipes.length}`;
    }

    console.log(
      `Render completato. Ricette: ${recipes.length}, video mappati: ${videoMap.size}`
    );
  };

  renderRecipes();
})();
