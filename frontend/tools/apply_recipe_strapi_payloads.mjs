// tools/apply_recipe_strapi_payloads.mjs
import path from "node:path";
import fs from "node:fs/promises";

const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || "";

const PAYLOAD_PATH = path.join(
  process.cwd(),
  "tools",
  "recipe_strapi_payloads.json"
);
const DUMP_PATH = path.join(
  process.cwd(),
  "tools",
  "strapi_slugs_dump.json"
);

function normalizeTitle(t) {
  if (!t) return "";
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function loadJson(p) {
  const txt = await fs.readFile(p, "utf8");
  return JSON.parse(txt);
}

async function main() {
  console.log(
    `Leggo file payload: ${path.relative(process.cwd(), PAYLOAD_PATH)}`
  );
  const payload = await loadJson(PAYLOAD_PATH);

  console.log(
    `Leggo dump titoli da Strapi: ${path.relative(process.cwd(), DUMP_PATH)}`
  );
  const dump = await loadJson(DUMP_PATH);

  console.log("Costruisco indice per titolo...");
  const titleIndex = new Map();
  const slugIndex = new Map();
  const ambiguousTitles = new Set();
  let recordsWithoutTitle = 0;

  for (const rec of dump) {
    const normTitle = normalizeTitle(rec.title);
    if (!normTitle) {
      recordsWithoutTitle += 1;
    } else {
      if (!titleIndex.has(normTitle)) {
        titleIndex.set(normTitle, rec);
      } else {
        ambiguousTitles.add(normTitle);
      }
    }
    if (rec.slug) {
      slugIndex.set(rec.slug, rec);
    }
  }

  console.log(
    `Indice titoli Strapi costruito. Record senza title: ${recordsWithoutTitle}`
  );
  console.log(
    `Titoli unici indicizzati: ${titleIndex.size}`
  );

  const dryRun = !STRAPI_TOKEN;
  console.log(
    `Modalità: ${
      dryRun
        ? "DRY RUN (solo simulazione, nessun PUT)"
        : "UPDATE reale su Strapi"
    }`
  );
  console.log("===========================================");

  let updated = 0;
  let same = 0;
  let notFound = 0;
  let ambiguous = 0;
  let errors = 0;

  for (let i = 0; i < payload.length; i++) {
    const rec = payload[i];
    const title = rec.title || "(senza titolo)";
    const source = rec.sourceFile || "n/d";

    console.log(`\n[${i + 1}/${payload.length}] "${title}"`);
    console.log(`Source: ${source}`);

    const normTitle = normalizeTitle(rec.title);
    console.log(
      ` [MATCH] Cerco in Strapi per title normalizzato: "${normTitle}"`
    );

    if (!normTitle) {
      console.log("  X Nessun titolo normalizzabile, salto.");
      notFound += 1;
      continue;
    }

    if (ambiguousTitles.has(normTitle)) {
      console.log(
        "  X Titolo ambiguo in Strapi, più ricette con questo titolo. Skip."
      );
      ambiguous += 1;
      continue;
    }

    let match = titleIndex.get(normTitle);

    if (!match && rec.slug) {
      console.log(
        ` [FALLBACK] Nessun match per titolo, provo per slug: "${rec.slug}"`
      );
      match = slugIndex.get(rec.slug);
    }

    if (!match) {
      console.log(
        " X NOT FOUND: nessuna ricetta in Strapi con questo titolo/slug"
      );
      notFound += 1;
      continue;
    }

    console.log(
      ` Match: id=${match.id}, documentId="${match.documentId}", slug="${match.slug}", title="${match.title}"`
    );

    const data = {};

    if (Array.isArray(rec.ingredients) && rec.ingredients.length > 0) {
      data.ingredients = rec.ingredients;
    }
    if (Array.isArray(rec.steps) && rec.steps.length > 0) {
      data.steps = rec.steps;
    }
    if (rec.sourceUrl) {
      data.sourceUrl = rec.sourceUrl;
    }
    if (rec.videoId !== undefined) {
      data.videoId = rec.videoId;
    }
    if (Array.isArray(rec.tags) && rec.tags.length > 0) {
      data.tags = rec.tags;
    }

    const url = new URL(
      `/api/recipes/${match.documentId}`,
      STRAPI_URL
    ).toString();

    const nIng = data.ingredients ? data.ingredients.length : 0;
    const nSteps = data.steps ? data.steps.length : 0;

    if (dryRun) {
      console.log(` [DRY RUN] PUT ${url}`);
      console.log(
        ` [DRY RUN] Aggiornerei ingredients (${nIng}) e steps (${nSteps})`
      );
      updated += 1;
      continue;
    }

    if (Object.keys(data).length === 0) {
      console.log(
        " Nessun campo da aggiornare (ingredients/steps vuoti), salto."
      );
      same += 1;
      continue;
    }

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STRAPI_TOKEN}`,
      },
      body: JSON.stringify({ data }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        ` ERRORE PUT ricetta: HTTP ${res.status} su ${url}`
      );
      if (body) {
        console.error(`  Risposta: ${body}`);
      }
      errors += 1;
      continue;
    }

    console.log(" OK aggiornato su Strapi.");
    updated += 1;
  }

  console.log("\n===========================================");
  console.log("RIEPILOGO FINALE");
  console.log(`✅ Ricette aggiornate:    ${updated}`);
  console.log(`🔁 Ricette già uguali:    ${same}`);
  console.log(`❌ Titoli non trovati:    ${notFound}`);
  console.log(`⚠️  Titoli ambigui:        ${ambiguous}`);
  console.log(`⛔ Errori di aggiornamento: ${errors}`);
  console.log("===========================================");
  console.log("Fine script apply_recipe_strapi_payloads.mjs");
}

main().catch((err) => {
  console.error("Errore generale in apply_recipe_strapi_payloads.mjs:", err);
  process.exit(1);
});
