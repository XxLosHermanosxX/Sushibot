@echo off
title Sushi Aki Bot - Modo Desenvolvimento
color 0B

echo.
echo  ================================================
echo   SUSHI AKI BOT - Modo Desenvolvimento
echo  ================================================
echo.
echo Este script inicia os servicos manualmente para debug.
echo Serao abertas 2 janelas do PowerShell.
echo.
echo Pressione qualquer tecla para iniciar...
pause > nul

echo.
echo Iniciando Backend Python...
start "Sushi Aki - Backend" powershell -NoExit -Command "cd C:\SushiAkiBot\backend; .\venv\Scripts\Activate.ps1; Write-Host 'Backend rodando em http://localhost:8001' -ForegroundColor Green; uvicorn server:app --host 0.0.0.0 --port 8001 --reload"

echo Aguardando Backend iniciar...
timeout /t 5 /nobreak > nul

echo Iniciando WhatsApp Bot...
start "Sushi Aki - WhatsApp Bot" powershell -NoExit -Command "cd C:\SushiAkiBot\backend\whatsapp_bot; $env:BACKEND_URL='http://localhost:8001'; Write-Host 'Bot WhatsApp rodando em http://localhost:3001' -ForegroundColor Green; node bot.js"

echo.
echo  ================================================
echo   MODO DESENVOLVIMENTO INICIADO!
echo  ================================================
echo.
echo Duas janelas do PowerShell foram abertas:
echo   1. Backend Python (porta 8001)
echo   2. WhatsApp Bot (porta 3001)
echo.
echo Para parar: feche as janelas do PowerShell
echo.
echo URLs:
echo   - QR Code: http://localhost:3001
echo   - API: http://localhost:8001/api/status
echo.
pause
