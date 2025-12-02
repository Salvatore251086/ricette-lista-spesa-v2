@echo off
cd /d "C:\Users\sasap\Desktop\ricette-paw\ricette-lista-spesa-main\frontend"
echo [%date% %time%] ============================================ >> log-automazione.txt
echo [%date% %time%] Inizio workflow completo >> log-automazione.txt

REM 1. Crawl sitemap per trovare nuovi URL
echo [%date% %time%] STEP 1: Crawl sitemap... >> log-automazione.txt
call npm run crawl >> log-automazione.txt 2>&1

REM 2. Prendi i primi 1000 URL dall'indice e salvali in urls-auto.txt
echo [%date% %time%] STEP 2: Preparo URL da importare (max 1000)... >> log-automazione.txt
node -e "const fs=require('fs');const lines=fs.readFileSync('assets/json/recipes-index.jsonl','utf8').split('\n').filter(Boolean).filter(l=>JSON.parse(l).url.includes('giallozafferano')).slice(0,1000);const urls=lines.map(l=>JSON.parse(l).url).join('\n');fs.writeFileSync('urls-auto.txt',urls);" >> log-automazione.txt 2>&1

REM 3. Import ricette da urls-auto.txt (1000 ricette)
echo [%date% %time%] STEP 3: Import 1000 ricette... >> log-automazione.txt
node script/import-recipes.mjs urls-auto.txt 1000 >> log-automazione.txt 2>&1

REM 4. Merge nel database
echo [%date% %time%] STEP 4: Merge database... >> log-automazione.txt
node script/merge_imported.mjs >> log-automazione.txt 2>&1

REM 5. Risolvi video YouTube
echo [%date% %time%] STEP 5: Risolvi video YouTube... >> log-automazione.txt
call npm run resolve:yt >> log-automazione.txt 2>&1

REM 6. Commit e push
echo [%date% %time%] STEP 6: Commit e push su GitHub... >> log-automazione.txt
git add .
git commit -m "🤖 Import automatico %date% - Crawl + 1000 ricette" >> log-automazione.txt 2>&1
git push >> log-automazione.txt 2>&1

echo [%date% %time%] Completato! >> log-automazione.txt
echo [%date% %time%] ============================================ >> log-automazione.txt