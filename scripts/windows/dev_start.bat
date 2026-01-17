@echo off
title Sushi Aki Bot - Modo Desenvolvimento
color 0A

echo.
echo  ================================================
echo   SUSHI AKI BOT - Iniciando em Modo Dev
echo  ================================================
echo.

set INSTALL_PATH=C:\SushiAkiBot
set BACKEND_URL=http://localhost:8001

echo Iniciando Backend Python...
start "Sushi Aki - Backend" cmd /k "cd /d %INSTALL_PATH%\backend && call venv\Scripts\activate.bat && uvicorn server:app --host 0.0.0.0 --port 8001 --reload"

echo Aguardando Backend iniciar...
timeout /t 5 /nobreak >nul

echo Iniciando WhatsApp Bot...
start "Sushi Aki - WhatsApp Bot" cmd /k "cd /d %INSTALL_PATH%\backend\whatsapp_bot && set BACKEND_URL=%BACKEND_URL% && node bot.js"

echo.
echo  ================================================
echo   SERVICOS INICIADOS!
echo  ================================================
echo.
echo   Duas janelas foram abertas:
echo   - Backend Python (porta 8001)
echo   - WhatsApp Bot (porta 3001)
echo.
echo   Acesse:
echo   - QR Code: http://localhost:3001
echo   - API: http://localhost:8001/api/status
echo   - Config: http://localhost:8001/api/config
echo.
echo   Para parar, feche as janelas ou pressione Ctrl+C nelas.
echo.
pause
