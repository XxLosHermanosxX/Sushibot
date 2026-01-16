from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import json
import asyncio
import subprocess
import signal
from datetime import datetime
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

app = FastAPI(title="Sushi Aki Bot API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== CONFIGURAÇÃO GEMINI ====================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=GEMINI_API_KEY)

# Prompt do sistema SORA
SYSTEM_PROMPT = """Você é SORA 🍣, atendente virtual do Sushi Aki.

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

IMPORTANTE: Sempre direcione para o site https://sushiakicb.shop para qualquer pedido ou dúvida sobre cardápio."""

MENSAGEM_INICIAL = """Oi! 😊 Seja bem-vindo ao Sushi Aki 🍣

👉 Nosso cardápio completo e os pedidos são feitos pelo site:
https://sushiakicb.shop

Aceitamos Pix e cartão 💳
Entregamos em toda Curitiba e região, com 4 unidades físicas.

Se quiser, posso te ajudar a escolher 😉"""

RESPOSTA_DESCONFIANCA = """Entendo a preocupação 😊
Trabalhamos com 4 unidades físicas em Curitiba, e todos os pedidos são registrados pelo site oficial:
👉 https://sushiakicb.shop

O pagamento é por Pix ou cartão, com confirmação imediata 🍣"""

DESCONFIANCA = ["golpe", "confiável", "fake", "pix antes", "site seguro", "fraude", "verdade", "mentira", "enganar", "roubo", "falso"]

# ==================== ESTADO GLOBAL ====================
conversas: Dict[str, Dict] = {}
websocket_clients: List[WebSocket] = []
whatsapp_status = {
    "connected": False,
    "qr_code": None,
    "phone_number": None,
    "status_text": "Desconectado"
}
bot_process = None
bot_config = {
    "auto_reply": True,
    "human_takeover_minutes": 60
}

# ==================== FUNÇÕES AUXILIARES ====================

def detecta_desconfianca(texto: str) -> bool:
    texto_lower = texto.lower()
    return any(palavra in texto_lower for palavra in DESCONFIANCA)

def get_conversa(chat_id: str) -> Dict:
    if chat_id not in conversas:
        conversas[chat_id] = {
            "chat_id": chat_id,
            "mensagens": [],
            "humano_ativo": False,
            "ultimo_humano": None,
            "mensagem_inicial_enviada": False,
            "objecoes_tratadas": [],
            "historico_gemini": [],
            "nome_cliente": chat_id.split("@")[0] if "@" in chat_id else chat_id,
            "criado_em": datetime.now().isoformat()
        }
    return conversas[chat_id]

async def broadcast_message(message: dict):
    """Envia mensagem para todos os clientes WebSocket conectados"""
    for client in websocket_clients:
        try:
            await client.send_json(message)
        except:
            pass

async def gerar_resposta_gemini(chat_id: str, mensagem: str) -> str:
    """Gera resposta usando Gemini"""
    conversa = get_conversa(chat_id)
    
    # Verificar desconfiança primeiro
    if detecta_desconfianca(mensagem):
        if "desconfianca" not in conversa["objecoes_tratadas"]:
            conversa["objecoes_tratadas"].append("desconfianca")
            return RESPOSTA_DESCONFIANCA
    
    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=SYSTEM_PROMPT
        )
        
        # Construir histórico
        history = []
        for msg in conversa["historico_gemini"][-10:]:
            history.append({
                "role": msg["role"],
                "parts": [msg["content"]]
            })
        
        chat = model.start_chat(history=history)
        response = chat.send_message(mensagem)
        resposta = response.text
        
        # Atualizar histórico
        conversa["historico_gemini"].append({"role": "user", "content": mensagem})
        conversa["historico_gemini"].append({"role": "model", "content": resposta})
        
        return resposta
        
    except Exception as e:
        print(f"Erro na API Gemini: {e}")
        return "Desculpe, tive um problema técnico. Por favor, acesse nosso site: https://sushiakicb.shop 🍣"

# ==================== MODELS ====================

class MessageRequest(BaseModel):
    chat_id: str
    message: str

class BotConfigRequest(BaseModel):
    auto_reply: Optional[bool] = None
    human_takeover_minutes: Optional[int] = None

class ManualMessageRequest(BaseModel):
    chat_id: str
    message: str

# ==================== ROTAS API ====================

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.get("/api/status")
async def get_status():
    return {
        "whatsapp": whatsapp_status,
        "bot_config": bot_config,
        "conversas_ativas": len(conversas),
        "gemini_configured": bool(GEMINI_API_KEY)
    }

@app.get("/api/conversas")
async def get_conversas():
    """Retorna todas as conversas ativas"""
    return {
        "conversas": list(conversas.values())
    }

@app.get("/api/conversa/{chat_id}")
async def get_conversa_by_id(chat_id: str):
    """Retorna uma conversa específica"""
    if chat_id not in conversas:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    return conversas[chat_id]

@app.post("/api/config")
async def update_config(config: BotConfigRequest):
    """Atualiza configurações do bot"""
    if config.auto_reply is not None:
        bot_config["auto_reply"] = config.auto_reply
    if config.human_takeover_minutes is not None:
        bot_config["human_takeover_minutes"] = config.human_takeover_minutes
    
    await broadcast_message({"type": "config_updated", "config": bot_config})
    return bot_config

@app.post("/api/takeover/{chat_id}")
async def human_takeover(chat_id: str):
    """Humano assume a conversa"""
    conversa = get_conversa(chat_id)
    conversa["humano_ativo"] = True
    conversa["ultimo_humano"] = datetime.now().isoformat()
    
    await broadcast_message({
        "type": "human_takeover",
        "chat_id": chat_id
    })
    
    return {"success": True, "message": f"Conversa {chat_id} assumida pelo humano"}

@app.post("/api/release/{chat_id}")
async def release_to_bot(chat_id: str):
    """Devolve conversa ao bot"""
    conversa = get_conversa(chat_id)
    conversa["humano_ativo"] = False
    
    await broadcast_message({
        "type": "bot_resumed",
        "chat_id": chat_id
    })
    
    return {"success": True, "message": f"Conversa {chat_id} devolvida ao bot"}

@app.post("/api/send-message")
async def send_manual_message(request: ManualMessageRequest):
    """Envia mensagem manual (humano)"""
    conversa = get_conversa(request.chat_id)
    
    # Adicionar mensagem ao histórico
    msg = {
        "id": f"manual_{datetime.now().timestamp()}",
        "from": "humano",
        "text": request.message,
        "timestamp": datetime.now().isoformat()
    }
    conversa["mensagens"].append(msg)
    conversa["humano_ativo"] = True
    conversa["ultimo_humano"] = datetime.now().isoformat()
    
    # Broadcast para UI
    await broadcast_message({
        "type": "message_sent",
        "chat_id": request.chat_id,
        "message": msg
    })
    
    # TODO: Enviar via WhatsApp quando bot Node.js estiver conectado
    
    return {"success": True, "message": msg}

@app.post("/api/webhook/message")
async def receive_message(request: MessageRequest):
    """Webhook para receber mensagens do bot Node.js"""
    chat_id = request.chat_id
    mensagem = request.message
    
    conversa = get_conversa(chat_id)
    
    # Adicionar mensagem recebida
    msg_recebida = {
        "id": f"recv_{datetime.now().timestamp()}",
        "from": "cliente",
        "text": mensagem,
        "timestamp": datetime.now().isoformat()
    }
    conversa["mensagens"].append(msg_recebida)
    
    # Broadcast para UI
    await broadcast_message({
        "type": "message_received",
        "chat_id": chat_id,
        "message": msg_recebida
    })
    
    # Verificar se bot pode responder
    if conversa["humano_ativo"]:
        # Verificar timeout
        if conversa["ultimo_humano"]:
            ultimo = datetime.fromisoformat(conversa["ultimo_humano"])
            diff_minutes = (datetime.now() - ultimo).total_seconds() / 60
            if diff_minutes > bot_config["human_takeover_minutes"]:
                conversa["humano_ativo"] = False
            else:
                return {"response": None, "reason": "human_active"}
    
    if not bot_config["auto_reply"]:
        return {"response": None, "reason": "auto_reply_disabled"}
    
    # Gerar resposta
    if not conversa["mensagem_inicial_enviada"]:
        resposta = MENSAGEM_INICIAL
        conversa["mensagem_inicial_enviada"] = True
    else:
        resposta = await gerar_resposta_gemini(chat_id, mensagem)
    
    # Adicionar resposta ao histórico
    msg_enviada = {
        "id": f"sent_{datetime.now().timestamp()}",
        "from": "bot",
        "text": resposta,
        "timestamp": datetime.now().isoformat()
    }
    conversa["mensagens"].append(msg_enviada)
    
    # Broadcast para UI
    await broadcast_message({
        "type": "message_sent",
        "chat_id": chat_id,
        "message": msg_enviada
    })
    
    return {"response": resposta}

@app.post("/api/webhook/status")
async def update_whatsapp_status(status: dict):
    """Webhook para atualizar status do WhatsApp"""
    global whatsapp_status
    
    if "connected" in status:
        whatsapp_status["connected"] = status["connected"]
    if "qr_code" in status:
        whatsapp_status["qr_code"] = status["qr_code"]
    if "phone_number" in status:
        whatsapp_status["phone_number"] = status["phone_number"]
    if "status_text" in status:
        whatsapp_status["status_text"] = status["status_text"]
    
    await broadcast_message({
        "type": "status_update",
        "status": whatsapp_status
    })
    
    return {"success": True}

@app.post("/api/test-gemini")
async def test_gemini():
    """Testa conexão com Gemini"""
    try:
        model = genai.GenerativeModel(model_name="gemini-2.0-flash-exp")
        response = model.generate_content("Diga apenas: OK")
        return {"success": True, "response": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ==================== WEBSOCKET ====================

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    websocket_clients.append(websocket)
    
    # Enviar estado inicial
    await websocket.send_json({
        "type": "init",
        "status": whatsapp_status,
        "config": bot_config,
        "conversas": list(conversas.values())
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            # Processar comandos do frontend se necessário
            try:
                cmd = json.loads(data)
                if cmd.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except:
                pass
    except WebSocketDisconnect:
        websocket_clients.remove(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
