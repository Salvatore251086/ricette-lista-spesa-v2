#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");

// Usa fetch globale se c'è (Node 18+), altrimenti fallback a node-fetch2
let fetchFn = global.fetch;
if (!fetchFn) {
  try {
    fetchFn = require("node-fetch2");
  } catch {
    console.error("[enrich] Nessun fetch disponibile. Installa 'node-fetch2' oppure usa Node 18+.");
    process.exit(1);
  }
}

function getJsonPath() {
  // unico punto da cambiare se un domani usi un file diverso
  return path.join(__dirname, "..", "assets", "json", "recipes-it.enriched.json");
}

// Adapters disponibili (ognuno esporta { id, canHandle(url), enrich({url, fetch}) })
const adapters = [
  require("./adapters/cucchiaio.cjs"),
  require("./adapters/giallozafferano.cjs"),
  // qui aggiungerai altri adapter ufficiali
];

function pickAdapter(url) {
  return adapters.find(a => {
    try {
      return typeof a.canHandle === "function" && a.canHandle(url);
    } catch {
      return false;
    }
  }) || null;
}

async function main() {
  const jsonPath = getJsonPath();
  const raw = await fs.readFile(jsonPath, "utf8");
  const data = JSON.parse(raw);
  const recipes = Array.isArray(data.recipes) ? data.recipes : data;

  console.log("Enrichment da adapter multi-fonte");
  console.log("Ricette in ingresso:", recipes.length);

  let enrichedAny = 0;
  let enrichedFromOfficial = 0;

  // Limitiamoci alle ricette che hanno url e NON hanno già steps.
  const targets = recipes.filter(r =>
    r &&
    typeof r.url === "string" &&
    r.url.trim() &&
    (!Array.isArray(r.steps) || r.steps.length === 0)
  );

  for (let i = 0; i < targets.length; i++) {
    const r = targets[i];

    try {
      const url = new URL(r.url);
      const adapter = pickAdapter(url);
      if (!adapter) {
        // Nessun adapter per questo dominio/path → ignoriamo
        continue;
      }

      const info = await adapter.enrich({
        url,
        fetch: fetchFn
      });

      if (!info) {
        continue;
      }

      // Applica solo se porta qualcosa di utile
      let changed = false;

      if (info.title && !r.title) {
        r.title = String(info.title).trim();
        changed = true;
      }

      if (Array.isArray(info.ingredients) && info.ingredients.length) {
        r.ingredients = info.ingredients.filter(Boolean);
        changed = true;
      }

      if (Array.isArray(info.steps) && info.steps.length) {
        r.steps = info.steps.filter(Boolean);
        changed = true;
      }

      if (info.source && !r.source) {
        r.source = info.source;
      }

      if (info.video && !r.videoUrl) {
        r.videoUrl = info.video;
      }

      if (changed) {
        enrichedAny++;
        if (info.official === true) {
          enrichedFromOfficial++;
        }
        console.log(
          `[${i + 1}/${targets.length}] + ${adapter.id} → ${
            r.title || r.slug || r.id || r.url
          }`
        );
      }
    } catch (err) {
      console.warn(
        "[enrich] Errore su",
        r.url,
        "-",
        err.status || "",
        err.message || err
      );
    }
  }

  // Salva mantenendo il wrapper {recipes} se esisteva
  const out = Array.isArray(data.recipes)
    ? { ...data, recipes }
    : recipes;

  await fs.writeFile(jsonPath, JSON.stringify(out, null, 2), "utf8");

  console.log("Enrichment completato.");
  console.log("Ricette totali:", recipes.length);
  console.log("Ricette arricchite (qualsiasi fonte adapter):", enrichedAny);
  console.log("Ricette con dati arricchiti da fonti ufficiali:", enrichedFromOfficial);
}

main().catch(err => {
  console.error("[enrich] Errore fatale:", err);
  process.exit(1);
});
