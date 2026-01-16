import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, 
  Send, 
  QrCode, 
  Settings, 
  Users, 
  Bot, 
  User, 
  Check, 
  CheckCheck,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  Phone,
  ExternalLink
} from 'lucide-react';

// Determinar URL do backend baseado no ambiente
const getBackendUrl = () => {
  // Se estiver rodando em localhost, usar localhost
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:8001';
  }
  // Caso contrário, usar URL do .env ou construir baseado no hostname
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  if (envUrl) return envUrl;
  
  // Fallback: usar mesmo hostname com porta 8001 ou /api
  return window.location.origin;
};

const BACKEND_URL = getBackendUrl();

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [status, setStatus] = useState({
    whatsapp: { connected: false, qr_code: null, status_text: 'Carregando...' },
    bot_config: { auto_reply: true, human_takeover_minutes: 60 },
    conversas_ativas: 0,
    gemini_configured: false
  });
  const [conversas, setConversas] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Buscar status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setError(null);
      }
    } catch (err) {
      console.error('Erro ao buscar status:', err);
      setError('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar conversas
  const fetchConversas = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversas`);
      if (response.ok) {
        const data = await response.json();
        setConversas(data.conversas || []);
        
        // Atualizar chat selecionado se existir
        if (selectedChat) {
          const updated = data.conversas?.find(c => c.chat_id === selectedChat.chat_id);
          if (updated) {
            setSelectedChat(updated);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar conversas:', err);
    }
  }, [selectedChat]);

  useEffect(() => {
    fetchStatus();
    fetchConversas();
    
    // Polling a cada 2 segundos
    const interval = setInterval(() => {
      fetchStatus();
      fetchConversas();
    }, 2000);
    
    return () => clearInterval(interval);
  }, [fetchStatus, fetchConversas]);

  // Scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChat?.mensagens]);

  // Enviar mensagem manual
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    try {
      await fetch(`${BACKEND_URL}/api/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: selectedChat.chat_id,
          message: newMessage
        })
      });
      setNewMessage('');
      fetchConversas();
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    }
  };

  // Toggle auto reply
  const toggleAutoReply = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_reply: !status.bot_config.auto_reply
        })
      });
      fetchStatus();
    } catch (err) {
      console.error('Erro ao atualizar config:', err);
    }
  };

  // Assumir/Liberar conversa
  const toggleHumanTakeover = async (chatId, isHuman) => {
    try {
      const endpoint = isHuman ? 'release' : 'takeover';
      await fetch(`${BACKEND_URL}/api/${endpoint}/${chatId}`, {
        method: 'POST'
      });
      fetchConversas();
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  // Testar Gemini
  const testGemini = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/test-gemini`, {
        method: 'POST'
      });
      const data = await response.json();
      alert(data.success ? `✅ Gemini OK: ${data.response}` : `❌ Erro: ${data.error}`);
    } catch (err) {
      alert('❌ Erro ao testar Gemini');
    }
  };

  // Formatar data
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Componente de Status Badge
  const StatusBadge = ({ connected }) => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
      connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
    }`}>
      {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
      {connected ? 'Conectado' : 'Desconectado'}
    </div>
  );

  // Sidebar
  const Sidebar = () => (
    <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-xl">
            🍣
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">Sushi Aki</h1>
            <p className="text-xs text-gray-400">Bot WhatsApp</p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => setActiveTab('dashboard')}
              data-testid="nav-dashboard"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'dashboard' 
                  ? 'bg-red-500 text-white' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <QrCode size={20} />
              Dashboard
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('conversas')}
              data-testid="nav-conversas"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'conversas' 
                  ? 'bg-red-500 text-white' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <MessageCircle size={20} />
              Conversas
              {conversas.length > 0 && (
                <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {conversas.length}
                </span>
              )}
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('configuracoes')}
              data-testid="nav-config"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'configuracoes' 
                  ? 'bg-red-500 text-white' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Settings size={20} />
              Configurações
            </button>
          </li>
        </ul>
      </nav>
      
      {/* Status */}
      <div className="p-4 border-t border-gray-700">
        <StatusBadge connected={status.whatsapp.connected} />
      </div>
    </div>
  );

  // Dashboard View
  const DashboardView = () => (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6 text-white">Dashboard</h2>
      
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400">
          {error}
        </div>
      )}
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Status WhatsApp</p>
              <p className="text-xl font-bold mt-1 text-white">
                {status.whatsapp.connected ? 'Online' : status.whatsapp.status_text}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              status.whatsapp.connected ? 'bg-green-500/20' : 'bg-yellow-500/20'
            }`}>
              <Phone size={24} className={
                status.whatsapp.connected ? 'text-green-400' : 'text-yellow-400'
              } />
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Conversas Ativas</p>
              <p className="text-xl font-bold mt-1 text-white">{conversas.length}</p>
            </div>
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
              <Users size={24} className="text-red-400" />
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Auto Resposta</p>
              <p className="text-xl font-bold mt-1 text-white">
                {status.bot_config.auto_reply ? 'Ativada' : 'Desativada'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              status.bot_config.auto_reply ? 'bg-teal-500/20' : 'bg-gray-500/20'
            }`}>
              <Bot size={24} className={
                status.bot_config.auto_reply ? 'text-teal-400' : 'text-gray-400'
              } />
            </div>
          </div>
        </div>
      </div>
      
      {/* QR Code Section */}
      {!status.whatsapp.connected && (
        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-4 text-white">Conectar WhatsApp</h3>
            <p className="text-gray-400 mb-6">
              Escaneie o QR Code abaixo com o WhatsApp do celular
            </p>
            
            {status.whatsapp.qr_code ? (
              <div className="inline-block bg-white p-4 rounded-2xl">
                <img 
                  src={status.whatsapp.qr_code} 
                  alt="QR Code" 
                  className="w-64 h-64"
                  data-testid="qr-code-image"
                />
              </div>
            ) : (
              <div className="inline-flex flex-col items-center gap-4">
                <div className="w-64 h-64 bg-gray-700 rounded-2xl flex items-center justify-center">
                  <RefreshCw size={32} className="text-gray-500 animate-spin" />
                </div>
                <p className="text-gray-500">Aguardando QR Code...</p>
              </div>
            )}
            
            <div className="mt-6 text-sm text-gray-400">
              <p className="font-medium mb-2">Como conectar:</p>
              <ol className="text-left max-w-xs mx-auto space-y-1">
                <li>1. Abra o WhatsApp no celular</li>
                <li>2. Vá em Configurações → Aparelhos conectados</li>
                <li>3. Toque em "Conectar um aparelho"</li>
                <li>4. Escaneie este QR Code</li>
              </ol>
            </div>
          </div>
        </div>
      )}
      
      {/* Connected Status */}
      {status.whatsapp.connected && (
        <div className="bg-gray-800 rounded-2xl p-8 border border-green-500/30">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={40} className="text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-green-400 mb-2">WhatsApp Conectado!</h3>
            <p className="text-gray-400">
              O bot está ativo e respondendo mensagens automaticamente
            </p>
            {status.whatsapp.phone_number && (
              <p className="text-gray-500 mt-2 text-sm">
                Número: {status.whatsapp.phone_number}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Conversas View
  const ConversasView = () => (
    <div className="flex h-full">
      {/* Lista de Conversas */}
      <div className={`w-80 bg-gray-900 border-r border-gray-700 flex flex-col ${
        selectedChat ? 'hidden md:flex' : 'flex'
      }`}>
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-bold text-white">Conversas</h3>
          <p className="text-sm text-gray-400">{conversas.length} ativas</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversas.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
              <p>Nenhuma conversa ainda</p>
              <p className="text-sm mt-2">As conversas aparecerão aqui quando clientes enviarem mensagens</p>
            </div>
          ) : (
            conversas.map((conversa) => (
              <button
                key={conversa.chat_id}
                onClick={() => setSelectedChat(conversa)}
                data-testid={`conversa-${conversa.chat_id}`}
                className={`w-full p-4 border-b border-gray-800 hover:bg-gray-800 transition-colors text-left ${
                  selectedChat?.chat_id === conversa.chat_id ? 'bg-gray-800' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                    <User size={20} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate text-white">{conversa.nome_cliente}</p>
                      {conversa.humano_ativo && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                          Humano
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 truncate">
                      {conversa.mensagens?.slice(-1)[0]?.text || 'Nova conversa'}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      
      {/* Chat View */}
      <div className={`flex-1 flex flex-col bg-gray-900 ${
        selectedChat ? 'flex' : 'hidden md:flex'
      }`}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-800">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedChat(null)}
                  className="md:hidden p-2 hover:bg-gray-700 rounded-lg text-white"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                  <User size={20} className="text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-white">{selectedChat.nome_cliente}</p>
                  <p className="text-xs text-gray-400">
                    {selectedChat.humano_ativo ? '🧑 Humano ativo' : '🤖 Bot respondendo'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => toggleHumanTakeover(selectedChat.chat_id, selectedChat.humano_ativo)}
                data-testid="toggle-takeover"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedChat.humano_ativo
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                }`}
              >
                {selectedChat.humano_ativo ? 'Devolver ao Bot' : 'Assumir Conversa'}
              </button>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedChat.mensagens?.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex ${msg.from === 'cliente' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                    msg.from === 'cliente'
                      ? 'bg-gray-800 border border-gray-700 text-white'
                      : msg.from === 'bot'
                        ? 'bg-red-500 text-white'
                        : 'bg-teal-500 text-white'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                      msg.from === 'cliente' ? 'text-gray-500' : 'text-white/70'
                    }`}>
                      <Clock size={12} />
                      {formatTime(msg.timestamp)}
                      {msg.from !== 'cliente' && (
                        <CheckCheck size={14} className="ml-1" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input */}
            <div className="p-4 border-t border-gray-700 bg-gray-800">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Digite uma mensagem..."
                  data-testid="message-input"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
                <button
                  onClick={sendMessage}
                  data-testid="send-message-btn"
                  className="p-3 bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
                >
                  <Send size={20} className="text-white" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <MessageCircle size={64} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">Selecione uma conversa</p>
              <p className="text-sm mt-2">Escolha uma conversa da lista para visualizar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Configurações View
  const ConfiguracoesView = () => (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6 text-white">Configurações</h2>
      
      <div className="space-y-6">
        {/* Auto Reply */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white">Resposta Automática</h3>
              <p className="text-sm text-gray-400 mt-1">
                Quando ativado, o bot responde automaticamente às mensagens
              </p>
            </div>
            <button
              onClick={toggleAutoReply}
              data-testid="toggle-auto-reply"
              className="p-2"
            >
              {status.bot_config.auto_reply ? (
                <ToggleRight size={40} className="text-red-500" />
              ) : (
                <ToggleLeft size={40} className="text-gray-500" />
              )}
            </button>
          </div>
        </div>
        
        {/* Timeout Humano */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h3 className="font-bold mb-2 text-white">Timeout de Takeover Humano</h3>
          <p className="text-sm text-gray-400 mb-4">
            Após este tempo sem resposta humana, o bot retoma a conversa
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={status.bot_config.human_takeover_minutes}
              disabled
              className="w-24 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
            />
            <span className="text-gray-400">minutos</span>
          </div>
        </div>
        
        {/* Gemini Test */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h3 className="font-bold mb-2 text-white">Integração Gemini</h3>
          <p className="text-sm text-gray-400 mb-4">
            Status: {status.gemini_configured ? '✅ Configurado' : '❌ Não configurado'}
          </p>
          <button
            onClick={testGemini}
            data-testid="test-gemini-btn"
            className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors text-white"
          >
            Testar Conexão
          </button>
        </div>
        
        {/* Info */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h3 className="font-bold mb-4 text-white">Informações do Bot</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Versão</span>
              <span className="text-white">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Persona</span>
              <span className="text-white">SORA 🍣</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Site</span>
              <a 
                href="https://sushiakicb.shop" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-red-400 hover:underline"
              >
                sushiakicb.shop
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <RefreshCw size={48} className="mx-auto mb-4 animate-spin text-red-500" />
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-900" data-testid="sushiaki-bot-app">
      <Sidebar />
      
      <main className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'conversas' && <ConversasView />}
        {activeTab === 'configuracoes' && <ConfiguracoesView />}
      </main>
    </div>
  );
}

export default App;
