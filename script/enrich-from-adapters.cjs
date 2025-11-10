// script/enrich-from-adapters.cjs
// Arricchimento ricette da fonti ufficiali tramite adapter multipli.

const fs = require("fs");
const path = require("path");

// Adapters ufficiali: aggiungi qui man mano che li creiamo
const cucchiaio = require("./adapters/cucchiaio.cjs");
// Esempio futuri:
// const giallozafferano = require("./adapters/giallozafferano.cjs");
// const fattoincasa = require("./adapters/fattoincasa.cjs");
// const salepepe = require("./adapters/salepepe.cjs");

const adapters = [
  cucchiaio,
  // giallozafferano,
  // fattoincasa,
  // salepepe,
];

// --- Utility JSON base ------------------------------------------------------

function loadRecipes(inputPath) {
  const raw = fs.readFileSync(inputPath, "utf8");
  const data = JSON.parse(raw);

  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data.recipes)) {
    return data.recipes;
  }

  throw new Error("Formato recipes-it.json non riconosciuto");
}

function saveRecipes(outputPath, recipes) {
  const out = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    recipes,
  };

  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf8");
}

// Normalizza i campi URL così gli adapter hanno qualcosa di sensato
function normalizeRecipeUrl(recipe) {
  const url =
    recipe.url ||
    recipe.link ||
    recipe.href ||
    (recipe.sources && recipe.sources[0] && recipe.sources[0].url) ||
    null;

  if (url && !recipe.url) {
    recipe.url = url;
  }

  return recipe.url || null;
}

// Confronto per capire se l'arricchimento ha realmente cambiato qualcosa
function snapshotForDiff(r) {
  return JSON.stringify({
    ingredients: r.ingredients || [],
    steps: r.steps || [],
    difficulty: r.difficulty || null,
    prepTime: r.prepTime || null,
    servings: r.servings || null,
    source: r.source || null,
  });
}

// Applica gli adapter in cascata finché uno arricchisce qualcosa
async function enrichWithAdapters(recipe) {
  const url = normalizeRecipeUrl(recipe);
  if (!url) return { recipe, enriched: false, official: false };

  const before = snapshotForDiff(recipe);
  let current = recipe;
  let usedOfficial = false;

  for (const adapter of adapters) {
    try {
      if (!adapter || typeof adapter.matches !== "function") continue;

      if (!adapter.matches(url)) continue;

      if (typeof adapter.enrich !== "function") continue;

      const after = await adapter.enrich(current);

      // Se l'adapter restituisce qualcosa di falsy, ignora
      if (!after) continue;

      const afterSnap = snapshotForDiff(after);
      if (afterSnap !== before) {
        // Cambiato qualcosa: segna arricchimento e stoppiamo la catena
        current = after;
        usedOfficial = true;
        break;
      }
    } catch (err) {
      console.error(
        `[enrich-from-adapters] Errore adapter ${adapter.id || "?"} su ${url}:`,
        err.message
      );
    }
  }

  const finalSnap = snapshotForDiff(current);
  const enriched = finalSnap !== before;

  // Marca in modo esplicito se deriva da fonte ufficiale
  if (enriched && usedOfficial) {
    if (!current.meta) current.meta = {};
    current.meta.enrichedFromOfficial = true;
  }

  return { recipe: current, enriched, official: enriched && usedOfficial };
}

// --- Main -------------------------------------------------------------------

async function main() {
  const inputPath = path.join(__dirname, "..", "assets", "json", "recipes-it.json");
  const outputPath = path.join(
    __dirname,
    "..",
    "assets",
    "json",
    "recipes-it.enriched.json"
  );

  const recipes = loadRecipes(inputPath);

  console.log("Enrichment da adapter multi-fonte");
  console.log("Ricette in ingresso:", recipes.length);
  console.log("Adapter attivi:", adapters.map(a => a.id).join(", ") || "nessuno");

  const enrichedRecipes = [];
  let enrichedCount = 0;
  let officialCount = 0;

  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i];
    const { recipe: newRecipe, enriched, official } =
      await enrichWithAdapters({ ...r });

    if (enriched) enrichedCount++;
    if (official) officialCount++;

    enrichedRecipes.push(newRecipe);

    if ((i + 1) % 10 === 0 || i === recipes.length - 1) {
      process.stdout.write(
        `\rProcessate ${i + 1} su ${recipes.length} | arricchite finora: ${enrichedCount}`
      );
    }
  }

  console.log("\nEnrichment completato.");
  console.log("Ricette totali:", enrichedRecipes.length);
  console.log("Ricette arricchite (qualsiasi fonte adapter):", enrichedCount);
  console.log("Ricette con dati arricchiti da fonti ufficiali:", officialCount);

  saveRecipes(outputPath, enrichedRecipes);

  console.log("File scritto:", outputPath);
}

main().catch((err) => {
  console.error("Errore enrichment globale:", err);
  process.exit(1);
});
