import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, RefreshCw, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { syncJobService } from '../services/syncJobService';
import { SyncStatus } from '../types';
import { useTenant } from '../contexts/TenantContext';

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      {trend && (
        <div className="flex items-center mt-2 text-xs font-medium text-green-600">
          <ArrowUpRight size={14} className="mr-1" />
          <span>{trend}</span>
        </div>
      )}
    </div>
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon size={20} className="text-white" />
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: SyncStatus }) => {
  const styles = {
    [SyncStatus.SUCCESS]: 'bg-green-100 text-green-700',
    [SyncStatus.PENDING]: 'bg-gray-100 text-gray-700',
    [SyncStatus.RUNNING]: 'bg-blue-100 text-blue-700',
    [SyncStatus.ERROR]: 'bg-red-100 text-red-700',
  };
  
  const statusLabels = {
    [SyncStatus.SUCCESS]: 'SUCESSO',
    [SyncStatus.PENDING]: 'PENDENTE',
    [SyncStatus.RUNNING]: 'RODANDO',
    [SyncStatus.ERROR]: 'ERRO',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {statusLabels[status]}
    </span>
  );
};

const Dashboard: React.FC = () => {
  const { selectedTenantId, selectedTenant } = useTenant();
  const [jobs, setJobs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedTenantId]); // Recarregar quando o tenant selecionado mudar

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Se selectedTenantId for null, não passa parâmetro (todos os clientes)
      // Se tiver valor, passa o tenantId para filtrar
      const [jobsData, statsData] = await Promise.all([
        syncJobService.list(selectedTenantId || undefined),
        syncJobService.getStats(selectedTenantId || undefined),
      ]);
      
      setJobs(jobsData.slice(0, 5));
      setStats(statsData);
    } catch (err: any) {
      console.error('Erro ao carregar dados do dashboard:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const pendingSyncs = stats?.pending || 0;
  const errorRate = stats?.total > 0 
    ? Math.round((stats.error / stats.total) * 100) 
    : 0;

  // Dados de receita vazios por enquanto (será implementado quando houver tabela de transações)
  const revenueData: any[] = [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel de Controle</h1>
            <p className="text-gray-500">Visão geral do desempenho da sua integração</p>
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-500">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel de Controle</h1>
            <p className="text-gray-500">Visão geral do desempenho da sua integração</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel de Controle</h1>
          <p className="text-gray-500">
            {selectedTenantId === null 
              ? 'Visão consolidada de todos os clientes' 
              : `Visão do cliente: ${selectedTenant?.name || 'Carregando...'}`}
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Última atualização: <span className="font-medium text-gray-900">Agora mesmo</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Receita Total (30d)" 
          value="R$ 0,00"
          icon={DollarSign} 
          color="bg-primary"
        />
        <StatCard 
          title="Sincronizações Pendentes" 
          value={pendingSyncs.toString()}
          icon={RefreshCw} 
          color="bg-blue-500"
        />
        <StatCard 
          title="A Receber" 
          value="R$ 0,00"
          icon={DollarSign} 
          color="bg-green-500"
        />
        <StatCard 
          title="Taxa de Erros" 
          value={errorRate + '%'}
          icon={AlertTriangle} 
          color="bg-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Tendência de Receita</h2>
          {revenueData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-gray-500">
              <p>Nenhum dado de receita disponível ainda.</p>
            </div>
          ) : (
            <div className="h-72 min-h-[288px]">
              <ResponsiveContainer width="100%" height="100%" minHeight={288}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0B74E0" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0B74E0" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={(value) => `R$${value}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ color: '#0B74E0', fontWeight: 600 }}
                    formatter={(value: number) => [`R$ ${value}`, 'Receita']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0B74E0" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Jobs Recentes</h2>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum job encontrado.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{job.type.replace('_', ' ')}</span>
                      <span className="text-xs text-gray-500">{new Date(job.startedAt).toLocaleTimeString('pt-BR')}</span>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 text-sm text-primary font-medium hover:text-primaryDark transition-colors">
                Ver Todos os Jobs &rarr;
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
