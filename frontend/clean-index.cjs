const fs = require('fs');

// Leggi database ricette
const db = JSON.parse(fs.readFileSync('assets/json/recipes-it.json', 'utf8'));
const importedUrls = new Set(db.recipes.map(r => r.sourceUrl).filter(Boolean));

console.log('Ricette nel database:', importedUrls.size);

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
