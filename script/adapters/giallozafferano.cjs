const { JSDOM } = require('jsdom');

function t(node) {
  if (!node) return '';
  return node.textContent.replace(/\s+/g, ' ').trim();
}

function tryJSONLD(doc) {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.textContent);
      const items = Array.isArray(data) ? data : [data];
      const recipe = items.find(it =>
        it && (it['@type'] === 'Recipe' || (Array.isArray(it['@type']) && it['@type'].includes('Recipe')))
      );
      if (recipe) {
        return {
          title: recipe.name || null,
          ingredients: recipe.recipeIngredient || [],
          steps: (recipe.recipeInstructions || [])
            .map(st => (typeof st === 'string' ? st : st.text || st.name || ''))
            .filter(Boolean)
        };
      }
    } catch { }
  }
  return null;
}

async function enrich({ url }) {
  if (!url || !url.includes('giallozafferano.it/ricetta/')) return null;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[adapter:giallozafferano] HTTP ${res.status} per ${url}`);
    return null;
  }
  const html = await res.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const fromLD = tryJSONLD(doc);
  const title = doc.querySelector('h1') ? t(doc.querySelector('h1')) : (fromLD?.title || null);
  const ingredients = fromLD?.ingredients || [];
  const steps = fromLD?.steps || [];

  if (!title && !ingredients.length && !steps.length) {
    console.warn(`[adapter:giallozafferano] Nessun dato utile estratto per ${url}`);
    return null;
  }

  return { source: 'giallozafferano', url, title, ingredients, steps };
}

module.exports = { id: 'giallozafferano', enrich };
