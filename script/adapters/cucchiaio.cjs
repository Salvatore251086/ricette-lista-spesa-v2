// script/adapters/cucchiaio.cjs
// Adapter per ricette prese da www.cucchiaio.it

const { loadHtml, textList, cleanText } = require("./shared.cjs");

const HOST = "www.cucchiaio.it";

function matches(url) {
  try {
    const u = new URL(url);
    return u.hostname === HOST && u.pathname.includes("/ricetta/");
  } catch {
    return false;
  }
}

async function enrich(recipe) {
  if (!recipe.url || !matches(recipe.url)) {
    // l'orchestratore gestisce il caso "nessun arricchimento"
    return recipe;
  }

  const $ = await loadHtml(recipe.url);

  // Ingredienti: diversi layout possibili, proviamo in ordine
  const ingredients =
    textList($, ".recipe-ingredients__list li") ||
    textList($, ".ingredients-list li") ||
    textList($, ".scheda-ingredienti li");

  // Passaggi di preparazione
  const steps =
    textList($, ".recipe-preparation__steps li") ||
    textList($, ".recipe-preparation__steps p") ||
    textList($, ".preparazione-ricetta li") ||
    textList($, ".preparazione-ricetta p");

  const difficulty = cleanText(
    $(
      ".recipe-infos__difficulty, .scheda-ricetta__difficolta, .difficulty"
    )
      .first()
      .text()
  );

  const prepTime = cleanText(
    $(".recipe-infos__time, .scheda-ricetta__preparazione, .preptime")
      .first()
      .text()
  );

  const servings = cleanText(
    $(".recipe-infos__people, .scheda-ricetta__persone, .servings")
      .first()
      .text()
  );

  const updated = { ...recipe };

  if (ingredients && ingredients.length) {
    updated.ingredients = ingredients;
  }

  if (steps && steps.length) {
    updated.steps = steps;
  }

  if (difficulty) updated.difficulty = difficulty;
  if (prepTime) updated.prepTime = prepTime;
  if (servings) updated.servings = servings;

  if (!updated.meta) updated.meta = {};
  updated.meta.cucchiaio = {
    used: true,
    url: recipe.url,
  };

  return updated;
}

module.exports = {
  id: "cucchiaio",
  matches,
  enrich,
};
