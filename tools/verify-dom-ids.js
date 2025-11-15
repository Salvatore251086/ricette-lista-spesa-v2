// tools/verify-dom-ids.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(INDEX, 'utf8');

// ID attesi dall’app
const required = [
  'search',
  'updateDataBtn',
  'favoritesToggle',
  'recipeCount',
  'recipes',
  'videoModal',
  'videoFrame',
  'closeVideo'
];

const missing = required.filter(id => !html.includes(`id="${id}"`));

if (missing.length) {
  fs.mkdirSync(path.join(__dirname, '..', 'reports'), { recursive: true });
  fs.writeFileSync(
    path.join(__dirname, '..', 'reports', 'dom-missing.json'),
    JSON.stringify({ missing }, null, 2)
  );
  console.error('DOM mancante:', missing);
  process.exit(1);
} else {
  console.log('DOM ok');
}
