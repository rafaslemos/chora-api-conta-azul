import React, { useState, useEffect } from 'react';
import { 
  Download, 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  XCircle,
  Workflow,
  Tag,
  Calendar,
  PlayCircle,
  PauseCircle,
  ExternalLink,
  Copy,
  AlertCircle
} from 'lucide-react';
import Button from '../components/ui/Button';
import { flowMappingService, MappedFlow } from '../services/flowMappingService';
import { n8nService } from '../services/n8nService';
import { motion } from 'framer-motion';

const N8nFlowsMapping: React.FC = () => {
  const [flows, setFlows] = useState<MappedFlow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    inactive: number;
    bySource: Record<string, number>;
    byDestination: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    setIsLoading(true);
    try {
      const mapped = await flowMappingService.mapBpoAutomatedFlows();
      setFlows(mapped);
      setLastSync(new Date());
      
      const statistics = await flowMappingService.getMappedFlowsStats();
      setStats(statistics);
    } catch (error: any) {
      console.error('Erro ao carregar fluxos do n8n:', error);
      alert('Erro ao carregar fluxos: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsLoading(false);
    }
  };

  const exportToJSON = () => {
    const data = {
      exportDate: new Date().toISOString(),
      tag: 'bpo-automatizado',
      total: flows.length,
      flows: flows.map(flow => ({
        id: flow.id,
        n8nWorkflowId: flow.n8nWorkflowId,
        name: flow.name,
        source: flow.source,
        destination: flow.destination,
        active: flow.active,
        config: flow.config,
        lastSync: flow.lastSync,
        tags: ['bpo-automatizado'],
      })),
      statistics: stats,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `n8n-flows-bpo-automatizado-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const headers = [
      'ID',
      'n8n Workflow ID',
      'Nome',
      'Origem',
      'Destino',
      'Status',
      'Sincronizar Produtos',
      'Criar Clientes',
      'Consolidar Vendas',
      'Última Sincronização',
    ];

    const rows = flows.map(flow => [
      flow.id,
      flow.n8nWorkflowId,
      flow.name,
      flow.source,
      flow.destination,
      flow.active ? 'Ativo' : 'Inativo',
      flow.config.syncProducts ? 'Sim' : 'Não',
      flow.config.createCustomers ? 'Sim' : 'Não',
      flow.config.consolidateSales ? 'Sim' : 'Não',
      flow.lastSync || 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `n8n-flows-bpo-automatizado-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Idealmente mostraria um toast
  };

  const getN8nWorkflowUrl = (workflowId: string) => {
    const n8nUrl = n8nService.getUrl();
    return n8nUrl ? `${n8nUrl}/workflow/${workflowId}` : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mapeamento de Fluxos n8n</h1>
          <p className="text-gray-500">Todos os workflows com tag "bpo-automatizado"</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={loadFlows}
            isLoading={isLoading}
          >
            <RefreshCw size={16} className="mr-2" />
            Atualizar
          </Button>
          <Button
            variant="secondary"
            onClick={exportToCSV}
            disabled={flows.length === 0}
          >
            <Download size={16} className="mr-2" />
            Exportar CSV
          </Button>
          <Button
            onClick={exportToJSON}
            disabled={flows.length === 0}
          >
            <Download size={16} className="mr-2" />
            Exportar JSON
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Total de Fluxos</p>
            <h3 className="text-2xl font-bold text-gray-900">{stats.total}</h3>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Ativos</p>
            <h3 className="text-2xl font-bold text-green-600">{stats.active}</h3>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Inativos</p>
            <h3 className="text-2xl font-bold text-gray-400">{stats.inactive}</h3>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Última Sincronização</p>
            <h3 className="text-sm font-bold text-gray-900">
              {lastSync ? lastSync.toLocaleTimeString('pt-BR') : 'Nunca'}
            </h3>
          </div>
        </div>
      )}

      {/* Distribuição por Origem e Destino */}
      {stats && (stats.bySource && Object.keys(stats.bySource).length > 0 || stats.byDestination && Object.keys(stats.byDestination).length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Origem</h3>
            <div className="space-y-2">
              {Object.entries(stats.bySource).map(([source, count]) => (
                <div key={source} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{source}</span>
                  <span className="text-sm font-bold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Destino</h3>
            <div className="space-y-2">
              {Object.entries(stats.byDestination).map(([destination, count]) => (
                <div key={destination} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{destination}</span>
                  <span className="text-sm font-bold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lista de Fluxos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-orange-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Workflows com tag "bpo-automatizado"
            </h2>
          </div>
          <span className="text-sm text-gray-500">
            {flows.length} workflow(s) encontrado(s)
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="animate-spin text-primary mb-4" size={32} />
            <p className="text-gray-500">Carregando fluxos do n8n...</p>
          </div>
        ) : flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Workflow className="text-gray-300 mb-4" size={48} />
            <p className="text-lg font-medium text-gray-600">Nenhum workflow encontrado</p>
            <p className="text-sm text-gray-400 mt-1">
              Nenhum workflow com a tag "bpo-automatizado" foi encontrado no n8n.
            </p>
            <Button onClick={loadFlows} variant="secondary" className="mt-4">
              <RefreshCw size={16} className="mr-2" />
              Tentar Novamente
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    n8n ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Origem
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destino
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Configurações
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {flows.map((flow) => {
                  const workflowUrl = getN8nWorkflowUrl(flow.n8nWorkflowId);
                  return (
                    <tr key={flow.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {flow.active ? (
                            <CheckCircle2 className="text-green-600" size={18} />
                          ) : (
                            <XCircle className="text-gray-400" size={18} />
                          )}
                          <span className={`text-xs font-medium ${
                            flow.active ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            {flow.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{flow.name}</div>
                        {flow.lastSync && (
                          <div className="text-xs text-gray-500">
                            Atualizado: {new Date(flow.lastSync).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                            {flow.n8nWorkflowId}
                          </code>
                          <button
                            onClick={() => copyToClipboard(flow.n8nWorkflowId)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Copiar ID"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700">
                          {flow.source}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                          {flow.destination}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {flow.config.syncProducts && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                              Sync Produtos
                            </span>
                          )}
                          {flow.config.createCustomers && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                              Cria Clientes
                            </span>
                          )}
                          {flow.config.consolidateSales && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                              Consolida
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {workflowUrl && (
                            <a
                              href={workflowUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-primary transition-colors"
                              title="Abrir no n8n"
                            >
                              <ExternalLink size={16} />
                            </a>
                          )}
                          <button
                            onClick={async () => {
                              try {
                                // Se n8n não estiver configurado, apenas atualiza localmente
                                if (!n8nService.isConfigured()) {
                                  setFlows(flows.map(f => 
                                    f.id === flow.id ? { ...f, active: !f.active } : f
                                  ));
                                  return;
                                }
                                await n8nService.toggleWorkflow(flow.n8nWorkflowId, !flow.active);
                                await loadFlows();
                              } catch (error) {
                                console.warn('Erro ao atualizar workflow no n8n, atualizando localmente:', error);
                                setFlows(flows.map(f => 
                                  f.id === flow.id ? { ...f, active: !f.active } : f
                                ));
                              }
                            }}
                            className={`p-1.5 rounded-full transition-colors ${
                              flow.active
                                ? 'text-orange-600 hover:bg-orange-50'
                                : 'text-gray-400 hover:bg-gray-100'
                            }`}
                            title={flow.active ? 'Pausar' : 'Ativar'}
                          >
                            {flow.active ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Informações sobre o arquivo */}
      {flows.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FileText className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Arquivo de Mapeamento</p>
              <p className="text-xs mb-2">
                Use os botões de exportação acima para gerar um arquivo JSON ou CSV com todos os fluxos mapeados.
                O arquivo inclui todas as informações dos workflows, configurações e estatísticas.
              </p>
              <ul className="text-xs list-disc list-inside space-y-1">
                <li>JSON: Formato completo com metadados e estatísticas</li>
                <li>CSV: Formato tabular para análise em planilhas</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default N8nFlowsMapping;

