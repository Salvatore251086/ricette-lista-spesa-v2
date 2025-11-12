#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));

const filePath = path.join(__dirname, '../assets/json/recipes-it.enriched.json');

(async () => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const recipes = Array.isArray(data.recipes) ? data.recipes : data;

  const updated = [];
  let okCount = 0;
  let badCount = 0;

  for (const r of recipes) {
    const candidate =
      r.videoUrl || r.video_url || r.video || r.youtube || null;

    if (!candidate) {
      // niente video dichiarato
      updated.push(r);
      continue;
    }

    // check rapido sintattico
    let isValid = false;
    try {
      const u = new URL(candidate);
      const host = u.hostname.replace(/^www\./, '');
      if (['youtube.com', 'youtu.be', 'vimeo.com'].includes(host)) {
        isValid = true;
      }
    } catch {
      isValid = false;
    }

    if (!isValid) {
      badCount++;
      const clean = { ...r };
      delete clean.videoUrl;
      delete clean.video_url;
      delete clean.video;
      delete clean.youtube;
      updated.push(clean);
      continue;
    }

    // opzionale: HEAD/GET leggero per vedere se risponde (best effort)
    try {
      const res = await fetch(candidate, { method: 'HEAD' });
      if (res.ok) {
        okCount++;
        updated.push({ ...r, videoUrl: candidate });
      } else {
        badCount++;
        const clean = { ...r };
        delete clean.videoUrl;
        delete clean.video_url;
        delete clean.video;
        delete clean.youtube;
        updated.push(clean);
      }
    } catch {
      badCount++;
      const clean = { ...r };
      delete clean.videoUrl;
      delete clean.video_url;
      delete clean.video;
      delete clean.youtube;
      updated.push(clean);
    }
  }

  const out = Array.isArray(data.recipes)
    ? { ...data, recipes: updated }
    : updated;

  fs.writeFileSync(filePath, JSON.stringify(out, null, 2));
  console.log(`Video validi: ${okCount}, rimossi/non validi: ${badCount}`);
})();
