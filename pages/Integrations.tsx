import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  ExternalLink, 
  Info, 
  Settings2,
  RefreshCw,
  Gauge
} from 'lucide-react';
import Button from '../components/ui/Button';
import { credentialService } from '../services/credentialService';
import { useTenant } from '../contexts/TenantContext';
import { olistPlanService, OlistPlan } from '../services/olistPlanService';
import { TenantCredential } from '../types';

// Componente simples de Toggle (Switch)
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

const Integrations: React.FC = () => {
  // Usar contexto de tenant
  const { selectedTenantId, isLoading: isLoadingTenants } = useTenant();
  const [isLoading, setIsLoading] = useState(true);

  // Estados Olist
  const [olistToken, setOlistToken] = useState('');
  const [olistEmail, setOlistEmail] = useState('');
  const [olistPlan, setOlistPlan] = useState<'COMECAR' | 'CRESCER' | 'EVOLUIR' | 'POTENCIALIZAR'>('COMECAR');
  const [olistPlans, setOlistPlans] = useState<OlistPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isTestingOlist, setTestingOlist] = useState(false);
  const [saveMessage, setSaveMessage] = useState<'success' | 'error' | null>(null);
  const [syncProducts, setSyncProducts] = useState(true);
  const [olistConnected, setOlistConnected] = useState(false);
  const [olistCredential, setOlistCredential] = useState<TenantCredential | null>(null);

  // Estados Conta Azul
  const [isTestingCa, setTestingCa] = useState(false);
  const [createCustomers, setCreateCustomers] = useState(true);
  const [consolidateSales, setConsolidateSales] = useState(false);
  const [caConnected, setCaConnected] = useState(false);
  const [caCredential, setCaCredential] = useState<TenantCredential | null>(null);

  // Carregar planos OLIST ao montar o componente
  useEffect(() => {
    loadOlistPlans();
  }, []);

  // Carregar credenciais quando o tenant selecionado mudar
  useEffect(() => {
    if (selectedTenantId) {
      loadCredentials(selectedTenantId);
    } else {
      // Se não há tenant selecionado, limpar credenciais
      setIsLoading(false);
      setOlistConnected(false);
      setOlistCredential(null);
      setOlistToken('');
      setOlistEmail('');
      setCaConnected(false);
      setCaCredential(null);
    }
  }, [selectedTenantId]);

  const loadOlistPlans = async () => {
    setIsLoadingPlans(true);
    try {
      const plans = await olistPlanService.list();
      setOlistPlans(plans);
      // Se não há plano selecionado ou o plano atual não está na lista, selecionar o primeiro
      if (plans.length > 0) {
        const currentPlanExists = plans.some(p => p.code === olistPlan);
        if (!currentPlanExists || !olistPlan) {
          setOlistPlan(plans[0].code);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar planos OLIST:', error);
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const loadCredentials = async (tenantId: string) => {
    setIsLoading(true);
    try {
      const credentials = await credentialService.list(tenantId);
      const olistCred = credentials.find(c => c.platform === 'OLIST');
      const caCred = credentials.find(c => c.platform === 'CONTA_AZUL');

      if (olistCred) {
        setOlistCredential(olistCred);
        setOlistConnected(olistCred.isActive);
        setOlistToken(olistCred.accessToken ? '••••••••••••••••' : '');
        // Carregar plano do config, validando se é um código válido
        const planCode = olistCred.config?.plan;
        if (planCode && ['COMECAR', 'CRESCER', 'EVOLUIR', 'POTENCIALIZAR'].includes(planCode)) {
          setOlistPlan(planCode as 'COMECAR' | 'CRESCER' | 'EVOLUIR' | 'POTENCIALIZAR');
        } else {
          // Se não há plano válido, usar o primeiro disponível (se já carregou os planos)
          // Caso contrário, será definido quando os planos carregarem
          if (olistPlans.length > 0) {
            setOlistPlan(olistPlans[0].code);
          }
        }
        // Email pode estar no config
        if (olistCred.config?.email) {
          setOlistEmail(olistCred.config.email);
        }
      } else {
        setOlistConnected(false);
        setOlistCredential(null);
        setOlistToken('');
        setOlistEmail('');
        // Se não há credencial, usar o primeiro plano disponível
        if (olistPlans.length > 0) {
          setOlistPlan(olistPlans[0].code);
        }
      }

      if (caCred) {
        setCaCredential(caCred);
        setCaConnected(caCred.isActive);
      } else {
        setCaConnected(false);
        setCaCredential(null);
      }
    } catch (error) {
      console.error('Erro ao carregar credenciais:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testOlist = async () => {
    if (!selectedTenantId) {
      setSaveMessage('error');
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setTestingOlist(true);
    setSaveMessage(null);

    try {
      // Preparar config com plano e email
      const config: Record<string, any> = {
        plan: olistPlan,
      };

      if (olistEmail) {
        config.email = olistEmail;
      }

      // Se já existe credencial, atualizar
      if (olistCredential) {
        await credentialService.update(selectedTenantId, 'OLIST', {
          plan: olistPlan,
          email: olistEmail || undefined,
        } as any);
      } else {
        // Se não existe credencial, apenas salvar o plano e email em uma credencial mínima
        // O token será configurado depois pelo usuário
        // Criar credencial com token vazio (será atualizado depois)
        await credentialService.create(selectedTenantId, 'OLIST', {
          access_token: 'PLACEHOLDER', // Placeholder que será substituído quando o token for configurado
          plan: olistPlan,
          email: olistEmail || undefined,
          is_active: false,
        } as any);
      }

      // Recarregar credenciais para atualizar o estado
      await loadCredentials(selectedTenantId);

      // Se há token configurado, testar conexão
      if (olistCredential?.accessToken || olistToken) {
        // Obter token descriptografado para teste
        const decryptedCred = await credentialService.getDecrypted(selectedTenantId, 'OLIST');
        if (decryptedCred?.accessToken) {
          const testResult = await credentialService.testOlistConnection(decryptedCred.accessToken);
          if (testResult.valid) {
            setSaveMessage('success');
          } else {
            setSaveMessage('error');
            console.error('Erro ao testar conexão:', testResult.error);
          }
        } else {
          setSaveMessage('success');
        }
      } else {
        setSaveMessage('success');
      }

      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      console.error('Erro ao salvar/testar conexão OLIST:', error);
      setSaveMessage('error');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setTestingOlist(false);
    }
  };

  const testCa = () => {
    setTestingCa(true);
    setTimeout(() => setTestingCa(false), 2000);
  };

  // Se não há tenant selecionado, mostrar mensagem
  if (!selectedTenantId) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 pb-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuração de Integrações</h1>
          <p className="text-gray-500">Conecte e configure o comportamento do fluxo de dados entre Olist e Conta Azul.</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircle className="mx-auto mb-3 text-yellow-600" size={32} />
          <p className="text-gray-700 font-medium">Selecione um cliente no menu superior para configurar as integrações.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuração de Integrações</h1>
        <p className="text-gray-500">Conecte e configure o comportamento do fluxo de dados entre Olist e Conta Azul.</p>
      </div>

      {isLoading || isLoadingTenants ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Carregando credenciais...</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ==================== OLIST SECTION (ORIGEM) ==================== */}
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">O</div>
                <h2 className="text-xl font-semibold text-gray-800">Olist</h2>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full border ${
                          olistConnected 
                            ? 'text-success bg-green-50 border-green-100' 
                            : 'text-gray-500 bg-gray-50 border-gray-100'
                        }`}>
                        {olistConnected ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        {olistConnected ? 'Conectado' : 'Desconectado'}
                        </div>
                    </div>
                    <Button variant="ghost" className="text-xs">
                        <ExternalLink size={14} className="mr-1"/> Portal Olist
                    </Button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Credenciais */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            <Lock size={16} className="text-gray-400"/>
                            Credenciais de Acesso
                        </h3>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">E-mail da Loja (Login Olist)</label>
                            <input 
                                type="email" 
                                value={olistEmail || ''} 
                                onChange={(e) => setOlistEmail(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                placeholder="Digite o e-mail da loja"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Token da API</label>
                            <div className="relative">
                                <input 
                                type="password" 
                                value={olistToken || ''} 
                                onChange={(e) => setOlistToken(e.target.value)}
                                className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-gray-50"
                                readOnly
                                placeholder={olistConnected ? 'Token configurado' : 'Nenhum token configurado'}
                                />
                                <button className="absolute right-3 top-2.5 text-gray-400 hover:text-indigo-600">
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Limites de API */}
                        <div className="pt-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                                <Gauge size={12} /> Limite de Requisições (Plano)
                            </label>
                            {isLoadingPlans ? (
                                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-500">
                                    Carregando planos...
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={olistPlan}
                                        onChange={(e) => setOlistPlan(e.target.value as 'COMECAR' | 'CRESCER' | 'EVOLUIR' | 'POTENCIALIZAR')}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                                    >
                                        {olistPlans.map((plan) => (
                                            <option key={plan.id} value={plan.code}>
                                                {plan.name} ({plan.requestsPerMinute} req/min, {plan.batchRequests} req em lote)
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-gray-400 mt-1 leading-tight">
                                        Define a velocidade máxima de sincronização para respeitar os limites do seu plano e evitar bloqueios.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* Comportamento */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                            <Settings2 size={16} className="text-gray-400"/>
                            Preferências de Sincronização
                        </h3>
                        <div className="divide-y divide-gray-100">
                            <Toggle 
                                label="Sincronizar Catálogo de Produtos" 
                                description="Atualiza automaticamente novos produtos cadastrados no Olist."
                                checked={syncProducts} 
                                onChange={() => setSyncProducts(!syncProducts)} 
                            />
                        </div>
                    </div>

                    <div className="pt-2 space-y-2">
                        {saveMessage === 'success' && (
                            <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg p-2">
                                <CheckCircle2 size={16} />
                                <span>Configurações salvas com sucesso!</span>
                            </div>
                        )}
                        {saveMessage === 'error' && (
                            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-2">
                                <AlertCircle size={16} />
                                <span>Erro ao salvar configurações. Tente novamente.</span>
                            </div>
                        )}
                        <Button onClick={testOlist} isLoading={isTestingOlist} className="w-full">
                            Salvar e Testar Conexão Olist
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        {/* ==================== CONTA AZUL SECTION (DESTINO) ==================== */}
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-[#0B74E0] rounded-lg flex items-center justify-center text-white font-bold text-xs">CA</div>
                <h2 className="text-xl font-semibold text-gray-800">Conta Azul</h2>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full border ${
                          caConnected 
                            ? 'text-success bg-green-50 border-green-100' 
                            : 'text-warning bg-yellow-50 border-yellow-100'
                        }`}>
                            {caConnected ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            {caConnected ? 'Conectado' : 'Token Expirando'}
                        </div>
                    </div>
                    <Button variant="ghost" className="text-xs">
                        <ExternalLink size={14} className="mr-1"/> Acessar Conta Azul
                    </Button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status da Autenticação */}
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                        <div className="flex items-start gap-3">
                            <div className="bg-white p-2 rounded-full shadow-sm">
                                <RefreshCw size={20} className="text-[#0B74E0]"/>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-[#0B74E0]">Conexão OAuth Ativa</h4>
                                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                                    O sistema está autorizado a ler e escrever lançamentos financeiros.
                                    O token de acesso é renovado automaticamente a cada 60 minutos.
                                </p>
                                {caCredential?.refreshToken && (
                                  <p className="text-xs text-gray-500 mt-2 font-mono">
                                    Refresh Token Hash: {caCredential.refreshToken.substring(0, 3)}...{caCredential.refreshToken.substring(caCredential.refreshToken.length - 3)}
                                  </p>
                                )}
                            </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <Button variant="secondary" className="text-xs py-1 h-8">Re-autenticar</Button>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* Comportamento de Escrita */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                            <Settings2 size={16} className="text-gray-400"/>
                            Regras de Lançamento
                        </h3>
                        <div className="divide-y divide-gray-100">
                            <Toggle 
                                label="Criar Clientes Automaticamente" 
                                description="Se desligado, usará um 'Cliente Padrão' para todas as vendas (recomendado para alto volume)."
                                checked={createCustomers} 
                                onChange={() => setCreateCustomers(!createCustomers)} 
                            />
                            <Toggle 
                                label="Agrupar Vendas Diárias" 
                                description="Cria um único lançamento financeiro somando as vendas do dia por Marketplace."
                                checked={consolidateSales} 
                                onChange={() => setConsolidateSales(!consolidateSales)} 
                            />
                             <div className="py-3">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-700">Centro de Custo Padrão</label>
                                    <span className="text-xs text-[#0B74E0] cursor-pointer hover:underline">Atualizar lista</span>
                                </div>
                                <select className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 text-sm py-2">
                                    <option>Vendas Online (Padrão)</option>
                                    <option>Marketplaces</option>
                                    <option>Sem Centro de Custo</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4">
                        <div className="flex items-start gap-2">
                            <Info size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-gray-500">
                                Para configurar regras específicas (ex: "Se produto X, então categoria Y"), acesse a aba <strong className="text-gray-700 cursor-pointer hover:underline">Mapeamentos</strong>.
                            </p>
                        </div>
                    </div>

                     <div className="pt-2">
                        <Button onClick={testCa} isLoading={isTestingCa} variant="primary" className="w-full bg-[#0B74E0] hover:bg-[#065FA8]">
                            Salvar e Testar Conta Azul
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default Integrations;