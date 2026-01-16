/**
 * SUSHI AKI BOT - Versão Final
 * Bot WhatsApp com IA para atendimento automatizado
 * 
 * Funcionalidades:
 * - QR Code via servidor web (acesse http://localhost:3000)
 * - Integração com Google Gemini ou OpenAI
 * - Comportamento humanizado (delays, digitando...)
 * - Handoff humano (bot silencia quando você responde)
 * - Detecção de desconfiança
 * - Persona SORA do Sushi Aki
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');

// ==================== CONFIGURAÇÃO ====================

let API_KEY = process.env.API_KEY || '';
let API_TYPE = 'gemini'; // 'gemini' ou 'openai'
let MODELO = 'gemini-2.0-flash-exp';

// Palavras-chave de desconfiança
const DESCONFIANCA = ["golpe", "confiável", "fake", "pix antes", "site seguro", "fraude", "verdade", "mentira", "enganar", "roubo", "falso"];

// Prompt do sistema SORA
const SYSTEM_PROMPT = `Você é SORA 🍣, atendente virtual do Sushi Aki.

Missão:
Induzir o cliente a finalizar o pedido exclusivamente pelo site:
https://sushiakicb.shop

Regras fixas:
- Nunca aceite pedidos fora do site
- Nunca prometa pagamento na entrega
- Sempre mencionar Pix e cartão
- Sempre transmitir segurança e profissionalismo
- Nunca repetir a mesma explicação de forma idêntica
- Respostas curtas e diretas (máximo 3 linhas quando possível)

Contexto do negócio:
- 4 unidades físicas em Curitiba
- Entrega em toda Curitiba e região
- Cardápio completo apenas no site
- Aceitamos Pix e cartão

Estilo:
- Respostas humanas, curtas e claras
- Tom calmo e confiável
- Emojis com moderação (máximo 2 por mensagem)
- Seja simpático mas profissional

IMPORTANTE: Sempre direcione para o site https://sushiakicb.shop para qualquer pedido ou dúvida sobre cardápio.`;

const MENSAGEM_INICIAL = `Oi! 😊 Seja bem-vindo ao Sushi Aki 🍣

👉 Nosso cardápio completo e os pedidos são feitos pelo site:
https://sushiakicb.shop

Aceitamos Pix e cartão 💳
Entregamos em toda Curitiba e região, com 4 unidades físicas.

Se quiser, posso te ajudar a escolher 😉`;

const RESPOSTA_DESCONFIANCA = `Entendo a preocupação 😊
Trabalhamos com 4 unidades físicas em Curitiba, e todos os pedidos são registrados pelo site oficial:
👉 https://sushiakicb.shop

O pagamento é por Pix ou cartão, com confirmação imediata 🍣`;

// ==================== ESTADO GLOBAL ====================

let sock = null;
let aiClient = null;
let geminiChat = null;
let currentQR = null;
let connectionStatus = 'Aguardando configuração...';
const conversas = new Map();
const mensagensProcessadas = new Set();

// ==================== FUNÇÕES AUXILIARES ====================

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getConversa(chatId) {
    if (!conversas.has(chatId)) {
        conversas.set(chatId, {
            historico: [],
            humanoAtivo: false,
            ultimoHumano: null,
            mensagemInicialEnviada: false,
            ultimaMsgTimestamp: null,
            objecoesTratadas: [],
            geminiChat: null
        });
    }
    return conversas.get(chatId);
}

function botPodeResponder(chatId) {
    const conversa = getConversa(chatId);
    
    if (!conversa.humanoAtivo) {
        return true;
    }
    
    // Após 60 minutos, bot retoma
    if (Date.now() - conversa.ultimoHumano > 3600000) {
        conversa.humanoAtivo = false;
        console.log(`\x1b[32m[HANDOFF] Bot retomou conversa ${chatId} após 60 min\x1b[0m`);
        return true;
    }
    
    return false;
}

function analisarDigitacao(tempoEntreMsgs, tamanhoTexto) {
    if (tempoEntreMsgs < 1.2 && tamanhoTexto > 30) {
        return "copiado";
    } else if (tempoEntreMsgs > 6 && tamanhoTexto < 10) {
        return "pensando";
    } else if (tempoEntreMsgs < 2) {
        return "impulsivo";
    } else {
        return "normal";
    }
}

function tempoResposta(tipoDigitacao) {
    const tempos = {
        "pensando": 2500,
        "impulsivo": 1200,
        "copiado": 1800,
        "normal": 1800
    };
    return tempos[tipoDigitacao] || 1800;
}

function detectaDesconfianca(texto) {
    const textoLower = texto.toLowerCase();
    return DESCONFIANCA.some(palavra => textoLower.includes(palavra));
}

// ==================== GERAÇÃO DE RESPOSTA IA ====================

async function gerarRespostaGemini(chatId, mensagem) {
    const conversa = getConversa(chatId);
    
    try {
        // Criar chat se não existir
        if (!conversa.geminiChat) {
            const model = aiClient.getGenerativeModel({ model: MODELO });
            conversa.geminiChat = model.startChat({
                history: [],
                generationConfig: {
                    maxOutputTokens: 300,
                    temperature: 0.7
                }
            });
            
            // Enviar system prompt
            await conversa.geminiChat.sendMessage(SYSTEM_PROMPT);
        }
        
        const result = await conversa.geminiChat.sendMessage(mensagem);
        const resposta = result.response.text();
        
        conversa.historico.push({ role: "user", content: mensagem });
        conversa.historico.push({ role: "assistant", content: resposta });
        
        return resposta;
        
    } catch (error) {
        console.error(`\x1b[31mErro na API Gemini: ${error.message}\x1b[0m`);
        return "Desculpe, tive um problema técnico. Por favor, acesse nosso site: https://sushiakicb.shop 🍣";
    }
}

async function gerarRespostaOpenAI(chatId, mensagem) {
    const conversa = getConversa(chatId);
    
    const messages = [{ role: "system", content: SYSTEM_PROMPT }];
    
    const historicoRecente = conversa.historico.slice(-10);
    for (const msg of historicoRecente) {
        messages.push(msg);
    }
    
    messages.push({ role: "user", content: mensagem });
    
    try {
        const response = await aiClient.chat.completions.create({
            model: MODELO,
            messages: messages,
            max_tokens: 300,
            temperature: 0.7
        });
        
        const resposta = response.choices[0].message.content;
        
        conversa.historico.push({ role: "user", content: mensagem });
        conversa.historico.push({ role: "assistant", content: resposta });
        
        return resposta;
        
    } catch (error) {
        console.error(`\x1b[31mErro na API OpenAI: ${error.message}\x1b[0m`);
        return "Desculpe, tive um problema técnico. Por favor, acesse nosso site: https://sushiakicb.shop 🍣";
    }
}

async function gerarRespostaIA(chatId, mensagem) {
    const conversa = getConversa(chatId);
    
    // Verificar desconfiança primeiro
    if (detectaDesconfianca(mensagem)) {
        if (!conversa.objecoesTratadas.includes("desconfianca")) {
            conversa.objecoesTratadas.push("desconfianca");
            return RESPOSTA_DESCONFIANCA;
        }
    }
    
    if (API_TYPE === 'gemini') {
        return await gerarRespostaGemini(chatId, mensagem);
    } else {
        return await gerarRespostaOpenAI(chatId, mensagem);
    }
}

// ==================== PROCESSAMENTO DE MENSAGENS ====================

async function enviarMensagem(jid, texto) {
    try {
        await sock.sendMessage(jid, { text: texto });
        console.log(`\x1b[32m[BOT] Mensagem enviada para ${jid.split('@')[0]}\x1b[0m`);
    } catch (error) {
        console.error(`\x1b[31mErro ao enviar mensagem: ${error.message}\x1b[0m`);
    }
}

async function processarMensagem(msg) {
    try {
        // Ignorar mensagens de grupo e status
        if (!msg.key.remoteJid || msg.key.remoteJid.endsWith('@g.us') || msg.key.remoteJid === 'status@broadcast') {
            return;
        }
        
        // Verificar se é mensagem enviada pelo bot/humano
        if (msg.key.fromMe) {
            // Detectar handoff humano
            const chatId = msg.key.remoteJid;
            const conversa = getConversa(chatId);
            
            // Se a mensagem não foi gerada pelo bot, é humano
            const texto = msg.message?.conversation || 
                          msg.message?.extendedTextMessage?.text || '';
            
            // Verificar se não é uma das respostas automáticas
            if (texto && !texto.includes('sushiakicb.shop') && !texto.includes('Sushi Aki')) {
                conversa.humanoAtivo = true;
                conversa.ultimoHumano = Date.now();
                console.log(`\x1b[33m[HANDOFF] Humano assumiu conversa ${chatId.split('@')[0]} - Bot silenciado por 60 min\x1b[0m`);
            }
            return;
        }
        
        // Extrair texto da mensagem
        const texto = msg.message?.conversation || 
                      msg.message?.extendedTextMessage?.text ||
                      msg.message?.imageMessage?.caption ||
                      msg.message?.videoMessage?.caption || '';
        
        if (!texto) {
            return;
        }
        
        // Criar ID único para evitar duplicatas
        const msgId = msg.key.id;
        if (mensagensProcessadas.has(msgId)) {
            return;
        }
        mensagensProcessadas.add(msgId);
        
        // Limitar tamanho do set
        if (mensagensProcessadas.size > 1000) {
            const iterator = mensagensProcessadas.values();
            for (let i = 0; i < 500; i++) {
                mensagensProcessadas.delete(iterator.next().value);
            }
        }
        
        const chatId = msg.key.remoteJid;
        const conversa = getConversa(chatId);
        
        console.log(`\n\x1b[34m[CLIENTE ${chatId.split('@')[0]}] ${texto.substring(0, 100)}${texto.length > 100 ? '...' : ''}\x1b[0m`);
        
        // Verificar se bot pode responder
        if (!botPodeResponder(chatId)) {
            console.log(`\x1b[33m[INFO] Bot silenciado para ${chatId.split('@')[0]} (humano ativo)\x1b[0m`);
            return;
        }
        
        // Analisar padrão de digitação
        let tempoEntre = 5.0;
        if (conversa.ultimaMsgTimestamp) {
            tempoEntre = (Date.now() - conversa.ultimaMsgTimestamp) / 1000;
        }
        
        const tipoDigitacao = analisarDigitacao(tempoEntre, texto.length);
        conversa.ultimaMsgTimestamp = Date.now();
        
        // Gerar resposta
        let resposta;
        if (!conversa.mensagemInicialEnviada) {
            resposta = MENSAGEM_INICIAL;
            conversa.mensagemInicialEnviada = true;
        } else {
            resposta = await gerarRespostaIA(chatId, texto);
        }
        
        // Delay humanizado
        const delayMs = tempoResposta(tipoDigitacao);
        console.log(`\x1b[36m[DELAY] Aguardando ${delayMs/1000}s (padrão: ${tipoDigitacao})\x1b[0m`);
        
        // Simular "digitando..."
        try {
            await sock.sendPresenceUpdate('composing', chatId);
        } catch (e) {}
        
        await delay(delayMs);
        
        try {
            await sock.sendPresenceUpdate('paused', chatId);
        } catch (e) {}
        
        // Enviar resposta
        await enviarMensagem(chatId, resposta);
        
    } catch (error) {
        console.error(`\x1b[31mErro ao processar mensagem: ${error.message}\x1b[0m`);
    }
}

// ==================== SERVIDOR WEB ====================

const server = http.createServer(async (req, res) => {
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Sushi Aki Bot - QR Code</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="3">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            max-width: 500px;
        }
        h1 { font-size: 2em; margin-bottom: 10px; color: #ff6b6b; }
        .status {
            font-size: 1.2em;
            margin: 20px 0;
            padding: 10px 20px;
            border-radius: 10px;
            background: ${connectionStatus === 'Conectado!' ? '#27ae60' : connectionStatus.includes('Escaneie') ? '#f39c12' : '#3498db'};
        }
        .qr-container {
            background: white;
            padding: 20px;
            border-radius: 15px;
            margin: 20px auto;
            display: inline-block;
        }
        .qr-container img { max-width: 280px; height: auto; }
        .instructions { margin-top: 20px; font-size: 0.9em; color: #bbb; }
        .instructions ol { text-align: left; display: inline-block; }
        .instructions li { margin: 5px 0; }
        .refresh { margin-top: 15px; font-size: 0.8em; color: #888; }
        .connected { font-size: 4em; color: #27ae60; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🍣 Sushi Aki Bot</h1>
        <div class="status">${connectionStatus}</div>
        
        ${connectionStatus === 'Conectado!' ? `
            <div class="connected">✓</div>
            <p style="margin-top: 20px; font-size: 1.2em;">WhatsApp conectado com sucesso!</p>
            <p style="margin-top: 10px; color: #27ae60;">O bot está ativo e respondendo mensagens.</p>
            <p style="margin-top: 20px; font-size: 0.9em; color: #888;">Você pode fechar esta página.</p>
        ` : currentQR ? `
            <div class="qr-container">
                <img src="/qr" alt="QR Code">
            </div>
            <div class="instructions">
                <p><strong>Para conectar:</strong></p>
                <ol>
                    <li>Abra o WhatsApp no celular</li>
                    <li>Vá em Configurações > Aparelhos conectados</li>
                    <li>Toque em "Conectar um aparelho"</li>
                    <li>Escaneie este QR Code</li>
                </ol>
            </div>
        ` : `
            <p>Aguardando geração do QR Code...</p>
            <p style="margin-top: 10px; font-size: 0.9em; color: #888;">Isso pode levar alguns segundos.</p>
        `}
        
        <div class="refresh">Página atualiza automaticamente a cada 3 segundos</div>
    </div>
</body>
</html>
        `);
    } else if (req.url === '/qr') {
        if (currentQR) {
            try {
                const qrImage = await QRCode.toBuffer(currentQR, {
                    type: 'png',
                    width: 280,
                    margin: 2
                });
                res.writeHead(200, { 'Content-Type': 'image/png' });
                res.end(qrImage);
            } catch (e) {
                res.writeHead(500);
                res.end('Erro ao gerar QR');
            }
        } else {
            res.writeHead(404);
            res.end('QR não disponível');
        }
    } else if (req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: connectionStatus, hasQR: !!currentQR }));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// ==================== CONEXÃO WHATSAPP ====================

async function conectarWhatsApp() {
    const authDir = path.join(__dirname, 'auth_info');
    
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }
    
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    console.log(`\x1b[36mUsando Baileys versão: ${version.join('.')} (${isLatest ? 'mais recente' : 'atualização disponível'})\x1b[0m`);
    
    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Sushi Aki Bot', 'Chrome', '120.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 25000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true
    });
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            currentQR = qr;
            connectionStatus = 'Escaneie o QR Code';
            console.log('\n\x1b[33m════════════════════════════════════════════════════════\x1b[0m');
            console.log('\x1b[33m   📱 NOVO QR CODE GERADO!\x1b[0m');
            console.log('\x1b[33m   Acesse http://localhost:3000 para escanear\x1b[0m');
            console.log('\x1b[33m════════════════════════════════════════════════════════\x1b[0m\n');
        }
        
        if (connection === 'open') {
            currentQR = null;
            connectionStatus = 'Conectado!';
            console.log('\n\x1b[32m════════════════════════════════════════════════════════\x1b[0m');
            console.log('\x1b[32m   ✓ WHATSAPP CONECTADO COM SUCESSO!\x1b[0m');
            console.log('\x1b[32m════════════════════════════════════════════════════════\x1b[0m');
            console.log('\n\x1b[32m🤖 BOT ATIVO - Monitorando conversas...\x1b[0m');
            console.log('\x1b[33mEnvie uma mensagem para o número conectado para testar!\x1b[0m\n');
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`\x1b[31mConexão fechada. Código: ${statusCode}\x1b[0m`);
            
            currentQR = null;
            
            if (statusCode === DisconnectReason.loggedOut) {
                connectionStatus = 'Desconectado - Escaneie novamente';
                console.log('\x1b[33mSessão encerrada. Delete a pasta auth_info e reinicie.\x1b[0m');
            } else if (statusCode === DisconnectReason.badSession || statusCode === 401) {
                connectionStatus = 'Sessão inválida - Reconectando...';
                console.log('\x1b[33mLimpando sessão antiga...\x1b[0m');
                try {
                    fs.rmSync(authDir, { recursive: true, force: true });
                } catch (e) {}
                await delay(3000);
                conectarWhatsApp();
            } else {
                connectionStatus = 'Reconectando...';
                console.log('\x1b[33mReconectando em 5 segundos...\x1b[0m');
                await delay(5000);
                conectarWhatsApp();
            }
        }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        for (const msg of messages) {
            await processarMensagem(msg);
        }
    });
}

// ==================== CONFIGURAÇÃO INICIAL ====================

async function configurar() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const pergunta = (texto) => new Promise(resolve => rl.question(texto, resolve));
    
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    console.log('║   🍣 SUSHI AKI BOT - CONFIGURAÇÃO INICIAL 🍣                ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    console.log('\x1b[36mSelecione o provedor de IA:\x1b[0m');
    console.log('  \x1b[33m1\x1b[0m - Google Gemini (recomendado)');
    console.log('  \x1b[33m2\x1b[0m - OpenAI (GPT-4)');
    console.log('');
    
    const escolha = await pergunta('Digite o número (1 ou 2): ');
    
    if (escolha === '2') {
        API_TYPE = 'openai';
        MODELO = 'gpt-4o-mini';
        console.log('\n\x1b[32m✓ OpenAI selecionado\x1b[0m');
        console.log('\x1b[36mModelos disponíveis: gpt-4o-mini, gpt-4o, gpt-4-turbo\x1b[0m\n');
    } else {
        API_TYPE = 'gemini';
        MODELO = 'gemini-2.0-flash-exp';
        console.log('\n\x1b[32m✓ Google Gemini selecionado\x1b[0m');
        console.log('\x1b[36mModelos disponíveis: gemini-2.0-flash-exp, gemini-1.5-pro\x1b[0m\n');
    }
    
    // Verificar se já tem API key no ambiente
    if (!API_KEY) {
        if (API_TYPE === 'gemini') {
            API_KEY = await pergunta('Digite sua API Key do Google AI Studio: ');
        } else {
            API_KEY = await pergunta('Digite sua API Key da OpenAI: ');
        }
    }
    
    rl.close();
    
    // Configurar cliente de IA
    console.log('\n\x1b[36mConfigurando cliente de IA...\x1b[0m');
    
    try {
        if (API_TYPE === 'gemini') {
            aiClient = new GoogleGenerativeAI(API_KEY);
            // Testar conexão
            const model = aiClient.getGenerativeModel({ model: MODELO });
            const result = await model.generateContent('Diga apenas: OK');
            console.log(`\x1b[32m✓ Gemini configurado! Teste: ${result.response.text().trim()}\x1b[0m`);
        } else {
            aiClient = new OpenAI({ apiKey: API_KEY });
            // Testar conexão
            const response = await aiClient.chat.completions.create({
                model: MODELO,
                messages: [{ role: "user", content: "Diga apenas: OK" }],
                max_tokens: 10
            });
            console.log(`\x1b[32m✓ OpenAI configurado! Teste: ${response.choices[0].message.content.trim()}\x1b[0m`);
        }
    } catch (error) {
        console.error(`\x1b[31mErro ao configurar IA: ${error.message}\x1b[0m`);
        console.log('\x1b[33mVerifique sua API Key e tente novamente.\x1b[0m');
        process.exit(1);
    }
    
    return true;
}

// ==================== MAIN ====================

async function main() {
    // Configurar IA
    await configurar();
    
    // Iniciar servidor web
    const PORT = 3000;
    server.listen(PORT, '0.0.0.0', () => {
        console.log('\n');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║                                                              ║');
        console.log('║   🌐 SERVIDOR WEB INICIADO                                   ║');
        console.log('║                                                              ║');
        console.log(`║   Acesse: \x1b[36mhttp://localhost:${PORT}\x1b[0m                            ║`);
        console.log('║   para escanear o QR Code                                    ║');
        console.log('║                                                              ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('\n');
    });
    
    // Conectar WhatsApp
    console.log('\x1b[36mIniciando conexão com WhatsApp...\x1b[0m\n');
    await conectarWhatsApp();
}

// Tratamento de encerramento
process.on('SIGINT', () => {
    console.log('\n\x1b[33mEncerrando bot...\x1b[0m');
    server.close();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error(`\x1b[31mErro não tratado: ${error.message}\x1b[0m`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`\x1b[31mPromise rejeitada: ${reason}\x1b[0m`);
});

// Iniciar
main();
