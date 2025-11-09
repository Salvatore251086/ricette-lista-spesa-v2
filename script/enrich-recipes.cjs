const fs = require("fs")
const path = require("path")
const cheerio = require("cheerio")

const inputPath = path.join(__dirname, "..", "assets", "json", "recipes-it.json")
const outputPath = path.join(__dirname, "..", "assets", "json", "recipes-it.enriched.json")

async function main() {
  const raw = fs.readFileSync(inputPath, "utf8")
  const data = JSON.parse(raw)
  const recipes = Array.isArray(data.recipes) ? data.recipes : data

  const updated = []

  for (const recipe of recipes) {
    if (Array.isArray(recipe.steps) && recipe.steps.length > 0) {
      updated.push(recipe)
      continue
    }

    if (!recipe.url) {
      updated.push(recipe)
      continue
    }

    try {
      const steps = await extractStepsFromUrl(recipe.url)
      if (steps.length > 0) {
        updated.push({
          ...recipe,
          steps
        })
      } else {
        updated.push(recipe)
      }
    } catch (err) {
      console.warn("Errore enrichment per:", recipe.title || recipe.id || "?", "-", err.message)
      updated.push(recipe)
    }
  }

  const out = {
    schemaVersion: data.schemaVersion || 1,
    generatedAt: new Date().toISOString(),
    recipes: updated
  }

  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf8")
  console.log("Enrichment completato. Ricette:", updated.length)
}

async function extractStepsFromUrl(url) {
  const res = await fetch(url, { redirect: "follow" })
  if (!res.ok) {
    console.warn("Richiesta fallita", url, res.status)
    return []
  }

  const html = await res.text()
  const $ = cheerio.load(html)

  const candidates = []

  $("ol li").each((_, el) => {
    const text = $(el).text().trim()
    if (text.length > 20) candidates.push(text)
  })

  if (candidates.length === 0) {
    $("h2, h3, h4").each((_, el) => {
      const title = $(el).text().toLowerCase()
      if (title.includes("preparazione") || title.includes("procedimento")) {
        const steps = []
        let node = $(el).next()
        while (node.length) {
          const tag = node.get(0).tagName
          const text = node.text().trim()
          if (!text) {
            node = node.next()
            continue
          }
          if (tag === "p" || tag === "li") {
            steps.push(text)
            node = node.next()
            continue
          }
          break
        }
        if (steps.length > 0) {
          candidates.push(...steps)
        }
      }
    })
  }

  const cleaned = candidates
    .map(s => s.replace(/\s+/g, " ").trim())
    .filter(s => s.length > 15)

  return cleaned
}

main().catch(err => {
  console.error("Errore enrichment:", err)
  process.exit(1)
})
