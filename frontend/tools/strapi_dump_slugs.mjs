// tools/strapi_dump_slugs.mjs
// Dump di id, documentId, slug e title da Strapi in un JSON locale

import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";

async function fetchPage(page) {
  const url = new URL("/api/recipes", STRAPI_URL);
  url.searchParams.set("pagination[page]", String(page));
  url.searchParams.set("pagination[pageSize]", "100");

  const res = await fetch(url.href);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Errore HTTP ${res.status} durante il fetch pagina ${page}: ${text}`
    );
  }

  return res.json();
}

async function dumpAll() {
  console.log("Inizio dump ricette da Strapi...");
  console.log(`Base URL: ${STRAPI_URL}`);

  const outputPath = path.join(
    process.cwd(),
    "tools",
    "strapi_slugs_dump.json"
  );

  let page = 1;
  let totalRead = 0;
  const dump = [];
  let pageCount = 1;

  while (true) {
    const json = await fetchPage(page);
    const items = json.data || [];
    const meta = (json.meta && json.meta.pagination) || {};
    pageCount = meta.pageCount || page;

    console.log(
      `Pagina ${page}/${pageCount}, ricette lette: ${items.length}`
    );

    for (const rec of items) {
      const attrs = rec.attributes || rec;

      const id = rec.id;
      const documentId = rec.documentId || null;
      const slug = (attrs.slug || "").trim();
      const title = (attrs.title || "").trim();

      dump.push({
        id,
        documentId,
        slug,
        title
      });
    }

    totalRead += items.length;

    if (!meta.page || page >= pageCount) {
      break;
    }

    page += 1;
  }

  const senzaTitle = dump.filter((r) => !r.title).length;

  console.log("====================================");
  console.log(`Totale record letti da Strapi: ${totalRead}`);
  console.log(`Totale record nel dump: ${dump.length}`);
  console.log(`Record senza title: ${senzaTitle}`);
  console.log("Esempi primi 5 record:");
  console.log(JSON.stringify(dump.slice(0, 5), null, 2));

  fs.writeFileSync(outputPath, JSON.stringify(dump, null, 2), "utf8");
  console.log(`Dump scritto in: ${outputPath}`);
  console.log("Fine script strapi_dump_slugs.mjs");
}

dumpAll().catch((err) => {
  console.error("Errore nel dump slugs da Strapi:", err);
  process.exit(1);
});
