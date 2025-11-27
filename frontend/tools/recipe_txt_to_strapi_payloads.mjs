// tools/recipe_txt_to_strapi_payloads.mjs
// Da recipe_txt_converted.json -> payload JSON "forma Strapi"

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const INPUT_PATH = path.join(__dirname, "recipe_txt_converted.json")
const OUTPUT_PATH = path.join(__dirname, "recipe_strapi_payloads.json")

function cleanTitle(raw) {
  if (!raw) return ""
  let t = raw.trim()

  t = t.replace(/^strapi recipe spec\s*[-–]\s*/i, "")
  t = t.replace(/^titolo:\s*/i, "")
  t = t.replace(/^title:\s*/i, "")

  return t.trim()
}

function normalizeSlug(str) {
  if (!str) return ""
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function cleanSlug(rawTitle, rawSlug) {
  let s = (rawSlug || "").trim()

  // se lo slug è "sporco", preferiamo rigenerarlo dal titolo
  if (
    !s ||
    /^titolo[-:]/i.test(s) ||
    /^title[-:]/i.test(s) ||
    /^strapi-recipe-spec/i.test(s)
  ) {
    s = ""
  }

  if (!s) {
    s = normalizeSlug(cleanTitle(rawTitle))
  } else {
    s = normalizeSlug(s)
  }

  return s
}

async function main() {
  console.log("Leggo file di supporto:", INPUT_PATH)
  const raw = await fs.readFile(INPUT_PATH, "utf8")
  const list = JSON.parse(raw)

  const payloads = []
  let skippedSpecs = 0

  for (const rec of list) {
    const ingredients = Array.isArray(rec.ingredients)
      ? rec.ingredients.filter(Boolean)
      : []
    const steps = Array.isArray(rec.steps)
      ? rec.steps.filter(Boolean)
      : []

    // salta i record "spec" senza ingredienti e passi
    if (ingredients.length === 0 && steps.length === 0) {
      skippedSpecs++
      continue
    }

    const title = cleanTitle(rec.title || "")
    const slug = cleanSlug(rec.title || "", rec.slug || "")

    const payload = {
      sourceFile: rec.sourceFile || "",
      title,
      slug,
      ingredients,
      steps
    }

    payloads.push(payload)
  }

  console.log("------------------------------------------")
  console.log("Ricette utili:", payloads.length)
  console.log("Spec saltate:", skippedSpecs)

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payloads, null, 2), "utf8")
  console.log("File Strapi payload scritto in:", OUTPUT_PATH)
}

main().catch(err => {
  console.error("Errore script recipe_txt_to_strapi_payloads:", err)
  process.exit(1)
})
