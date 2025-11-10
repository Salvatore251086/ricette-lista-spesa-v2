const { JSDOM } = require('jsdom');

/**
 * Utility: testo pulito
 */
function t(node) {
  if (!node) return '';
  return node.textContent.replace(/\s+/g, ' ').trim();
}

/**
 * Prova a leggere eventuale JSON-LD di tipo Recipe.
 */
function tryJSONLD(doc) {
  const scripts = Array.from(
    doc.querySelectorAll('script[type="application/ld+json"]')
  );

  for (const s of scripts) {
    let data;
    try {
      data = JSON.parse(s.textContent);
    } catch {
      continue;
    }

    // gestisci sia singolo oggetto che array
    const items = Array.isArray(data) ? data : [data];
    const recipe = items.find(
      (it) =>
        it &&
        (it['@type'] === 'Recipe' ||
          (Array.isArray(it['@type']) && it['@type'].includes('Recipe')))
    );

    if (recipe) {
      return {
        title: recipe.name || null,
        ingredients: recipe.recipeIngredient || [],
        steps:
          (recipe.recipeInstructions || [])
            .map((step) =>
              typeof step === 'string'
                ? step
                : step.text || step.name || ''
            )
            .filter(Boolean) || [],
      };
    }
  }

  return null;
}

/**
 * Estrarre ingredienti dall'HTML (fallback quando manca JSON-LD).
 */
function extractIngredients(doc) {
  const headings = Array.from(doc.querySelectorAll('h2,h3,h4,h5'));
  const ingHeader = headings.find((h) =>
    /ingredienti/i.test(h.textContent)
  );
  if (!ingHeader) return [];

  const ingredients = [];
  let node = ingHeader.nextElementSibling;

  while (node) {
    const text = t(node);

    // stop quando arriviamo alla parte di preparazione o altre sezioni
    if (
      /come preparare/i.test(text) ||
      /scopri altre ricette/i.test(text) ||
      node.matches('h2,h3,h4,h5')
    ) {
      break;
    }

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

/**
 * Estrarre steps dalla sezione "Come preparare".
 */
function extractSteps(doc) {
  const headings = Array.from(doc.querySelectorAll('h2,h3,h4,h5'));
  const prepHeader = headings.find((h) =>
    /come preparare/i.test(h.textContent)
  );
  if (!prepHeader) return [];

  const steps = [];
  let node = prepHeader.nextElementSibling;
  let current = [];

  while (node) {
    const text = t(node);

    if (
      node.matches('h2,h3,h4,h5') ||
      /scopri altre ricette/i.test(text)
    ) {
      break;
    }

    if (!text) {
      node = node.nextElementSibling;
      continue;
    }

    // righe che sono solo "1", "2", "3"... separano i passi
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

/**
 * Adapter principale
 * Input: { url }
 * Output:
 *   - null se l'URL non è del Cucchiaio o non riusciamo a leggere niente
 *   - oggetto con almeno una di: title / ingredients / steps
 */
async function enrich({ url }) {
  if (!url || !url.includes('cucchiaio.it/ricetta/')) {
    return null;
  }

  const res = await fetch(url);

  if (!res.ok) {
    console.error(
      `[adapter:cucchiaio] HTTP ${res.status} per ${url}`
    );
    return null;
  }

  const html = await res.text();
  const dom = new JSDOM(html);
  const { document } = dom.window;

  // 1) tentativo JSON-LD
  const fromLD = tryJSONLD(document);

  let title = document.querySelector('h1')
    ? t(document.querySelector('h1'))
    : fromLD?.title || null;

  let ingredients = fromLD?.ingredients || extractIngredients(document);
  let steps = fromLD?.steps || extractSteps(document);

  if (!title && !ingredients.length && !steps.length) {
    console.warn(
      `[adapter:cucchiaio] Nessun dato utile estratto per ${url}`
    );
    return null;
  }

  return {
    source: 'cucchiaio',
    url,
    ...(title ? { title } : {}),
    ...(ingredients.length ? { ingredients } : {}),
    ...(steps.length ? { steps } : {}),
  };
}

module.exports = { enrich };
