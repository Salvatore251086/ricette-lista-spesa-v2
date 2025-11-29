// script/enrich_missing_ingredients.mjs

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parto dal file già arricchito con le ricette top
const INPUT = path.join(__dirname, '..', 'assets', 'json', 'recipes-it.enriched.top.json');
const OUTPUT = path.join(__dirname, '..', 'assets', 'json', 'recipes-it.enriched.all.json');

function hasRealText(arr) {
  if (!Array.isArray(arr)) return false;
  return arr.some(s => s && s.trim());
}

function isAlreadyLinkLine(s) {
  if (!s) return false;
  return s.includes('Ingredienti completi sulla ricetta originale') ||
         s.includes('Apri la preparazione completa');
}

function getSourceLabel(url) {
  if (!url) return 'sito originale';
  if (url.includes('cucchiaio.it')) return 'cucchiaio.it';
  return 'sito originale';
}

async function run() {
  const raw = await fs.readFile(INPUT, 'utf8');
  const data = JSON.parse(raw);
  const recipes = Array.isArray(data) ? data : data.recipes;

  let updated = 0;

  const newRecipes = recipes.map(r => {
    const clone = { ...r };

    const hasIngr = hasRealText(clone.ingredients) &&
      !clone.ingredients.every(isAlreadyLinkLine);

    const hasInstr = hasRealText(clone.instructions) &&
      !clone.instructions.every(isAlreadyLinkLine);

    // Se mancano ingredienti o istruzioni, uso il link alla fonte
    if ((!hasIngr || !hasInstr) && clone.url) {
      const source = getSourceLabel(clone.url);

      if (!hasIngr) {
        clone.ingredients = [
          `Ingredienti completi sulla ricetta originale (${source})`,
          clone.url
        ];
      }

      if (!hasInstr) {
        clone.instructions = [
          `Apri la preparazione completa su ${source}`,
          clone.url
        ];
      }

      updated++;
    }

    return clone;
  });

  const outData = Array.isArray(data) ? newRecipes : { ...data, recipes: newRecipes };

  await fs.writeFile(OUTPUT, JSON.stringify(outData, null, 2), 'utf8');

  console.log('Ricette totali:', recipes.length);
  console.log('Ricette aggiornate (link auto):', updated);
  console.log('File scritto in:', OUTPUT);
}

run().catch(err => {
  console.error('Errore nello script:', err);
  process.exit(1);
});
