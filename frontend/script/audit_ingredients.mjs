import { readFile, writeFile } from 'fs/promises'
import path from 'path'

const filePath = path.join(process.cwd(), 'assets', 'json', 'recipes-it.json')
const reportPath = path.join(process.cwd(), 'logs', 'missing_ingredients.json')

async function main() {
  const raw = await readFile(filePath, 'utf8')
  const data = JSON.parse(raw)

  const recipesArray = Array.isArray(data) ? data : data.recipes
  if (!Array.isArray(recipesArray)) {
    console.error('Formato recipes-it.json inatteso')
    return
  }

  const missing = []

  for (const r of recipesArray) {
    if (!r) continue
    const slug = r.slug || ''
    const title = r.title || ''
    const url = r.url || ''
    const ing = r.ingredients

    let empty = false

    if (ing == null) {
      empty = true
    } else if (Array.isArray(ing) && ing.length === 0) {
      empty = true
    } else if (typeof ing === 'string' && ing.trim() === '') {
      empty = true
    }

    if (empty) {
      missing.push({ title, slug, url })
    }
  }

  console.log('Ricette senza ingredienti o ingredienti vuoti:', missing.length)
  missing.forEach(r => {
    console.log(' -', r.title || '(senza titolo)', '|', r.slug || '(no slug)')
  })

  try {
    await writeFile(reportPath, JSON.stringify(missing, null, 2) + '\n', 'utf8')
    console.log('Report salvato in', reportPath)
  } catch (err) {
    console.warn('Non riesco a scrivere il report in logs/, cartella forse mancante')
  }
}

main().catch(err => {
  console.error('Errore audit_ingredients', err)
})
