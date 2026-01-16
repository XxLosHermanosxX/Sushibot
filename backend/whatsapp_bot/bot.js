/**
 * SUSHI AKI BOT - WhatsApp com Baileys
 * Conecta ao WhatsApp e envia mensagens para o backend Python
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const http = require('http');
const axios = require('axios');

// Configuração
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8001';
const PORT = process.env.PORT || 3001;

// Estado global
let sock = null;
let currentQR = null;
let connectionStatus = 'Aguardando conexão...';
const mensagensProcessadas = new Set();

// Funções auxiliares
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function notifyBackend(endpoint, data) {
    try {
        const response = await axios.post(`${BACKEND_URL}/api/webhook/${endpoint}`, data);
        return response.data;
    } catch (error) {
        console.error(`Erro ao notificar backend: ${error.message}`);
        return null;
    }
}

// Processamento de mensagens
async function processarMensagem(msg) {
    try {
        // Ignorar mensagens de grupo e status
        if (!msg.key.remoteJid || msg.key.remoteJid.endsWith('@g.us') || msg.key.remoteJid === 'status@broadcast') {
            return;
        }
        
        // Ignorar mensagens próprias
        if (msg.key.fromMe) {
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
        
        // Evitar duplicatas
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
        console.log(`\n\x1b[34m[CLIENTE ${chatId.split('@')[0]}] ${texto.substring(0, 100)}${texto.length > 100 ? '...' : ''}\x1b[0m`);
        
        // Enviar para backend e obter resposta
        const result = await notifyBackend('message', {
            chat_id: chatId,
            message: texto
        });
        
        if (result && result.response) {
            // Simular digitação
            try {
                await sock.sendPresenceUpdate('composing', chatId);
            } catch (e) {}
            
            // Delay humanizado (1.5 a 3 segundos)
            const delayMs = 1500 + Math.random() * 1500;
            await delay(delayMs);
            
            try {
                await sock.sendPresenceUpdate('paused', chatId);
            } catch (e) {}
            
            // Enviar resposta
            await sock.sendMessage(chatId, { text: result.response });
            console.log(`\x1b[32m[BOT] Resposta enviada para ${chatId.split('@')[0]}\x1b[0m`);
        }
        
    } catch (error) {
        console.error(`\x1b[31mErro ao processar mensagem: ${error.message}\x1b[0m`);
    }
}

// Servidor web para QR Code
const server = http.createServer(async (req, res) => {
    if (req.url === '/' || req.url === '/qr-page') {
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
    } else if (req.url === '/qr-data') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (currentQR) {
            const qrDataUrl = await QRCode.toDataURL(currentQR, { width: 280, margin: 2 });
            res.end(JSON.stringify({ qr: qrDataUrl, status: connectionStatus }));
        } else {
            res.end(JSON.stringify({ qr: null, status: connectionStatus }));
        }
    } else if (req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: connectionStatus, 
            hasQR: !!currentQR,
            connected: connectionStatus === 'Conectado!'
        }));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Conexão WhatsApp
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
        printQRInTerminal: true,
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
            console.log(`\x1b[33m   Acesse http://localhost:${PORT} para escanear\x1b[0m`);
            console.log('\x1b[33m════════════════════════════════════════════════════════\x1b[0m\n');
            
            // Notificar backend
            const qrDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
            await notifyBackend('status', {
                connected: false,
                qr_code: qrDataUrl,
                status_text: 'Escaneie o QR Code'
            });
        }
        
        if (connection === 'open') {
            currentQR = null;
            connectionStatus = 'Conectado!';
            console.log('\n\x1b[32m════════════════════════════════════════════════════════\x1b[0m');
            console.log('\x1b[32m   ✓ WHATSAPP CONECTADO COM SUCESSO!\x1b[0m');
            console.log('\x1b[32m════════════════════════════════════════════════════════\x1b[0m');
            console.log('\n\x1b[32m🤖 BOT ATIVO - Monitorando conversas...\x1b[0m\n');
            
            // Notificar backend
            await notifyBackend('status', {
                connected: true,
                qr_code: null,
                status_text: 'Conectado!',
                phone_number: sock.user?.id?.split(':')[0] || null
            });
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`\x1b[31mConexão fechada. Código: ${statusCode}\x1b[0m`);
            
            currentQR = null;
            
            // Notificar backend
            await notifyBackend('status', {
                connected: false,
                qr_code: null,
                status_text: 'Desconectado'
            });
            
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

// Main
async function main() {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    console.log('║   🍣 SUSHI AKI BOT - INICIANDO                              ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    // Iniciar servidor web
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\x1b[36m🌐 Servidor QR Code: http://localhost:${PORT}\x1b[0m`);
        console.log(`\x1b[36m🔗 Backend URL: ${BACKEND_URL}\x1b[0m\n`);
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
