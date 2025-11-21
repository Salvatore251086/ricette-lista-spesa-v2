// frontend/tools/convert_recipe_txt_to_json.mjs
// Converte i file di testo delle ricette in un JSON strutturato di supporto

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// cartella dove mettiamo i .txt delle ricette
const INPUT_DIR = path.join(__dirname, "recipe_txt");

// file di output con tutte le ricette convertite
const OUTPUT_JSON = path.join(__dirname, "recipe_txt_converted.json");

// utilità per slugificare
function slugify(str) {
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

// parsing molto semplice basato sulle intestazioni
// "Ingredienti" e "Preparazione"
function parseRecipeTxt(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim());

  let title = "";
  const ingredients = [];
  const steps = [];

  let mode = "title"; // "title" -> "ingredients" -> "steps"

  for (const line of lines) {
    if (!line) continue;

    const lower = line.toLowerCase();

    if (lower.startsWith("ingredienti")) {
      mode = "ingredients";
      continue;
    }

    if (lower.startsWith("preparazione")) {
      mode = "steps";
      continue;
    }

    if (mode === "title") {
      // prima riga non vuota diventa il titolo
      if (!title) title = line;
    } else if (mode === "ingredients") {
      // togli eventuali bullet iniziali
      const clean = line.replace(/^[-•\d.]+\s*/, "").trim();
      if (clean) ingredients.push(clean);
    } else if (mode === "steps") {
      const clean = line.replace(/^[-•\d.]+\s*/, "").trim();
      if (clean) steps.push(clean);
    }
  }

  const slug = slugify(title);

  return {
    title,
    slug,
    ingredients,
    steps
  };
}

async function main() {
  console.log("Converti ricette .txt in JSON di supporto...");
  console.log("Cartella input:", INPUT_DIR);

  let files;
  try {
    files = await fs.readdir(INPUT_DIR);
  } catch (err) {
    console.error(
      "Errore: cartella recipe_txt mancante. Creala in frontend/tools/recipe_txt"
    );
    throw err;
  }

  const txtFiles = files.filter(f => f.toLowerCase().endsWith(".txt"));

  if (txtFiles.length === 0) {
    console.log("Nessun file .txt trovato in recipe_txt.");
    return;
  }

  console.log("File trovati:", txtFiles);

  const result = [];

  for (const file of txtFiles) {
    const fullPath = path.join(INPUT_DIR, file);
    const raw = await fs.readFile(fullPath, "utf8");
    const parsed = parseRecipeTxt(raw);

    console.log(
      `Parsed "${file}" -> titolo="${parsed.title}", ingredienti=${parsed.ingredients.length}, passi=${parsed.steps.length}`
    );

    result.push({
      sourceFile: file,
      ...parsed
    });
  }

  await fs.writeFile(OUTPUT_JSON, JSON.stringify(result, null, 2), "utf8");
  console.log("--------------------------------------------------");
  console.log("Ricette convertite:", result.length);
  console.log("Output scritto in:", OUTPUT_JSON);
}

main().catch(err => {
  console.error("Errore nello script convert_recipe_txt_to_json:", err);
  process.exit(1);
});
