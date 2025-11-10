// script/enrich-from-adapters.cjs
// Orchestratore: arricchisce recipes-it.json usando gli adapter disponibili

const fs = require("fs")
const path = require("path")
const { parseCucchiaio } = require("./adapters/cucchiaio.cjs")

// Quando aggiungeremo altri adapter, li importeremo qui:
// const { parseGialloZafferano } = require("./adapters/giallozafferano.cjs")
// const { parseBenedetta } = require("./adapters/fattoincasa.cjs")
// const { parseLaCucinaItaliana } = require("./adapters/lacucinaitaliana.cjs")

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function enrichRecipe(recipe) {
  if (!recipe.url) return recipe

  const hostname = new URL(recipe.url).hostname
  let adapter = null

  if (hostname.includes("cucchiaio.it")) adapter = parseCucchiaio
  // else if (hostname.includes("giallozafferano.it")) adapter = parseGialloZafferano
  // else if (hostname.includes("fattoincasadabenedetta.it")) adapter = parseBenedetta
  // else if (hostname.includes("lacucinaitaliana.it")) adapter = parseLaCucinaItaliana

  if (!adapter) return recipe // dominio non gestito

  try {
    const enriched = await adapter(recipe.url)

    // Unisci solo i campi validi
    const merged = {
      ...recipe,
      ...Object.fromEntries(
        Object.entries(enriched).filter(([_, v]) => v && v.length !== 0)
      )
    }

    return merged
  } catch (err) {
    console.error("Errore adapter", hostname, err.message)
    return recipe
  }
}

async function main() {
  const inputPath = path.resolve("assets/json/recipes-it.json")
  const outputPath = path.resolve("assets/json/recipes-it.enriched.json")

  if (!fs.existsSync(inputPath)) {
    console.error("File recipes-it.json non trovato")
    process.exit(1)
  }

  const data = JSON.parse(fs.readFileSync(inputPath, "utf8"))
  const recipes = data.recipes || []
  console.log("Ricette da elaborare:", recipes.length)

  const results = []
  let enrichedCount = 0

  for (const [i, r] of recipes.entries()) {
    console.log(`→ [${i + 1}/${recipes.length}] ${r.title || "Senza titolo"}`)
    const enriched = await enrichRecipe(r)
    results.push(enriched)
    if (enriched.steps && enriched.steps.length > 0) enrichedCount++
    await sleep(500) // per sicurezza anti blocco
  }

  const final = {
    ...data,
    enrichedAt: new Date().toISOString(),
    recipes: results
  }

  fs.writeFileSync(outputPath, JSON.stringify(final, null, 2), "utf8")
  console.log("Completato. Ricette arricchite:", enrichedCount)
}

main().catch(err => {
  console.error("Errore generale:", err)
  process.exit(1)
})
