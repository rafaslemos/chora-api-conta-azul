import React, { useState, useEffect } from 'react';
import { Plus, Search, Building2, LogIn, CheckCircle2, XCircle, Key, RefreshCw, AlertTriangle, Loader2, MapPin, Phone, Mail, Building2 as BuildingIcon, Edit, PowerOff, AlertCircle, Power, MoreVertical } from 'lucide-react';
import Button from '../components/ui/Button';
import { Tenant } from '../types';
import { tenantService } from '../services/tenantService';
import { isSupabaseConfigured } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { fetchCompanyDataByCnpj } from '../services/cnpjService';
import { validateCnpj, formatCnpj, cleanCnpj } from '../utils/cnpjValidator';
import { formatPhone } from '../utils/phoneValidator';
import DropdownMenu, { DropdownMenuItem } from '../components/ui/DropdownMenu';
import ViewToggle, { ViewMode } from '../components/ui/ViewToggle';

const AdminTenants: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [isDeactivating, setIsDeactivating] = useState<string | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('bpo_tenants_view_mode');
    return (saved === 'grid' || saved === 'list') ? saved : 'grid';
  });
  
  const [newTenant, setNewTenant] = useState({ name: '', cnpj: '', email: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [cnpjMessage, setCnpjMessage] = useState('');
  const [companyData, setCompanyData] = useState<{
    razaoSocial?: string;
    nomeFantasia?: string;
    telefone?: string;
    email?: string;
    endereco?: {
      logradouro: string;
      numero: string;
      bairro: string;
      cidade: string;
      estado: string;
      cep: string;
    };
  } | null>(null);
  const navigate = useNavigate();

  // Carregar dados ao montar
  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const data = await tenantService.list();
      setTenants(data);
    } catch (error) {
      console.error("Falha ao carregar clientes", error);
      // Aqui poderíamos adicionar um toast de erro
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar dados do CNPJ
  const handleCnpjBlur = async () => {
    const cnpj = newTenant.cnpj.trim();
    
    if (!cnpj) {
      return;
    }

    // Validar formato
    if (!validateCnpj(cnpj)) {
      setCnpjStatus('error');
      setCnpjMessage('CNPJ inválido. Verifique o formato e os dígitos verificadores.');
      return;
    }

    setIsLoadingCnpj(true);
    setCnpjStatus('idle');
    setCnpjMessage('');

    try {
      const fetchedData = await fetchCompanyDataByCnpj(cnpj);
      
      // Salvar todos os dados retornados
      setCompanyData(fetchedData);
      
      // Preencher campos automaticamente
      setNewTenant(prev => ({
        ...prev,
        name: fetchedData.razaoSocial || fetchedData.nomeFantasia || prev.name,
        email: fetchedData.email && !prev.email ? fetchedData.email : prev.email,
      }));

      setCnpjStatus('success');
      setCnpjMessage('Dados da empresa carregados com sucesso!');
    } catch (error) {
      setCnpjStatus('error');
      setCompanyData(null);
      const message = error instanceof Error ? error.message : 'Erro ao buscar dados do CNPJ';
      setCnpjMessage(message);
    } finally {
      setIsLoadingCnpj(false);
    }
  };

  // Formatar CNPJ enquanto digita
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatCnpj(value);
    setNewTenant(prev => ({ ...prev, cnpj: formatted }));
    setCnpjStatus('idle');
    setCnpjMessage('');
    setCompanyData(null); // Limpar dados quando CNPJ mudar
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar CNPJ antes de criar/editar
    if (!validateCnpj(newTenant.cnpj)) {
      setCnpjStatus('error');
      setCnpjMessage('CNPJ inválido. Verifique o formato e os dígitos verificadores.');
      return;
    }

    if (isEditing && editingTenantId) {
      // Modo edição
      setIsCreating(true);
      try {
        const updated = await tenantService.update(editingTenantId, {
          ...newTenant,
          cnpj: cleanCnpj(newTenant.cnpj), // Salvar CNPJ sem formatação
          // Incluir todos os dados da empresa se disponíveis
          razaoSocial: companyData?.razaoSocial,
          nomeFantasia: companyData?.nomeFantasia,
          phone: companyData?.telefone,
          address: companyData?.endereco,
        });
        // Atualizar na lista local
        setTenants(tenants.map(t => t.id === editingTenantId ? updated : t));
        setIsModalOpen(false);
        resetForm();
      } catch (error) {
        console.error("Erro ao editar cliente", error);
        const errorMessage = error instanceof Error ? error.message : "Erro ao editar cliente. Verifique o console.";
        alert(errorMessage);
      } finally {
        setIsCreating(false);
      }
    } else {
      // Modo criação
      setIsCreating(true);
      try {
        const created = await tenantService.create({
          ...newTenant,
          cnpj: cleanCnpj(newTenant.cnpj), // Salvar CNPJ sem formatação
          // Incluir todos os dados da empresa se disponíveis
          razaoSocial: companyData?.razaoSocial,
          nomeFantasia: companyData?.nomeFantasia,
          phone: companyData?.telefone,
          address: companyData?.endereco,
        });
        setTenants([created, ...tenants]); // Adiciona ao topo da lista local
        setIsModalOpen(false);
        resetForm();
      } catch (error) {
        console.error("Erro ao criar cliente", error);
        const errorMessage = error instanceof Error ? error.message : "Erro ao criar cliente. Verifique o console.";
        alert(errorMessage);
      } finally {
        setIsCreating(false);
      }
    }
  };

  const navigateToContext = (path: string, tenant: Tenant) => {
      navigate(path, { state: { tenantId: tenant.id, tenantName: tenant.name } });
  };

  // Função para inativar cliente
  const handleDeactivateTenant = async (tenant: Tenant) => {
    setIsDeactivating(tenant.id);
    setShowDeactivateConfirm(null);

    try {
      await tenantService.deactivate(tenant.id);
      // Recarregar lista de tenants
      await loadTenants();
    } catch (error) {
      console.error("Erro ao inativar cliente", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao inativar cliente. Verifique o console.";
      alert(errorMessage);
    } finally {
      setIsDeactivating(null);
    }
  };

  // Função para ativar cliente
  const handleActivateTenant = async (tenant: Tenant) => {
    setIsDeactivating(tenant.id);

    try {
      await tenantService.activate(tenant.id);
      // Recarregar lista de tenants
      await loadTenants();
    } catch (error) {
      console.error("Erro ao ativar cliente", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao ativar cliente. Verifique o console.";
      alert(errorMessage);
    } finally {
      setIsDeactivating(null);
    }
  };

  // Função para resetar todos os estados do formulário
  const resetForm = () => {
    setNewTenant({ name: '', cnpj: '', email: '' });
    setCnpjStatus('idle');
    setCnpjMessage('');
    setCompanyData(null);
    setIsEditing(false);
    setEditingTenantId(null);
  };

  // Função para abrir o modal e resetar o formulário
  const handleOpenModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Função para abrir o modal de edição
  const handleEditTenant = (tenant: Tenant) => {
    setEditingTenantId(tenant.id);
    setNewTenant({
      name: tenant.name,
      cnpj: formatCnpj(tenant.cnpj), // Formatar CNPJ ao carregar para edição
      email: tenant.email,
    });
    // Preencher dados da empresa se existirem
    if (tenant.razaoSocial || tenant.nomeFantasia || tenant.phone || tenant.address) {
      setCompanyData({
        razaoSocial: tenant.razaoSocial,
        nomeFantasia: tenant.nomeFantasia,
        telefone: tenant.phone,
        email: tenant.email,
        endereco: tenant.address,
      });
      setCnpjStatus('success');
      setCnpjMessage('Dados carregados para edição');
    } else {
      setCompanyData(null);
      setCnpjStatus('idle');
      setCnpjMessage('');
    }
    setIsEditing(true);
    setIsModalOpen(true);
  };

  // Handler para mudança de visualização
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('bpo_tenants_view_mode', mode);
  };

  // Lógica de filtragem
  const filteredTenants = tenants.filter(tenant => {
    const term = searchTerm.toLowerCase();
    const cleanTerm = searchTerm.replace(/\D/g, ''); 

    const matchesName = tenant.name.toLowerCase().includes(term);
    const matchesCnpj = cleanTerm.length > 0 && tenant.cnpj.replace(/\D/g, '').includes(cleanTerm);

    return matchesName || matchesCnpj;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meus Clientes</h1>
          <p className="text-gray-500">Gerencie as empresas e acessos da plataforma multi-tenant.</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle value={viewMode} onChange={handleViewModeChange} />
          <Button onClick={handleOpenModal}>
            <Plus size={18} className="mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {!isSupabaseConfigured() && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 mt-0.5" size={18} />
            <div>
                <p className="text-xs text-yellow-700 mt-1">
                    O Supabase ainda não está configurado neste ambiente. Os dados exibidos abaixo são fictícios e não serão salvos permanentemente.
                    Use a página de setup para configurar o Supabase e conectar ao banco real.
                </p>
            </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4">
         <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por Empresa ou CNPJ..." 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-shadow"
            />
         </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="animate-spin text-primary mb-4" size={32} />
            <p className="text-gray-500">Carregando clientes...</p>
        </div>
      ) : (
        /* Renderização condicional: Grid ou Lista */
        filteredTenants.length > 0 ? (
          viewMode === 'grid' ? (
            /* Visualização em Caixas (Grid) */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredTenants.map((tenant) => (
                    <div key={tenant.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-visible flex flex-col">
                        <div className="p-5 flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                                        <Building2 size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 line-clamp-1">{tenant.name}</h3>
                                        <p className="text-xs text-gray-500">{formatCnpj(tenant.cnpj)}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    tenant.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    {tenant.status === 'ACTIVE' ? 'ATIVO' : 'INATIVO'}
                                </span>
                            </div>
                            
                            <div className="space-y-3 mt-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Plano</span>
                                    <span className="font-medium text-gray-900">{tenant.plan}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Criado em</span>
                                    <span className="text-gray-900">{new Date(tenant.joinedAt).toLocaleDateString('pt-BR')}</span>
                                </div>
                                
                                <div className="pt-2 border-t border-gray-100 mt-2">
                                    <p className="text-xs text-gray-400 mb-2 uppercase font-semibold">Status das Conexões</p>
                                    <div className="flex gap-2">
                                        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${tenant.connections.contaAzul ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-400 grayscale'}`}>
                                            {tenant.connections.contaAzul ? <CheckCircle2 size={12}/> : <XCircle size={12}/>} Conta Azul
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-3 border-t border-gray-200 flex items-center gap-2">
                            {/* Botões Principais */}
                            <Button 
                              variant="secondary" 
                              className="text-xs justify-center flex-1"
                              onClick={() => navigateToContext('/credentials', tenant)}
                            >
                              <Key size={14} className="mr-1"/> Credenciais
                            </Button>
                            
                            {/* Menu Dropdown */}
                            <DropdownMenu
                              align="right"
                              trigger={
                                <button className="p-2 rounded-lg hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900">
                                  <MoreVertical size={18} />
                                </button>
                              }
                              items={[
                                {
                                  label: 'Editar',
                                  icon: Edit,
                                  onClick: () => handleEditTenant(tenant),
                                },
                                ...(tenant.status === 'ACTIVE' ? [{
                                  label: 'Acessar Painel',
                                  icon: LogIn,
                                  onClick: () => navigateToContext('/dashboard', tenant),
                                }] : []),
                                {
                                  label: '---',
                                  onClick: () => {},
                                },
                                ...(tenant.status === 'ACTIVE' ? [{
                                  label: isDeactivating === tenant.id ? 'Inativando...' : 'Inativar Cliente',
                                  icon: PowerOff,
                                  onClick: () => setShowDeactivateConfirm(tenant.id),
                                  disabled: isDeactivating === tenant.id,
                                  variant: 'destructive' as const,
                                }] : [{
                                  label: isDeactivating === tenant.id ? 'Ativando...' : 'Ativar Cliente',
                                  icon: Power,
                                  onClick: () => handleActivateTenant(tenant),
                                  disabled: isDeactivating === tenant.id,
                                  variant: 'default' as const, // Ativar não é destrutivo, é positivo
                                }]),
                              ] as DropdownMenuItem[]}
                            />
                        </div>
                    </div>
                ))}
            </div>
          ) : (
            /* Visualização em Lista (Tabela) */
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cliente</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">CNPJ</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Plano</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Conexões</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Criado em</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 flex-shrink-0">
                              <Building2 size={20} />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{tenant.name}</div>
                              <div className="text-sm text-gray-500">{tenant.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatCnpj(tenant.cnpj)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            tenant.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {tenant.status === 'ACTIVE' ? 'ATIVO' : 'INATIVO'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{tenant.plan}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${tenant.connections.contaAzul ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-400 grayscale'}`}>
                              {tenant.connections.contaAzul ? <CheckCircle2 size={12}/> : <XCircle size={12}/>} CA
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{new Date(tenant.joinedAt).toLocaleDateString('pt-BR')}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Botões Principais */}
                            <Button 
                              variant="secondary" 
                              className="text-xs justify-center"
                              onClick={() => navigateToContext('/credentials', tenant)}
                            >
                              <Key size={14} className="mr-1"/> Credenciais
                            </Button>
                            <Button 
                              variant="secondary" 
                              className="text-xs justify-center"
                            >
                            </Button>
                            
                            {/* Menu Dropdown */}
                            <DropdownMenu
                              align="right"
                              trigger={
                                <button className="p-2 rounded-lg hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900">
                                  <MoreVertical size={18} />
                                </button>
                              }
                              items={[
                                {
                                  label: 'Editar',
                                  icon: Edit,
                                  onClick: () => handleEditTenant(tenant),
                                },
                                ...(tenant.status === 'ACTIVE' ? [{
                                  label: 'Acessar Painel',
                                  icon: LogIn,
                                  onClick: () => navigateToContext('/dashboard', tenant),
                                }] : []),
                                {
                                  label: '---',
                                  onClick: () => {},
                                },
                                ...(tenant.status === 'ACTIVE' ? [{
                                  label: isDeactivating === tenant.id ? 'Inativando...' : 'Inativar Cliente',
                                  icon: PowerOff,
                                  onClick: () => setShowDeactivateConfirm(tenant.id),
                                  disabled: isDeactivating === tenant.id,
                                  variant: 'destructive' as const,
                                }] : [{
                                  label: isDeactivating === tenant.id ? 'Ativando...' : 'Ativar Cliente',
                                  icon: Power,
                                  onClick: () => handleActivateTenant(tenant),
                                  disabled: isDeactivating === tenant.id,
                                  variant: 'default' as const,
                                }]),
                              ] as DropdownMenuItem[]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Search size={32} className="text-gray-300" />
            </div>
            <p className="text-lg font-medium text-gray-600">Nenhum cliente encontrado</p>
            <p className="text-sm text-gray-400">Tente buscar por outro nome ou CNPJ.</p>
          </div>
        )
      )}

      {/* Modal de confirmação de inativação */}
      {showDeactivateConfirm && (() => {
        const tenant = tenants.find(t => t.id === showDeactivateConfirm);
        if (!tenant) return null;
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="text-red-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Confirmar Inativação</h3>
                  <p className="text-sm text-gray-500">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  Tem certeza que deseja inativar o cliente <strong>{tenant.name}</strong>?
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 font-medium mb-2">Esta ação irá:</p>
                  <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                    <li>Inativar todos os fluxos cadastrados</li>
                    <li>Excluir todas as credenciais</li>
                    <li>Alterar o status do cliente para INATIVO</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="secondary" 
                  className="flex-1"
                  onClick={() => setShowDeactivateConfirm(null)}
                  disabled={isDeactivating === tenant.id}
                >
                  Cancelar
                </Button>
                <Button 
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => handleDeactivateTenant(tenant)}
                  isLoading={isDeactivating === tenant.id}
                >
                  {isDeactivating === tenant.id ? 'Inativando...' : 'Confirmar Inativação'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Novo Cliente */}
      <AnimatePresence>
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" 
                    onClick={() => {
                        setIsModalOpen(false);
                        resetForm();
                    }}
                />
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white rounded-xl shadow-xl w-full max-w-md relative z-10 overflow-hidden"
                >
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="text-lg font-bold text-gray-900">{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</h3>
                        <button 
                            onClick={() => {
                                setIsModalOpen(false);
                                resetForm();
                            }} 
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <XCircle size={20} />
                        </button>
                    </div>
                    
                    <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
                        {/* Campo CNPJ - Primeiro campo */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                CNPJ <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input 
                                    required
                                    type="text" 
                                    value={newTenant.cnpj}
                                    onChange={handleCnpjChange}
                                    onBlur={handleCnpjBlur}
                                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                                        cnpjStatus === 'error' 
                                            ? 'border-red-300 bg-red-50' 
                                            : cnpjStatus === 'success'
                                            ? 'border-green-300 bg-green-50'
                                            : 'border-gray-300'
                                    }`}
                                    placeholder="00.000.000/0000-00"
                                    disabled={isLoadingCnpj}
                                />
                                <div className="absolute right-3 top-2.5">
                                    {isLoadingCnpj && (
                                        <Loader2 className="animate-spin text-primary" size={18} />
                                    )}
                                    {!isLoadingCnpj && cnpjStatus === 'success' && (
                                        <CheckCircle2 className="text-green-600" size={18} />
                                    )}
                                    {!isLoadingCnpj && cnpjStatus === 'error' && (
                                        <XCircle className="text-red-600" size={18} />
                                    )}
                                </div>
                            </div>
                            {cnpjMessage && (
                                <p className={`mt-1 text-xs ${
                                    cnpjStatus === 'error' 
                                        ? 'text-red-600' 
                                        : cnpjStatus === 'success'
                                        ? 'text-green-600'
                                        : 'text-gray-500'
                                }`}>
                                    {cnpjMessage}
                                </p>
                            )}
                            <p className="mt-1 text-xs text-gray-500">
                                Digite o CNPJ e os dados da empresa serão preenchidos automaticamente
                            </p>
                        </div>

                        {/* Card com dados completos da empresa */}
                        {cnpjStatus === 'success' && companyData && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3"
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle2 className="text-green-600" size={18} />
                                    <h4 className="text-sm font-semibold text-green-900">Dados da Empresa Encontrados</h4>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    {/* Razão Social */}
                                    {companyData.razaoSocial && (
                                        <div className="flex items-start gap-2">
                                            <BuildingIcon className="text-green-600 mt-0.5 flex-shrink-0" size={16} />
                                            <div>
                                                <p className="text-xs text-gray-600 font-medium">Razão Social</p>
                                                <p className="text-gray-900">{companyData.razaoSocial}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Nome Fantasia */}
                                    {companyData.nomeFantasia && companyData.nomeFantasia !== companyData.razaoSocial && (
                                        <div className="flex items-start gap-2">
                                            <BuildingIcon className="text-green-600 mt-0.5 flex-shrink-0" size={16} />
                                            <div>
                                                <p className="text-xs text-gray-600 font-medium">Nome Fantasia</p>
                                                <p className="text-gray-900">{companyData.nomeFantasia}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Telefone */}
                                    {companyData.telefone && (
                                        <div className="flex items-start gap-2">
                                            <Phone className="text-green-600 mt-0.5 flex-shrink-0" size={16} />
                                            <div>
                                                <p className="text-xs text-gray-600 font-medium">Telefone</p>
                                                <p className="text-gray-900">{formatPhone(companyData.telefone)}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Email */}
                                    {companyData.email && (
                                        <div className="flex items-start gap-2">
                                            <Mail className="text-green-600 mt-0.5 flex-shrink-0" size={16} />
                                            <div>
                                                <p className="text-xs text-gray-600 font-medium">E-mail</p>
                                                <p className="text-gray-900">{companyData.email}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Endereço Completo */}
                                {companyData.endereco && (
                                    <div className="pt-2 border-t border-green-200">
                                        <div className="flex items-start gap-2">
                                            <MapPin className="text-green-600 mt-0.5 flex-shrink-0" size={16} />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-600 font-medium mb-1">Endereço</p>
                                                <p className="text-gray-900 text-sm">
                                                    {companyData.endereco.logradouro && (
                                                        <>
                                                            {companyData.endereco.logradouro}
                                                            {companyData.endereco.numero && `, ${companyData.endereco.numero}`}
                                                            {companyData.endereco.bairro && ` - ${companyData.endereco.bairro}`}
                                                            <br />
                                                        </>
                                                    )}
                                                    {companyData.endereco.cidade && companyData.endereco.estado && (
                                                        <>
                                                            {companyData.endereco.cidade} - {companyData.endereco.estado}
                                                            {companyData.endereco.cep && ` • CEP: ${companyData.endereco.cep}`}
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Campo Nome da Empresa */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nome da Empresa <span className="text-red-500">*</span>
                            </label>
                            <input 
                                required
                                type="text" 
                                value={newTenant.name}
                                onChange={e => setNewTenant({...newTenant, name: e.target.value})}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                                    cnpjStatus === 'success' && newTenant.name
                                        ? 'border-green-300 bg-green-50'
                                        : 'border-gray-300'
                                }`}
                                placeholder="Ex: Acme Corp Ltda"
                                disabled={isLoadingCnpj}
                            />
                        </div>

                        {/* Campo E-mail do Responsável */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                E-mail do Responsável <span className="text-red-500">*</span>
                            </label>
                            <input 
                                required
                                type="email" 
                                value={newTenant.email}
                                onChange={e => setNewTenant({...newTenant, email: e.target.value})}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                                    cnpjStatus === 'success' && newTenant.email
                                        ? 'border-green-300 bg-green-50'
                                        : 'border-gray-300'
                                }`}
                                placeholder="admin@empresa.com"
                                disabled={isLoadingCnpj}
                            />
                        </div>

                        <div className="pt-4 flex gap-3">
                            <Button type="button" variant="secondary" className="flex-1" onClick={() => {
                                setIsModalOpen(false);
                                resetForm();
                            }}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="flex-1" isLoading={isCreating}>
                                {isEditing ? 'Salvar Alterações' : 'Criar Cliente'}
                            </Button>
                        </div>
                    </form>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTenants;