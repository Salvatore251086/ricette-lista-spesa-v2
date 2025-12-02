#!/usr/bin/env node
// Merge: legge l'indice URL, scarica un piccolo lotto di ricette nuove, valida soft e aggiunge a recipes-it.json
// VERSIONE MIGLIORATA: Rileva meglio i duplicati usando sourceUrl, slug E title

import fs from 'node:fs/promises';

const INDEX   = 'assets/json/recipes-index.jsonl';
const OUTFILE = 'assets/json/recipes-it.json';

// domini ammessi
const ALLOWED = new Set([
  'ricette.giallozafferano.it',
  'www.giallozafferano.it',
  'www.fattoincasadabenedetta.it',
  'www.cucchiaio.it',
  'www.misya.info',
  'www.lacucinaitaliana.it',
  'www.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com'
]);

function safeJson(t){ try { return JSON.parse(t) } catch { return null } }
function nowTs(){ return new Date().toISOString().replace(/[:.]/g,''); }
function isAllowed(u){ try { return ALLOWED.has(new URL(u).hostname) } catch { return false } }
function slugFromUrl(u){ 
  try { 
    return new URL(u).pathname.split('/').filter(Boolean).pop()?.replace(/\.html?$/i, '') || 'ricetta' 
  } catch { 
    return 'ricetta' 
  } 
}

// Normalizza title per confronto
function normalizeTitle(title){
  return String(title || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Rimuovi punteggiatura
    .replace(/\s+/g, ' ')    // Normalizza spazi
    .trim();
}

async function readIndex(){
  let lines = [];
  try {
    const txt = await fs.readFile(INDEX,'utf8');
    lines = txt.split(/\r?\n/).filter(Boolean).map(l => safeJson(l)).filter(Boolean);
  } catch { lines = []; }
  return lines;
}

async function readRecipes(){
  try {
    const obj = safeJson(await fs.readFile(OUTFILE,'utf8')) || {};
    return Array.isArray(obj.recipes) ? obj.recipes : [];
  } catch { return []; }
}

function buildExistingMaps(existing){
  const byUrl = new Map();
  const bySlug = new Map();
  const byTitle = new Map();
  
  for (const r of existing){
    // Mappa per sourceUrl
    if (r.sourceUrl){
      byUrl.set(String(r.sourceUrl).toLowerCase(), r);
    }
    
    // Mappa per slug
    if (r.slug){
      bySlug.set(String(r.slug).toLowerCase(), r);
    } else if (r.sourceUrl){
      // Genera slug da sourceUrl se non presente
      const slug = slugFromUrl(r.sourceUrl);
      bySlug.set(slug.toLowerCase(), r);
    }
    
    // Mappa per title normalizzato
    if (r.title){
      const normTitle = normalizeTitle(r.title);
      if (normTitle){
        byTitle.set(normTitle, r);
      }
    }
  }
  
  return { byUrl, bySlug, byTitle };
}

function isDuplicate(url, existingMaps){
  const { byUrl, bySlug, byTitle } = existingMaps;
  
  // Check 1: URL esatto
  if (byUrl.has(url.toLowerCase())){
    return { isDup: true, reason: 'url-exact' };
  }
  
  // Check 2: Slug simile
  const slug = slugFromUrl(url);
  if (bySlug.has(slug.toLowerCase())){
    return { isDup: true, reason: 'slug-match' };
  }
  
  return { isDup: false };
}

function pickCandidates(index, existingMaps, limit=10){
  const list = [];
  const stats = { total: 0, skipped: { notAllowed: 0, notRecipe: 0, duplicate: 0 } };
  
  for (const it of index){
    const u = it.url || it;
    if (!u) continue;
    
    stats.total++;
    
    // Check dominio
    if (!isAllowed(u)){
      stats.skipped.notAllowed++;
      continue;
    }
    
    // Check pattern ricetta
    if (!/\/ricetta\/|\/ricette\//.test(u)){
      stats.skipped.notRecipe++;
      continue;
    }
    
    // Check duplicati
    const dupCheck = isDuplicate(u, existingMaps);
    if (dupCheck.isDup){
      stats.skipped.duplicate++;
      continue;
    }
    
    list.push(u);
    if (list.length >= limit) break;
  }
  
  console.error(`[PICK] Processed ${stats.total} URLs: ${list.length} candidates, ${stats.skipped.duplicate} duplicates, ${stats.skipped.notRecipe} not recipes, ${stats.skipped.notAllowed} not allowed`);
  
  return list;
}

function parseTitle(html){
  // prova og:title
  const m1 = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (m1 && m1[1]) return m1[1].trim();
  // fallback <title>
  const m2 = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (m2 && m2[1]) return m2[1].trim();
  return '';
}

async function fetchRecipe(url){
  const res = await fetch(url, { headers: { 'User-Agent': 'RLS-Crawler/1.1 (+https://github.com/)' }});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const title = parseTitle(html);
  const slug = slugFromUrl(url);
  
  return {
    id: slug,
    slug: slug,
    title,
    image: '',
    servings: 0,
    prepTime: 0,
    cookTime: 0,
    difficulty: 'easy',
    category: [],
    tags: [],
    ingredients: [],
    steps: [],
    sourceUrl: url,
    youtubeId: ''
  };
}

function validateSoft(r){
  const errs = [];
  if (!r.title || !String(r.title).trim()) errs.push('title mancante');
  if (!r.sourceUrl) errs.push('url mancante');
  if (r.sourceUrl && !isAllowed(r.sourceUrl)) errs.push('dominio non permesso');
  return errs;
}

// Verifica se la ricetta fetchata è duplicato usando title
function isFetchedDuplicate(recipe, existingMaps){
  const { byTitle } = existingMaps;
  
  if (!recipe.title) return { isDup: false };
  
  const normTitle = normalizeTitle(recipe.title);
  if (byTitle.has(normTitle)){
    return { isDup: true, reason: 'title-match', match: byTitle.get(normTitle).title };
  }
  
  return { isDup: false };
}

async function main(){
  const tsStart = new Date().toISOString();

  const index = await readIndex();
  const existing = await readRecipes();
  
  console.error(`[MERGE] Database has ${existing.length} recipes`);
  
  const existingMaps = buildExistingMaps(existing);
  console.error(`[MERGE] Built maps: ${existingMaps.byUrl.size} URLs, ${existingMaps.bySlug.size} slugs, ${existingMaps.byTitle.size} titles`);

  const candidates = pickCandidates(index, existingMaps, 10);
  const added = [];
  const skipped = { validation: 0, titleDuplicate: 0 };

  for (const url of candidates){
    try {
      const r = await fetchRecipe(url);
      
      // Validazione soft
      const v = validateSoft(r);
      if (v.length){
        console.error('[SKIP]', url, '-> validation:', v.join('; '));
        skipped.validation++;
        continue;
      }
      
      // Check duplicato per title dopo fetch
      const dupCheck = isFetchedDuplicate(r, existingMaps);
      if (dupCheck.isDup){
        console.error('[SKIP]', url, '-> title duplicate:', r.title, '~=', dupCheck.match);
        skipped.titleDuplicate++;
        continue;
      }
      
      added.push(r);
      console.error('[ADD]', url, '->', r.title);
      
    } catch (e){
      console.error('[FAIL]', url, '->', e.message);
    }
  }

  if (added.length){
    const backup = `assets/json/recipes-it.backup.${nowTs()}.json`;
    await fs.writeFile(backup, JSON.stringify({recipes: existing}, null, 2));
    const merged = existing.concat(added);
    await fs.writeFile(OUTFILE, JSON.stringify({recipes: merged}, null, 2));
    console.error(`[MERGE] Added ${added.length} new recipes (skipped: ${skipped.validation} validation, ${skipped.titleDuplicate} title duplicates)`);
  } else {
    console.error('[MERGE] No new recipes to add');
  }

  const summary = { ts: tsStart, added: added.length, total: existing.length + added.length };
  console.log(JSON.stringify(summary));
}

main().catch(e => { console.error(e); process.exit(1); });
