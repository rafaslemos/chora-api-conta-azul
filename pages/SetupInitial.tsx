import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';
import Button from '../components/ui/Button';
import { executeSetup, generateSystemApiKey, type SetupConfig } from '../services/setupService';
import { updateSupabaseConfig } from '../lib/supabase';
import { generateApiKey } from '../utils/generateApiKey';
import { useTimeout } from '../hooks/useTimeout';

const SetupInitial: React.FC = () => {
  const navigate = useNavigate();
  const { createTimeout } = useTimeout();
  
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
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({
    service_role_key: false,
    db_password: false,
    ca_client_secret: false,
    system_api_key: false,
  });
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string; details?: any } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    // Limpar cache de verificação do banco para forçar nova verificação após setup
    localStorage.removeItem('db_setup_verified');

    try {
      // Executar setup
      const setupResult = await executeSetup(formData);

      if (setupResult.success) {
        // Salvar configuração do Supabase
        updateSupabaseConfig(formData.supabase_url, formData.supabase_anon_key);

        setResult({
          type: 'success',
          message: setupResult.message || 'Setup concluído com sucesso!',
          details: setupResult.next_steps,
        });

        // Redirecionar para login após 3 segundos
        createTimeout(() => {
          navigate('/login');
        }, 3000);
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
      </div>

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

            {/* Resultado */}
            {result && (
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
                          {result.details.next_steps.manual_steps.map((step, index) => (
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
            )}

            <div>
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Executar Setup
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetupInitial;
