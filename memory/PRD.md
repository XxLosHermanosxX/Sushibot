# Sushi Aki Bot - Product Requirements Document

## Problema Original
Bot de WhatsApp para o restaurante de sushi "Sushiaki" para engajar clientes vindos de anúncios do Facebook e guiá-los a fazer compras no site do restaurante.

## Requisitos do Produto

### Core Features (Implementado ✅)
- **Bot WhatsApp:** Conexão via QR code usando Baileys
- **Integração AI:** Google Gemini + OpenRouter (DeepSeek R1, Llama 3.3 70B)
- **Dashboard Admin:** Painel web para QR code, conversas e configurações
- **PWA:** Aplicativo instalável para Android/iPhone
- **Persistência:** Configurações salvas em config.json
- **Seletor de Provedor:** Alternar entre Gemini e OpenRouter facilmente
- **Modo Lobo de Wall Street:** Persuasão agressiva para fechar vendas
- **Modo Humanizado:** Bot 100% humanizado quando cliente pede atendente

### Arquitetura
```
/app/
├── backend/
│   ├── server.py           # FastAPI - lógica principal
│   ├── config.json         # Configurações persistidas
│   ├── whatsapp_bot/
│   │   └── bot.js          # Node.js/Baileys
│   └── .env
├── frontend/
│   ├── src/App.js          # React SPA (refatorado v2.1)
│   └── public/
│       ├── manifest.json   # PWA
│       └── service-worker.js
└── scripts/windows/        # Scripts de deploy
```

## Status de Implementação

### Concluído ✅
- [x] Backend FastAPI com API de status, configurações, webhook
- [x] Bot WhatsApp com Baileys e geração de QR code
- [x] Frontend React com dashboard completo
- [x] Integração Google Gemini
- [x] Integração OpenRouter (modelos gratuitos)
- [x] PWA instalável
- [x] Bug do QR code corrigido
- [x] Guia de deploy Windows Server 2025
- [x] Scripts de instalação e gerenciamento
- [x] Bug inputs fechando (refatoração componentes)
- [x] Seletor Gemini/OpenRouter com teste de conexão
- [x] Modo Lobo de Wall Street - persuasão vendas
- [x] Modo humanizado quando cliente pede atendente

### Pendente/Futuro
- [ ] Persistência de histórico de conversas
- [ ] Processamento de áudio (baixa prioridade)

## Endpoints API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /api/status | Status do bot e conversas |
| GET | /api/config | Ler configurações |
| POST | /api/config | Salvar configurações |
| POST | /api/test-ai | Testar IA configurada |
| GET | /api/models | Lista de modelos disponíveis |
| POST | /api/webhook/message | Receber mensagens do bot |

## Integrações de Terceiros
- **Google Gemini:** Chave de API do usuário
- **OpenRouter:** Chave de API do usuário
- **Baileys:** Autenticação via QR code

## Deploy
- Guia completo: `/app/DEPLOY_WINDOWS.md`
- Scripts: `/app/scripts/windows/`

---
*Última atualização: Janeiro 2026*
