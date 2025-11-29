// script/update_video_index.mjs

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const VIDEO_INDEX_PATH = path.join(ROOT, 'assets', 'json', 'video_index.manual.json');

const NEW_VIDEOS = [
  // Esempio, sostituisci con i tuoi dati reali
  {
    slug: 'spaghetti-alle-vongole-e-bottarga-di-tonno',
    yt_id: 'YOUTUBE_ID_QUI',
    title: 'Spaghetti alle vongole e bottarga di tonno',
    note: 'Ricetta TOP monitorata',
  },
  // Aggiungi qui altre ricette TOP, una per riga
  // {
  //   slug: 'maccheroncini-con-carbonara-alla-majonese',
  //   yt_id: 'ALTRO_ID',
  //   title: 'Maccheroncini con carbonara alla majonese',
  //   note: 'Ricetta TOP monitorata',
  // },
];

function loadManualIndex() {
  if (!fs.existsSync(VIDEO_INDEX_PATH)) {
    return {
      schema: 2,
      updated_at: new Date().toISOString(),
      by_title: {},
      by_slug: {},
    };
  }

  const raw = fs.readFileSync(VIDEO_INDEX_PATH, 'utf8');
  const json = JSON.parse(raw);

  if (!json.by_slug) json.by_slug = {};
  if (!json.by_title) json.by_title = {};

  return json;
}

function saveManualIndex(data) {
  data.updated_at = new Date().toISOString();
  const out = JSON.stringify(data, null, 2);
  fs.writeFileSync(VIDEO_INDEX_PATH, out, 'utf8');
  console.log(`File aggiornato: ${VIDEO_INDEX_PATH}`);
}

function applyNewVideos(data) {
  let count = 0;

  for (const v of NEW_VIDEOS) {
    if (!v.slug || !v.yt_id) {
      console.warn(`Salto voce senza slug o yt_id valido:`, v);
      continue;
    }

    data.by_slug[v.slug] = {
      yt_id: v.yt_id,
      title: v.title || '',
      note: v.note || '',
      priority: 10,
      added_at: new Date().toISOString(),
      source: 'manual',
    };

    count += 1;
  }

  console.log(`Video aggiornati o aggiunti: ${count}`);
}

function main() {
  const data = loadManualIndex();
  applyNewVideos(data);
  saveManualIndex(data);
}

main();
