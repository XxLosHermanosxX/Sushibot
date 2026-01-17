@echo off
title Sushi Aki Bot - Iniciar Servicos
color 0A

echo.
echo  ================================================
echo   SUSHI AKI BOT - Iniciando Servicos
echo  ================================================
echo.

echo Iniciando Backend API...
net start SushiAkiBackend
if %errorlevel% == 0 (
    echo   [OK] Backend iniciado
) else (
    echo   [AVISO] Backend ja estava rodando ou erro ao iniciar
)

echo.
echo Iniciando WhatsApp Bot...
net start SushiAkiBot
if %errorlevel% == 0 (
    echo   [OK] WhatsApp Bot iniciado
) else (
    echo   [AVISO] Bot ja estava rodando ou erro ao iniciar
)

echo.
echo  ================================================
echo   SERVICOS INICIADOS!
echo  ================================================
echo.
echo Acesse:
echo   - QR Code: http://localhost:3001
echo   - API: http://localhost:8001/api/status
echo.
pause
