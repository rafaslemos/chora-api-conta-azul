import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity } from 'lucide-react';
import { tenantService } from '../services/tenantService';
import { credentialService } from '../services/credentialService';

const Dashboard: React.FC = () => {
  const [tenantCounts, setTenantCounts] = useState<{ active: number; inactive: number; total: number } | null>(null);
  const [credentialCounts, setCredentialCounts] = useState<{ active: number; inactive: number; total: number } | null>(null);
  const [requestStats, setRequestStats] = useState<{
    total: number;
    byTenant: Array<{ tenantId: string; tenantName: string; count: number }>;
    byCredential: Array<{ credentialId: string; credentialName: string; tenantId: string; tenantName: string; count: number }>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []); // Carregar dados do parceiro uma vez

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tenantData, credentialData, requestData] = await Promise.all([
        tenantService.getCounts(),
        credentialService.getCounts(),
        credentialService.getRequestStats(),
      ]);
      
      setTenantCounts(tenantData);
      setCredentialCounts(credentialData);
      setRequestStats(requestData);
    } catch (err: any) {
      console.error('Erro ao carregar dados do dashboard:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  // Preparar dados para gráficos
  const tenantChartData = tenantCounts ? [
    { name: 'Ativos', value: tenantCounts.active, color: '#10B981' },
    { name: 'Inativos', value: tenantCounts.inactive, color: '#EF4444' },
  ] : [];

  const credentialChartData = credentialCounts ? [
    { name: 'Ativas', value: credentialCounts.active, color: '#10B981' },
    { name: 'Inativas', value: credentialCounts.inactive, color: '#EF4444' },
  ] : [];

  // Preparar dados do gráfico de requisições por cliente
  const requestByTenantChartData = requestStats?.byTenant.slice(0, 10).map(item => ({
    name: item.tenantName.length > 15 ? item.tenantName.substring(0, 15) + '...' : item.tenantName,
    fullName: item.tenantName,
    count: item.count,
  })) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel de Controle</h1>
            <p className="text-gray-500">Informações do parceiro</p>
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
            <p className="text-gray-500">Informações do parceiro</p>
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
          <p className="text-gray-500">Informações do parceiro</p>
        </div>
        <div className="text-sm text-gray-500">
          Última atualização: <span className="font-medium text-gray-900">Agora mesmo</span>
        </div>
      </div>

      {/* Cards de Contagem de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Clientes</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Ativos</p>
              <p className="text-2xl font-bold text-green-600">{tenantCounts?.active || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Inativos</p>
              <p className="text-2xl font-bold text-red-600">{tenantCounts?.inactive || 0}</p>
            </div>
          </div>
          {tenantChartData.length > 0 && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tenantChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {tenantChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Cards de Contagem de Credenciais */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Credenciais</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Ativas</p>
              <p className="text-2xl font-bold text-green-600">{credentialCounts?.active || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Inativas</p>
              <p className="text-2xl font-bold text-red-600">{credentialCounts?.inactive || 0}</p>
            </div>
          </div>
          {credentialChartData.length > 0 && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={credentialChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {credentialChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Card de Requisições */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Requisições Totais</h2>
            <div className="flex items-center gap-2">
              <Activity className="text-primary" size={20} />
              <span className="text-2xl font-bold text-gray-900">{requestStats?.total || 0}</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-6">Total de requisições realizadas</p>
          
          {requestStats && requestStats.byTenant.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Por Cliente</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {requestStats.byTenant.map((item) => (
                  <div key={item.tenantId} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                    <span className="text-sm text-gray-700">{item.tenantName}</span>
                    <span className="text-sm font-semibold text-gray-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Requisições por Cliente</h2>
          {requestByTenantChartData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-gray-500">
              <p>Nenhuma requisição encontrada.</p>
            </div>
          ) : (
            <div className="h-72 min-h-[288px]">
              <ResponsiveContainer width="100%" height="100%" minHeight={288}>
                <BarChart data={requestByTenantChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#6B7280', fontSize: 11}} 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value: number) => [value, 'Requisições']}
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data?.fullName || label;
                    }}
                  />
                  <Bar dataKey="count" fill="#0B74E0" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Tabela de Requisições por Credencial */}
      {requestStats && requestStats.byCredential.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Requisições por Credencial</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Cliente</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Credencial</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Requisições</th>
                </tr>
              </thead>
              <tbody>
                {requestStats.byCredential.map((item) => (
                  <tr key={item.credentialId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-700">{item.tenantName}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{item.credentialName}</td>
                    <td className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
