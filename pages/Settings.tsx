import React, { useState } from 'react';
import { 
  Settings as SettingsIcon,
  Key,
  RefreshCw,
  Gauge,
  Shield,
  Clock,
  Save,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Calendar,
  Plug
} from 'lucide-react';
import Button from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// Toggle Component
const Toggle = ({ label, checked, onChange, description }: { 
  label: string, 
  checked: boolean, 
  onChange: () => void, 
  description?: string 
}) => (
  <div className="flex items-start justify-between py-3">
    <div className="pr-4">
      <label className="text-sm font-medium text-gray-700 cursor-pointer select-none" onClick={onChange}>
        {label}
      </label>
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
    </div>
    <button 
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
        checked ? 'bg-primary' : 'bg-gray-200'
      }`}
    >
      <span 
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

// Histórico de rotação de tokens será carregado do banco de dados quando implementado

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'general' | 'tokens' | 'limits' | 'security'>('general');
  
  // General Settings
  const [autoSync, setAutoSync] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [emailReports, setEmailReports] = useState(false);
  
  // Token Rotation
  const [rotationInterval, setRotationInterval] = useState('30');
  const [autoRotation, setAutoRotation] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [tokenRotationHistory, setTokenRotationHistory] = useState<Array<{ id: string; date: string; type: string; status: string }>>([]);
  
  // Rate Limits
  const [olistRateLimit, setOlistRateLimit] = useState('60');
  const [contaAzulRateLimit, setContaAzulRateLimit] = useState('100');
  const [maxConcurrentJobs, setMaxConcurrentJobs] = useState('5');
  
  // Security
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('60');
  const [ipWhitelist, setIpWhitelist] = useState<string[]>([]);
  const [newIp, setNewIp] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<'success' | 'error' | null>(null);

  const handleSave = () => {
    setIsSaving(true);
    setSaveMessage(null);
    // Simular salvamento
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage('success');
      setTimeout(() => setSaveMessage(null), 3000);
    }, 1500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Idealmente mostraria um toast
  };

  const addIpToWhitelist = () => {
    if (newIp && !ipWhitelist.includes(newIp)) {
      setIpWhitelist([...ipWhitelist, newIp]);
      setNewIp('');
    }
  };

  const removeIpFromWhitelist = (ip: string) => {
    setIpWhitelist(ipWhitelist.filter(i => i !== ip));
  };

  const tabs = [
    { id: 'general', label: 'Geral', icon: SettingsIcon },
    { id: 'tokens', label: 'Tokens', icon: Key },
    { id: 'limits', label: 'Limites', icon: Gauge },
    { id: 'security', label: 'Segurança', icon: Shield }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-500">Gerencie as configurações do sistema e integrações</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => navigate('/test-connections')}
        >
          <Plug size={16} className="mr-2" />
          Testar Conexões
        </Button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Tab: General */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurações Gerais</h3>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200">
                      <Toggle
                        label="Sincronização Automática"
                        description="Executa sincronizações automaticamente em intervalos configurados"
                        checked={autoSync}
                        onChange={() => setAutoSync(!autoSync)}
                      />
                      <Toggle
                        label="Notificações por E-mail"
                        description="Receba alertas por e-mail quando ocorrerem erros ou eventos importantes"
                        checked={notifications}
                        onChange={() => setNotifications(!notifications)}
                      />
                      <Toggle
                        label="Relatórios Semanais"
                        description="Envia relatório semanal por e-mail com resumo de vendas e sincronizações"
                        checked={emailReports}
                        onChange={() => setEmailReports(!emailReports)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Tokens */}
              {activeTab === 'tokens' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Rotação de Tokens</h3>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
                      <Toggle
                        label="Rotação Automática de Tokens"
                        description="Renova tokens automaticamente antes da expiração"
                        checked={autoRotation}
                        onChange={() => setAutoRotation(!autoRotation)}
                      />
                      
                      {autoRotation && (
                        <div className="pt-4 border-t border-gray-200">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Intervalo de Rotação (dias)
                          </label>
                          <input
                            type="number"
                            value={rotationInterval}
                            onChange={(e) => setRotationInterval(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                            min="1"
                            max="90"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Tokens serão renovados automaticamente a cada {rotationInterval} dias
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Chave de API do Sistema</h3>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Key
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey || ''}
                          readOnly
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white font-mono text-sm"
                          placeholder={apiKey ? undefined : 'Nenhuma API key configurada'}
                        />
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(apiKey)}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <Copy size={18} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Use esta chave para autenticar requisições à API do sistema
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Histórico de Rotação</h3>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Data
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Tipo
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {tokenRotationHistory.length > 0 ? (
                              tokenRotationHistory.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {new Date(item.date).toLocaleString('pt-BR')}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">{item.type}</td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                      item.status === 'success'
                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                        : 'bg-red-100 text-red-700 border border-red-200'
                                    }`}>
                                      {item.status === 'success' ? 'Sucesso' : 'Erro'}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                                  Nenhum histórico de rotação disponível ainda.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Limits */}
              {activeTab === 'limits' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Limites de Rate Limiting</h3>
                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Olist - Requisições por Minuto
                        </label>
                        <input
                          type="number"
                          value={olistRateLimit}
                          onChange={(e) => setOlistRateLimit(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                          min="1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Limite máximo de requisições por minuto para a API do Olist
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ContaAzul - Requisições por Minuto
                        </label>
                        <input
                          type="number"
                          value={contaAzulRateLimit}
                          onChange={(e) => setContaAzulRateLimit(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                          min="1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Limite máximo de requisições por minuto para a API do ContaAzul
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Jobs Concorrentes Máximos
                        </label>
                        <input
                          type="number"
                          value={maxConcurrentJobs}
                          onChange={(e) => setMaxConcurrentJobs(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                          min="1"
                          max="20"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Número máximo de jobs de sincronização executados simultaneamente
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Security */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Segurança</h3>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200">
                      <Toggle
                        label="Autenticação de Dois Fatores (2FA)"
                        description="Adicione uma camada extra de segurança à sua conta (em breve)"
                        checked={twoFactorAuth}
                        onChange={() => setTwoFactorAuth(!twoFactorAuth)}
                      />
                      <div className="py-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Timeout de Sessão (minutos)
                        </label>
                        <input
                          type="number"
                          value={sessionTimeout}
                          onChange={(e) => setSessionTimeout(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                          min="5"
                          max="480"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Tempo de inatividade antes de desconectar automaticamente
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Whitelist de IPs</h3>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newIp}
                          onChange={(e) => setNewIp(e.target.value)}
                          placeholder="Ex: 192.168.1.1"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                        <Button onClick={addIpToWhitelist} variant="secondary">
                          <Plus size={16} className="mr-2" />
                          Adicionar
                        </Button>
                      </div>

                      {ipWhitelist.length > 0 ? (
                        <div className="space-y-2">
                          {ipWhitelist.map((ip) => (
                            <div
                              key={ip}
                              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                            >
                              <span className="text-sm font-mono text-gray-900">{ip}</span>
                              <button
                                onClick={() => removeIpFromWhitelist(ip)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Shield size={32} className="mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">Nenhum IP na whitelist</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Adicione IPs para restringir o acesso à API
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer com botão Salvar */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div>
            {saveMessage === 'success' && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 size={16} />
                <span>Configurações salvas com sucesso!</span>
              </div>
            )}
            {saveMessage === 'error' && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={16} />
                <span>Erro ao salvar configurações</span>
              </div>
            )}
          </div>
          <Button onClick={handleSave} isLoading={isSaving}>
            <Save size={16} className="mr-2" />
            Salvar Alterações
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;

