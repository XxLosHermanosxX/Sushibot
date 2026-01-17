# ================================================
# SUSHI AKI BOT - Executar em Modo Desenvolvimento
# ================================================

param(
    [string]$InstallPath = "C:\SushiAkiBot"
)

$backendPath = Join-Path $InstallPath "backend"
$whatsappBotPath = Join-Path $backendPath "whatsapp_bot"

Write-Host ""
Write-Host "  SUSHI AKI BOT - Modo Desenvolvimento" -ForegroundColor Cyan
Write-Host ""

# Iniciar Backend em nova janela
$backendScript = @"
cd '$backendPath'
.\venv\Scripts\Activate.ps1
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript

Write-Host "[OK] Backend iniciado" -ForegroundColor Green
Write-Host "     Aguardando 5 segundos..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Iniciar Bot em nova janela
$botScript = @"
cd '$whatsappBotPath'
`$env:BACKEND_URL = 'http://localhost:8001'
node bot.js
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $botScript

Write-Host "[OK] WhatsApp Bot iniciado" -ForegroundColor Green

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Green
Write-Host "   SERVICOS INICIADOS!" -ForegroundColor Green  
Write-Host "  ================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Acesse:" -ForegroundColor Yellow
Write-Host "  - QR Code:  http://localhost:3001" -ForegroundColor White
Write-Host "  - API:      http://localhost:8001/api/status" -ForegroundColor White
Write-Host ""
