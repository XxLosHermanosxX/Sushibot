/**
 * SUSHI AKI BOT - WhatsApp com Baileys
 * Conecta ao WhatsApp e envia mensagens para o backend Python
 * Agora com suporte para envio de mensagens do painel!
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
let currentQRDataUrl = null;
let connectionStatus = 'Aguardando conexão...';
let isConnected = false;
let phoneNumber = null;
const mensagensProcessadas = new Set();

// Funções auxiliares
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function notifyBackend(endpoint, data) {
    try {
        const response = await axios.post(`${BACKEND_URL}/api/webhook/${endpoint}`, data, {
            timeout: 5000
        });
        return response.data;
    } catch (error) {
        if (error.code !== 'ECONNREFUSED') {
            console.error(`Erro ao notificar backend: ${error.message}`);
        }
        return null;
    }
}

// Sincronizar status com backend periodicamente
async function syncStatusWithBackend() {
    const statusData = {
        connected: isConnected,
        qr_code: currentQRDataUrl,
        status_text: connectionStatus,
        phone_number: phoneNumber
    };
    await notifyBackend('status', statusData);
}

setInterval(syncStatusWithBackend, 5000);

// ==================== ENVIAR MENSAGEM PARA WHATSAPP ====================
async function enviarMensagemWhatsApp(chatId, mensagem) {
    if (!sock || !isConnected) {
        return { success: false, error: 'WhatsApp não conectado' };
    }
    
    try {
        // Garantir formato correto do chatId
        let jid = chatId;
        if (!jid.includes('@')) {
            jid = jid + '@s.whatsapp.net';
        }
        
        // Simular digitação
        try {
            await sock.sendPresenceUpdate('composing', jid);
            await delay(500 + Math.random() * 1000);
            await sock.sendPresenceUpdate('paused', jid);
        } catch (e) {}
        
        // Enviar mensagem
        const result = await sock.sendMessage(jid, { text: mensagem });
        
        console.log(`\x1b[35m[PAINEL -> ${jid.split('@')[0]}] ${mensagem.substring(0, 50)}${mensagem.length > 50 ? '...' : ''}\x1b[0m`);
        
        return { 
            success: true, 
            messageId: result?.key?.id,
            timestamp: Date.now()
        };
    } catch (error) {
        console.error(`\x1b[31mErro ao enviar mensagem: ${error.message}\x1b[0m`);
        return { success: false, error: error.message };
    }
}

// Processamento de mensagens recebidas
async function processarMensagem(msg) {
    try {
        if (!msg.key.remoteJid || msg.key.remoteJid.endsWith('@g.us') || msg.key.remoteJid === 'status@broadcast') {
            return;
        }
        
        if (msg.key.fromMe) {
            return;
        }
        
        const texto = msg.message?.conversation || 
                      msg.message?.extendedTextMessage?.text ||
                      msg.message?.imageMessage?.caption ||
                      msg.message?.videoMessage?.caption || '';
        
        if (!texto) {
            return;
        }
        
        const msgId = msg.key.id;
        if (mensagensProcessadas.has(msgId)) {
            return;
        }
        mensagensProcessadas.add(msgId);
        
        if (mensagensProcessadas.size > 1000) {
            const iterator = mensagensProcessadas.values();
            for (let i = 0; i < 500; i++) {
                mensagensProcessadas.delete(iterator.next().value);
            }
        }
        
        const chatId = msg.key.remoteJid;
        console.log(`\n\x1b[34m[CLIENTE ${chatId.split('@')[0]}] ${texto.substring(0, 100)}${texto.length > 100 ? '...' : ''}\x1b[0m`);
        
        const result = await notifyBackend('message', {
            chat_id: chatId,
            message: texto
        });
        
        if (result && result.response) {
            try {
                await sock.sendPresenceUpdate('composing', chatId);
            } catch (e) {}
            
            const delayMs = 1500 + Math.random() * 1500;
            await delay(delayMs);
            
            try {
                await sock.sendPresenceUpdate('paused', chatId);
            } catch (e) {}
            
            await sock.sendMessage(chatId, { text: result.response });
            console.log(`\x1b[32m[BOT] Resposta enviada para ${chatId.split('@')[0]}\x1b[0m`);
        }
        
    } catch (error) {
        console.error(`\x1b[31mErro ao processar mensagem: ${error.message}\x1b[0m`);
    }
}

// ==================== SERVIDOR HTTP COM API ====================
const server = http.createServer(async (req, res) => {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // ========== ENDPOINT PARA ENVIAR MENSAGEM ==========
    if (req.url === '/send-message' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { chat_id, message } = JSON.parse(body);
                
                if (!chat_id || !message) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'chat_id e message são obrigatórios' }));
                    return;
                }
                
                const result = await enviarMensagemWhatsApp(chat_id, message);
                
                res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'JSON inválido' }));
            }
        });
        return;
    }
    
    // Página QR Code
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
            background: ${isConnected ? '#27ae60' : currentQR ? '#f39c12' : '#3498db'};
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
        .connected { font-size: 4em; color: #27ae60; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🍣 Sushi Aki Bot</h1>
        <div class="status">${connectionStatus}</div>
        
        ${isConnected ? `
            <div class="connected">✓</div>
            <p style="margin-top: 20px; font-size: 1.2em;">WhatsApp conectado!</p>
            <p style="margin-top: 10px; color: #27ae60;">Bot ativo e respondendo.</p>
            ${phoneNumber ? `<p style="margin-top: 10px; color: #888;">Número: ${phoneNumber}</p>` : ''}
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
    </div>
</body>
</html>
        `);
    } else if (req.url === '/qr') {
        if (currentQR) {
            try {
                const qrImage = await QRCode.toBuffer(currentQR, {
                    type: 'png',
                    width: 300,
                    margin: 2,
                    errorCorrectionLevel: 'M'
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
        res.end(JSON.stringify({ 
            qr: currentQRDataUrl, 
            status: connectionStatus,
            connected: isConnected,
            phone_number: phoneNumber
        }));
    } else if (req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: connectionStatus, 
            hasQR: !!currentQR,
            connected: isConnected,
            phone_number: phoneNumber
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
            isConnected = false;
            connectionStatus = 'Escaneie o QR Code';
            
            try {
                currentQRDataUrl = await QRCode.toDataURL(qr, { 
                    width: 300, 
                    margin: 2,
                    errorCorrectionLevel: 'M'
                });
            } catch (e) {
                console.error('Erro ao gerar QR data URL:', e);
            }
            
            console.log('\n\x1b[33m════════════════════════════════════════════════════════\x1b[0m');
            console.log('\x1b[33m   📱 NOVO QR CODE GERADO!\x1b[0m');
            console.log(`\x1b[33m   Acesse http://localhost:${PORT} para escanear\x1b[0m`);
            console.log('\x1b[33m════════════════════════════════════════════════════════\x1b[0m\n');
            
            await syncStatusWithBackend();
        }
        
        if (connection === 'open') {
            currentQR = null;
            currentQRDataUrl = null;
            isConnected = true;
            connectionStatus = 'Conectado!';
            phoneNumber = sock.user?.id?.split(':')[0] || null;
            
            console.log('\n\x1b[32m════════════════════════════════════════════════════════\x1b[0m');
            console.log('\x1b[32m   ✓ WHATSAPP CONECTADO COM SUCESSO!\x1b[0m');
            if (phoneNumber) console.log(`\x1b[32m   📞 Número: ${phoneNumber}\x1b[0m`);
            console.log('\x1b[32m════════════════════════════════════════════════════════\x1b[0m');
            console.log('\n\x1b[32m🤖 BOT ATIVO - Monitorando conversas...\x1b[0m\n');
            
            await syncStatusWithBackend();
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`\x1b[31mConexão fechada. Código: ${statusCode}\x1b[0m`);
            
            currentQR = null;
            currentQRDataUrl = null;
            isConnected = false;
            phoneNumber = null;
            
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
    console.log('║   📤 Envio de mensagens do painel HABILITADO                ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\x1b[36m🌐 Servidor QR Code: http://localhost:${PORT}\x1b[0m`);
        console.log(`\x1b[36m📤 Endpoint envio: POST http://localhost:${PORT}/send-message\x1b[0m`);
        console.log(`\x1b[36m🔗 Backend URL: ${BACKEND_URL}\x1b[0m\n`);
    });
    
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

main();
