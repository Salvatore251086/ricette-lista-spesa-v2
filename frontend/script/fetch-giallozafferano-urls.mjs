#!/usr/bin/env node

/**
 * Script per estrarre URL ricette popolari da GialloZafferano
 * Estrae ricette dalle pagine di categoria e le aggiunge all'indice
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';

const CATEGORIES = [
  'https://ricette.giallozafferano.it/ricette-cat/Primi/',
  'https://ricette.giallozafferano.it/ricette-cat/Secondi-piatti/',
  'https://ricette.giallozafferano.it/ricette-cat/Antipasti/',
  'https://ricette.giallozafferano.it/ricette-cat/Dolci-e-Dessert/',
  'https://ricette.giallozafferano.it/ricette-cat/Lievitati/',
  'https://ricette.giallozafferano.it/ricette-cat/Torte/',
  'https://ricette.giallozafferano.it/ricette-cat/Contorni/',
  'https://ricette.giallozafferano.it/ricette-cat/Piatti-Unici/'
];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchRecipeUrls(categoryUrl, maxRecipes = 50) {
  console.log(`[INFO] Fetching: ${categoryUrl}`);
  
  try {
    const response = await fetch(categoryUrl);
    if (!response.ok) {
      console.log(`[ERROR] HTTP ${response.status} for ${categoryUrl}`);
      return [];
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    const urls = [];
    
    // Trova i link alle ricette
    // GialloZafferano usa diversi selettori per i link ricette
    $('a.gz-title, a[href*="/ricette/"], .gz-card a').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href && href.includes('ricette.giallozafferano.it') && href.includes('.html')) {
        const fullUrl = href.startsWith('http') ? href : `https://ricette.giallozafferano.it${href}`;
        if (!urls.includes(fullUrl)) {
          urls.push(fullUrl);
        }
      }
    });
    
    console.log(`[INFO] Found ${urls.length} recipes in ${categoryUrl}`);
    return urls.slice(0, maxRecipes);
    
  } catch (error) {
    console.log(`[ERROR] Failed to fetch ${categoryUrl}: ${error.message}`);
    return [];
  }
}

async function main() {
  const maxPerCategory = 40; // 40 ricette per categoria = ~320 totali
  const allUrls = new Set();
  
  console.log(`[START] Extracting recipes from ${CATEGORIES.length} categories...`);
  
  for (const categoryUrl of CATEGORIES) {
    const urls = await fetchRecipeUrls(categoryUrl, maxPerCategory);
    urls.forEach(url => allUrls.add(url));
    
    // Pausa tra richieste per non sovraccaricare il server
    await delay(2000);
  }
  
  console.log(`\n[RESULT] Total unique recipes found: ${allUrls.size}`);
  
  // Prepara i record in formato JSONL
  const timestamp = new Date().toISOString();
  const records = Array.from(allUrls).map(url => 
    JSON.stringify({ url, ts: timestamp })
  );
  
  // Leggi l'indice esistente
  const indexPath = 'assets/json/recipes-index.jsonl';
  let existingUrls = new Set();
  
  if (fs.existsSync(indexPath)) {
    const existing = fs.readFileSync(indexPath, 'utf8').split('\n').filter(Boolean);
    existing.forEach(line => {
      try {
        const record = JSON.parse(line);
        existingUrls.add(record.url);
      } catch (e) {}
    });
  }
  
  // Filtra solo URL nuovi
  const newRecords = records.filter(record => {
    const { url } = JSON.parse(record);
    return !existingUrls.has(url);
  });
  
  console.log(`[INFO] New recipes to add: ${newRecords.length}`);
  console.log(`[INFO] Already in index: ${allUrls.size - newRecords.length}`);
  
  if (newRecords.length > 0) {
    // Aggiungi all'indice
    fs.appendFileSync(indexPath, '\n' + newRecords.join('\n'));
    console.log(`[SUCCESS] Added ${newRecords.length} new recipes to ${indexPath}`);
  } else {
    console.log(`[INFO] No new recipes to add`);
  }
  
  // Salva lista completa per riferimento
  fs.writeFileSync('giallozafferano-urls.txt', Array.from(allUrls).join('\n'));
  console.log(`[INFO] Saved all URLs to giallozafferano-urls.txt`);
  
  console.log(`\n[DONE] Process completed!`);
  console.log(`Run: npm run import`);
}

main().catch(console.error);
