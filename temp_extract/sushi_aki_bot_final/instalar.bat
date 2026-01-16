@echo off
chcp 65001 >nul
title Sushi Aki Bot - Instalação

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║   🍣 SUSHI AKI BOT - INSTALAÇÃO                             ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Verificar Node.js
echo [1/3] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ Node.js não encontrado!
    echo.
    echo Por favor, instale o Node.js 18+ de:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js encontrado: %NODE_VERSION%

:: Limpar instalação anterior
echo.
echo [2/3] Preparando instalação...
if exist node_modules (
    echo Removendo instalação anterior...
    rmdir /s /q node_modules 2>nul
)
if exist package-lock.json del package-lock.json 2>nul

:: Instalar dependências
echo.
echo [3/3] Instalando dependências...
echo Isso pode demorar alguns minutos...
echo.

call npm install --legacy-peer-deps

if errorlevel 1 (
    echo.
    echo ❌ Erro na instalação!
    echo.
    echo Tente executar manualmente:
    echo   npm install @whiskeysockets/baileys
    echo   npm install @google/generative-ai
    echo   npm install openai qrcode pino
    echo.
    pause
    exit /b 1
)

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║   ✓ INSTALAÇÃO CONCLUÍDA COM SUCESSO!                       ║
echo ║                                                              ║
echo ║   Para iniciar o bot, execute: iniciar.bat                  ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

pause
