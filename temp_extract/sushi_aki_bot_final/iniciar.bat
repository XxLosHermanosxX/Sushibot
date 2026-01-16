@echo off
chcp 65001 >nul
title Sushi Aki Bot

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║   🍣 SUSHI AKI BOT - Iniciando...                           ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Verificar se node_modules existe
if not exist node_modules (
    echo ⚠️ Dependências não instaladas!
    echo.
    echo Executando instalação...
    call instalar.bat
    if errorlevel 1 exit /b 1
)

:: Verificar arquivo principal
if not exist sushi_bot.js (
    echo ❌ Arquivo sushi_bot.js não encontrado!
    pause
    exit /b 1
)

:: Iniciar bot
echo Iniciando bot...
echo.
echo ═══════════════════════════════════════════════════════════════
echo   Após iniciar, acesse http://localhost:3000 no navegador
echo   para escanear o QR Code do WhatsApp
echo ═══════════════════════════════════════════════════════════════
echo.

node sushi_bot.js

:: Se o bot encerrar
echo.
echo Bot encerrado.
pause
