const fs = require('fs')
const path = require('path')

const BASE = path.join(__dirname, '..', 'assets', 'json')
const RAW = path.join(BASE, 'video_index.raw.json')
const RESOLVED = path.join(BASE, 'video_index.resolved.json')
const OUT = RESOLVED

function readArray(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8')
    const data = JSON.parse(txt)
    return Array.isArray(data) ? data : []
  } catch (e) {
    return []
  }
}

function norm(str) {
  return String(str || '').trim()
}

function dedup(list) {
  const seen = new Set()
  const out = []

  for (const v of list) {
    const slug = norm(v.slug)
    const yt = norm(v.youtubeId)
    const key = slug || yt
    if (!key) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }

  return out
}

function merge(resolved, raw) {
  const merged = [...resolved, ...raw]
  const clean = dedup(merged)
  clean.sort((a, b) => norm(a.title).localeCompare(norm(b.title)))
  return clean
}

const resolved = readArray(RESOLVED)
const raw = readArray(RAW)

console.log('Video già risolti:', resolved.length)
console.log('Video in raw:', raw.length)

const merged = merge(resolved, raw)

fs.writeFileSync(OUT, JSON.stringify(merged, null, 2), 'utf8')

console.log('Video totali unificati:', merged.length)
console.log('Aggiornato:', OUT)