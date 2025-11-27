const fs = require("fs")

// Percorso del file normalizzato
const inputPath = "assets/json/recipes-it.json"

// Leggi e analizza il JSON
const raw = fs.readFileSync(inputPath, "utf8")
const data = JSON.parse(raw)
const recipes = Array.isArray(data.recipes) ? data.recipes : data

// Filtra le ricette senza preparazione
const missing = recipes.filter(r => !r.steps || r.steps.length === 0)

// Report sintetico
console.log("Totale ricette:", recipes.length)
console.log("Ricette senza preparazione:", missing.length)
console.log("Percentuale:", ((missing.length / recipes.length) * 100).toFixed(1) + "%")

// Elenca i primi titoli mancanti
console.log("\nEsempi:")
missing.slice(0, 10).forEach(r => console.log("- " + (r.title || "Titolo mancante")))
