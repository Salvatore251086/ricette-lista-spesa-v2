#!/usr/bin/env node
// Importa ricette da più siti usando parser modulari
// Versione multi-sito con auto-discovery dei parser
// Uso: node script/import-recipes.mjs urls.txt 30  -> stampa JSON su stdout.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const INPUT = process.argv[2] || "urls.txt";
const LIMIT = Number(process.argv[3] || 30);

const DEBUG_DIR = path.join(process.cwd(), ".cache", "debug");
fs.mkdirSync(DEBUG_DIR, { recursive: true });

// ---- Parser Registry --------------------------------------------------------
const PARSERS = [];

// Carica dinamicamente tutti i parser dalla cartella parsers/
async function loadParsers() {
  const parsersDir = path.join(__dirname, "parsers");
  
  try {
    if (!fs.existsSync(parsersDir)) {
      console.error(`[PARSER] Directory parsers/ non trovata. Uso fallback generico.`);
      return;
    }

    const files = fs.readdirSync(parsersDir).filter(f => f.endsWith('.mjs'));
    
    for (const file of files) {
      try {
        const parserPath = path.join(parsersDir, file);
        const parser = await import(pathToFileURL(parserPath).href);
        
        if (parser.match && parser.parse) {
          PARSERS.push({
            name: file.replace('.mjs', ''),
            match: parser.match,
            parse: parser.parse
          });
          console.error(`[PARSER] ✓ ${file}`);
        }
      } catch (e) {
        console.error(`[PARSER] ✗ ${file}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error('[PARSER] Errore caricamento parsers:', e.message);
  }
  
  if (PARSERS.length === 0) {
    console.error('[PARSER] Nessun parser caricato. Uso fallback generico JSON-LD.');
  }
}

function pathToFileURL(p) {
  return new URL(`file:///${p.replace(/\\/g, '/')}`);
}

// Trova il parser appropriato per un URL
function findParser(url) {
  for (const parser of PARSERS) {
    try {
      if (parser.match(url)) {
        return parser;
      }
    } catch (e) {
      console.error(`[PARSER] Errore match ${parser.name}:`, e.message);
    }
  }
  return null;
}

// -----------------------------------------------------------------------------

// ---- YouTube config ---------------------------------------------------------
const YT_API_KEY = process.env.YT_API_KEY || "";
const YT_REGION  = "IT";
const YT_LANG    = "it";
const YT_CACHE   = path.join(process.cwd(), ".cache", "yt-map.json");
let ytMap = {};
try { ytMap = JSON.parse(fs.readFileSync(YT_CACHE, "utf8")); } catch { ytMap = {}; }
function saveYtMap(){ try { fs.writeFileSync(YT_CACHE, JSON.stringify(ytMap, null, 2)); } catch {} }
// -----------------------------------------------------------------------------

function slugify(u){
  try {
    const { pathname, hostname } = new URL(u.trim());
    const site = hostname.replace(/^www\./, '').split('.')[0];
    return `${site}-${pathname.replace(/(^\/+|\/+$)/g,"").replace(/[^\w\-]+/g,"-").slice(0,100)}` || "root";
  } catch { return "invalid"; }
}

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url, { tries=3, timeout=15000, headers={} } = {}){
  let lastErr;
  for (let i=1; i<=tries; i++){
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeout);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          ...headers,
        }
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if ((res.headers.get("content-type") || "").includes("application/json")) {
        return await res.json();
      }
      return await res.text();
    } catch (e){
      lastErr = e;
      await sleep(500 * i);
    }
  }
  throw lastErr;
}

// ---- Fallback generico JSON-LD (se nessun parser specifico) ----------------
function findJsonLdBlocks(html){
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    const cleaned = raw
      .replace(/^\s*\/\/.*$/mg, "")
      .replace(/,\s*]/g, "]")
      .replace(/,\s*}/g, "}");
    try { blocks.push(JSON.parse(cleaned)); }
    catch { blocks.push({ __invalidJson: true, raw }); }
  }
  return blocks;
}

function* walk(obj){
  if (!obj || typeof obj !== "object") return;
  yield obj;
  if (Array.isArray(obj)) for (const x of obj) yield* walk(x);
  else for (const k of Object.keys(obj)) yield* walk(obj[k]);
}

function asArray(x){ return Array.isArray(x) ? x : (x ? [x] : []); }

function normalizeRecipe(r){
  const text = v => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.map(text).filter(Boolean).join(" ");
    if (typeof v === "object" && v.text) return text(v.text);
    return "";
  };

  const image =
    (typeof r.image === "string" && r.image) ||
    (Array.isArray(r.image) && r.image.find(s => typeof s === "string")) ||
    (r.image && r.image.url) || undefined;

  const instructions = asArray(r.recipeInstructions)
    .map(step => {
      if (!step) return null;
      if (typeof step === "string") return step;
      if (step.text) return text(step.text);
      if (step.name && step.text) return `${step.name}: ${text(step.text)}`;
      return text(step);
    })
    .filter(Boolean);

  const video =
    r.video?.contentUrl ||
    r.video?.embedUrl ||
    (typeof r.video === "string" ? r.video : undefined);

  return {
    source: "scraped",
    url: r.mainEntityOfPage || r.url || undefined,
    title: r.name || "",
    description: text(r.description) || "",
    image,
    ingredients: asArray(r.recipeIngredient).map(text).filter(Boolean),
    instructions,
    totalTime: r.totalTime || r.totaltime || undefined,
    cookTime: r.cookTime || undefined,
    prepTime: r.prepTime || undefined,
    yield: r.recipeYield || undefined,
    category: asArray(r.recipeCategory).map(text).filter(Boolean),
    cuisine: asArray(r.recipeCuisine).map(text).filter(Boolean),
    keywords: asArray(r.keywords).map(text).filter(Boolean),
    rating: r.aggregateRating?.ratingValue || undefined,
    video,
  };
}

function looksValid(rec){
  return !!(rec.title && rec.ingredients?.length >= 2 && rec.instructions?.length >= 1);
}

// ---- YouTube fallback -------------------------------------------------------
async function findYoutubeVideoUrlByTitle(title){
  if (!YT_API_KEY) return null;

  const key = title.trim().toLowerCase();
  if (ytMap[key]) return ytMap[key];

  const params = new URLSearchParams({
    key: YT_API_KEY,
    part: "snippet",
    q: `${title} ricetta`,
    type: "video",
    regionCode: YT_REGION,
    relevanceLanguage: YT_LANG,
    maxResults: "5",
    safeSearch: "none",
  });

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
    const data = await fetchWithRetry(apiUrl, { tries: 2, timeout: 12000, headers: { Accept: "application/json" } });

    const items = (data && data.items) ? data.items : [];
    const pick = items.find(i => i?.id?.videoId) || null;
    if (!pick) return null;

    const url = `https://www.youtube.com/watch?v=${pick.id.videoId}`;
    ytMap[key] = url;
    saveYtMap();
    return url;
  } catch {
    return null;
  }
}
// -----------------------------------------------------------------------------

function extractYouTubeId(videoUrl) {
  if (!videoUrl) return "";
  try {
    const url = new URL(videoUrl);
    if (/youtu\.be$/i.test(url.hostname)) return url.pathname.slice(1);
    if (/youtube\.com$/i.test(url.hostname)) {
      if (url.searchParams.get("v")) return url.searchParams.get("v");
      const m = url.pathname.match(/\/embed\/([^/]+)/);
      if (m) return m[1];
    }
    return "";
  } catch {
    return "";
  }
}

async function processUrl(u){
  const s = slugify(u);
  const dbgPath = path.join(DEBUG_DIR, `${s}.log`);
  const dbg = msg => fs.appendFileSync(dbgPath, msg + "\n");

  try {
    // Trova il parser appropriato
    const parser = findParser(u);
    
    if (parser) {
      dbg(`[INFO] Parser: ${parser.name}`);
      
      // Scarica HTML
      const html = await fetchWithRetry(u);
      fs.writeFileSync(path.join(DEBUG_DIR, `${s}.html`), html, "utf8");
      dbg(`[INFO] Scaricato HTML (${html.length} bytes)`);

      const fetchHtml = async (url) => {
        if (url === u) return html;
        return await fetchWithRetry(url);
      };

      // Usa il parser
      let recipe;
      try {
        recipe = await parser.parse({ url: u, html, fetchHtml });
      } catch (parseErr) {
        dbg(`[ERROR] Parser fallito: ${parseErr.message}`);
        return { ok: false, url: u, recipes: [], error: 'parse_error' };
      }

      if (!recipe) {
        dbg(`[WARN] Parser non ha restituito dati`);
        return { ok: false, url: u, recipes: [], error: 'no_data' };
      }

      // Normalizza formato per compatibilità
      const normalized = {
        source: parser.name,
        url: recipe.sourceUrl || u,
        title: recipe.title || "",
        description: "",
        image: recipe.image || "",
        ingredients: recipe.ingredients || [],
        instructions: recipe.steps || [],
        totalTime: recipe.totalTime || 0,
        cookTime: recipe.cookTime || 0,
        prepTime: recipe.prepTime || 0,
        yield: recipe.servings || 0,
        category: recipe.category || [],
        cuisine: [],
        keywords: recipe.tags || [],
        rating: undefined,
        video: "",
        youtubeId: recipe.youtubeId || "",
        difficulty: recipe.difficulty || "easy",
        id: recipe.id || "",
      };

      if (normalized.youtubeId) {
        normalized.video = `https://www.youtube.com/watch?v=${normalized.youtubeId}`;
      }

      // Fallback YouTube
      if (!normalized.video && !normalized.youtubeId && normalized.title && YT_API_KEY) {
        dbg(`[YTFALLBACK] Cerco video per "${normalized.title}"...`);
        const v = await findYoutubeVideoUrlByTitle(normalized.title);
        if (v) {
          normalized.video = v;
          normalized.youtubeId = extractYouTubeId(v);
          dbg(`[YTFALLBACK] Trovato: ${v}`);
        } else {
          dbg(`[YTFALLBACK] Nessun risultato`);
        }
        await sleep(150);
      }

      const isValid = !!(
        normalized.title &&
        normalized.ingredients?.length >= 2 &&
        normalized.instructions?.length >= 1
      );

      if (!isValid) {
        dbg(`[SKIP] Ricetta incompleta`);
        return { ok: false, url: u, recipes: [], error: 'incomplete' };
      }

      fs.writeFileSync(
        path.join(DEBUG_DIR, `${s}-parsed.json`),
        JSON.stringify(normalized, null, 2)
      );
      dbg(`[SUCCESS] Ricetta estratta`);

      return { ok: true, url: u, recipes: [normalized] };
      
    } else {
      // FALLBACK: usa parsing generico JSON-LD
      dbg(`[INFO] Nessun parser specifico, uso JSON-LD generico`);
      
      const html = await fetchWithRetry(u);
      fs.writeFileSync(path.join(DEBUG_DIR, `${s}.html`), html, "utf8");
      dbg(`[INFO] Scaricato HTML (${html.length} bytes)`);

      const blocks = findJsonLdBlocks(html);
      fs.writeFileSync(path.join(DEBUG_DIR, `${s}-jsonld.json`), JSON.stringify(blocks, null, 2));

      let recipes = [];
      for (const b of blocks){
        if (b && b.__invalidJson){ dbg(`[WARN] Blocco JSON-LD non parse-abile`); continue; }
        for (const node of walk(b)){
          const t = node?.["@type"]; if (!t) continue;
          const list = Array.isArray(t) ? t.map(x => String(x).toLowerCase()) : [String(t).toLowerCase()];
          if (list.includes("recipe")){
            const rec = normalizeRecipe(node);
            if (!rec.url) rec.url = u;

            if (!rec.video && rec.title){
              const v = await findYoutubeVideoUrlByTitle(rec.title);
              if (v) { rec.video = v; dbg(`[YTFALLBACK] video trovato per "${rec.title}" -> ${v}`); }
              else   { dbg(`[YTFALLBACK] nessun video per "${rec.title}"`); }
              await sleep(150);
            }

            if (looksValid(rec)) recipes.push(rec);
            else dbg(`[SKIP] recipe incompleta`);
          }
        }
      }

      const seen = new Set();
      recipes = recipes.filter(r => {
        const k = (r.title || "").trim().toLowerCase();
        if (seen.has(k)) return false; seen.add(k); return true;
      });

      fs.writeFileSync(path.join(DEBUG_DIR, `${s}-parsed.json`), JSON.stringify(recipes, null, 2));
      dbg(`[RESULT] ricette valide: ${recipes.length}`);
      return { ok: recipes.length > 0, url: u, recipes };
    }

  } catch (e){
    fs.appendFileSync(path.join(DEBUG_DIR, `${s}.log`), `[ERROR] ${e?.message || e}\n`);
    return { ok: false, url: u, recipes: [], error: e.message };
  }
}

function loadUrls(){
  if (!fs.existsSync(INPUT)) return [];
  const raw = fs.readFileSync(INPUT, "utf8");
  return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

(async () => {
  console.error('[IMPORT] Caricamento parser...');
  await loadParsers();
  
  if (PARSERS.length > 0) {
    console.error(`[IMPORT] Parser attivi: ${PARSERS.map(p => p.name).join(', ')}`);
  }
  
  const urls = loadUrls().slice(0, LIMIT);
  console.error(`[IMPORT] Processando ${urls.length} URL...`);
  
  const out = [];
  const used = [];
  const stats = {
    total: urls.length,
    success: 0,
    failed: 0,
    by_parser: {}
  };

  for (let i=0; i<urls.length; i++){
    if (i>0) await sleep(300);
    const u = urls[i];
    console.error(`[${i+1}/${urls.length}] ${u}`);
    
    const res = await processUrl(u);
    
    if (res.recipes.length) {
      const source = res.recipes[0].source || 'generic';
      stats.by_parser[source] = (stats.by_parser[source] || 0) + 1;
      out.push(...res.recipes);
      used.push(u);
      stats.success++;
    } else {
      stats.failed++;
    }
  }

  if (used.length){
    fs.mkdirSync(path.join(process.cwd(), ".cache"), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), ".cache", "used_urls.txt"), used.join("\n"));
  }

   console.error`\n[STATS] ${JSON.stringify(stats, null, 2)}`;
  console.error`[RESULT] Estratte ${out.length} ricette da ${stats.success} URL`;
  
  // Salva ricette in new_recipes.json
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    recipes: out
  };
  fs.writeFileSync('new_recipes.json', JSON.stringify(output, null, 2));
  console.error(`[SAVED] ${out.length} recipes to new_recipes.json`);
  
  process.stdout.write(JSON.stringify(out, null, 2));
})();
