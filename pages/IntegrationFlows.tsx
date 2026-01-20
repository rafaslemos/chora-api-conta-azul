import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Settings, 
  PlayCircle, 
  PauseCircle, 
  Plus, 
  MoreVertical,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  ShoppingCart,
  Calculator,
  Building2,
  Filter,
  Search,
  ChevronDown,
  Check,
  Flame
} from 'lucide-react';
import Button from '../components/ui/Button';
import { IntegrationFlow, PlatformType } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { flowMappingService, MappedFlow } from '../services/flowMappingService';
import { RefreshCw } from 'lucide-react';
import { tenantService } from '../services/tenantService';
import { integrationFlowService } from '../services/integrationFlowService';

// Toggle Component (Internal)
const Toggle = ({ label, checked, onChange, description }: { label: string, checked: boolean, onChange: () => void, description?: string }) => (
  <div className="flex items-start justify-between py-3">
    <div className="pr-4">
      <label className="text-sm font-medium text-gray-700 cursor-pointer select-none" onClick={onChange}>{label}</label>
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
    </div>
    <button 
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${checked ? 'bg-primary' : 'bg-gray-200'}`}
    >
      <span 
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  </div>
);

// Dados das Plataformas Disponíveis
const PLATFORMS = {
    SOURCES: [
        { id: 'OLIST', name: 'Olist Store', icon: 'O', color: 'bg-indigo-600', status: 'ACTIVE', type: 'Marketplace' },
        { id: 'HOTMART', name: 'Hotmart', icon: <Flame size={16}/>, color: 'bg-orange-600', status: 'ACTIVE', type: 'Infoprodutos' },
        { id: 'MERCADO_LIVRE', name: 'Mercado Livre', icon: 'ML', color: 'bg-yellow-400', status: 'SOON', type: 'Marketplace' },
        { id: 'SHOPEE', name: 'Shopee', icon: 'S', color: 'bg-orange-500', status: 'SOON', type: 'Marketplace' },
    ],
    DESTINATIONS: [
        { id: 'CONTA_AZUL', name: 'Conta Azul', icon: 'CA', color: 'bg-[#0B74E0]', status: 'ACTIVE', type: 'ERP' },
        { id: 'BLING', name: 'Bling', icon: 'B', color: 'bg-green-600', status: 'SOON', type: 'ERP' },
        { id: 'TINY', name: 'Tiny', icon: 'T', color: 'bg-blue-800', status: 'SOON', type: 'ERP' },
    ]
};

const IntegrationFlows: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Estado para controlar qual tenant está selecionado
  const [currentTenantId, setCurrentTenantId] = useState<string>('');
  
  // Estados para o Combobox Customizado (Tenant Selector)
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [tenantSearchTerm, setTenantSearchTerm] = useState('');

  const [tenants, setTenants] = useState<any[]>([]);

  // Carregar tenants e fluxos
  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const data = await tenantService.list();
      setTenants(data);
      if (data.length > 0 && !currentTenantId) {
        setCurrentTenantId(data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar tenants:', error);
    }
  };

  // Efeito para carregar o tenant vindo da navegação ou selecionar o default
  useEffect(() => {
    const state = location.state as { tenantId: string; tenantName: string } | null;
    if (state && state.tenantId) {
        setCurrentTenantId(state.tenantId);
    }
  }, [location]);

  // Carregar fluxos quando o tenant mudar
  useEffect(() => {
    if (currentTenantId) {
      loadFlows();
    }
  }, [currentTenantId]);

  const loadFlows = async () => {
    if (!currentTenantId) return;
    try {
      const data = await integrationFlowService.list(currentTenantId);
      setFlows(data);
    } catch (error) {
      console.error('Erro ao carregar fluxos:', error);
    }
  };

  // Carregar workflows do n8n com tag bpo-automatizado
  useEffect(() => {
    loadN8nWorkflows();
  }, []);

  const loadN8nWorkflows = async () => {
    setIsLoadingN8n(true);
    try {
      const mapped = await flowMappingService.mapBpoAutomatedFlows();
      setMappedN8nFlows(mapped);
    } catch (error) {
      console.error('Erro ao carregar workflows do n8n:', error);
    } finally {
      setIsLoadingN8n(false);
    }
  };

  // Helper para pegar o objeto tenant completo
  const currentTenant = tenants.find(t => t.id === currentTenantId);

  // Filtragem de Tenants para o Dropdown (Lógica Corrigida)
  const filteredTenants = tenants.filter(tenant => {
    const term = tenantSearchTerm.toLowerCase();
    const cleanTerm = tenantSearchTerm.replace(/\D/g, ''); 

    const matchesName = tenant.name.toLowerCase().includes(term);
    const matchesCnpj = cleanTerm.length > 0 && tenant.cnpj.replace(/\D/g, '').includes(cleanTerm);

    return matchesName || matchesCnpj;
  });

  const [flows, setFlows] = useState<IntegrationFlow[]>([]);
  const [editingFlow, setEditingFlow] = useState<string | null>(null);
  
  // Estados para workflows do n8n
  const [isLoadingN8n, setIsLoadingN8n] = useState<boolean>(false);
  const [mappedN8nFlows, setMappedN8nFlows] = useState<MappedFlow[]>([]);
  
  // Wizard States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [newFlow, setNewFlow] = useState<{
      source: PlatformType | null;
      destination: PlatformType | null;
      name: string;
      config: any;
  }>({
      source: null,
      destination: null,
      name: '',
      config: { syncProducts: true, createCustomers: true }
  });

  const toggleFlowStatus = (id: string) => {
    setFlows(flows.map(flow => 
      flow.id === id ? { ...flow, active: !flow.active } : flow
    ));
  };

  const updateConfig = (flowId: string, key: string) => {
    setFlows(flows.map(flow => {
      if (flow.id === flowId) {
        return {
          ...flow,
          config: {
            ...flow.config,
            [key]: !flow.config[key as keyof typeof flow.config]
          }
        };
      }
      return flow;
    }));
  };

  const handleCreateFlow = () => {
      if (newFlow.source && newFlow.destination) {
          const created: IntegrationFlow = {
              id: `flow-${Date.now()}`,
              name: newFlow.name || `Fluxo ${newFlow.source} -> ${newFlow.destination}`,
              source: newFlow.source,
              destination: newFlow.destination,
              active: true,
              config: newFlow.config
          };
          setFlows([...flows, created]);
          setIsModalOpen(false);
          resetWizard();
      }
  };

  const resetWizard = () => {
      setStep(1);
      setNewFlow({ source: null, destination: null, name: '', config: { syncProducts: true, createCustomers: true } });
  };

  const renderPlatformCard = (type: string, isOrigin: boolean) => {
    const isOlist = type === 'OLIST';
    const isHotmart = type === 'HOTMART';
    const colorClass = isOlist ? 'bg-indigo-600' : isHotmart ? 'bg-orange-600' : 'bg-[#0B74E0]';
    const label = isOlist ? 'Olist' : isHotmart ? 'Hotmart' : 'Conta Azul';
    const icon = isHotmart ? <Flame size={12}/> : label.substring(0, 1);
    
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${isOrigin ? 'border-gray-200 bg-white' : 'border-blue-100 bg-blue-50'}`}>
        <div className={`w-8 h-8 ${colorClass} rounded-lg flex items-center justify-center text-white font-bold text-xs`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">
            {isOrigin ? 'ORIGEM' : 'DESTINO'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto pb-10">
      
      {/* Header com Filtro de Cliente */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fluxos de Integração</h1>
          <p className="text-gray-500 mt-1">Gerencie e monitore os pipelines de dados.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            {/* Botão para sincronizar workflows do n8n */}
            <Button
              variant="secondary"
              onClick={loadN8nWorkflows}
              isLoading={isLoadingN8n}
              className="h-[46px] whitespace-nowrap"
            >
              <RefreshCw size={18} className="mr-2" />
              Sincronizar n8n
            </Button>

            {/* Custom Tenant Selector (Combobox) */}
            <div className="relative min-w-[300px]">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 ml-1 flex items-center gap-1">
                    <Filter size={12} /> Cliente Selecionado
                </label>
                
                <div className="relative">
                    {/* Backdrop transparente para fechar ao clicar fora */}
                    {isTenantDropdownOpen && (
                        <div className="fixed inset-0 z-10" onClick={() => setIsTenantDropdownOpen(false)} />
                    )}

                    {/* Trigger Button */}
                    <button 
                        onClick={() => setIsTenantDropdownOpen(!isTenantDropdownOpen)}
                        className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-left shadow-sm focus:ring-2 focus:ring-primary focus:border-primary hover:border-gray-400 transition-colors flex flex-col justify-center relative z-20"
                    >
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        {currentTenant ? (
                            <>
                                <span className="font-medium text-gray-900 leading-none">{currentTenant.name}</span>
                                <span className="text-[10px] text-gray-500 leading-tight mt-0.5">{currentTenant.cnpj}</span>
                            </>
                        ) : (
                            <span className="text-gray-500">Selecione um cliente...</span>
                        )}
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    </button>

                    {/* Dropdown Content */}
                    <AnimatePresence>
                        {isTenantDropdownOpen && (
                            <motion.div 
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 overflow-hidden"
                            >
                                {/* Search Input */}
                                <div className="p-2 border-b border-gray-100 bg-gray-50">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input 
                                            autoFocus
                                            type="text" 
                                            placeholder="Buscar empresa ou CNPJ..." 
                                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                            value={tenantSearchTerm}
                                            onChange={(e) => setTenantSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* List Options */}
                                <div className="max-h-60 overflow-y-auto">
                                    {filteredTenants.length > 0 ? (
                                        filteredTenants.map(tenant => (
                                            <button
                                                key={tenant.id}
                                                onClick={() => {
                                                    setCurrentTenantId(tenant.id);
                                                    setIsTenantDropdownOpen(false);
                                                    setTenantSearchTerm('');
                                                }}
                                                className={`w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors flex items-center justify-between group ${
                                                    currentTenantId === tenant.id ? 'bg-blue-50' : ''
                                                }`}
                                            >
                                                <div>
                                                    <p className={`text-sm ${currentTenantId === tenant.id ? 'font-bold text-primary' : 'font-medium text-gray-700'}`}>
                                                        {tenant.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{tenant.cnpj}</p>
                                                </div>
                                                {currentTenantId === tenant.id && (
                                                    <Check size={16} className="text-primary" />
                                                )}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-gray-500 text-sm">
                                            Nenhum cliente encontrado.
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="flex items-end gap-2">
                {/* Botão Novo Fluxo */}
                <Button onClick={() => setIsModalOpen(true)} className="h-[46px] whitespace-nowrap">
                    <Plus size={18} className="mr-2" />
                    Novo Fluxo
                </Button>
            </div>
        </div>
      </div>

      {/* Kanban / Pipeline View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Coluna 1: Origens Disponíveis (Visual apenas) */}
        <div className="lg:col-span-3 space-y-4 opacity-60 hover:opacity-100 transition-opacity duration-300">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Origens Conectadas</h3>
            <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm border-dashed">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">O</div>
                    <span className="text-sm font-medium">Olist Store</span>
                </div>
            </div>
             <button onClick={() => setIsModalOpen(true)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg shadow-sm border-dashed flex justify-center text-gray-400 text-xs hover:bg-gray-100 transition-colors">
                 + Adicionar Origem
            </button>
        </div>

        {/* Coluna 2: Fluxos Ativos (Central) */}
        <div className="lg:col-span-6 space-y-6">
             <div className="flex items-center justify-between mb-4">
                 <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Fluxos Ativos - {currentTenant?.name}
                 </h3>
                 {mappedN8nFlows.length > 0 && (
                   <span className="text-xs text-gray-500">
                     {mappedN8nFlows.length} workflow(s) do n8n mapeado(s)
                   </span>
                 )}
             </div>

             {/* Workflows do n8n mapeados */}
             {mappedN8nFlows.length > 0 && (
               <div className="mb-6">
                 <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                   Workflows n8n (tag: bpo-automatizado)
                 </h4>
                 {mappedN8nFlows.map(flow => (
                   <div key={flow.id} className={`bg-white rounded-xl border-2 transition-all mb-4 ${flow.active ? 'border-orange-200 shadow-lg shadow-orange-50' : 'border-gray-100 shadow-sm opacity-75'}`}>
                     <div className="p-5 flex flex-col gap-4">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <span className={`w-2 h-2 rounded-full ${flow.active ? 'bg-orange-500 animate-pulse' : 'bg-gray-300'}`}></span>
                           <div>
                             <h3 className="font-bold text-gray-800">{flow.name}</h3>
                             <p className="text-xs text-gray-500">n8n Workflow ID: {flow.n8nWorkflowId}</p>
                           </div>
                         </div>
                         <div className="flex items-center gap-2">
                           <button 
                             onClick={async () => {
                               try {
                                 const { n8nService } = await import('../services/n8nService');
                                 await n8nService.toggleWorkflow(flow.n8nWorkflowId, !flow.active);
                                 await loadN8nWorkflows();
                               } catch (error) {
                                 console.error('Erro ao atualizar workflow:', error);
                                 alert('Erro ao atualizar workflow no n8n');
                               }
                             }}
                             className={`p-1.5 rounded-full transition-colors ${flow.active ? 'text-orange-600 hover:bg-orange-50' : 'text-gray-400 hover:bg-gray-100'}`}
                             title={flow.active ? "Pausar Workflow" : "Iniciar Workflow"}
                           >
                             {flow.active ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
                           </button>
                         </div>
                       </div>

                       <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 relative">
                         {renderPlatformCard(flow.source, true)}
                         
                         <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-1.5 border border-gray-200 shadow-sm z-10 text-gray-400">
                           <ArrowRight size={16} />
                         </div>

                         {renderPlatformCard(flow.destination, false)}
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             )}

             {/* Fluxos do sistema */}
             {flows.map(flow => (
                <div key={flow.id} className={`bg-white rounded-xl border-2 transition-all ${flow.active ? 'border-primary/20 shadow-lg shadow-primary/5' : 'border-gray-100 shadow-sm opacity-75'}`}>
                    
                    {/* Header do Card */}
                    <div className="p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${flow.active ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
                                <h3 className="font-bold text-gray-800">{flow.name}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => toggleFlowStatus(flow.id)}
                                    className={`p-1.5 rounded-full transition-colors ${flow.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                    title={flow.active ? "Pausar Fluxo" : "Iniciar Fluxo"}
                                >
                                    {flow.active ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
                                </button>
                                <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
                                    <MoreVertical size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Visualização do Fluxo */}
                        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 relative">
                            {renderPlatformCard(flow.source, true)}
                            
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-1.5 border border-gray-200 shadow-sm z-10 text-gray-400">
                                <ArrowRight size={16} />
                            </div>

                            {renderPlatformCard(flow.destination, false)}
                        </div>
                    </div>

                    {/* Área de Configuração Rápida */}
                    <div className="border-t border-gray-100 p-5 bg-gray-50/50 rounded-b-xl">
                        <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setEditingFlow(editingFlow === flow.id ? null : flow.id)}>
                             <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <Settings size={12} />
                                Regras de Negócio
                             </h4>
                             <span className="text-xs text-primary font-medium hover:underline">
                                {editingFlow === flow.id ? 'Ocultar' : 'Editar'}
                             </span>
                        </div>

                        {editingFlow === flow.id && (
                            <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                                <Toggle 
                                    label="Sincronizar Produtos" 
                                    description="Cria produtos no Conta Azul se não existirem."
                                    checked={flow.config.syncProducts || false} 
                                    onChange={() => updateConfig(flow.id, 'syncProducts')} 
                                />
                                <Toggle 
                                    label="Criar Clientes" 
                                    description="Cadastra clientes automaticamente para cada pedido."
                                    checked={flow.config.createCustomers || false} 
                                    onChange={() => updateConfig(flow.id, 'createCustomers')} 
                                />
                                <Toggle 
                                    label="Consolidar Vendas (Diário)" 
                                    description="Agrupa vendas do dia em um único lançamento."
                                    checked={flow.config.consolidateSales || false} 
                                    onChange={() => updateConfig(flow.id, 'consolidateSales')} 
                                />
                            </div>
                        )}
                        
                        {/* Resumo quando fechado */}
                        {editingFlow !== flow.id && (
                            <div className="flex gap-2 mt-2">
                                {flow.config.syncProducts && (
                                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">Sync Produtos</span>
                                )}
                                {flow.config.createCustomers && (
                                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">Cria Clientes</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
             ))}

        </div>

        {/* Coluna 3: Destinos (Visual) */}
        <div className="lg:col-span-3 space-y-4 opacity-60 hover:opacity-100 transition-opacity duration-300">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Destinos Conectados</h3>
             <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm border-dashed">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#0B74E0] rounded-lg flex items-center justify-center text-white font-bold text-xs">CA</div>
                    <span className="text-sm font-medium">Conta Azul</span>
                </div>
            </div>
             <button onClick={() => setIsModalOpen(true)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg shadow-sm border-dashed flex justify-center text-gray-400 text-xs hover:bg-gray-100 transition-colors">
                 + Adicionar Destino
            </button>
        </div>
      </div>

      {/* WIZARD MODAL */}
      <AnimatePresence>
        {isModalOpen && (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" 
                    onClick={() => setIsModalOpen(false)}
                />
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-white rounded-xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Modal Header */}
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Novo Fluxo de Integração</h3>
                            <p className="text-xs text-gray-500">Cliente: <span className="font-semibold">{currentTenant?.name}</span></p>
                        </div>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <XCircle size={20} />
                        </button>
                    </div>
                    
                    {/* Modal Body */}
                    <div className="p-8 overflow-y-auto flex-1">
                        {/* Visualização do Progresso */}
                        <div className="flex justify-center items-center mb-10 text-gray-400">
                             <div className={`flex flex-col items-center gap-2 ${step === 1 ? 'text-primary' : newFlow.source ? 'text-gray-800' : ''}`}>
                                <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${newFlow.source ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-200 bg-gray-50'}`}>
                                    <ShoppingCart size={20} />
                                </div>
                                <span className="text-xs font-semibold uppercase">Origem</span>
                             </div>

                             <div className="w-16 h-0.5 bg-gray-200 mx-2 relative">
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-300">
                                    <ChevronRight size={16} />
                                </div>
                             </div>

                             <div className={`flex flex-col items-center gap-2 ${step === 2 ? 'text-primary' : newFlow.destination ? 'text-gray-800' : ''}`}>
                                <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${newFlow.destination ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 bg-gray-50'}`}>
                                    <Calculator size={20} />
                                </div>
                                <span className="text-xs font-semibold uppercase">Destino</span>
                             </div>

                             <div className="w-16 h-0.5 bg-gray-200 mx-2 relative">
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-300">
                                    <ChevronRight size={16} />
                                </div>
                             </div>

                             <div className={`flex flex-col items-center gap-2 ${step === 3 ? 'text-primary' : ''}`}>
                                <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${step === 3 ? 'bg-green-50 border-green-200 text-green-600' : 'border-gray-200 bg-gray-50'}`}>
                                    <Settings size={20} />
                                </div>
                                <span className="text-xs font-semibold uppercase">Config</span>
                             </div>
                        </div>

                        {/* Step 1: Origem */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <h4 className="text-lg font-medium text-gray-900 text-center mb-6">De onde virão os dados?</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {PLATFORMS.SOURCES.map(platform => (
                                        <button 
                                            key={platform.id}
                                            disabled={platform.status !== 'ACTIVE'}
                                            onClick={() => setNewFlow({...newFlow, source: platform.id as PlatformType})}
                                            className={`p-4 rounded-xl border-2 text-left transition-all ${
                                                newFlow.source === platform.id 
                                                ? 'border-primary ring-1 ring-primary bg-primary/5' 
                                                : platform.status === 'ACTIVE' 
                                                    ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50' 
                                                    : 'border-gray-100 opacity-60 cursor-not-allowed'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 ${platform.color} rounded-lg flex items-center justify-center text-white font-bold text-sm`}>
                                                        {typeof platform.icon === 'string' ? platform.icon : platform.icon}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900">{platform.name}</p>
                                                        <p className="text-xs text-gray-500">{platform.type}</p>
                                                    </div>
                                                </div>
                                                {platform.status !== 'ACTIVE' && (
                                                    <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded-full font-medium">Em breve</span>
                                                )}
                                                {newFlow.source === platform.id && (
                                                    <CheckCircle2 size={20} className="text-primary" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                         {/* Step 2: Destino */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <h4 className="text-lg font-medium text-gray-900 text-center mb-6">Para onde vamos enviar?</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {PLATFORMS.DESTINATIONS.map(platform => (
                                        <button 
                                            key={platform.id}
                                            disabled={platform.status !== 'ACTIVE'}
                                            onClick={() => setNewFlow({...newFlow, destination: platform.id as PlatformType})}
                                            className={`p-4 rounded-xl border-2 text-left transition-all ${
                                                newFlow.destination === platform.id 
                                                ? 'border-primary ring-1 ring-primary bg-primary/5' 
                                                : platform.status === 'ACTIVE' 
                                                    ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50' 
                                                    : 'border-gray-100 opacity-60 cursor-not-allowed'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 ${platform.color} rounded-lg flex items-center justify-center text-white font-bold text-sm`}>
                                                        {platform.icon}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900">{platform.name}</p>
                                                        <p className="text-xs text-gray-500">{platform.type}</p>
                                                    </div>
                                                </div>
                                                {platform.status !== 'ACTIVE' && (
                                                    <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded-full font-medium">Em breve</span>
                                                )}
                                                {newFlow.destination === platform.id && (
                                                    <CheckCircle2 size={20} className="text-primary" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Configuração */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <h4 className="text-lg font-medium text-gray-900">Configurações Iniciais</h4>
                                    <p className="text-sm text-gray-500">Você poderá alterar isso depois nas configurações detalhadas.</p>
                                </div>

                                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Fluxo</label>
                                        <input 
                                            type="text" 
                                            value={newFlow.name}
                                            onChange={(e) => setNewFlow({...newFlow, name: e.target.value})}
                                            placeholder="Ex: Integração Principal"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                        />
                                    </div>
                                    <div className="border-t border-gray-200 my-4 pt-2">
                                        <Toggle 
                                            label="Sincronizar Produtos Automaticamente" 
                                            description="Cadastra produtos no ERP caso não encontre correspondência pelo SKU."
                                            checked={newFlow.config.syncProducts}
                                            onChange={() => setNewFlow({...newFlow, config: {...newFlow.config, syncProducts: !newFlow.config.syncProducts}})}
                                        />
                                        <Toggle 
                                            label="Criar Clientes" 
                                            description="Cria o cadastro do cliente no ERP com os dados do pedido."
                                            checked={newFlow.config.createCustomers}
                                            onChange={() => setNewFlow({...newFlow, config: {...newFlow.config, createCustomers: !newFlow.config.createCustomers}})}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between">
                         <Button 
                            variant="secondary" 
                            onClick={() => step > 1 ? setStep(step - 1) : setIsModalOpen(false)}
                            disabled={false}
                        >
                            {step > 1 ? <><ChevronLeft size={16} className="mr-2"/> Voltar</> : 'Cancelar'}
                        </Button>
                        
                        {step < 3 ? (
                            <Button 
                                onClick={() => setStep(step + 1)}
                                disabled={step === 1 && !newFlow.source || step === 2 && !newFlow.destination}
                            >
                                Próximo <ChevronRight size={16} className="ml-2"/>
                            </Button>
                        ) : (
                            <Button onClick={handleCreateFlow} className="bg-green-600 hover:bg-green-700">
                                <CheckCircle2 size={16} className="mr-2"/> Criar Fluxo
                            </Button>
                        )}
                    </div>
                </motion.div>
             </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IntegrationFlows;