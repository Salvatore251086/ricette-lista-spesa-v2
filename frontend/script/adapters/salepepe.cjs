// script/adapters/salepepe.cjs

const cheerio = require("cheerio")

function normalize(str) {
  if (!str) return ""
  return String(str).replace(/\s+/g, " ").trim()
}

function parseDuration(value) {
  if (!value || typeof value !== "string") return null
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value.trim())
  if (!m) return null
  const days = parseInt(m[1] || "0", 10)
  const hours = parseInt(m[2] || "0", 10)
  const minutes = parseInt(m[3] || "0", 10)
  const seconds = parseInt(m[4] || "0", 10)
  const total = days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60)
  return total || null
}

function extractFromLdJson(html) {
  const $ = cheerio.load(html)
  const scripts = $('script[type="application/ld+json"]')
  const blocks = []

  scripts.each((_, el) => {
    const raw = $(el).contents().text()
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) blocks.push(...parsed)
      else blocks.push(parsed)
    } catch {
      // ignora
    }
  })

  if (!blocks.length) return null
  const recipe = blocks.find(b => {
    const t = b && b["@type"]
    if (!t) return false
    if (typeof t === "string") return t.toLowerCase() === "recipe"
    if (Array.isArray(t)) {
      return t.some(v => typeof v === "string" && v.toLowerCase() === "recipe")
    }
    return false
  })

  if (!recipe) return null

  const title = normalize(recipe.name || "")

  const ingredients = []
  if (Array.isArray(recipe.recipeIngredient)) {
    recipe.recipeIngredient.forEach(i => {
      const t = normalize(i)
      if (t) ingredients.push(t)
    })
  }

  const steps = []
  const pushStep = txt => {
    const t = normalize(txt)
    if (t.length > 4) steps.push(t)
  }

  const inst = recipe.recipeInstructions
  if (Array.isArray(inst)) {
    inst.forEach(s => {
      if (!s) return
      if (typeof s === "string") pushStep(s)
      else if (typeof s === "object") pushStep(s.text || s.name || s.description)
    })
  }

  const prepTime = parseDuration(recipe.prepTime)
  const cookTime = parseDuration(recipe.cookTime)
  const totalTime =
    parseDuration(recipe.totalTime) ||
    (prepTime || 0) + (cookTime || 0) ||
    null

  return {
    title,
    ingredients,
    steps,
    servings: null,
    prepTime: prepTime || null,
    cookTime: cookTime || null,
    totalTime: totalTime || null,
    difficulty: null,
    videoUrl: null
  }
}

async function parseSalePepe(url) {
  if (!url) throw new Error("URL mancante per Sale&Pepe")

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 RLSpesaBot/1.0",
      Accept: "text/html,application/xhtml+xml"
    }
  })

  if (!res.ok) throw new Error("HTTP " + res.status + " per " + url)
  const html = await res.text()

  const fromLd = extractFromLdJson(html)
  if (fromLd && fromLd.title) {
    return {
      source: "salepepe.it",
      url,
      ...fromLd
    }
  }

  return {
    source: "salepepe.it",
    url,
    title: "",
    ingredients: [],
    steps: [],
    servings: null,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    difficulty: null,
    videoUrl: null
  }
}

module.exports = { parseSalePepe }
