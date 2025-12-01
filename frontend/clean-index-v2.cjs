const fs = require('fs');

// Leggi database ricette
const db = JSON.parse(fs.readFileSync('assets/json/recipes-it.json', 'utf8'));

// Crea set di URL e slug già importati
const importedUrls = new Set();
db.recipes.forEach(r => {
  if (r.sourceUrl) importedUrls.add(r.sourceUrl);
  if (r.slug) {
    // Ricostruisci possibili URL dalla slug
    importedUrls.add('https://ricette.giallozafferano.it/' + r.slug + '.html');
    importedUrls.add('https://www.cucchiaio.it/ricetta/' + r.slug + '/');
  }
});

console.log('Pattern da escludere:', importedUrls.size);

// Leggi indice
const index = fs.readFileSync('assets/json/recipes-index.jsonl', 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(line => JSON.parse(line));

console.log('URL indice prima:', index.length);

// Filtra URL non ancora importati
const newIndex = index.filter(record => !importedUrls.has(record.url));

console.log('URL indice dopo:', newIndex.length);
console.log('Duplicati rimossi:', index.length - newIndex.length);

// Salva indice pulito
fs.writeFileSync('assets/json/recipes-index.jsonl', 
  newIndex.map(r => JSON.stringify(r)).join('\n')
);

console.log('Indice pulito salvato!');
