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
  Download,
  Bell,
  BellOff,
  Menu,
  X,
  Smartphone,
  Share,
  Key,
  Save,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Trash2,
  ExternalLink,
  Cpu,
  Zap,
  Star
} from 'lucide-react';

// Determinar URLs
const getBackendUrl = () => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost') {
      return 'http://localhost:8001';
    }
    const envUrl = process.env.REACT_APP_BACKEND_URL;
    if (envUrl) return envUrl;
    return window.location.origin;
  }
  return '';
};

const getWhatsAppBotUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  return process.env.REACT_APP_WHATSAPP_BOT_URL || '';
};

const BACKEND_URL = getBackendUrl();
const WHATSAPP_BOT_URL = getWhatsAppBotUrl();

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [status, setStatus] = useState({
    whatsapp: { connected: false, qr_code: null, status_text: 'Carregando...' },
    bot_config: { auto_reply: true, human_takeover_minutes: 60 },
    conversas_ativas: 0,
    gemini_configured: false
  });
  const [whatsappBotStatus, setWhatsappBotStatus] = useState({
    connected: false,
    qr: null,
    status: 'Carregando...'
  });
  const [appConfig, setAppConfig] = useState({
    gemini_api_key_set: false,
    gemini_api_key_preview: '',
    openrouter_api_key_set: false,
    openrouter_api_key_preview: '',
    selected_model: 'deepseek/deepseek-r1:free',
    auto_reply: true,
    human_takeover_minutes: 60,
    site_url: 'https://sushiakicb.shop',
    business_name: 'Sushi Aki'
  });
  const [availableModels, setAvailableModels] = useState({ openrouter: {}, gemini: {} });
  const [conversas, setConversas] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  
  // Estados para configuração
  const [newGeminiKey, setNewGeminiKey] = useState('');
  const [newOpenRouterKey, setNewOpenRouterKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState(null);
  const [testingAI, setTestingAI] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Detectar PWA
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    setIsInstalled(isStandalone);
    
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Capturar evento de instalação
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (!isInstalled) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, [isInstalled]);

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowInstallBanner(false);
      }
      setInstallPrompt(null);
    }
  };

  const requestNotifications = async () => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationsEnabled(true);
          new Notification('Sushi Aki Bot', {
            body: 'Notificações ativadas!',
            icon: '/icons/icon-192x192.png'
          });
        }
      } catch (err) {
        console.error('Erro notificações:', err);
      }
    }
  };

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
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar status do bot WhatsApp diretamente
  const fetchWhatsAppBotStatus = useCallback(async () => {
    if (!WHATSAPP_BOT_URL) return;
    
    try {
      const response = await fetch(`${WHATSAPP_BOT_URL}/qr-data`);
      if (response.ok) {
        const data = await response.json();
        setWhatsappBotStatus(data);
      }
    } catch (err) {
      console.log('Bot WhatsApp não acessível diretamente');
    }
  }, []);

  // Buscar config
  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/config`);
      if (response.ok) {
        const data = await response.json();
        setAppConfig(data);
      }
    } catch (err) {
      console.error('Erro config:', err);
    }
  }, []);

  // Buscar modelos disponíveis
  const fetchModels = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/models`);
      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.models || {});
      }
    } catch (err) {
      console.error('Erro models:', err);
    }
  }, []);

  // Buscar conversas
  const fetchConversas = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversas`);
      if (response.ok) {
        const data = await response.json();
        const newConversas = data.conversas || [];
        
        if (notificationsEnabled && conversas.length > 0) {
          newConversas.forEach(conv => {
            const oldConv = conversas.find(c => c.chat_id === conv.chat_id);
            if (oldConv && conv.mensagens?.length > oldConv.mensagens?.length) {
              const lastMsg = conv.mensagens[conv.mensagens.length - 1];
              if (lastMsg.from === 'cliente') {
                new Notification('Nova mensagem', {
                  body: `${conv.nome_cliente}: ${lastMsg.text.substring(0, 50)}...`,
                  icon: '/icons/icon-192x192.png',
                  tag: conv.chat_id
                });
              }
            }
          });
        }
        
        setConversas(newConversas);
        
        if (selectedChat) {
          const updated = newConversas.find(c => c.chat_id === selectedChat.chat_id);
          if (updated) setSelectedChat(updated);
        }
      }
    } catch (err) {
      console.error('Erro conversas:', err);
    }
  }, [selectedChat, conversas, notificationsEnabled]);

  useEffect(() => {
    fetchStatus();
    fetchConfig();
    fetchConversas();
    fetchWhatsAppBotStatus();
    
    const interval = setInterval(() => {
      fetchStatus();
      fetchConversas();
      fetchWhatsAppBotStatus();
    }, 2000);
    
    return () => clearInterval(interval);
  }, [fetchStatus, fetchConfig, fetchConversas, fetchWhatsAppBotStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChat?.mensagens]);

  // Salvar configuração
  const saveConfig = async (configData) => {
    setSavingConfig(true);
    setConfigMessage(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });
      
      if (response.ok) {
        const data = await response.json();
        setAppConfig(data.config);
        setConfigMessage({ type: 'success', text: 'Configuração salva!' });
        setNewApiKey('');
        fetchStatus();
      } else {
        setConfigMessage({ type: 'error', text: 'Erro ao salvar' });
      }
    } catch (err) {
      setConfigMessage({ type: 'error', text: 'Erro de conexão' });
    } finally {
      setSavingConfig(false);
    }
  };

  // Salvar API Key
  const saveApiKey = () => {
    if (newApiKey.trim()) {
      saveConfig({ gemini_api_key: newApiKey.trim() });
    }
  };

  // Toggle auto reply
  const toggleAutoReply = () => {
    saveConfig({ auto_reply: !appConfig.auto_reply });
  };

  // Testar Gemini
  const testGemini = async () => {
    setTestingGemini(true);
    setConfigMessage(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/test-gemini`, { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setConfigMessage({ type: 'success', text: `✅ Gemini funcionando: "${data.response}"` });
      } else {
        setConfigMessage({ type: 'error', text: `❌ Erro: ${data.error}` });
      }
    } catch (err) {
      setConfigMessage({ type: 'error', text: '❌ Erro de conexão' });
    } finally {
      setTestingGemini(false);
    }
  };

  // Enviar mensagem
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
      console.error('Erro:', err);
    }
  };

  // Takeover
  const toggleHumanTakeover = async (chatId, isHuman) => {
    try {
      const endpoint = isHuman ? 'release' : 'takeover';
      await fetch(`${BACKEND_URL}/api/${endpoint}/${chatId}`, { method: 'POST' });
      fetchConversas();
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  // Deletar conversa
  const deleteConversa = async (chatId) => {
    if (window.confirm('Deletar esta conversa?')) {
      try {
        await fetch(`${BACKEND_URL}/api/conversa/${chatId}`, { method: 'DELETE' });
        if (selectedChat?.chat_id === chatId) setSelectedChat(null);
        fetchConversas();
      } catch (err) {
        console.error('Erro:', err);
      }
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  // Status Badge
  const StatusBadge = ({ connected }) => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
      connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
    }`}>
      {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
      {connected ? 'Online' : 'Offline'}
    </div>
  );

  // Install Banner
  const InstallBanner = () => {
    if (isInstalled || !showInstallBanner) return null;
    
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-red-500 to-pink-500 p-4 z-50">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🍣</div>
            <div>
              <p className="font-bold text-white text-sm">Instalar App</p>
              <p className="text-white/80 text-xs">Acesse mais rápido!</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInstallBanner(false)} className="p-2 text-white/70">
              <X size={20} />
            </button>
            {installPrompt ? (
              <button onClick={handleInstall} className="bg-white text-red-500 px-4 py-2 rounded-full text-sm font-bold">
                Instalar
              </button>
            ) : isIOS ? (
              <button
                onClick={() => alert('Toque em "Compartilhar" ⬆️ e depois "Adicionar à Tela de Início"')}
                className="bg-white text-red-500 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1"
              >
                <Share size={16} /> Como instalar
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  // Mobile Header
  const MobileHeader = () => (
    <div className="lg:hidden fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-700 z-40">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 hover:bg-gray-800 rounded-lg">
            {mobileMenuOpen ? <X size={24} className="text-white" /> : <Menu size={24} className="text-white" />}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🍣</span>
            <span className="font-bold text-white">{appConfig.business_name || 'Sushi Aki'}</span>
          </div>
        </div>
        <StatusBadge connected={status.whatsapp.connected} />
      </div>
    </div>
  );

  // Mobile Menu
  const MobileMenu = () => {
    if (!mobileMenuOpen) return null;
    
    return (
      <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setMobileMenuOpen(false)}>
        <div className="absolute top-16 left-0 w-64 bg-gray-900 h-full border-r border-gray-700" onClick={e => e.stopPropagation()}>
          <nav className="p-4">
            <ul className="space-y-2">
              {[
                { id: 'dashboard', icon: QrCode, label: 'Dashboard' },
                { id: 'conversas', icon: MessageCircle, label: 'Conversas', badge: conversas.length },
                { id: 'configuracoes', icon: Settings, label: 'Configurações' }
              ].map(item => (
                <li key={item.id}>
                  <button
                    onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      activeTab === item.id ? 'bg-red-500 text-white' : 'text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    <item.icon size={20} />
                    {item.label}
                    {item.badge > 0 && <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-xs">{item.badge}</span>}
                  </button>
                </li>
              ))}
            </ul>
            
            <div className="mt-6 pt-6 border-t border-gray-700 space-y-3">
              {!isInstalled && (
                <button
                  onClick={isIOS ? () => alert('Compartilhar → Adicionar à Tela de Início') : handleInstall}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl text-white font-medium"
                >
                  <Download size={20} />
                  Instalar App
                </button>
              )}
              
              <button
                onClick={notificationsEnabled ? () => {} : requestNotifications}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium ${
                  notificationsEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'
                }`}
              >
                {notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
                {notificationsEnabled ? 'Notificações Ativas' : 'Ativar Notificações'}
              </button>
            </div>
          </nav>
        </div>
      </div>
    );
  };

  // Sidebar Desktop
  const Sidebar = () => (
    <div className="hidden lg:flex w-64 bg-gray-900 border-r border-gray-700 flex-col">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-xl">🍣</div>
          <div>
            <h1 className="font-bold text-lg text-white">{appConfig.business_name || 'Sushi Aki'}</h1>
            <p className="text-xs text-gray-400">Bot WhatsApp</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {[
            { id: 'dashboard', icon: QrCode, label: 'Dashboard' },
            { id: 'conversas', icon: MessageCircle, label: 'Conversas', badge: conversas.length },
            { id: 'configuracoes', icon: Settings, label: 'Configurações' }
          ].map(item => (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                data-testid={`nav-${item.id}`}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === item.id ? 'bg-red-500 text-white' : 'text-gray-400 hover:bg-gray-800'
                }`}
              >
                <item.icon size={20} />
                {item.label}
                {item.badge > 0 && <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-xs">{item.badge}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-700">
        <StatusBadge connected={status.whatsapp.connected || whatsappBotStatus.connected} />
        {!status.gemini_configured && (
          <div className="mt-3 p-2 bg-yellow-500/20 rounded-lg">
            <p className="text-yellow-400 text-xs flex items-center gap-1">
              <AlertCircle size={12} />
              API Gemini não configurada
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // Determinar status real do WhatsApp (combinar backend + bot direto)
  const isWhatsAppConnected = status.whatsapp.connected || whatsappBotStatus.connected;
  const currentQRCode = status.whatsapp.qr_code || whatsappBotStatus.qr;
  const whatsappStatusText = whatsappBotStatus.connected ? 'Conectado!' : (whatsappBotStatus.status || status.whatsapp.status_text);

  // Dashboard View
  const DashboardView = () => (
    <div className="p-4 lg:p-8">
      <h2 className="text-xl lg:text-2xl font-bold mb-6 text-white">Dashboard</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}
      
      {!status.gemini_configured && (
        <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-yellow-400 font-medium">API do Gemini não configurada</p>
              <p className="text-yellow-400/70 text-sm mt-1">
                Vá em Configurações para adicionar sua API Key do Google Gemini
              </p>
              <button
                onClick={() => setActiveTab('configuracoes')}
                className="mt-2 text-yellow-400 text-sm underline"
              >
                Configurar agora →
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 rounded-2xl p-4 lg:p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Status</p>
              <p className="text-lg lg:text-xl font-bold mt-1 text-white">
                {isWhatsAppConnected ? 'Online' : 'Offline'}
              </p>
            </div>
            <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center ${
              isWhatsAppConnected ? 'bg-green-500/20' : 'bg-yellow-500/20'
            }`}>
              <Phone size={20} className={isWhatsAppConnected ? 'text-green-400' : 'text-yellow-400'} />
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-2xl p-4 lg:p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Conversas</p>
              <p className="text-lg lg:text-xl font-bold mt-1 text-white">{conversas.length}</p>
            </div>
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-red-400" />
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-2xl p-4 lg:p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Auto Resposta</p>
              <p className="text-lg lg:text-xl font-bold mt-1 text-white">
                {appConfig.auto_reply ? 'Ativada' : 'Desativada'}
              </p>
            </div>
            <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center ${
              appConfig.auto_reply ? 'bg-teal-500/20' : 'bg-gray-500/20'
            }`}>
              <Bot size={20} className={appConfig.auto_reply ? 'text-teal-400' : 'text-gray-400'} />
            </div>
          </div>
        </div>
      </div>
      
      {/* QR Code Section */}
      {!isWhatsAppConnected ? (
        <div className="bg-gray-800 rounded-2xl p-6 lg:p-8 border border-gray-700">
          <div className="text-center">
            <h3 className="text-lg lg:text-xl font-bold mb-4 text-white">Conectar WhatsApp</h3>
            <p className="text-gray-400 mb-2 text-sm">
              Escaneie o QR Code com seu WhatsApp
            </p>
            <p className="text-gray-500 mb-6 text-xs">
              Status: {whatsappStatusText}
            </p>
            
            {currentQRCode ? (
              <div className="inline-block bg-white p-3 lg:p-4 rounded-2xl">
                <img 
                  src={currentQRCode} 
                  alt="QR Code" 
                  className="w-48 h-48 lg:w-64 lg:h-64"
                  data-testid="qr-code-image"
                />
              </div>
            ) : (
              <div className="inline-flex flex-col items-center gap-4">
                <div className="w-48 h-48 lg:w-64 lg:h-64 bg-gray-700 rounded-2xl flex items-center justify-center">
                  <RefreshCw size={32} className="text-gray-500 animate-spin" />
                </div>
                <p className="text-gray-500 text-sm">Aguardando QR Code...</p>
                <p className="text-gray-600 text-xs">Certifique-se que o bot WhatsApp está rodando</p>
              </div>
            )}
            
            <div className="mt-6 text-xs lg:text-sm text-gray-400">
              <p className="font-medium mb-2">Como conectar:</p>
              <ol className="text-left max-w-xs mx-auto space-y-1">
                <li>1. Abra o WhatsApp</li>
                <li>2. Configurações → Aparelhos conectados</li>
                <li>3. Conectar um aparelho</li>
                <li>4. Escaneie o QR Code</li>
              </ol>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-2xl p-6 lg:p-8 border border-green-500/30">
          <div className="text-center">
            <div className="w-16 h-16 lg:w-20 lg:h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-400" />
            </div>
            <h3 className="text-lg lg:text-xl font-bold text-green-400 mb-2">WhatsApp Conectado!</h3>
            <p className="text-gray-400 text-sm">O bot está respondendo automaticamente</p>
            {(status.whatsapp.phone_number || whatsappBotStatus.phone_number) && (
              <p className="text-gray-500 mt-2 text-sm">Número: {status.whatsapp.phone_number || whatsappBotStatus.phone_number}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Conversas View
  const ConversasView = () => (
    <div className="flex h-full">
      <div className={`w-full lg:w-80 bg-gray-900 border-r border-gray-700 flex flex-col ${
        selectedChat ? 'hidden lg:flex' : 'flex'
      }`}>
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-bold text-white">Conversas</h3>
          <p className="text-sm text-gray-400">{conversas.length} ativas</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversas.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
              <p>Nenhuma conversa</p>
            </div>
          ) : (
            conversas.map((conversa) => (
              <div
                key={conversa.chat_id}
                className={`p-4 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                  selectedChat?.chat_id === conversa.chat_id ? 'bg-gray-800' : ''
                }`}
              >
                <button
                  onClick={() => setSelectedChat(conversa)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                      <User size={20} className="text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate text-white text-sm">{conversa.nome_cliente}</p>
                        {conversa.humano_ativo && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                            Humano
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {conversa.mensagens?.slice(-1)[0]?.text || 'Nova conversa'}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className={`flex-1 flex flex-col bg-gray-900 ${selectedChat ? 'flex' : 'hidden lg:flex'}`}>
        {selectedChat ? (
          <>
            <div className="p-3 lg:p-4 border-b border-gray-700 flex items-center justify-between bg-gray-800">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedChat(null)}
                  className="lg:hidden p-2 hover:bg-gray-700 rounded-lg text-white"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                  <User size={16} className="text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-white text-sm">{selectedChat.nome_cliente}</p>
                  <p className="text-xs text-gray-400">
                    {selectedChat.humano_ativo ? '🧑 Humano' : '🤖 Bot'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleHumanTakeover(selectedChat.chat_id, selectedChat.humano_ativo)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    selectedChat.humano_ativo
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {selectedChat.humano_ativo ? 'Devolver' : 'Assumir'}
                </button>
                <button
                  onClick={() => deleteConversa(selectedChat.chat_id)}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedChat.mensagens?.map((msg, idx) => (
                <div key={msg.id || idx} className={`flex ${msg.from === 'cliente' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] lg:max-w-[70%] rounded-2xl px-4 py-2 ${
                    msg.from === 'cliente'
                      ? 'bg-gray-800 border border-gray-700 text-white'
                      : msg.from === 'bot'
                        ? 'bg-red-500 text-white'
                        : 'bg-teal-500 text-white'
                  }`}>
                    <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                      msg.from === 'cliente' ? 'text-gray-500' : 'text-white/70'
                    }`}>
                      <Clock size={10} />
                      {formatTime(msg.timestamp)}
                      {msg.from !== 'cliente' && <CheckCheck size={12} className="ml-1" />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="p-3 lg:p-4 border-t border-gray-700 bg-gray-800">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm"
                />
                <button onClick={sendMessage} className="p-2.5 bg-red-500 hover:bg-red-600 rounded-xl">
                  <Send size={18} className="text-white" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
              <p>Selecione uma conversa</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Configurações View
  const ConfiguracoesView = () => (
    <div className="p-4 lg:p-8 max-w-2xl overflow-y-auto">
      <h2 className="text-xl lg:text-2xl font-bold mb-6 text-white">Configurações</h2>
      
      {configMessage && (
        <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 ${
          configMessage.type === 'success' 
            ? 'bg-green-500/20 border border-green-500/50 text-green-400' 
            : 'bg-red-500/20 border border-red-500/50 text-red-400'
        }`}>
          {configMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm">{configMessage.text}</span>
        </div>
      )}
      
      <div className="space-y-4">
        {/* API Key Gemini */}
        <div className="bg-gray-800 rounded-2xl p-4 lg:p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Key size={20} className="text-red-400" />
            <h3 className="font-bold text-white">API Key do Gemini</h3>
          </div>
          
          {appConfig.gemini_api_key_set ? (
            <div className="mb-4 p-3 bg-green-500/20 rounded-lg flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <span className="text-green-400 text-sm">
                Configurada: {appConfig.gemini_api_key_preview}
              </span>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-yellow-500/20 rounded-lg flex items-center gap-2">
              <AlertCircle size={16} className="text-yellow-400" />
              <span className="text-yellow-400 text-sm">Não configurada</span>
            </div>
          )}
          
          <div className="space-y-3">
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="Cole sua API Key aqui..."
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={saveApiKey}
                disabled={!newApiKey.trim() || savingConfig}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
              >
                {savingConfig ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar API Key
              </button>
              
              <button
                onClick={testGemini}
                disabled={!appConfig.gemini_api_key_set || testingGemini}
                className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2"
              >
                {testingGemini ? <RefreshCw size={16} className="animate-spin" /> : <Bot size={16} />}
                Testar
              </button>
            </div>
            
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
            >
              <ExternalLink size={12} />
              Obter API Key no Google AI Studio
            </a>
          </div>
        </div>
        
        {/* Auto Reply */}
        <div className="bg-gray-800 rounded-2xl p-4 lg:p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-sm lg:text-base">Resposta Automática</h3>
              <p className="text-xs lg:text-sm text-gray-400 mt-1">Bot responde automaticamente</p>
            </div>
            <button onClick={toggleAutoReply} disabled={savingConfig}>
              {appConfig.auto_reply 
                ? <ToggleRight size={36} className="text-red-500" />
                : <ToggleLeft size={36} className="text-gray-500" />
              }
            </button>
          </div>
        </div>
        
        {/* Modelo Gemini */}
        <div className="bg-gray-800 rounded-2xl p-4 lg:p-6 border border-gray-700">
          <h3 className="font-bold text-white text-sm lg:text-base mb-3">Modelo do Gemini</h3>
          <select
            value={appConfig.gemini_model}
            onChange={(e) => saveConfig({ gemini_model: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-red-500"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado)</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
          </select>
        </div>
        
        {/* Notificações */}
        <div className="bg-gray-800 rounded-2xl p-4 lg:p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-sm lg:text-base">Notificações Push</h3>
              <p className="text-xs lg:text-sm text-gray-400 mt-1">Alertas de novas mensagens</p>
            </div>
            <button onClick={notificationsEnabled ? () => {} : requestNotifications}>
              {notificationsEnabled 
                ? <Bell size={24} className="text-green-400" />
                : <BellOff size={24} className="text-gray-500" />
              }
            </button>
          </div>
        </div>
        
        {/* Sobre */}
        <div className="bg-gray-800 rounded-2xl p-4 lg:p-6 border border-gray-700">
          <h3 className="font-bold mb-4 text-white text-sm lg:text-base">Sobre</h3>
          <div className="space-y-2 text-xs lg:text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Versão</span>
              <span className="text-white">1.1.0 (PWA)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Negócio</span>
              <span className="text-white">{appConfig.business_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Site</span>
              <a href={appConfig.site_url} target="_blank" rel="noopener noreferrer" className="text-red-400">
                {appConfig.site_url}
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Instalado</span>
              <span className="text-white">{isInstalled ? '✅ Sim' : '❌ Não'}</span>
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
          <div className="text-5xl mb-4 animate-bounce">🍣</div>
          <RefreshCw size={32} className="mx-auto mb-4 animate-spin text-red-500" />
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-900" data-testid="sushiaki-bot-app">
      <MobileHeader />
      <MobileMenu />
      <Sidebar />
      
      <main className="flex-1 overflow-hidden pt-16 lg:pt-0 h-screen lg:h-auto" style={{ paddingBottom: showInstallBanner ? '80px' : '0' }}>
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'conversas' && <ConversasView />}
        {activeTab === 'configuracoes' && <ConfiguracoesView />}
      </main>
      
      <InstallBanner />
    </div>
  );
}

export default App;
