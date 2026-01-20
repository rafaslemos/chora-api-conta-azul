import React, { useState, useEffect } from 'react';
import { Search, Filter, Download } from 'lucide-react';
import { auditLogService } from '../services/auditLogService';
import { LogEntry } from '../types';
import Button from '../components/ui/Button';

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await auditLogService.list({ limit: 100 });
      setLogs(data);
    } catch (err: any) {
      console.error('Erro ao carregar logs:', err);
      setError(err.message || 'Erro ao carregar logs de auditoria');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.id.toLowerCase().includes(searchLower) ||
      log.user.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower) ||
      log.details.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Logs de Auditoria</h1>
            <p className="text-gray-500">Histórico imutável de eventos do sistema</p>
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-500">Carregando logs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Logs de Auditoria</h1>
            <p className="text-gray-500">Histórico imutável de eventos do sistema</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Logs de Auditoria</h1>
          <p className="text-gray-500">Histórico imutável de eventos do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">
            <Download size={16} className="mr-2"/> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar logs por ID, Usuário ou Ação..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
        <Button variant="secondary">
          <Filter size={16} className="mr-2"/> Filtrar
        </Button>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-200 shadow-sm text-center">
          <p className="text-gray-500">Nenhum log encontrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    log.status === 'SUCCESS' ? 'bg-green-500' : 
                    log.status === 'ERROR' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  <span className="font-semibold text-gray-900">{log.action}</span>
                </div>
                <span className="text-xs text-gray-400 font-mono">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <div className="text-gray-600">
                  <span className="font-medium">Usuário:</span> {log.user}
                </div>
                <div className="text-gray-400 text-xs">ID: {log.id}</div>
              </div>
              {log.details && (
                <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 font-mono">
                  {log.details}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Logs;
