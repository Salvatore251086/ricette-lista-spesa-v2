// script/adapters/giallozafferano.cjs
// Adapter per www.giallozafferano.it

const cheerio = require("cheerio")

function normalizeText(str) {
  if (!str) return ""
  return String(str).replace(/\s+/g, " ").trim()
}

function parseDurationToMinutes(value) {
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

function pickRecipeNode(blocks) {
  const flat = []

  blocks.forEach(b => {
    if (!b) return
    if (Array.isArray(b["@graph"])) flat.push(...b["@graph"])
    else flat.push(b)
  })

  function isRecipe(node) {
    if (!node) return false
    const t = node["@type"]
    if (!t) return false
    if (typeof t === "string") return t.toLowerCase() === "recipe"
    if (Array.isArray(t)) {
      return t.some(v => typeof v === "string" && v.toLowerCase() === "recipe")
    }
    return false
  }

  return (
    flat.find(isRecipe) ||
    blocks.find(isRecipe) ||
    (flat.length === 1 && isRecipe(flat[0]) ? flat[0] : null)
  )
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
  const recipe = pickRecipeNode(blocks)
  if (!recipe) return null

  const title = normalizeText(recipe.name || "")

  const ingredients = []
  if (Array.isArray(recipe.recipeIngredient)) {
    recipe.recipeIngredient.forEach(i => {
      const t = normalizeText(i)
      if (t) ingredients.push(t)
    })
  }

  const steps = []
  const inst = recipe.recipeInstructions
  const pushStep = txt => {
    const t = normalizeText(txt)
    if (t.length > 4) steps.push(t)
  }

  if (Array.isArray(inst)) {
    inst.forEach(s => {
      if (!s) return
      if (typeof s === "string") pushStep(s)
      else if (typeof s === "object") pushStep(s.text || s.name || s.description)
    })
  } else if (typeof inst === "string") {
    inst
      .split(/[\r\n]+|\. /)
      .map(s => s.trim())
      .forEach(pushStep)
  }

  let servings = null
  const ry = recipe.recipeYield
  if (typeof ry === "string") {
    const m = ry.match(/(\d+)/)
    if (m) servings = parseInt(m[1], 10)
  }

  const prepTime = parseDurationToMinutes(recipe.prepTime)
  const cookTime = parseDurationToMinutes(recipe.cookTime)
  const totalTime =
    parseDurationToMinutes(recipe.totalTime) ||
    (prepTime || 0) + (cookTime || 0) ||
    null

  let difficulty = null
  if (typeof recipe.recipeCategory === "string") {
    const low = recipe.recipeCategory.toLowerCase()
    if (low.includes("facile")) difficulty = "easy"
    else if (low.includes("media")) difficulty = "medium"
    else if (low.includes("difficile")) difficulty = "hard"
  }

  let videoUrl = null
  if (recipe.video) {
    const v = recipe.video
    if (typeof v === "string") videoUrl = v
    else if (typeof v === "object") {
      videoUrl = v.embedUrl || v.contentUrl || v.url || null
    }
  }

  return {
    title,
    ingredients,
    steps,
    servings: servings || null,
    prepTime: prepTime || null,
    cookTime: cookTime || null,
    totalTime: totalTime || null,
    difficulty: difficulty || null,
    videoUrl: videoUrl || null
  }
}

async function parseGialloZafferano(url) {
  if (!url) throw new Error("URL mancante per Giallo Zafferano")

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 RLSpesaBot/1.0",
      Accept: "text/html,application/xhtml+xml"
    }
  })

  if (!res.ok) throw new Error("HTTP " + res.status + " per " + url)
  const html = await res.text()

  const fromLd = extractFromLdJson(html)
  if (fromLd && fromLd.title) {
    return {
      source: "giallozafferano.it",
      url,
      ...fromLd
    }
  }

  return {
    source: "giallozafferano.it",
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

module.exports = { parseGialloZafferano }
