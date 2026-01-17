@echo off
title Sushi Aki Bot - Parar Servicos
color 0C

echo.
echo  ================================================
echo   SUSHI AKI BOT - Parando Servicos
echo  ================================================
echo.

echo Parando WhatsApp Bot...
net stop SushiAkiBot
if %errorlevel% == 0 (
    echo   [OK] WhatsApp Bot parado
) else (
    echo   [AVISO] Bot ja estava parado
)

echo.
echo Parando Backend API...
net stop SushiAkiBackend
if %errorlevel% == 0 (
    echo   [OK] Backend parado
) else (
    echo   [AVISO] Backend ja estava parado
)

echo.
echo  ================================================
echo   SERVICOS PARADOS!
echo  ================================================
echo.
pause
