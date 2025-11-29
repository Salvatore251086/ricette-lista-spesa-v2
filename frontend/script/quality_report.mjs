// script/quality_report.mjs

import fs from "fs/promises";
import path from "path";

const RECIPES_PATH = "assets/json/recipes-it.enriched.all.json";
const VIDEO_INDEX_PATH = "assets/json/video_index.resolved.json";
const LOGS_DIR = "logs";

// Ricette "top" che vogliamo tenere sotto controllo.
// Puoi aggiungere o togliere slug qui dentro.
const TOP_SLUGS = [
  "maccheroncini-con-carbonara-alla-majonese",
  "ricetta-carbonara-di-pesce",
  "maccheroni-alla-chitarra-con-polpette",
  "pollo-in-crosta-di-sale",
  "spaghetti-alle-vongole-e-bottarga-di-tonno",
  "risotto-porri-zucca-salmone-nocciole",
  "ossobuco-alla-milanese-in-gremolada",
  "ossibuchi-di-vitello-alla-milanese",
  "gnocchi-di-zucca-con-ragu-di-fegatini-di-pollo",
  "caprese-di-mozzarella-di-bufala"
];

async function loadJson(filePath) {
  const full = path.resolve(filePath);
  const raw = await fs.readFile(full, "utf8");
  return JSON.parse(raw);
}

function ensureArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.recipes)) return data.recipes;
  return [];
}

async function main() {
  console.log("=== Report qualità Ricette Smart & Risparmio ===");

  // Carica ricette
  const recipesData = await loadJson(RECIPES_PATH);
  const recipes = ensureArray(recipesData);
  console.log(`Totale ricette: ${recipes.length}`);

  // Carica indice video
  const videoIndexData = await loadJson(VIDEO_INDEX_PATH);
  const bySlug = videoIndexData && videoIndexData.by_slug ? videoIndexData.by_slug : {};
  const slugsConVideo = new Set(
    Object.entries(bySlug)
      .filter(([_, info]) => info && info.primary)
      .map(([slug]) => slug)
  );

  // Ricette senza ingredienti
  const senzaIngredienti = recipes.filter(
    (r) => !Array.isArray(r.ingredients) || r.ingredients.length === 0
  );

  // Ricette top (per slug) senza video
  const topRecipes = recipes.filter((r) => TOP_SLUGS.includes(r.slug));
  const topSenzaVideo = topRecipes.filter((r) => !slugsConVideo.has(r.slug));

  // Prepara testo report
  const lines = [];

  lines.push("=== Report qualità Ricette Smart & Risparmio ===");
  lines.push(`Totale ricette: ${recipes.length}`);
  lines.push("");

  lines.push(`Ricette SENZA ingredienti: ${senzaIngredienti.length}`);
  senzaIngredienti.forEach((r) => {
    lines.push(` - ${r.title} | ${r.slug}`);
  });
  lines.push("");

  lines.push(`Ricette TOP monitorate: ${topRecipes.length}`);
  lines.push(`Ricette TOP SENZA video: ${topSenzaVideo.length}`);
  topSenzaVideo.forEach((r) => {
    lines.push(` - ${r.title} | ${r.slug}`);
  });

  const reportText = lines.join("\n");

  // Stampa in console
  console.log("");
  console.log(reportText);

  // Scrivi anche in logs/
  await fs.mkdir(path.resolve(LOGS_DIR), { recursive: true });
  const now = new Date();
  const stamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0");

  const logFile = path.resolve(LOGS_DIR, `quality-report-${stamp}.txt`);
  await fs.writeFile(logFile, reportText, "utf8");

  console.log("");
  console.log(`Report salvato in: ${logFile}`);
}

main().catch((err) => {
  console.error("Errore nel report qualità:", err);
  process.exit(1);
});
