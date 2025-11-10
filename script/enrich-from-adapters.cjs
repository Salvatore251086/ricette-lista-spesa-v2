// script/enrich-from-adapters.cjs
// Enrichment multi-fonte delle ricette usando adapter per siti ufficiali

const fs = require("fs")
const path = require("path")

// Setup fetch per gli adapter
let fetchImpl = null

try {
  if (typeof fetch === "function") {
    fetchImpl = fetch
  } else {
    // Node senza fetch globale
    fetchImpl = require("node-fetch")
  }
} catch {
  fetchImpl = require("node-fetch")
}

if (typeof global.fetch !== "function") {
  global.fetch = (...args) => fetchImpl(...args)
}

// Adapter sorgenti
const { parseCucchiaio } = require("./adapters/cucchiaio.cjs")
const { parseGialloZafferano } = require("./adapters/giallozafferano.cjs")
const { parseBenedetta } = require("./adapters/fattoincasa.cjs")
const { parseLaCucinaItaliana } = require("./adapters/lacucinaitaliana.cjs")
const { parseSalePepe } = require("./adapters/salepepe.cjs")

function normalizeUrl(url) {
  if (!url) return null
  try {
    return new URL(url).toString()
  } catch {
    return null
  }
}

function pickAdapter(url) {
  const u = normalizeUrl(url)
  if (!u) return null
  const hostname = new URL(u).hostname

  if (hostname.includes("cucchiaio.it")) return parseCucchiaio
  if (hostname.includes("giallozafferano.it")) return parseGialloZafferano
  if (hostname.includes("fattoincasadabenedetta.it")) return parseBenedetta
  if (hostname.includes("lacucinaitaliana.it")) return parseLaCucinaItaliana
  if (hostname.includes("salepepe.it")) return parseSalePepe

  return null
}

function mergeEnrichment(base, enriched) {
  if (!enriched || typeof enriched !== "object") return { merged: base, touched: false }

  const result = { ...base }
  let touched = false

  for (const [key, val] of Object.entries(enriched)) {
    if (key === "url" || key === "source") continue

    if (val == null) continue
    if (typeof val === "string" && val.trim() === "") continue
    if (Array.isArray(val) && val.length === 0) continue

    const current = result[key]

    // Non sovrascrivo valori già presenti con roba vuota o identica
    if (Array.isArray(val)) {
      const existing = Array.isArray(current) ? current : []
      const cleaned = val.map(v => String(v).trim()).filter(v => v)
      const mergedArr = cleaned.length ? cleaned : existing
      if (JSON.stringify(mergedArr) !== JSON.stringify(existing)) {
        result[key] = mergedArr
        touched = true
      }
    } else if (typeof val === "string") {
      const cleaned = val.trim()
      if (!current || String(current).trim() === "") {
        result[key] = cleaned
        touched = true
      }
    } else {
      if (current == null) {
        result[key] = val
        touched = true
      }
    }
  }

  return { merged: result, touched }
}

async function enrichSingle(recipe, index, total) {
  if (!recipe || !recipe.url) {
    return { recipe, touched: false }
  }

  const adapter = pickAdapter(recipe.url)
  if (!adapter) {
    return { recipe, touched: false }
  }

  try {
    const enriched = await adapter(recipe.url)
    const { merged, touched } = mergeEnrichment(recipe, enriched)
    return { recipe: merged, touched }
  } catch (err) {
    console.error(
      `Errore enrichment [${index + 1}/${total}] ${recipe.url}:`,
      err.message || err.toString()
    )
    return { recipe, touched: false }
  }
}

async function run() {
  const inputPath = path.join(__dirname, "../assets/json/recipes-it.json")
  const outputPath = path.join(__dirname, "../assets/json/recipes-it.enriched.json")

  const raw = fs.readFileSync(inputPath, "utf8")
  const data = JSON.parse(raw)

  const recipes = Array.isArray(data.recipes)
    ? data.recipes
    : Array.isArray(data)
    ? data
    : []

  if (!recipes.length) {
    throw new Error("Nessuna ricetta valida trovata in recipes-it.json")
  }

  console.log("Ricette in ingresso:", recipes.length)

  const enriched = []
  let touchedCount = 0

  for (let i = 0; i < recipes.length; i++) {
    const base = recipes[i]
    const { recipe, touched } = await enrichSingle(base, i, recipes.length)
    enriched.push(recipe)
    if (touched) touchedCount++

    if ((i + 1) % 10 === 0 || i === recipes.length - 1) {
      console.log(
        `Processate ${i + 1} su ${recipes.length} | ricette arricchite finora: ${touchedCount}`
      )
    }
  }

  const out = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "multi-adapter",
    recipes: enriched
  }

  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf8")

  console.log("Enrichment completato.")
  console.log("Ricette totali:", enriched.length)
  console.log("Ricette con dati arricchiti da fonti ufficiali:", touchedCount)
  console.log("File scritto:", outputPath)
}

run().catch(err => {
  console.error("Errore enrichment:", err)
  process.exit(1)
})
