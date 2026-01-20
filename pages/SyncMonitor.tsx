import React, { useState, useEffect } from 'react';
import { Play, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { syncJobService } from '../services/syncJobService';
import { SyncJob, SyncStatus } from '../types';
import Button from '../components/ui/Button';

const SyncMonitor: React.FC = () => {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await syncJobService.list();
      setJobs(data);
    } catch (err: any) {
      console.error('Erro ao carregar jobs:', err);
      setError(err.message || 'Erro ao carregar jobs de sincronização');
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (status: SyncStatus) => {
    switch (status) {
      case SyncStatus.SUCCESS: return <CheckCircle className="text-success" size={18} />;
      case SyncStatus.ERROR: return <AlertCircle className="text-error" size={18} />;
      case SyncStatus.RUNNING: return <Clock className="text-primary animate-pulse" size={18} />;
      default: return <Clock className="text-gray-400" size={18} />;
    }
  };

  const statusLabels = {
    [SyncStatus.SUCCESS]: 'SUCESSO',
    [SyncStatus.PENDING]: 'PENDENTE',
    [SyncStatus.RUNNING]: 'RODANDO',
    [SyncStatus.ERROR]: 'ERRO',
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Monitor de Sincronização</h1>
            <p className="text-gray-500">Acompanhe e gerencie jobs de integração</p>
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-500">Carregando jobs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Monitor de Sincronização</h1>
            <p className="text-gray-500">Acompanhe e gerencie jobs de integração</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitor de Sincronização</h1>
          <p className="text-gray-500">Acompanhe e gerencie jobs de integração</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">Filtrar Logs</Button>
          <Button>
            <Play size={16} className="mr-2" />
            Executar Sync Manual
          </Button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-200 shadow-sm text-center">
          <p className="text-gray-500">Nenhum job de sincronização encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID do Job</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Iniciado em</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Itens</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalhes</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getIcon(job.status)}
                        <span className={`text-sm font-medium ${
                          job.status === SyncStatus.SUCCESS ? 'text-gray-900' :
                          job.status === SyncStatus.ERROR ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {statusLabels[job.status]}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{job.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(job.startedAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.itemsProcessed}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs">{job.details}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {job.status === SyncStatus.ERROR && (
                        <button className="text-primary hover:text-primaryDark">Tentar Novamente</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Mostrando <span className="font-medium">1</span> até <span className="font-medium">{jobs.length}</span> de <span className="font-medium">{jobs.length}</span> resultados
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50" disabled>Anterior</button>
              <button className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50" disabled>Próxima</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncMonitor;
