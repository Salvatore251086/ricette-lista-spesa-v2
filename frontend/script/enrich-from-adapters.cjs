#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Percorsi
const basePath = path.join(__dirname, '../assets/json/recipes-it.enriched.json');
const logDir = path.join(__dirname, '../logs');
const logPath = path.join(logDir, 'enrich-latest.txt');

// Crea la cartella logs se non esiste
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// Carica dataset di base
const baseData = require(basePath);
const recipes = Array.isArray(baseData) ? baseData : (baseData.recipes || []);

// Importa gli adapter attivi
const adapters = [
  require('./adapters/cucchiaio.cjs'),
  require('./adapters/giallozafferano.cjs')
].filter(Boolean);

// Inizializza log
const logLines = [];
const log = (msg) => {
  console.log(msg);
  logLines.push(msg);
};

log(`[enrich] Uso recipes-it.enriched.json come base (${recipes.length} ricette).`);
log(`Adapter attivi: ${adapters.map(a => a.id || '?').join(', ')}`);

async function main() {
  let enrichedCount = 0;

  for (const recipe of recipes) {
    if (!recipe || !recipe.url) continue;

    for (const adapter of adapters) {
      try {
        const res = await adapter.enrich({ url: recipe.url });
        if (!res) continue;

        const hasIngredients = Array.isArray(res.ingredients) && res.ingredients.length > 0;
        const hasSteps = Array.isArray(res.steps) && res.steps.length > 0;

        if (hasIngredients || hasSteps) {
          if (!Array.isArray(recipe.enrichedFrom)) {
            recipe.enrichedFrom = recipe.enrichedFrom ? [recipe.enrichedFrom] : [];
          }

          recipe.enrichedFrom.push(res.source);

          if (hasIngredients) recipe.ingredients = res.ingredients;
          if (hasSteps) recipe.steps = res.steps;

          enrichedCount++;

          const ingCount = res.ingredients ? res.ingredients.length : 0;
          const stepCount = res.steps ? res.steps.length : 0;

          log(`✅ [${res.source}] ${res.title || '(senza titolo)'} — ${ingCount} ingredienti, ${stepCount} step`);
        }
      } catch (err) {
        log(`[❌] Errore adapter ${adapter.id || '?'} su ${recipe.url}: ${err.message}`);
      }
    }
  }

  log(`\n[enrich] Enrichment completato.`);
  log(`Ricette totali: ${recipes.length}`);
  log(`Ricette arricchite (qualsiasi fonte adapter): ${enrichedCount}`);

  // Scrivi file aggiornato
  fs.writeFileSync(basePath, JSON.stringify({ recipes }, null, 2));
  log(`File scritto: ${basePath}`);

  // Salva log
  fs.writeFileSync(logPath, logLines.join('\n'));
  log(`Log salvato in: ${logPath}`);
}

main();
