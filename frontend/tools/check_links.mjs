// tools/check_links.mjs
// Controllo ricette pubblicate in Strapi: titolo, fonte, videoId

const STRAPI_URL =
  'http://localhost:1337/api/recipes?pagination[pageSize]=100';

// Helper semplice per log
function line() {
  console.log('----------------------------------------');
}

async function fetchAllPublishedRecipes() {
  console.log('Scarico ricette da Strapi');

  const res = await fetch(STRAPI_URL);
  if (!res.ok) {
    throw new Error(`Fetch Strapi HTTP ${res.status}`);
  }

  const json = await res.json();
  const data = Array.isArray(json.data) ? json.data : [];

  // prendo solo quelle pubblicate
  const published = data.filter(
    (item) =>
      item &&
      item.attributes &&
      item.attributes.publishedAt
  );

  console.log(
    `Totale ricevute: ${data.length}, pubblicate: ${published.length}`
  );

  return published.map((item) => {
    const a = item.attributes || {};
    return {
      id: item.id,
      title: (a.title || '').trim(),
      sourceUrl: (a.sourceUrl || '').trim(),
      videoId: (a.videoId || '').trim(),
    };
  });
}

function findProblems(recipes) {
  const problems = [];

  for (const r of recipes) {
    const missing = [];

    if (!r.title) missing.push('Titolo');
    if (!r.sourceUrl) missing.push('Fonte');
    if (!r.videoId) missing.push('VideoId');

    if (missing.length > 0) {
      problems.push({ ...r, missing });
    }
  }

  return problems;
}

async function main() {
  try {
    const recipes = await fetchAllPublishedRecipes();
    const problems = findProblems(recipes);

    if (problems.length === 0) {
      line();
      console.log(
        `Nessun problema trovato su ${recipes.length} ricette pubblicate.`
      );
      line();
      return;
    }

    line();
    console.log('Ricette con problemi trovate');
    line();

    for (const r of problems) {
      console.log(`ID        ${r.id}`);
      console.log(`Titolo    ${r.title || 'senza titolo'}`);
      for (const m of r.missing) {
        console.log(`${m.padEnd(9)} mancante -> missing`);
      }
      line();
    }
  } catch (err) {
    console.error('Errore esecuzione script:', err);
  }
}

main();
