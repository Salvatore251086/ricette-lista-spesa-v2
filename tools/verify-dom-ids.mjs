import { readFile } from "fs/promises"
import path from "path"

const cwd = process.cwd()
const indexPath = path.resolve(cwd, "index.html")

const requiredIds = [
  "searchInput",
  "updateDataBtn",
  "favoritesToggle",
  "recipeCount",
  "recipesContainer",
  "videoModal",
  "videoFrame",
  "closeVideo"
]

const requiredScripts = [
  "app.v18.js"
]

function hasId(html, id) {
  const re = new RegExp(`id=["']${id}["']`, "i")
  return re.test(html)
}

function hasScript(html, src) {
  const re = new RegExp(`<script[^>]+src=["']${src}["']`, "i")
  return re.test(html)
}

try {
  const html = await readFile(indexPath, "utf8")

  const missingIds = requiredIds.filter(id => !hasId(html, id))
  const missingScripts = requiredScripts.filter(s => !hasScript(html, s))

  if (missingIds.length === 0 && missingScripts.length === 0) {
    console.log("✅ DOM OK e script OK")
    process.exit(0)
  }

  if (missingIds.length) {
    console.error("❌ ID mancanti:", missingIds.join(", "))
  }
  if (missingScripts.length) {
    console.error("❌ Script mancanti:", missingScripts.join(", "))
  }
  process.exit(1)
} catch (err) {
  console.error("Errore lettura index.html:", err.message)
  process.exit(2)
}
