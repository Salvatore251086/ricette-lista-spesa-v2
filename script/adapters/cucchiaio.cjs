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

function extractIngredients(doc) {
  const headings = Array.from(doc.querySelectorAll('h2,h3,h4'));
  const ingHeader = headings.find(h => /ingredienti/i.test(h.textContent));
  if (!ingHeader) return [];

  const ingredients = [];
  let node = ingHeader.nextElementSibling;
  while (node) {
    const text = t(node);
    if (!text || /come preparare/i.test(text) || /scopri altre/i.test(text) || node.matches('h2,h3,h4')) break;
    if (node.matches('ul,ol')) {
      for (const li of node.querySelectorAll('li')) {
        const liText = t(li);
        if (liText) ingredients.push(liText);
      }
    }
    node = node.nextElementSibling;
  }
  return ingredients;
}

function extractSteps(doc) {
  const headings = Array.from(doc.querySelectorAll('h2,h3,h4'));
  const prepHeader = headings.find(h => /come preparare/i.test(h.textContent));
  if (!prepHeader) return [];

  const steps = [];
  let node = prepHeader.nextElementSibling;
  let current = [];
  while (node) {
    const text = t(node);
    if (!text || node.matches('h2,h3,h4') || /scopri altre/i.test(text)) break;
    if (/^\d+$/.test(text)) {
      if (current.length) {
        steps.push(current.join(' '));
        current = [];
      }
    } else {
      current.push(text);
    }
    node = node.nextElementSibling;
  }
  if (current.length) steps.push(current.join(' '));
  return steps;
}

async function enrich({ url }) {
  if (!url || !url.includes('cucchiaio.it/ricetta/')) return null;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[adapter:cucchiaio] HTTP ${res.status} per ${url}`);
    return null;
  }
  const html = await res.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const fromLD = tryJSONLD(doc);
  const title = doc.querySelector('h1') ? t(doc.querySelector('h1')) : (fromLD?.title || null);
  const ingredients = fromLD?.ingredients?.length ? fromLD.ingredients : extractIngredients(doc);
  const steps = fromLD?.steps?.length ? fromLD.steps : extractSteps(doc);

  if (!title && !ingredients.length && !steps.length) {
    console.warn(`[adapter:cucchiaio] Nessun dato utile estratto per ${url}`);
    return null;
  }

  return { source: 'cucchiaio', url, title, ingredients, steps };
}

module.exports = { id: 'cucchiaio', enrich };
