from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import json
import asyncio
import aiohttp
from datetime import datetime
from pathlib import Path

# Carregar .env manualmente
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

app = FastAPI(title="Sushi Aki Bot API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== MODELOS DISPONÍVEIS ====================
AVAILABLE_MODELS = {
    # OpenRouter - Modelos GRATUITOS
    "openrouter": {
        "deepseek/deepseek-r1:free": {
            "name": "DeepSeek R1 (Gratuito)",
            "description": "Modelo de raciocínio avançado, ótimo para respostas complexas",
            "free": True
        },
        "deepseek/deepseek-chat:free": {
            "name": "DeepSeek Chat (Gratuito)", 
            "description": "Modelo de chat rápido e eficiente",
            "free": True
        },
        "meta-llama/llama-3.3-70b-instruct:free": {
            "name": "Llama 3.3 70B (Gratuito)",
            "description": "Modelo grande da Meta, excelente qualidade",
            "free": True
        },
        "meta-llama/llama-3.1-8b-instruct:free": {
            "name": "Llama 3.1 8B (Gratuito)",
            "description": "Modelo menor mas muito rápido",
            "free": True
        },
        "google/gemma-2-9b-it:free": {
            "name": "Google Gemma 2 9B (Gratuito)",
            "description": "Modelo do Google, bom para português",
            "free": True
        },
        "qwen/qwen-2.5-72b-instruct:free": {
            "name": "Qwen 2.5 72B (Gratuito)",
            "description": "Modelo chinês muito capaz, multilíngue",
            "free": True
        },
        "qwen/qwen-2.5-coder-32b-instruct:free": {
            "name": "Qwen 2.5 Coder 32B (Gratuito)",
            "description": "Especializado em código e instruções",
            "free": True
        },
        "mistralai/mistral-small-24b-instruct-2501:free": {
            "name": "Mistral Small 24B (Gratuito)",
            "description": "Modelo europeu rápido e eficiente",
            "free": True
        },
        "microsoft/phi-3-mini-128k-instruct:free": {
            "name": "Microsoft Phi-3 Mini (Gratuito)",
            "description": "Modelo compacto da Microsoft",
            "free": True
        },
        "openchat/openchat-7b:free": {
            "name": "OpenChat 7B (Gratuito)",
            "description": "Modelo de chat open source",
            "free": True
        }
    },
    # Google Gemini
    "gemini": {
        "gemini-2.5-flash": {
            "name": "Gemini 2.5 Flash",
            "description": "Mais recente e rápido",
            "free": False
        },
        "gemini-2.5-pro": {
            "name": "Gemini 2.5 Pro",
            "description": "Mais capaz, respostas melhores",
            "free": False
        },
        "gemini-2.0-flash": {
            "name": "Gemini 2.0 Flash",
            "description": "Versão estável e rápida",
            "free": False
        },
        "gemini-1.5-flash": {
            "name": "Gemini 1.5 Flash",
            "description": "Versão anterior, muito estável",
            "free": False
        },
        "gemini-1.5-pro": {
            "name": "Gemini 1.5 Pro",
            "description": "Versão anterior, alta qualidade",
            "free": False
        }
    }
}

# ==================== CONFIGURAÇÃO ====================
CONFIG_FILE = Path(__file__).parent / "config.json"

def load_config():
    """Carrega configuração do arquivo"""
    default_config = {
        "provider": "openrouter",  # "openrouter" ou "gemini"
        "gemini_api_key": os.getenv("GEMINI_API_KEY", ""),
        "openrouter_api_key": os.getenv("OPENROUTER_API_KEY", ""),
        "selected_model": "deepseek/deepseek-r1:free",
        "auto_reply": True,
        "human_takeover_minutes": 60,
        "site_url": "https://sushiakicb.shop",
        "business_name": "Sushi Aki"
    }
    
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE) as f:
                saved = json.load(f)
                default_config.update(saved)
        except Exception:
            pass
    
    return default_config

def save_config(config):
    """Salva configuração no arquivo"""
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        print(f"Erro ao salvar config: {e}")
        return False

# Carregar configuração inicial
config = load_config()

# ==================== PROMPTS ====================
def get_system_prompt():
    return f"""Você é SORA 🍣, atendente virtual do {config.get('business_name', 'Sushi Aki')}.

Missão:
Induzir o cliente a finalizar o pedido exclusivamente pelo site:
{config.get('site_url', 'https://sushiakicb.shop')}

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

IMPORTANTE: Sempre direcione para o site {config.get('site_url', 'https://sushiakicb.shop')} para qualquer pedido ou dúvida sobre cardápio."""

def get_mensagem_inicial():
    return f"""Oi! 😊 Seja bem-vindo ao {config.get('business_name', 'Sushi Aki')} 🍣

👉 Nosso cardápio completo e os pedidos são feitos pelo site:
{config.get('site_url', 'https://sushiakicb.shop')}

Aceitamos Pix e cartão 💳
Entregamos em toda Curitiba e região, com 4 unidades físicas.

Se quiser, posso te ajudar a escolher 😉"""

def get_resposta_desconfianca():
    return f"""Entendo a preocupação 😊
Trabalhamos com 4 unidades físicas em Curitiba, e todos os pedidos são registrados pelo site oficial:
👉 {config.get('site_url', 'https://sushiakicb.shop')}

O pagamento é por Pix ou cartão, com confirmação imediata 🍣"""

DESCONFIANCA = ["golpe", "confiável", "fake", "pix antes", "site seguro", "fraude", "verdade", "mentira", "enganar", "roubo", "falso"]

# ==================== CLIENTES DE IA ====================

async def call_openrouter(messages: list, model: str) -> str:
    """Chama a API da OpenRouter"""
    api_key = config.get("openrouter_api_key", "")
    if not api_key:
        raise ValueError("API Key da OpenRouter não configurada")
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": config.get("site_url", "https://sushiakicb.shop"),
        "X-Title": config.get("business_name", "Sushi Aki Bot")
    }
    
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 500,
        "temperature": 0.7
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                raise ValueError(f"Erro OpenRouter ({response.status}): {error_text}")
            
            data = await response.json()
            return data["choices"][0]["message"]["content"]

def call_gemini(messages: list, model: str) -> str:
    """Chama a API do Google Gemini"""
    import google.generativeai as genai
    
    api_key = config.get("gemini_api_key", "")
    if not api_key:
        raise ValueError("API Key do Gemini não configurada")
    
    genai.configure(api_key=api_key)
    
    gemini_model = genai.GenerativeModel(
        model_name=model,
        system_instruction=get_system_prompt()
    )
    
    # Converter mensagens para formato Gemini
    history = []
    for msg in messages[:-1]:  # Todas menos a última
        role = "user" if msg["role"] == "user" else "model"
        history.append({"role": role, "parts": [msg["content"]]})
    
    chat = gemini_model.start_chat(history=history)
    response = chat.send_message(messages[-1]["content"])
    return response.text

async def generate_ai_response(mensagem: str, historico: list) -> str:
    """Gera resposta usando o provedor configurado"""
    provider = config.get("provider", "openrouter")
    model = config.get("selected_model", "deepseek/deepseek-r1:free")
    
    # Construir mensagens
    messages = [{"role": "system", "content": get_system_prompt()}]
    
    for msg in historico[-10:]:
        role = "user" if msg["role"] == "user" else "assistant"
        messages.append({"role": role, "content": msg["content"]})
    
    messages.append({"role": "user", "content": mensagem})
    
    try:
        if provider == "openrouter":
            return await call_openrouter(messages, model)
        else:
            return call_gemini(messages, model)
    except Exception as e:
        print(f"Erro na IA ({provider}/{model}): {e}")
        return f"Desculpe, tive um problema técnico. Por favor, acesse nosso site: {config.get('site_url', 'https://sushiakicb.shop')} 🍣"

# ==================== ESTADO GLOBAL ====================
conversas: Dict[str, Dict] = {}
websocket_clients: List[WebSocket] = []
whatsapp_status = {
    "connected": False,
    "qr_code": None,
    "phone_number": None,
    "status_text": "Desconectado"
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
            "historico_ia": [],
            "nome_cliente": chat_id.split("@")[0] if "@" in chat_id else chat_id,
            "criado_em": datetime.now().isoformat()
        }
    return conversas[chat_id]

async def broadcast_message(message: dict):
    """Envia mensagem para todos os clientes WebSocket conectados"""
    disconnected = []
    for client in websocket_clients:
        try:
            await client.send_json(message)
        except Exception:
            disconnected.append(client)
    
    for client in disconnected:
        try:
            websocket_clients.remove(client)
        except Exception:
            pass

async def gerar_resposta(chat_id: str, mensagem: str) -> str:
    """Gera resposta para o cliente"""
    conversa = get_conversa(chat_id)
    
    # Verificar desconfiança primeiro
    if detecta_desconfianca(mensagem):
        if "desconfianca" not in conversa["objecoes_tratadas"]:
            conversa["objecoes_tratadas"].append("desconfianca")
            return get_resposta_desconfianca()
    
    # Gerar resposta com IA
    resposta = await generate_ai_response(mensagem, conversa["historico_ia"])
    
    # Atualizar histórico
    conversa["historico_ia"].append({"role": "user", "content": mensagem})
    conversa["historico_ia"].append({"role": "assistant", "content": resposta})
    
    # Limitar histórico
    if len(conversa["historico_ia"]) > 20:
        conversa["historico_ia"] = conversa["historico_ia"][-20:]
    
    return resposta

# ==================== MODELS ====================

class MessageRequest(BaseModel):
    chat_id: str
    message: str

class ConfigRequest(BaseModel):
    provider: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    selected_model: Optional[str] = None
    auto_reply: Optional[bool] = None
    human_takeover_minutes: Optional[int] = None
    site_url: Optional[str] = None
    business_name: Optional[str] = None

class ManualMessageRequest(BaseModel):
    chat_id: str
    message: str

# ==================== ROTAS API ====================

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.get("/api/models")
async def get_available_models():
    """Retorna lista de modelos disponíveis"""
    return {
        "models": AVAILABLE_MODELS,
        "current_provider": config.get("provider", "openrouter"),
        "current_model": config.get("selected_model", "deepseek/deepseek-r1:free")
    }

@app.get("/api/status")
async def get_status():
    provider = config.get("provider", "openrouter")
    has_api_key = bool(config.get(f"{provider}_api_key" if provider != "gemini" else "gemini_api_key"))
    
    return {
        "whatsapp": whatsapp_status,
        "bot_config": {
            "auto_reply": config.get("auto_reply", True),
            "human_takeover_minutes": config.get("human_takeover_minutes", 60)
        },
        "conversas_ativas": len(conversas),
        "ai_configured": has_api_key,
        "provider": provider,
        "model": config.get("selected_model", "deepseek/deepseek-r1:free")
    }

@app.get("/api/config")
async def get_config():
    """Retorna configuração atual"""
    return {
        "provider": config.get("provider", "openrouter"),
        "gemini_api_key_set": bool(config.get("gemini_api_key")),
        "gemini_api_key_preview": config.get("gemini_api_key", "")[:10] + "..." if config.get("gemini_api_key") else "",
        "openrouter_api_key_set": bool(config.get("openrouter_api_key")),
        "openrouter_api_key_preview": config.get("openrouter_api_key", "")[:10] + "..." if config.get("openrouter_api_key") else "",
        "selected_model": config.get("selected_model", "deepseek/deepseek-r1:free"),
        "auto_reply": config.get("auto_reply", True),
        "human_takeover_minutes": config.get("human_takeover_minutes", 60),
        "site_url": config.get("site_url", "https://sushiakicb.shop"),
        "business_name": config.get("business_name", "Sushi Aki")
    }

@app.post("/api/config")
async def update_config(request: ConfigRequest):
    """Atualiza configuração"""
    global config
    
    updated = False
    
    if request.provider is not None:
        config["provider"] = request.provider
        updated = True
    
    if request.gemini_api_key is not None:
        config["gemini_api_key"] = request.gemini_api_key
        updated = True
    
    if request.openrouter_api_key is not None:
        config["openrouter_api_key"] = request.openrouter_api_key
        updated = True
    
    if request.selected_model is not None:
        config["selected_model"] = request.selected_model
        updated = True
    
    if request.auto_reply is not None:
        config["auto_reply"] = request.auto_reply
        updated = True
    
    if request.human_takeover_minutes is not None:
        config["human_takeover_minutes"] = request.human_takeover_minutes
        updated = True
    
    if request.site_url is not None:
        config["site_url"] = request.site_url
        updated = True
    
    if request.business_name is not None:
        config["business_name"] = request.business_name
        updated = True
    
    if updated:
        save_config(config)
        await broadcast_message({"type": "config_updated"})
    
    return {"success": True, "config": await get_config()}

@app.get("/api/conversas")
async def get_conversas():
    return {"conversas": list(conversas.values())}

@app.get("/api/conversa/{chat_id}")
async def get_conversa_by_id(chat_id: str):
    if chat_id not in conversas:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    return conversas[chat_id]

@app.post("/api/takeover/{chat_id}")
async def human_takeover(chat_id: str):
    conversa = get_conversa(chat_id)
    conversa["humano_ativo"] = True
    conversa["ultimo_humano"] = datetime.now().isoformat()
    await broadcast_message({"type": "human_takeover", "chat_id": chat_id})
    return {"success": True}

@app.post("/api/release/{chat_id}")
async def release_to_bot(chat_id: str):
    conversa = get_conversa(chat_id)
    conversa["humano_ativo"] = False
    await broadcast_message({"type": "bot_resumed", "chat_id": chat_id})
    return {"success": True}

@app.post("/api/send-message")
async def send_manual_message(request: ManualMessageRequest):
    conversa = get_conversa(request.chat_id)
    
    msg = {
        "id": f"manual_{datetime.now().timestamp()}",
        "from": "humano",
        "text": request.message,
        "timestamp": datetime.now().isoformat()
    }
    conversa["mensagens"].append(msg)
    conversa["humano_ativo"] = True
    conversa["ultimo_humano"] = datetime.now().isoformat()
    
    await broadcast_message({
        "type": "message_sent",
        "chat_id": request.chat_id,
        "message": msg
    })
    
    return {"success": True, "message": msg}

@app.post("/api/webhook/message")
async def receive_message(request: MessageRequest):
    chat_id = request.chat_id
    mensagem = request.message
    
    conversa = get_conversa(chat_id)
    
    msg_recebida = {
        "id": f"recv_{datetime.now().timestamp()}",
        "from": "cliente",
        "text": mensagem,
        "timestamp": datetime.now().isoformat()
    }
    conversa["mensagens"].append(msg_recebida)
    
    await broadcast_message({
        "type": "message_received",
        "chat_id": chat_id,
        "message": msg_recebida
    })
    
    # Verificar se bot pode responder
    if conversa["humano_ativo"]:
        if conversa["ultimo_humano"]:
            ultimo = datetime.fromisoformat(conversa["ultimo_humano"])
            diff_minutes = (datetime.now() - ultimo).total_seconds() / 60
            if diff_minutes > config.get("human_takeover_minutes", 60):
                conversa["humano_ativo"] = False
            else:
                return {"response": None, "reason": "human_active"}
    
    if not config.get("auto_reply", True):
        return {"response": None, "reason": "auto_reply_disabled"}
    
    # Gerar resposta
    if not conversa["mensagem_inicial_enviada"]:
        resposta = get_mensagem_inicial()
        conversa["mensagem_inicial_enviada"] = True
    else:
        resposta = await gerar_resposta(chat_id, mensagem)
    
    msg_enviada = {
        "id": f"sent_{datetime.now().timestamp()}",
        "from": "bot",
        "text": resposta,
        "timestamp": datetime.now().isoformat()
    }
    conversa["mensagens"].append(msg_enviada)
    
    await broadcast_message({
        "type": "message_sent",
        "chat_id": chat_id,
        "message": msg_enviada
    })
    
    return {"response": resposta}

@app.post("/api/webhook/status")
async def update_whatsapp_status(request: Request):
    global whatsapp_status
    
    try:
        status = await request.json()
    except Exception:
        return {"success": False, "error": "Invalid JSON"}
    
    if "connected" in status:
        whatsapp_status["connected"] = status["connected"]
    if "qr_code" in status:
        whatsapp_status["qr_code"] = status["qr_code"]
    if "phone_number" in status:
        whatsapp_status["phone_number"] = status["phone_number"]
    if "status_text" in status:
        whatsapp_status["status_text"] = status["status_text"]
    
    await broadcast_message({"type": "status_update", "status": whatsapp_status})
    
    return {"success": True}

@app.post("/api/test-ai")
async def test_ai():
    """Testa conexão com a IA configurada"""
    provider = config.get("provider", "openrouter")
    model = config.get("selected_model", "deepseek/deepseek-r1:free")
    
    messages = [
        {"role": "system", "content": "Responda apenas: OK"},
        {"role": "user", "content": "Teste"}
    ]
    
    try:
        if provider == "openrouter":
            if not config.get("openrouter_api_key"):
                return {"success": False, "error": "API Key da OpenRouter não configurada"}
            response = await call_openrouter(messages, model)
        else:
            if not config.get("gemini_api_key"):
                return {"success": False, "error": "API Key do Gemini não configurada"}
            response = call_gemini(messages, model)
        
        return {
            "success": True, 
            "response": response[:100],
            "provider": provider,
            "model": model
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.delete("/api/conversas")
async def clear_conversas():
    global conversas
    conversas = {}
    return {"success": True}

@app.delete("/api/conversa/{chat_id}")
async def delete_conversa(chat_id: str):
    if chat_id in conversas:
        del conversas[chat_id]
        return {"success": True}
    raise HTTPException(status_code=404, detail="Conversa não encontrada")

# ==================== WEBSOCKET ====================

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    websocket_clients.append(websocket)
    
    try:
        await websocket.send_json({
            "type": "init",
            "status": whatsapp_status,
            "config": {
                "auto_reply": config.get("auto_reply", True),
                "human_takeover_minutes": config.get("human_takeover_minutes", 60)
            },
            "conversas": list(conversas.values())
        })
    except Exception:
        pass
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                cmd = json.loads(data)
                if cmd.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except Exception:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        try:
            websocket_clients.remove(websocket)
        except Exception:
            pass

# ==================== STARTUP ====================

@app.on_event("startup")
async def startup_event():
    provider = config.get("provider", "openrouter")
    model = config.get("selected_model", "deepseek/deepseek-r1:free")
    has_key = bool(config.get(f"{provider}_api_key" if provider != "gemini" else "gemini_api_key"))
    
    print("=" * 60)
    print("🍣 Sushi Aki Bot - Backend iniciado")
    print(f"📝 Config file: {CONFIG_FILE}")
    print(f"🤖 Provedor: {provider.upper()}")
    print(f"🧠 Modelo: {model}")
    print(f"🔑 API Key configurada: {'Sim' if has_key else 'Não'}")
    print(f"🌐 Site: {config.get('site_url', 'https://sushiakicb.shop')}")
    print("=" * 60)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
