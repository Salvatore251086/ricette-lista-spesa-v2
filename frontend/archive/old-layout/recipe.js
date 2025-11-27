import { STRAPI_URL } from "./config.js";

async function loadRecipe() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  if (!slug) {
    alert("Slug mancante.");
    return;
  }

  // 1) Fetch da Strapi
  const url = `${STRAPI_URL}/recipes?filters[slug][$eq]=${slug}`;
  const res = await fetch(url);
  const json = await res.json();

  if (!json?.data?.length) {
    alert("Ricetta non trovata.");
    return;
  }

  const r = json.data[0].attributes;

  document.getElementById("rTitle").textContent = r.title;
  document.getElementById("meta").textContent =
    `Diff: ${r.difficulty}, Porzioni: ${r.servings}`;

  // Immagine
  const img = document.getElementById("rImg");
  img.src = r.image ?? "assets/icons/shortcut-96.png";

  // TAGS
  const tagsBox = document.getElementById("tags");
  tagsBox.innerHTML = "";
  (r.tags ?? []).forEach(t => {
    const el = document.createElement("span");
    el.className = "tag";
    el.textContent = t;
    tagsBox.appendChild(el);
  });

  // INGREDIENTI
  const ingList = document.getElementById("ingList");
  ingList.innerHTML = "";
  (r.ingredients ?? []).forEach(i => {
    const li = document.createElement("li");
    li.textContent = i;
    ingList.appendChild(li);
  });

  // STEPS
  const steps = document.getElementById("steps");
  steps.innerHTML = "";
  (r.steps ?? []).forEach(s => {
    const li = document.createElement("li");
    li.textContent = s;
    steps.appendChild(li);
  });

  // Fonte
  const src = document.getElementById("btnSource");
  if (r.sourceUrl) {
    src.href = r.sourceUrl;
    src.style.display = "inline-block";
  } else {
    src.style.display = "none";
  }

  // Video
  const videoWrap = document.getElementById("videoWrap");
  const yt = document.getElementById("yt");

  if (r.videoId) {
    videoWrap.style.display = "block";
    yt.src = `https://www.youtube-nocookie.com/embed/${r.videoId}`;
  } else {
    videoWrap.style.display = "none";
  }
}

loadRecipe();

// Anno footer
document.getElementById("year").textContent = new Date().getFullYear();
