# 🍣 Sushi Aki Bot - WhatsApp com IA

Bot de atendimento automatizado para WhatsApp usando inteligência artificial.

## ✨ Funcionalidades

- **QR Code via navegador** - Acesse `http://localhost:3000` para escanear
- **Integração com IA** - Google Gemini ou OpenAI
- **Comportamento humanizado** - Delays e indicador "digitando..."
- **Handoff humano** - Bot silencia automaticamente quando você responde
- **Detecção de desconfiança** - Respostas específicas para objeções
- **Persona SORA** - Atendente virtual focada em conversão
- **Sessão persistente** - Não precisa escanear QR novamente

## 📋 Requisitos

- **Windows Server 2025** (ou Windows 10/11)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **API Key** do Google AI Studio ou OpenAI

## 🚀 Instalação

### Passo 1: Instalar Node.js

1. Baixe o Node.js de [nodejs.org](https://nodejs.org/)
2. Execute o instalador
3. Reinicie o terminal após a instalação

### Passo 2: Instalar o Bot

1. Extraia o ZIP para uma pasta (ex: `C:\SushiAkiBot`)
2. Execute `instalar.bat` como Administrador
3. Aguarde a instalação das dependências

### Passo 3: Obter API Key

**Google Gemini (Gratuito):**
1. Acesse [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Clique em "Create API Key"
3. Copie a chave gerada

**OpenAI (Pago):**
1. Acesse [OpenAI Platform](https://platform.openai.com/api-keys)
2. Crie uma nova API Key
3. Copie a chave gerada

### Passo 4: Iniciar o Bot

1. Execute `iniciar.bat`
2. Escolha o provedor de IA (1 para Gemini, 2 para OpenAI)
3. Cole sua API Key quando solicitado
4. Acesse `http://localhost:3000` no navegador
5. Escaneie o QR Code com seu WhatsApp

## 📱 Como Escanear o QR Code

1. Abra o **WhatsApp** no celular
2. Vá em **Configurações** > **Aparelhos conectados**
3. Toque em **Conectar um aparelho**
4. Aponte a câmera para o QR Code na tela

## ⚙️ Configuração Avançada

### Variáveis de Ambiente

Você pode definir a API Key como variável de ambiente para não precisar digitar toda vez:

```cmd
set API_KEY=sua_chave_aqui
node sushi_bot.js
```

### Personalização

Edite o arquivo `sushi_bot.js` para personalizar:

- `SYSTEM_PROMPT` - Personalidade e instruções do bot
- `MENSAGEM_INICIAL` - Primeira mensagem enviada
- `RESPOSTA_DESCONFIANCA` - Resposta para objeções
- `DESCONFIANCA` - Lista de palavras-chave de objeção

## 🔧 Solução de Problemas

### "Node.js não encontrado"
- Instale o Node.js de [nodejs.org](https://nodejs.org/)
- Reinicie o terminal após a instalação

### "Erro na instalação de dependências"
Execute manualmente no CMD:
```cmd
npm install @whiskeysockets/baileys --legacy-peer-deps
npm install @google/generative-ai openai qrcode pino
```

### "QR Code não aparece"
- Verifique se a porta 3000 não está em uso
- Tente acessar `http://127.0.0.1:3000`

### "Conexão fechada após escanear"
- Delete a pasta `auth_info` e tente novamente
- Verifique sua conexão com a internet

### "Erro na API de IA"
- Verifique se a API Key está correta
- Verifique se você tem cota disponível
- Tente usar outro modelo

## 📝 Logs

O bot exibe logs coloridos no terminal:
- 🔵 **Azul** - Mensagens recebidas dos clientes
- 🟢 **Verde** - Mensagens enviadas pelo bot
- 🟡 **Amarelo** - Avisos e handoff humano
- 🔴 **Vermelho** - Erros

## 🛑 Encerrar o Bot

Pressione `Ctrl+C` no terminal para encerrar o bot de forma segura.

## 📄 Licença

MIT License - Sushi Aki © 2026
