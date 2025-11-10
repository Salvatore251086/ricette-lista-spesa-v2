// script/adapters/shared.cjs
// Helper condivisi per tutti gli adapter di scraping ricette

const cheerio = require("cheerio")

// Usa fetch globale se esiste, altrimenti prova a richiamare node-fetch
let fetchImpl = null

try {
  if (typeof fetch === "function") {
    fetchImpl = fetch
  } else {
    fetchImpl = require("node-fetch")
  }
} catch {
  fetchImpl = require("node-fetch")
}

if (typeof global.fetch !== "function") {
  global.fetch = (...args) => fetchImpl(...args)
}

async function fetchHtml(url) {
  if (!url) {
    throw new Error("URL mancante in fetchHtml")
  }

  const res = await fetchImpl(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RicetteListaSpesaBot/1.0; +https://github.com/Salvatore251086/ricette-lista-spesa-v2)"
    },
    redirect: "follow"
  })

  if (!res.ok) {
    throw new Error(`Richiesta fallita ${res.status} per ${url}`)
  }

  const html = await res.text()
  return html
}

function loadCheerio(html) {
  return cheerio.load(html)
}

function cleanText(text) {
  if (!text) return ""
  return String(text)
    .replace(/\s+/g, " ")
    .trim()
}

function nonEmptyLines(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .map(t => cleanText(t))
    .filter(t => t.length > 0)
}

module.exports = {
  fetchHtml,
  loadCheerio,
  cleanText,
  nonEmptyLines
}
