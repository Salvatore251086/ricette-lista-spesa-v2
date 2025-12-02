const fs = require('fs');

const db = JSON.parse(fs.readFileSync('assets/json/recipes-it.json', 'utf8'));
const recipes = db.recipes;

console.log('=== ANALISI DATABASE ===');
console.log('Totale ricette:', recipes.length);

// Analizza slug duplicati
const slugs = {};
recipes.forEach(r => {
  const slug = r.slug || 'NO_SLUG';
  slugs[slug] = (slugs[slug] || 0) + 1;
});

const duplicateSlugs = Object.entries(slugs).filter(([k,v]) => v > 1);
console.log('Slug duplicati:', duplicateSlugs.length);

// Analizza title duplicati
const titles = {};
recipes.forEach(r => {
  const title = (r.title || 'NO_TITLE').toLowerCase().trim();
  titles[title] = (titles[title] || 0) + 1;
});

const duplicateTitles = Object.entries(titles).filter(([k,v]) => v > 1);
console.log('Title duplicati:', duplicateTitles.length);

// Controlla quante ricette hanno sourceUrl
const withSource = recipes.filter(r => r.sourceUrl).length;
console.log('Ricette con sourceUrl:', withSource);

// Mostra alcuni esempi di slug
console.log('\n=== ESEMPI SLUG ===');
Object.keys(slugs).slice(0, 10).forEach(slug => {
  console.log(slug);
});
