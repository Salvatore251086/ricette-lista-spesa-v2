// frontend/tools/resolve_youtube_ids.mjs
// Usa Node 18 o superiore

import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const INPUT_PATH = path.join(__dirname, '..', 'assets', 'json', 'video_index.manual.json')
const OUTPUT_PATH = path.join(__dirname, '..', 'assets', 'json', 'video_index.resolved.json')

async function main() {
  console.log('Inizio risoluzione ID YouTube…')
  const raw = await fs.readFile(INPUT_PATH, 'utf8')
  const data = JSON.parse(raw)

  const bySlug = data.by_slug || {}
  const resolved = {}

  let okCount = 0
  let failCount = 0

  for (const [slug, entry] of Object.entries(bySlug)) {
    const title = entry.title || slug
    const candidates = [
      entry.primary,
      ...(Array.isArray(entry.backups) ? entry.backups : [])
    ].filter(Boolean)

    if (!candidates.length) {
      console.warn(`Nessun ID candidato per slug ${slug}`)
      failCount++
      continue
    }

    console.log(`\n[${slug}] provo`, candidates.join(', '))

    let chosen = null

    for (const id of candidates) {
      const ok = await isYoutubeEmbeddable(id)
      if (ok) {
        chosen = id
        console.log(`  ✓ OK -> uso ${id}`)
        break
      } else {
        console.log(`  ✗ NON valido: ${id}`)
      }
    }

    if (!chosen) {
      console.warn(`  Nessun ID valido trovato per ${slug}`)
      failCount++
      continue
    }

    resolved[slug] = {
      youtubeId: chosen,
      title
    }
    okCount++
  }

  const out = {
    schema: 1,
    generated_at: new Date().toISOString(),
    by_slug: resolved
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(out, null, 2), 'utf8')
  console.log('\nSalvato video_index.resolved.json in', OUTPUT_PATH)
  console.log(`Ricette con video valido: ${okCount}`)
  console.log(`Ricette senza video valido: ${failCount}`)
}

async function isYoutubeEmbeddable(id) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`

  try {
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) {
      return false
    }
    // se vuoi, potresti leggere il JSON ma non serve
    return true
  } catch (err) {
    console.warn('  Errore rete per', id, err.message)
    return false
  }
}

main().catch(err => {
  console.error('Errore generale script', err)
  process.exit(1)
})
