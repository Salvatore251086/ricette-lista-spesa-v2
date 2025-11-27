const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "..", "assets", "json", "recipes-it.json");
const outputPath = path.join(__dirname, "..", "assets", "json", "recipes-it.normalized.json");

function slugify(title) {
  return (title || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanImage(image) {
  if (!image) return "";
  let v = image.trim();
  if (v.startsWith("[") && v.endsWith("]")) {
    v = v.slice(1, -1);
  }
  v = v.replace(/(^"+|"+$)/g, "");
  return v;
}

function toTimeString(value) {
  if (!value || typeof value !== "number" || value <= 0) return "";
  return value + " min";
}

function guessCategory(title) {
  if (!title) return "";
  const t = title.toLowerCase();
  if (
    t.includes("risotto") ||
    t.includes("pasta") ||
    t.includes("spaghetti") ||
    t.includes("tagliatelle") ||
    t.includes("gnocchi") ||
    t.includes("lasagne") ||
    t.includes("penne") ||
    t.includes("fusilli")
  ) {
    return "Primo piatto";
  }
  if (
    t.includes("torta") ||
    t.includes("cheesecake") ||
    t.includes("dolce") ||
    t.includes("biscotti") ||
    t.includes("cioccolato")
  ) {
    return "Dolce";
  }
  if (
    t.includes("insalata") ||
    t.includes("antipasto") ||
    t.includes("crostini") ||
    t.includes("sformato") ||
    t.includes("stuzzichini")
  ) {
    return "Antipasto";
  }
  if (
    t.includes("zuppa") ||
    t.includes("minestra") ||
    t.includes("vellutata")
  ) {
    return "Zuppa";
  }
  if (
    t.includes("pane") ||
    t.includes("focaccia") ||
    t.includes("pizza")
  ) {
    return "Pane";
  }
  return "";
}

function guessDifficulty(raw) {
  const v = (raw || "").toString().toLowerCase().trim();
  if (v === "easy" || v === "facile") return "easy";
  if (v === "medium" || v === "media") return "medium";
  if (v === "hard" || v === "difficile") return "hard";
  return "";
}

function arrStrings(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map(String).map(s => s.trim()).filter(Boolean);
  }
  const str = String(val).trim();
  if (!str) return [];
  if (str.includes("\n")) {
    return str.split("\n").map(s => s.trim()).filter(Boolean);
  }
  if (str.includes(". ")) {
    return str.split(". ").map(s => s.trim()).filter(Boolean);
  }
  if (str.includes(";")) {
    return str.split(";").map(s => s.trim()).filter(Boolean);
  }
  return [str];
}

function normalizeRecipe(r, index) {
  const rawTitle = (r.title || r.name || "").trim();
  const title = rawTitle || "Ricetta senza titolo";
  const slug = slugify(title || r.id || ("ricetta-" + index));

  const url =
    (r.url || r.link || r.sourceUrl || "").trim();

  const image = cleanImage(r.image || r.thumbnail || "");

  const servings =
    (Number(r.servings) > 0 && Number(r.servings)) ||
    (Number(r.portions) > 0 && Number(r.portions)) ||
    4;

  const prepTimeStr = toTimeString(r.prepTime || r.prep_time || r.tempoPreparazione);
  const cookTimeStr = toTimeString(r.cookTime || r.cook_time || r.tempoCottura);

  let totalTimeStr = "";
  const prep = r.prepTime || r.prep_time || r.tempoPreparazione || 0;
  const cook = r.cookTime || r.cook_time || r.tempoCottura || 0;
  if (prep > 0 && cook > 0) {
    totalTimeStr = prep + cook + " min";
  }

  const difficulty = guessDifficulty(r.difficulty || r.diff || r.level);

  const baseCategory =
    (Array.isArray(r.category) && r.category[0]) ||
    r.category ||
    r.categoria ||
    r.portata ||
    "";

  const category = baseCategory || guessCategory(title);

  const cuisine = "Italiana";

  const tags = arrStrings(r.tags);

  const ingredients =
    arrStrings(r.ingredients || r.ingredienti);

  const steps =
    arrStrings(
      r.steps ||
      r.preparazione ||
      r.directions ||
      r.istruzioni ||
      r.method ||
      r.metodo
    );

  const videoId =
    (r.videoId || r.youtubeId || "").trim();

  return {
    id: slug || (r.id ? String(r.id) : "ricetta-" + index),
    title,
    slug,
    url,
    image,
    servings,
    difficulty,
    prepTime: prepTimeStr,
    cookTime: cookTimeStr,
    totalTime: totalTimeStr,
    cost: "",
    category,
    cuisine,
    tags,
    ingredients,
    steps,
    videoId
  };
}

function run() {
  const raw = fs.readFileSync(inputPath, "utf8");
  const data = JSON.parse(raw);

  const sourceArray = Array.isArray(data)
    ? data
    : Array.isArray(data.recipes)
      ? data.recipes
      : Array.isArray(data.items)
        ? data.items
        : [];

  if (!sourceArray.length) {
    throw new Error("Formato recipes-it.json non valido: nessuna ricetta trovata");
  }

  const normalized = sourceArray.map(normalizeRecipe);

  const out = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    recipes: normalized
  };

  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf8");
  console.log("recipes-it.normalized.json generato con", normalized.length, "ricette");
}

run();
