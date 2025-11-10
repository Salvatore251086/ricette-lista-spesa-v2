// script/adapters/shared.cjs
// Helper condivisi per tutti gli adapter multi-fonte.

const cheerio = require("cheerio");

// Scarica HTML e restituisce l'istanza di cheerio
async function loadHtml(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} per ${url}`);
  }
  const html = await res.text();
  return cheerio.load(html);
}

function cleanText(str) {
  if (!str) return "";
  return String(str)
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Estrae testo da un selettore o elemento
function text($, selectorOrEl) {
  if (!selectorOrEl) return "";
  const $el =
    typeof selectorOrEl === "string" ? $(selectorOrEl) : $(selectorOrEl);
  return cleanText($el.text());
}

// Estrae una lista di testi da:
// - un selettore CSS (stringa)
// - una collezione cheerio
function textList($, selectorOrNodes) {
  const out = [];
  if (!selectorOrNodes) return out;

  if (typeof selectorOrNodes === "string") {
    $(selectorOrNodes).each((_, el) => {
      const t = cleanText($(el).text());
      if (t) out.push(t);
    });
  } else {
    // collezione cheerio
    selectorOrNodes.each((_, el) => {
      const t = cleanText($(el).text());
      if (t) out.push(t);
    });
  }

  return out;
}

module.exports = {
  loadHtml,
  cleanText,
  text,
  textList,
};
