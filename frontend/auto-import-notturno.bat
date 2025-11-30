# Ricrea lo script con il percorso CORRETTO
@"
@echo off
cd /d "C:\Users\sasap\Desktop\ricette-paw\ricette-lista-spesa-main\frontend"
echo [%date% %time%] Inizio workflow giornaliero >> log-automazione.txt
call npm run workflow:daily >> log-automazione.txt 2>&1
echo [%date% %time%] Fine workflow >> log-automazione.txt
git add .
git commit -m "🤖 Import automatico %date%" >> log-automazione.txt 2>&1
git push >> log-automazione.txt 2>&1
echo [%date% %time%] Completato! >> log-automazione.txt
"@ | Out-File -FilePath "auto-import-notturno.bat" -Encoding ASCII -Force