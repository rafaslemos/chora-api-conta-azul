import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Database, 
  Workflow,
  AlertCircle,
  Copy,
  ExternalLink
} from 'lucide-react';
import Button from '../components/ui/Button';
import { testSupabaseConnection, testN8nConnection, testAllConnections, ConnectionTestResult } from '../lib/testConnections';
import { motion, AnimatePresence } from 'framer-motion';

const ConnectionTest: React.FC = () => {
  const [supabaseResult, setSupabaseResult] = useState<ConnectionTestResult | null>(null);
  const [n8nResult, setN8nResult] = useState<ConnectionTestResult | null>(null);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isTestingN8n, setIsTestingN8n] = useState(false);
  const [isTestingAll, setIsTestingAll] = useState(false);

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    setSupabaseResult(null);
    try {
      const result = await testSupabaseConnection();
      setSupabaseResult(result);
    } catch (error) {
      setSupabaseResult({
        service: 'supabase',
        success: false,
        message: `Erro ao executar teste: ${error}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleTestN8n = async () => {
    setIsTestingN8n(true);
    setN8nResult(null);
    try {
      const result = await testN8nConnection();
      setN8nResult(result);
    } catch (error) {
      setN8nResult({
        service: 'n8n',
        success: false,
        message: `Erro ao executar teste: ${error}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsTestingN8n(false);
    }
  };

  const handleTestAll = async () => {
    setIsTestingAll(true);
    setSupabaseResult(null);
    setN8nResult(null);
    try {
      const results = await testAllConnections();
      results.forEach((result) => {
        if (result.service === 'supabase') {
          setSupabaseResult(result);
        } else if (result.service === 'n8n') {
          setN8nResult(result);
        }
      });
    } catch (error) {
      console.error('Erro ao testar conexões:', error);
    } finally {
      setIsTestingAll(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Idealmente mostraria um toast aqui
  };

  const renderTestResult = (result: ConnectionTestResult | null, isTesting: boolean) => {
    if (isTesting) {
      return (
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="animate-spin" size={20} />
          <span>Testando conexão...</span>
        </div>
      );
    }

    if (!result) {
      return (
        <div className="text-gray-400 text-sm">
          Clique em "Testar Conexão" para verificar a configuração
        </div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-lg border ${
          result.success
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}
      >
        <div className="flex items-start gap-3">
          {result.success ? (
            <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
          ) : (
            <XCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          )}
          <div className="flex-1">
            <p className={`font-semibold mb-1 ${result.success ? 'text-green-900' : 'text-red-900'}`}>
              {result.message}
            </p>
            {result.details && (
              <div className="mt-3 space-y-2">
                {result.details.url && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600">URL:</span>
                    <code className="bg-white px-2 py-1 rounded border border-gray-200 font-mono">
                      {result.details.url}
                    </code>
                    <button
                      onClick={() => copyToClipboard(result.details.url)}
                      className="text-gray-400 hover:text-gray-600"
                      title="Copiar URL"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                )}
                {result.details.workflowsCount !== undefined && (
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>
                      Workflows encontrados: <strong>{result.details.workflowsCount}</strong>
                    </div>
                    {result.details.activeWorkflows !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span>Ativos: <strong>{result.details.activeWorkflows}</strong></span>
                        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                        <span>Inativos: <strong>{result.details.inactiveWorkflows}</strong></span>
                      </div>
                    )}
                  </div>
                )}
                {result.details.webhookUrl && (
                  <div className="flex items-center gap-2 text-xs mt-2">
                    <span className="text-gray-600">Webhook URL:</span>
                    <code className="bg-white px-2 py-1 rounded border border-gray-200 font-mono text-[10px] truncate max-w-xs">
                      {result.details.webhookUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(result.details.webhookUrl)}
                      className="text-gray-400 hover:text-gray-600"
                      title="Copiar URL"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                )}
                {result.details.workflows && result.details.workflows.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Workflows:</p>
                    <div className="space-y-1">
                      {result.details.workflows.map((wf: any) => (
                        <div
                          key={wf.id}
                          className="text-xs bg-white px-2 py-1 rounded border border-gray-200 flex items-center justify-between"
                        >
                          <span>{wf.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              wf.active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {wf.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.details.errorCode && (
                  <div className="text-xs text-red-700">
                    <strong>Código:</strong> {result.details.errorCode}
                  </div>
                )}
                {result.details.errorMessage && (
                  <div className="text-xs text-red-700">
                    <strong>Erro:</strong> {result.details.errorMessage}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Testado em: {new Date(result.timestamp).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Teste de Conexões</h1>
        <p className="text-gray-500">Verifique a conectividade com Supabase e n8n</p>
      </div>

      {/* Botão para testar tudo */}
      <div className="flex justify-end">
        <Button onClick={handleTestAll} isLoading={isTestingAll} variant="secondary">
          <RefreshCw size={16} className="mr-2" />
          Testar Todas as Conexões
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teste Supabase */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Database className="text-green-600" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Supabase</h3>
                <p className="text-xs text-gray-500">Banco de dados</p>
              </div>
            </div>
            <Button
              onClick={handleTestSupabase}
              isLoading={isTestingSupabase}
              variant="secondary"
              className="text-xs"
            >
              <RefreshCw size={14} className="mr-1" />
              Testar
            </Button>
          </div>

          <div className="space-y-3">
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">URL:</span>
                <code className="bg-gray-50 px-2 py-0.5 rounded text-[10px]">
                  {import.meta.env.VITE_SUPABASE_URL || 'Não configurado'}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Anon Key:</span>
                <span className={import.meta.env.VITE_SUPABASE_ANON_KEY ? 'text-green-600' : 'text-red-600'}>
                  {import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Configurado' : 'Não configurado'}
                </span>
              </div>
            </div>

            {renderTestResult(supabaseResult, isTestingSupabase)}
          </div>
        </div>

        {/* Teste n8n */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Workflow className="text-orange-600" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">n8n</h3>
                <p className="text-xs text-gray-500">Automações</p>
              </div>
            </div>
            <Button
              onClick={handleTestN8n}
              isLoading={isTestingN8n}
              variant="secondary"
              className="text-xs"
            >
              <RefreshCw size={14} className="mr-1" />
              Testar
            </Button>
          </div>

          <div className="space-y-3">
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">URL:</span>
                <code className="bg-gray-50 px-2 py-0.5 rounded text-[10px]">
                  {import.meta.env.VITE_N8N_URL || 'Não configurado'}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">API Key:</span>
                <span className={import.meta.env.VITE_N8N_API_KEY ? 'text-green-600' : 'text-red-600'}>
                  {import.meta.env.VITE_N8N_API_KEY ? 'Configurado' : 'Não configurado'}
                </span>
              </div>
            </div>

            {renderTestResult(n8nResult, isTestingN8n)}
          </div>
        </div>
      </div>

      {/* Aviso de Segurança */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold mb-1">Importante - Segurança</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>A chave <strong>anon</strong> do Supabase pode ser exposta no frontend (protegida por RLS)</li>
              <li>A chave <strong>service_role</strong> do Supabase NUNCA deve ser exposta no frontend</li>
              <li>As credenciais do n8n devem ser mantidas seguras</li>
              <li>Nunca commite o arquivo <code>.env.local</code> no repositório</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionTest;

