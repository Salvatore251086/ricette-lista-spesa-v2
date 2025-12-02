#!/usr/bin/env node
// Merge Imported: Legge new_recipes.json (output di import-recipes.mjs) e fa merge intelligente in recipes-it.json
// Filtra duplicati per sourceUrl, slug e title normalizzato

import fs from 'node:fs/promises';

const INPUT_FILE = 'new_recipes.json';
const OUTPUT_FILE = 'assets/json/recipes-it.json';

function safeJson(t){ try { return JSON.parse(t) } catch { return null } }
function nowTs(){ return new Date().toISOString().replace(/[:.]/g,''); }

// Normalizza title per confronto
function normalizeTitle(title){
  return String(title || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')  // Rimuovi punteggiatura
    .replace(/\s+/g, ' ')     // Normalizza spazi
    .trim();
}

// Normalizza slug
function normalizeSlug(slug){
  return String(slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function readImported(){
  try {
    const obj = safeJson(await fs.readFile(INPUT_FILE, 'utf8')) || {};
    const recipes = Array.isArray(obj.recipes) ? obj.recipes : [];
    console.error(`[INPUT] Loaded ${recipes.length} recipes from ${INPUT_FILE}`);
    return recipes;
  } catch (e) {
    console.error(`[ERROR] Cannot read ${INPUT_FILE}:`, e.message);
    return [];
  }
}

async function readDatabase(){
  try {
    const obj = safeJson(await fs.readFile(OUTPUT_FILE, 'utf8')) || {};
    const recipes = Array.isArray(obj.recipes) ? obj.recipes : [];
    console.error(`[DATABASE] Loaded ${recipes.length} existing recipes`);
    return recipes;
  } catch {
    console.error('[DATABASE] No existing database, starting fresh');
    return [];
  }
}

function buildExistingMaps(existing){
  const byUrl = new Map();
  const bySlug = new Map();
  const byTitle = new Map();
  
  for (const r of existing){
    // Mappa per sourceUrl
    if (r.sourceUrl){
      const url = String(r.sourceUrl).toLowerCase();
      byUrl.set(url, r);
    }
    
    // Mappa per slug
    if (r.slug){
      const slug = normalizeSlug(r.slug);
      bySlug.set(slug, r);
    }
    
    // Mappa per ID (fallback slug)
    if (r.id){
      const id = normalizeSlug(r.id);
      bySlug.set(id, r);
    }
    
    // Mappa per title normalizzato
    if (r.title){
      const normTitle = normalizeTitle(r.title);
      if (normTitle.length > 3){  // Evita title troppo corti
        byTitle.set(normTitle, r);
      }
    }
  }
  
  console.error(`[MAPS] Built: ${byUrl.size} URLs, ${bySlug.size} slugs, ${byTitle.size} titles`);
  return { byUrl, bySlug, byTitle };
}

function isDuplicate(recipe, existingMaps){
  const { byUrl, bySlug, byTitle } = existingMaps;
  
  // Check 1: URL esatto
  if (recipe.sourceUrl){
    const url = String(recipe.sourceUrl).toLowerCase();
    if (byUrl.has(url)){
      return { isDup: true, reason: 'url', match: recipe.sourceUrl };
    }
  }
  
  // Check 2: Slug
  const slug = normalizeSlug(recipe.slug || recipe.id || '');
  if (slug && bySlug.has(slug)){
    return { isDup: true, reason: 'slug', match: slug };
  }
  
  // Check 3: Title normalizzato
  if (recipe.title){
    const normTitle = normalizeTitle(recipe.title);
    if (normTitle.length > 3 && byTitle.has(normTitle)){
      const existing = byTitle.get(normTitle);
      return { isDup: true, reason: 'title', match: existing.title };
    }
  }
  
  return { isDup: false };
}

function validateRecipe(recipe){
  const errors = [];
  
  if (!recipe.title || String(recipe.title).trim().length < 3){
    errors.push('title too short or missing');
  }
  
  if (!recipe.sourceUrl){
    errors.push('sourceUrl missing');
  }
  
  // Verifica che almeno uno tra ingredients o steps esista
  const hasIngredients = Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0;
  const hasSteps = Array.isArray(recipe.steps) && recipe.steps.length > 0;
  
  if (!hasIngredients && !hasSteps){
    errors.push('no ingredients and no steps');
  }
  
  return errors;
}

async function main(){
  const tsStart = new Date().toISOString();
  
  console.error('=== MERGE IMPORTED RECIPES ===');
  
  // Leggi ricette importate
  const imported = await readImported();
  if (imported.length === 0){
    console.error('[ERROR] No recipes to import!');
    process.exit(1);
  }
  
  // Leggi database esistente
  const existing = await readDatabase();
  
  // Costruisci mappe per rilevamento duplicati
  const existingMaps = buildExistingMaps(existing);
  
  // Filtra e valida ricette
  const toAdd = [];
  const skipped = {
    duplicateUrl: 0,
    duplicateSlug: 0,
    duplicateTitle: 0,
    validation: 0
  };
  
  console.error('\n[PROCESSING] Filtering duplicates...');
  
  for (const recipe of imported){
    // Check duplicati
    const dupCheck = isDuplicate(recipe, existingMaps);
    if (dupCheck.isDup){
      skipped[`duplicate${dupCheck.reason.charAt(0).toUpperCase() + dupCheck.reason.slice(1)}`]++;
      if (skipped.duplicateUrl + skipped.duplicateSlug + skipped.duplicateTitle <= 10){
        console.error(`[SKIP] ${recipe.title} -> duplicate ${dupCheck.reason}: ${dupCheck.match}`);
      }
      continue;
    }
    
    // Validazione
    const errors = validateRecipe(recipe);
    if (errors.length > 0){
      skipped.validation++;
      if (skipped.validation <= 10){
        console.error(`[SKIP] ${recipe.title} -> validation: ${errors.join(', ')}`);
      }
      continue;
    }
    
    toAdd.push(recipe);
  }
  
  // Riepilogo
  console.error('\n=== FILTER SUMMARY ===');
  console.error(`Imported: ${imported.length}`);
  console.error(`Skipped duplicates: ${skipped.duplicateUrl + skipped.duplicateSlug + skipped.duplicateTitle} (url: ${skipped.duplicateUrl}, slug: ${skipped.duplicateSlug}, title: ${skipped.duplicateTitle})`);
  console.error(`Skipped validation: ${skipped.validation}`);
  console.error(`To add: ${toAdd.length}`);
  
  // Salva se ci sono ricette da aggiungere
  if (toAdd.length > 0){
    // Backup
    const backup = `assets/json/recipes-it.backup.${nowTs()}.json`;
    await fs.writeFile(backup, JSON.stringify({recipes: existing}, null, 2));
    console.error(`[BACKUP] Saved to ${backup}`);
    
    // Merge
    const merged = existing.concat(toAdd);
    await fs.writeFile(OUTPUT_FILE, JSON.stringify({recipes: merged}, null, 2));
    console.error(`[SUCCESS] Added ${toAdd.length} recipes to database (total: ${merged.length})`);
    
    // Log prime 10 ricette aggiunte
    console.error('\n[ADDED RECIPES] (first 10):');
    toAdd.slice(0, 10).forEach((r, i) => {
      console.error(`  ${i+1}. ${r.title} (${r.sourceUrl})`);
    });
    if (toAdd.length > 10){
      console.error(`  ... and ${toAdd.length - 10} more`);
    }
  } else {
    console.error('[INFO] No new recipes to add');
  }
  
  // Output JSON per automazione
  const summary = { 
    ts: tsStart, 
    imported: imported.length,
    added: toAdd.length, 
    skipped: skipped.duplicateUrl + skipped.duplicateSlug + skipped.duplicateTitle + skipped.validation,
    total: existing.length + toAdd.length 
  };
  console.log(JSON.stringify(summary));
}

main().catch(e => { 
  console.error('[FATAL]', e); 
  process.exit(1); 
});
