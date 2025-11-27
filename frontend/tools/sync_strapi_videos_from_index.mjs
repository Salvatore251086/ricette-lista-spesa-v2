// tools/sync_strapi_videos_from_index.mjs
// Sincronizza i video YouTube sulle ricette Strapi usando assets/json/video_index.resolved.json
// Regola: match SOLO se lo slug coincide dopo normalizzazione. Niente fuzzy.
// Caso speciale: scampi-marinati viene sempre saltata.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STRAPI_URL = "http://localhost:1337";
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIDEO_INDEX_PATH = path.join(
  __dirname,
  "..",
  "assets",
  "json",
  "video_index.resolved.json"
);

const MATCHED_PATH = path.join(__dirname, "matched_videos.json");
const CLEARED_PATH = path.join(__dirname, "clear_videos.json");
const MISSING_PATH = path.join(__dirname, "missing_videos.json");

function normalize(str) {
  if (!str) return "";
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// legge video_index.resolved.json e costruisce mappa slugNorm -> { youtubeId, title }
async function readVideoIndex() {
  const raw = await fs.readFile(VIDEO_INDEX_PATH, "utf8");
  const data = JSON.parse(raw);

  const map = new Map();

  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const slugRaw = row.slug;
    const youtubeId = (row.youtubeId || "").trim();
    const vTitle = row.title || "";

    if (!slugRaw || !youtubeId) continue;

    const nSlug = normalize(slugRaw);

    // non vogliamo mai assegnare video automatico a scampi-marinati
    if (nSlug === "scampi-marinati") continue;

    if (!map.has(nSlug)) {
      map.set(nSlug, { youtubeId, title: vTitle });
    }
  }

  console.log("Voci in indice locale effettive (per slug):", map.size);
  console.log(
    "Esempi indice:",
    Array.from(map.entries())
      .slice(0, 5)
      .map(([slug, v]) => [slug, v.youtubeId])
  );

  return map;
}

async function fetchJson(url) {
  const headers = { "Content-Type": "application/json" };
  if (STRAPI_TOKEN) {
    headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} su ${url}`);
  }

  return res.json();
}

async function putJson(url, data) {
  if (!STRAPI_TOKEN) {
    throw new Error("PUT chiamato senza STRAPI_TOKEN");
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${STRAPI_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${url} -> ${res.status} ${text}`);
  }

  return res.json();
}

async function fetchAllRecipes() {
  const pageSize = 100;
  let page = 1;
  const all = [];

  while (true) {
    const url = `${STRAPI_URL}/api/recipes?pagination[page]=${page}&pagination[pageSize]=${pageSize}`;
    const json = await fetchJson(url);
    const items = json.data || [];
    if (items.length === 0) break;
    all.push(...items);
    console.log(`Pagina ${page}, ricette: ${items.length}`);
    page += 1;
  }

  console.log("Totale ricette Strapi lette:", all.length);
  return all;
}

// genera i possibili slug normalizzati per una ricetta
function extractSlugCandidates(rec) {
  const attrs = rec.attributes || {};
  const out = new Set();

  if (attrs.slug) {
    out.add(normalize(attrs.slug));
  }

  if (attrs.title) {
    out.add(normalize(attrs.title));
  }

  if (attrs.sourceUrl) {
    try {
      const u = new URL(attrs.sourceUrl);
      const parts = u.pathname.split("/").filter(Boolean);
      let last = parts[parts.length - 1];
      if (last) {
        last = last.replace(/\.html$/i, "");
        out.add(normalize(last));
      }
    } catch {
      // url rotta, ignoriamo
    }
  }

  return Array.from(out).filter(Boolean);
}

async function main() {
  console.log(
    STRAPI_TOKEN
      ? "Sync Strapi videoId da indice locale tramite slug/titolo..."
      : "Sync SOLO LOCALE (nessun STRAPI_TOKEN), scrivo solo json di supporto..."
  );

  const indexMap = await readVideoIndex();
  const recipes = await fetchAllRecipes();

  const matched = [];
  const toClear = [];
  const missing = [];

  let skippedScampi = 0;

  for (const rec of recipes) {
    const attrs = rec.attributes || {};
    const id = rec.id;

    const candidates = extractSlugCandidates(rec);

    // sicurezza: non tocchiamo mai scampi-marinati
    if (candidates.includes("scampi-marinati")) {
      console.log(`SALTATO Scampi marinati: id=${id}, titolo="${attrs.title}"`);
      skippedScampi++;
      continue;
    }

    let matchEntry = null;
    let matchSlug = null;

    for (const slug of candidates) {
      if (indexMap.has(slug)) {
        matchEntry = indexMap.get(slug);
        matchSlug = slug;
        break;
      }
    }

    const currentVideo = attrs.videoId || null;

    if (matchEntry) {
      // abbiamo trovato un video per questa ricetta
      matched.push({
        id,
        title: attrs.title || "",
        slugStrapi: attrs.slug || "",
        slugMatch: matchSlug,
        youtubeId: matchEntry.youtubeId
      });

      if (STRAPI_TOKEN) {
        console.log(
          `MATCH: Ricetta ${id} "${attrs.title}" -> Slug "${matchSlug}" -> Video ${matchEntry.youtubeId}`
        );
        await putJson(`${STRAPI_URL}/api/recipes/${id}`, {
          data: { videoId: matchEntry.youtubeId }
        });
      }
    } else {
      // nessun match nel nostro indice
      if (currentVideo && STRAPI_TOKEN) {
        // puliamo video errato
        console.log(
          `CLEAN: Ricetta ${id} "${attrs.title}" -> nessun match, rimuovo videoId "${currentVideo}"`
        );
        await putJson(`${STRAPI_URL}/api/recipes/${id}`, {
          data: { videoId: null }
        });
        toClear.push({
          id,
          title: attrs.title || "",
          oldVideoId: currentVideo
        });
      } else {
        missing.push({
          id,
          title: attrs.title || "",
          slugCandidates: candidates
        });
      }
    }
  }

  console.log("----------------------------------------");
  if (STRAPI_TOKEN) {
    console.log("Riepilogo (con update su Strapi):");
    console.log("Ricette aggiornate con videoId:", matched.length);
    console.log("Video rimossi (puliti):", toClear.length);
  } else {
    console.log("Riepilogo (solo file locale, nessuna chiamata PUT):");
    console.log("Ricette con match (solo file locale):", matched.length);
    console.log("Video da pulire (solo file locale):", toClear.length);
  }
  console.log('Ricette "Scampi marinati" saltate:', skippedScampi);
  console.log("Ricette senza video (missing):", missing.length);

  await fs.writeFile(MATCHED_PATH, JSON.stringify(matched, null, 2), "utf8");
  await fs.writeFile(CLEARED_PATH, JSON.stringify(toClear, null, 2), "utf8");
  await fs.writeFile(MISSING_PATH, JSON.stringify(missing, null, 2), "utf8");

  console.log("File matched_videos.json scritto in:", MATCHED_PATH);
  console.log("File clear_videos.json scritto in:", CLEARED_PATH);
  console.log("File missing_videos.json scritto in:", MISSING_PATH);
}

main().catch(err => {
  console.error("Errore generale nello script sync:", err);
  process.exit(1);
});
