// script/enrich-recipes.cjs
// Enrichment automatico: estrae steps e metadati da www.cucchiaio.it con Puppeteer

const fs = require("fs")
const path = require("path")
const puppeteer = require("puppeteer")

const INPUT_PATH = path.join(__dirname, "..", "assets", "json", "recipes-it.json")
const OUTPUT_PATH = path.join(__dirname, "..", "assets", "json", "recipes-it.enriched.json")

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome RLSpesaBot/1.0"

const TIMEOUT_MS = 20000

function parseDurationToMinutes(value) {
  if (!value || typeof value !== "string") return null
  const m =
    /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value.trim())
  if (!m) return null
  const days = parseInt(m[1] || "0", 10)
  const hours = parseInt(m[2] || "0", 10)
  const minutes = parseInt(m[3] || "0", 10)
  const seconds = parseInt(m[4] || "0", 10)
  const total = days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60)
  return total || null
}

async function enrichFromCucchiaio(browser, recipe) {
  const url = recipe.url
  const page = await browser.newPage()
  try {
    await page.setUserAgent(USER_AGENT)
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: TIMEOUT_MS
    })

    const data = await page.evaluate(() => {
      function safeParse(jsonText) {
        try {
          return JSON.parse(jsonText)
        } catch {
          return null
        }
      }

      function flatten(nodes) {
        const out = []
        nodes.forEach(n => {
          if (!n) return
          if (Array.isArray(n["@graph"])) out.push(...n["@graph"])
          else out.push(n)
        })
        return out
      }

      function isRecipe(node) {
        const t = node && node["@type"]
        if (!t) return false
        if (typeof t === "string") return t.toLowerCase() === "recipe"
        if (Array.isArray(t)) {
          return t.some(
            v => typeof v === "string" && v.toLowerCase() === "recipe"
          )
        }
        return false
      }

      function parseDurationToMinutesLocal(value) {
        if (!value || typeof value !== "string") return null
        const m =
          /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(
            value.trim()
          )
        if (!m) return null
        const days = parseInt(m[1] || "0", 10)
        const hours = parseInt(m[2] || "0", 10)
        const minutes = parseInt(m[3] || "0", 10)
        const seconds = parseInt(m[4] || "0", 10)
        const total =
          days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60)
        return total || null
      }

      function extractSteps(inst) {
        const steps = []
        const push = txt => {
          if (!txt) return
          const s = String(txt).replace(/\s+/g, " ").trim()
          if (s.length > 4) steps.push(s)
        }

        if (!inst) return steps

        if (Array.isArray(inst)) {
          inst.forEach(step => {
            if (!step) return
            if (typeof step === "string") {
              push(step)
            } else if (typeof step === "object") {
              push(step.text || step.name || step.description)
            }
          })
        } else if (typeof inst === "string") {
          inst.split(/[\r\n]+|\. /).forEach(push)
        }

        return steps
      }

      const scripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      )

      const jsonBlocks = []
      for (const s of scripts) {
        const txt = s.textContent || s.innerText || ""
        const parsed = safeParse(txt)
        if (!parsed) continue
        if (Array.isArray(parsed)) jsonBlocks.push(...parsed)
        else jsonBlocks.push(parsed)
      }

      const flat = flatten(jsonBlocks)
      let recipeNode =
        flat.find(isRecipe) || jsonBlocks.find(isRecipe) || null

      if (!recipeNode && flat.length === 1 && isRecipe(flat[0])) {
        recipeNode = flat[0]
      }

      if (!recipeNode) {
        return {
          steps: [],
          servings: null,
          prepTime: null,
          cookTime: null,
          totalTime: null
        }
      }

      const steps = extractSteps(recipeNode.recipeInstructions)

      let servings = null
      const ry = recipeNode.recipeYield
      if (typeof ry === "string") {
        const m = ry.match(/(\d+)/)
        if (m) servings = parseInt(m[1], 10)
      } else if (Array.isArray(ry)) {
        const txt = ry.join(" ")
        const m = txt.match(/(\d+)/)
        if (m) servings = parseInt(m[1], 10)
      }

      const prepTime = parseDurationToMinutesLocal(
        recipeNode.prepTime || recipeNode.preparationTime
      )
      const cookTime = parseDurationToMinutesLocal(recipeNode.cookTime)
      const totalTime =
        parseDurationToMinutesLocal(recipeNode.totalTime) ||
        (prepTime || 0) + (cookTime || 0) ||
        null

      return {
        steps,
        servings: servings || null,
        prepTime: prepTime || null,
        cookTime: cookTime || null,
        totalTime: totalTime || null
      }
    })

    await page.close()

    if (!data || !Array.isArray(data.steps) || data.steps.length === 0) {
      return { recipe, enriched: false }
    }

    const merged = {
      ...recipe,
      steps: data.steps,
      servings: data.servings != null ? data.servings : recipe.servings || null,
      prepTime:
        data.prepTime != null ? data.prepTime : recipe.prepTime || null,
      cookTime:
        data.cookTime != null ? data.cookTime : recipe.cookTime || null,
      totalTime:
        data.totalTime != null ? data.totalTime : recipe.totalTime || null,
      meta: {
        ...(recipe.meta || {}),
        enriched: true,
        source: "cucchiaio.it"
      }
    }

    return { recipe: merged, enriched: true }
  } catch (err) {
    await page.close()
    const failed = {
      ...recipe,
      meta: {
        ...(recipe.meta || {}),
        enrichError: String(err.message || err)
      }
    }
    return { recipe: failed, enriched: false }
  }
}

async function enrichAll() {
  const raw = fs.readFileSync(INPUT_PATH, "utf8")
  const data = JSON.parse(raw)
  const recipes = Array.isArray(data.recipes) ? data.recipes : data

  console.log("Ricette in ingresso:", recipes.length)

const browser = await puppeteer.launch({
  headless: true,
  executablePath: puppeteer.executablePath(),
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-software-rasterizer"
  ]
})

  const result = []
  let enrichedCount = 0

  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i]
    let enrichedRecipe = r
    let enriched = false

    try {
      const url = r.url || ""
      const hostname = url ? new URL(url).hostname.replace(/^www\./, "") : ""

      if (hostname === "cucchiaio.it") {
        const res = await enrichFromCucchiaio(browser, r)
        enrichedRecipe = res.recipe
        enriched = res.enriched
      }

      // altri domini importanti li aggiungeremo qui con funzioni dedicate

    } catch (err) {
      enrichedRecipe = {
        ...r,
        meta: {
          ...(r.meta || {}),
          enrichError: String(err.message || err)
        }
      }
      enriched = false
    }

    if (enriched) enrichedCount++
    result.push(enrichedRecipe)

    if (i % 25 === 0) {
      console.log(
        "Processate",
        i,
        "su",
        recipes.length,
        "| arricchite finora:",
        enrichedCount
      )
    }
  }

  await browser.close()

  const wrapped = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    recipes: result
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(wrapped, null, 2), "utf8")

  console.log("Enrichment completato.")
  console.log("Ricette totali:", recipes.length)
  console.log("Ricette con steps:", enrichedCount)
  console.log("File scritto:", OUTPUT_PATH)
}

enrichAll().catch(err => {
  console.error("Errore enrichment:", err)
  process.exit(1)
})
