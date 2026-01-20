import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  Package, 
  Clock,
  Download,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import Button from '../components/ui/Button';
import { useTimeout } from '../hooks/useTimeout';

const COLORS = ['#0B74E0', '#22C55E', '#F59E0B', '#8B5CF6', '#EF4444'];

const Analytics: React.FC = () => {
  const { createTimeout } = useTimeout();
  const [dateRange, setDateRange] = useState('30d');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = (format: 'csv' | 'pdf') => {
    setIsExporting(true);
    createTimeout(() => {
      setIsExporting(false);
      alert(`Exportando relatório em ${format.toUpperCase()}...`);
    }, 1000);
  };

  // Dados vazios por enquanto (será implementado quando houver tabela de transações/vendas)
  const REVENUE_BY_MARKETPLACE: any[] = [];
  const TOP_SKUS: any[] = [];
  const PAYMENT_TIME_DATA: any[] = [];
  const REVENUE_BY_CATEGORY: any[] = [];

  const totalRevenue = 0;
  const totalOrders = 0;
  const avgPaymentDays = 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Relatórios</h1>
          <p className="text-gray-500">Análise detalhada de receitas, produtos e performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => handleExport('csv')} isLoading={isExporting}>
            <Download size={16} className="mr-2" />
            Exportar CSV
          </Button>
          <Button variant="secondary" onClick={() => handleExport('pdf')} isLoading={isExporting}>
            <Download size={16} className="mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filtros de Período */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Período:</span>
        </div>
        <div className="flex gap-2">
          {['7d', '30d', '90d', '1y'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range === '7d' ? '7 dias' : range === '30d' ? '30 dias' : range === '90d' ? '90 dias' : '1 ano'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="text-blue-600" size={24} />
            </div>
            <ArrowUpRight className="text-green-500" size={20} />
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Receita Total</h3>
          <p className="text-2xl font-bold text-gray-900">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Package className="text-green-600" size={24} />
            </div>
            <ArrowUpRight className="text-green-500" size={20} />
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total de Pedidos</h3>
          <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="text-orange-600" size={24} />
            </div>
            <ArrowDownRight className="text-red-500" size={20} />
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Tempo Médio de Pagamento</h3>
          <p className="text-2xl font-bold text-gray-900">{avgPaymentDays} dias</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receita por Marketplace */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Receita por Marketplace</h2>
          {REVENUE_BY_MARKETPLACE.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              <p>Nenhum dado disponível ainda.</p>
            </div>
          ) : (
            <div className="h-64 min-h-[256px]">
              <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                <BarChart data={REVENUE_BY_MARKETPLACE}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#0B74E0" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Receita por Categoria */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Receita por Categoria</h2>
          {REVENUE_BY_CATEGORY.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              <p>Nenhum dado disponível ainda.</p>
            </div>
          ) : (
            <div className="h-64 min-h-[256px]">
              <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                <PieChart>
                  <Pie
                    data={REVENUE_BY_CATEGORY}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {REVENUE_BY_CATEGORY.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Tabela de Top SKUs */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 SKUs</h2>
        {TOP_SKUS.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Nenhum dado disponível ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receita</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {TOP_SKUS.map((item) => (
                  <tr key={item.sku}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{item.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">R$ {item.revenue.toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
