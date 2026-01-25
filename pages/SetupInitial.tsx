import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Eye, EyeOff, Copy, RefreshCw, Terminal, AlertTriangle, Settings, CheckCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import { executeSetup, checkDatabaseConfigured, type SetupConfig, onSetupLog, type SetupLogEntry } from '../services/setupService';
import { updateSupabaseConfig, isSupabaseConfigured } from '../lib/supabase';
import { generateApiKey } from '../utils/generateApiKey';
import { useTimeout } from '../hooks/useTimeout';

const DB_VERIFIED_KEY = 'db_setup_verified';

type Phase = 1 | 2 | 3;

const SetupInitial: React.FC = () => {
  const navigate = useNavigate();
  const { createTimeout } = useTimeout();
  const [phase, setPhase] = useState<Phase>(1);
  const [phase1ValidateMessage, setPhase1ValidateMessage] = useState(false);
  const [phase2Checking, setPhase2Checking] = useState(false);
  const [phase2Result, setPhase2Result] = useState<{ configured: boolean; hint?: 'exposed_schemas' | 'function_not_found' } | null>(null);

  // Estado do formulário
  const [formData, setFormData] = useState<SetupConfig & { db_password?: string }>({
    supabase_url: '',
    supabase_anon_key: '',
    service_role_key: '',
    db_password: '',
    ca_client_id: '',
    ca_client_secret: '',
    system_api_key: generateApiKey(),
  });

  // Estado da UI
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({
    service_role_key: false,
    db_password: false,
    ca_client_secret: false,
    system_api_key: false,
  });
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string; details?: any } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  
  // Estado para logs
  const [logs, setLogs] = useState<SetupLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Definir fase inicial ao montar (apenas uma vez)
  useEffect(() => {
    const config = isSupabaseConfigured();
    if (config) {
      setPhase(2);
      setPhase2Checking(true);
      setPhase2Result(null);
      const url = localStorage.getItem('supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
      const key = localStorage.getItem('supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      checkDatabaseConfigured(url, key).then((r) => {
        setPhase2Result(r);
        setPhase2Checking(false);
      });
    } else {
      setPhase(1);
      setPhase1ValidateMessage(false);
    }
  }, []);

  // Registrar callback de logs
  useEffect(() => {
    onSetupLog((entry) => {
      setLogs((prev) => [...prev, entry]);
    });
    return () => {
      onSetupLog(null);
    };
  }, []);

  // Auto-scroll dos logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Handlers
  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPasswords({ ...showPasswords, [field]: !showPasswords[field] });
  };

  const handleGenerateApiKey = () => {
    setFormData({ ...formData, system_api_key: generateApiKey() });
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    createTimeout(() => setCopied(null), 2000);
  };

  const handleVerifyAgain = async () => {
    const supabaseUrl = formData.supabase_url || localStorage.getItem('supabase_url') || import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = formData.supabase_anon_key || localStorage.getItem('supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return;
    }
    setIsVerifying(true);
    localStorage.removeItem(DB_VERIFIED_KEY);
    try {
      const { configured } = await checkDatabaseConfigured(supabaseUrl, supabaseAnonKey);
      if (configured) {
        localStorage.setItem(DB_VERIFIED_KEY, 'true');
        setPhase(2);
        setPhase2Result({ configured: true });
      } else {
        setPhase2Result({ configured: false, hint: 'exposed_schemas' });
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleGoToPhase3 = () => {
    const url = localStorage.getItem('supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
    const key = localStorage.getItem('supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    setFormData((prev) => ({ ...prev, supabase_url: url || prev.supabase_url, supabase_anon_key: key || prev.supabase_anon_key }));
    setPhase(3);
    setPhase2Result(null);
  };

  const handleGoToLogin = () => {
    localStorage.setItem(DB_VERIFIED_KEY, 'true');
    navigate('/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);
    setLogs([]); // Limpar logs anteriores

    localStorage.removeItem(DB_VERIFIED_KEY);

    try {
      // Executar setup
      const setupResult = await executeSetup(formData);

      if (setupResult.success) {
        updateSupabaseConfig(formData.supabase_url, formData.supabase_anon_key);

        setResult({
          type: 'success',
          message: setupResult.message || 'Setup concluído com sucesso!',
          details: setupResult.next_steps,
        });

        // Não redirecionar automaticamente; mostrar "Próximo passo" e "Verificar novamente"
      } else {
        setResult({
          type: setupResult.requires_db_password ? 'error' : 'error',
          message: setupResult.error || 'Erro ao executar setup',
          details: setupResult,
        });
      }
    } catch (error: any) {
      console.error('Erro no setup:', error);
      setResult({
        type: 'error',
        message: error.message || 'Erro desconhecido ao executar setup',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            C
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Configuração Inicial
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Configure o banco de dados Supabase e credenciais da Conta Azul
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${phase === 1 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}`}>
            {phase > 1 ? <CheckCircle className="h-4 w-4" /> : '1'}
            Fase 1
          </span>
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${phase === 2 ? 'bg-primary text-white' : phase > 2 ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'}`}>
            {phase > 2 ? <CheckCircle className="h-4 w-4" /> : '2'}
            Fase 2
          </span>
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${phase === 3 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
            3
            Fase 3
          </span>
        </div>
      </div>

      {phase === 1 && (
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
          <div className="bg-white py-8 px-6 shadow sm:rounded-lg border border-gray-200">
            {phase1ValidateMessage ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-700">
                  Para validar o schema, configure antes as variáveis <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_URL</code> e <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> no <code className="bg-gray-100 px-1 rounded">.env</code> ou no Vercel. Recarregue a página e volte aqui.
                </p>
                <Button type="button" onClick={() => setPhase1ValidateMessage(false)} variant="secondary">
                  Voltar
                </Button>
              </div>
            ) : (
              <>
                <p className="text-center text-gray-700 font-medium mb-6">O que deseja fazer?</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button type="button" onClick={() => setPhase(3)} className="flex-1 sm:flex-initial flex items-center justify-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configurar pela primeira vez
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setPhase1ValidateMessage(true)} className="flex-1 sm:flex-initial flex items-center justify-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Validar schema exposto
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {phase === 2 && (
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl space-y-4">
          {phase2Checking && (
            <div className="bg-white py-12 px-6 shadow sm:rounded-lg border border-gray-200 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-gray-600">Verificando schema exposto...</p>
            </div>
          )}
          {!phase2Checking && phase2Result?.configured && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900">Schema validado com sucesso</p>
                  <p className="mt-2 text-sm text-green-800">
                    Para não precisar validar o banco em toda carga, defina no Vercel (ou <code className="bg-green-100 px-1 rounded">.env</code>) a variável <code className="bg-green-100 px-1 rounded">VITE_SKIP_DB_CHECK=true</code>. Depois disso, o app não consultará o banco nessa verificação.
                  </p>
                  <Button type="button" onClick={handleGoToLogin} className="mt-4">
                    Ir para o login
                  </Button>
                </div>
              </div>
            </div>
          )}
          {!phase2Checking && phase2Result && !phase2Result.configured && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">
                  A API ainda não acessa o schema <code className="bg-amber-100 px-1 rounded">app_core</code>.
                </p>
                <p className="mt-2 text-sm text-amber-800">
                  Vá em <strong>Supabase → Settings → API → Exposed Schemas</strong>, marque <code className="bg-amber-100 px-1 rounded">app_core</code> (e opcionalmente <code className="bg-amber-100 px-1 rounded">dw</code>), salve.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button type="button" onClick={handleVerifyAgain} isLoading={isVerifying}>
                    Verificar novamente
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleGoToPhase3} className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configurar o projeto
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 3 && (
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Supabase URL */}
            <div>
              <label htmlFor="supabase_url" className="block text-sm font-medium text-gray-700">
                Supabase URL <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="supabase_url"
                  type="url"
                  required
                  value={formData.supabase_url}
                  onChange={handleChange('supabase_url')}
                  placeholder="https://xxxxx.supabase.co"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
              </div>
            </div>

            {/* Supabase Anon Key */}
            <div>
              <label htmlFor="supabase_anon_key" className="block text-sm font-medium text-gray-700">
                Supabase Anon Key <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="supabase_anon_key"
                  type="text"
                  required
                  value={formData.supabase_anon_key}
                  onChange={handleChange('supabase_anon_key')}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
              </div>
            </div>

            {/* Service Role Key */}
            <div>
              <label htmlFor="service_role_key" className="block text-sm font-medium text-gray-700">
                Service Role Key <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-gray-500">(temporário, usado apenas para setup)</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="service_role_key"
                  type={showPasswords.service_role_key ? 'text' : 'password'}
                  required
                  value={formData.service_role_key}
                  onChange={handleChange('service_role_key')}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="appearance-none block w-full px-3 py-2 pr-20 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('service_role_key')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.service_role_key ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Database Password */}
            <div>
              <label htmlFor="db_password" className="block text-sm font-medium text-gray-700">
                Database Password (PostgreSQL) <span className="text-gray-500 text-xs">(opcional)</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="db_password"
                  type={showPasswords.db_password ? 'text' : 'password'}
                  value={formData.db_password || ''}
                  onChange={handleChange('db_password')}
                  placeholder="Se não fornecido, migrations serão executadas manualmente"
                  className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('db_password')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.db_password ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Se fornecido, as migrations SQL serão executadas automaticamente via conexão direta ao PostgreSQL.
              </p>
            </div>

            <hr className="border-gray-200" />

            {/* CA Client ID */}
            <div>
              <label htmlFor="ca_client_id" className="block text-sm font-medium text-gray-700">
                Conta Azul Client ID <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="ca_client_id"
                  type="text"
                  required
                  value={formData.ca_client_id}
                  onChange={handleChange('ca_client_id')}
                  placeholder="client_id_da_conta_azul"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
              </div>
            </div>

            {/* CA Client Secret */}
            <div>
              <label htmlFor="ca_client_secret" className="block text-sm font-medium text-gray-700">
                Conta Azul Client Secret <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="ca_client_secret"
                  type={showPasswords.ca_client_secret ? 'text' : 'password'}
                  required
                  value={formData.ca_client_secret}
                  onChange={handleChange('ca_client_secret')}
                  placeholder="client_secret_da_conta_azul"
                  className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('ca_client_secret')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.ca_client_secret ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* System API Key */}
            <div>
              <label htmlFor="system_api_key" className="block text-sm font-medium text-gray-700">
                System API Key <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="system_api_key"
                  type={showPasswords.system_api_key ? 'text' : 'password'}
                  required
                  value={formData.system_api_key}
                  onChange={handleChange('system_api_key')}
                  className="appearance-none block w-full px-3 py-2 pr-20 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
                <div className="absolute inset-y-0 right-0 pr-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(formData.system_api_key, 'system_api_key')}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Copiar"
                  >
                    {copied === 'system_api_key' ? (
                      <CheckCircle2 size={16} className="text-green-500" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateApiKey}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Gerar nova chave"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('system_api_key')}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Mostrar/Ocultar"
                  >
                    {showPasswords.system_api_key ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Chave gerada automaticamente. Você pode gerar uma nova ou usar uma chave personalizada.
              </p>
            </div>

            {/* Painel de Logs */}
            {(logs.length > 0 || isLoading) && (
              <div className="border border-gray-300 rounded-md overflow-hidden">
                <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={16} />
                    <span className="text-sm font-medium">Logs do Setup</span>
                    {isLoading && (
                      <span className="animate-pulse text-yellow-400 text-xs">(executando...)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const logText = logs
                          .map((l) => `[${l.timestamp.toISOString()}] [${l.level.toUpperCase()}] ${l.message}${l.details ? ` - ${l.details}` : ''}`)
                          .join('\n');
                        navigator.clipboard.writeText(logText);
                        setCopied('logs');
                        createTimeout(() => setCopied(null), 2000);
                      }}
                      className="text-xs text-gray-300 hover:text-white flex items-center gap-1"
                      title="Copiar logs"
                    >
                      {copied === 'logs' ? (
                        <CheckCircle2 size={14} className="text-green-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                      Copiar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLogs(!showLogs)}
                      className="text-xs text-gray-300 hover:text-white"
                    >
                      {showLogs ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </div>
                {showLogs && (
                  <div className="bg-gray-900 text-gray-100 p-3 max-h-64 overflow-y-auto font-mono text-xs">
                    {logs.length === 0 && isLoading && (
                      <div className="text-gray-400">Aguardando logs...</div>
                    )}
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={`py-0.5 ${
                          log.level === 'error'
                            ? 'text-red-400'
                            : log.level === 'warn'
                            ? 'text-yellow-400'
                            : log.level === 'success'
                            ? 'text-green-400'
                            : 'text-gray-300'
                        }`}
                      >
                        <span className="text-gray-500">
                          [{log.timestamp.toLocaleTimeString()}]
                        </span>{' '}
                        <span
                          className={`font-semibold ${
                            log.level === 'error'
                              ? 'text-red-500'
                              : log.level === 'warn'
                              ? 'text-yellow-500'
                              : log.level === 'success'
                              ? 'text-green-500'
                              : 'text-blue-400'
                          }`}
                        >
                          [{log.level.toUpperCase()}]
                        </span>{' '}
                        {log.message}
                        {log.details && (
                          <span className="text-gray-400 ml-2">({log.details})</span>
                        )}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            )}

            {/* Resultado */}
            {result && (
              <>
                <div
                  className={`p-4 rounded-md border ${
                    result.type === 'success'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-start">
                    {result.type === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          result.type === 'success' ? 'text-green-800' : 'text-red-800'
                        }`}
                      >
                        {result.message}
                      </p>
                      {result.details?.next_steps?.manual_steps && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">Próximos passos manuais:</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                            {result.details.next_steps.manual_steps.map((step: string, index: number) => (
                              <li key={index}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {result.details?.next_steps?.secrets_to_configure && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">Secrets para configurar:</p>
                          <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {Object.entries(result.details.next_steps.secrets_to_configure)
                              .map(([key, value]) => `${key}=${value}`)
                              .join('\n')}
                            </pre>
                          </div>
                      )}
                    </div>
                  </div>
                </div>

                {result.type === 'success' && (
                  <div className="p-4 rounded-md border border-blue-200 bg-blue-50">
                    <p className="text-sm font-semibold text-blue-900 mb-2">
                      Próximo passo: exponha o schema <code className="bg-blue-100 px-1 rounded">app_core</code>
                    </p>
                    <p className="text-sm text-blue-800 mb-3">
                      Vá em <strong>Supabase → Settings → API → Exposed Schemas</strong>, marque <code className="bg-blue-100 px-1 rounded">app_core</code> (e opcionalmente <code className="bg-blue-100 px-1 rounded">dw</code>), salve. Depois clique em &quot;Verificar novamente&quot; para ir ao login.
                    </p>
                    <Button
                      type="button"
                      onClick={handleVerifyAgain}
                      isLoading={isVerifying}
                    >
                      Verificar novamente
                    </Button>
                  </div>
                )}
              </>
            )}

            <div>
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Executar Setup
              </Button>
            </div>
          </form>
        </div>
      </div>
      )}
    </div>
  );
};

export default SetupInitial;
