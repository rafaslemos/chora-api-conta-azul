import React, { useState, useEffect } from 'react';
import {
    CheckCircle2,
    Lock,
    ExternalLink,
    RefreshCw,
    Key,
    XCircle,
    Settings,
    AlertCircle,
    Building2,
    Plus,
    Trash2,
    Power,
    PowerOff,
    Edit,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { credentialService } from '../services/credentialService';
import { TenantCredential } from '../types';
import { contaAzulAuthService } from '../services/contaAzulAuthService';
import { tenantService } from '../services/tenantService';
import { supabase } from '../lib/supabase';
import { useTenant } from '../contexts/TenantContext';

const Credentials: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { selectedTenantId } = useTenant();
    const tenantStateFromRoute = location.state as { tenantId: string; tenantName: string } | null;
    
    // Estado local para tenant
    const [currentTenant, setCurrentTenant] = useState<{ tenantId: string; tenantName: string } | null>(
        tenantStateFromRoute || (selectedTenantId ? { tenantId: selectedTenantId, tenantName: '' } : null)
    );

    // Estados de Controle de UI
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    // Estados Conta Azul - Lista de credenciais
    const [contaAzulCredentials, setContaAzulCredentials] = useState<TenantCredential[]>([]);
    const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
    
    // Estados para adicionar nova credencial
    const [showAddCredentialModal, setShowAddCredentialModal] = useState(false);
    const [newCredentialName, setNewCredentialName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    // Verificar se há tenantId na URL (retorno do callback OAuth)
    useEffect(() => {
        let searchParams = new URLSearchParams(location.search);
        let tenantIdFromUrl = searchParams.get('tenantId');
        
        if (window.location.hash) {
            const hashMatch = window.location.hash.match(/[?&]tenantId=([^&]*)/);
            if (hashMatch) {
                tenantIdFromUrl = decodeURIComponent(hashMatch[1]);
                const hashQuery = window.location.hash.split('?')[1];
                if (hashQuery) {
                    searchParams = new URLSearchParams(hashQuery);
                }
            }
        }
        
        if (tenantIdFromUrl) {
            if (currentTenant?.tenantId === tenantIdFromUrl) {
                return;
            }
            
            const fetchTenant = async () => {
                try {
                    // Query direta - a tabela está no schema app_core, mas o Supabase client pode acessar se o schema estiver exposto
                    const { data, error } = await supabase
                        .from('tenants')
                        .select('id, name')
                        .eq('id', tenantIdFromUrl)
                        .single();
                    
                    if (!error && data) {
                        setCurrentTenant({
                            tenantId: data.id,
                            tenantName: data.name
                        });
                        navigate(location.pathname, {
                            state: { tenantId: data.id, tenantName: data.name },
                            replace: true
                        });
                    }
                } catch (error) {
                    console.error('Erro ao buscar tenant:', error);
                }
            };
            
            fetchTenant();
        } else if (tenantStateFromRoute) {
            setCurrentTenant(tenantStateFromRoute);
        } else if (selectedTenantId && !currentTenant) {
            // Buscar nome do tenant do contexto
            tenantService.list().then(tenants => {
                const tenant = tenants.find(t => t.id === selectedTenantId);
                if (tenant) {
                    setCurrentTenant({ tenantId: tenant.id, tenantName: tenant.name });
                }
            });
        }
    }, [location.search, currentTenant, navigate, location.pathname, tenantStateFromRoute, selectedTenantId]);

    // Verificar parâmetros de sucesso/erro na URL
    useEffect(() => {
        let searchParams = new URLSearchParams(location.search);
        let success = searchParams.get('success');
        let error = searchParams.get('error');
        
        if (window.location.hash) {
            const hashQuery = window.location.hash.split('?')[1];
            if (hashQuery) {
                searchParams = new URLSearchParams(hashQuery);
                success = searchParams.get('success') || success;
                error = searchParams.get('error') || error;
            }
        }

        if (success) {
            setSuccessMessage(success);
            setErrorMessage(null);
            if (currentTenant?.tenantId) {
                loadCredentials();
            }
            // Limpar parâmetros da URL
            const newParams = new URLSearchParams();
            const tenantId = searchParams.get('tenantId');
            if (tenantId) newParams.set('tenantId', tenantId);
            const newSearch = newParams.toString();
            navigate(`${location.pathname}${newSearch ? '?' + newSearch : ''}`, { replace: true });
        }

        if (error) {
            setErrorMessage(error);
            setSuccessMessage(null);
            const newParams = new URLSearchParams();
            const tenantId = searchParams.get('tenantId');
            if (tenantId) newParams.set('tenantId', tenantId);
            const newSearch = newParams.toString();
            navigate(`${location.pathname}${newSearch ? '?' + newSearch : ''}`, { replace: true });
        }
    }, [location.search, navigate, currentTenant?.tenantId, location.pathname]);

    // Carregar credenciais quando o tenant estiver disponível
    useEffect(() => {
        if (currentTenant?.tenantId) {
            loadCredentials();
        }
    }, [currentTenant?.tenantId]);

    const loadCredentials = async () => {
        if (!currentTenant?.tenantId) {
            return;
        }

        setIsLoadingCredentials(true);
        try {
            const credentials = await credentialService.list(currentTenant.tenantId, 'CONTA_AZUL');
            setContaAzulCredentials(credentials);
        } catch (error) {
            console.error('Erro ao carregar credenciais:', error);
            setErrorMessage('Erro ao carregar credenciais');
        } finally {
            setIsLoadingCredentials(false);
        }
    };

    const handleCreateCredential = async () => {
        if (!currentTenant?.tenantId) {
            setErrorMessage('Tenant ID não encontrado');
            return;
        }
        if (!newCredentialName.trim()) {
            setErrorMessage('Por favor, informe um nome para a credencial (ex: "Matriz SP", "Filial RJ")');
            return;
        }

        setIsCreating(true);
        setErrorMessage(null);
        try {
            await credentialService.create(
                currentTenant.tenantId,
                'CONTA_AZUL',
                newCredentialName.trim(),
                {
                    access_token: null,
                    refresh_token: null,
                    is_active: false,
                }
            );
            setShowAddCredentialModal(false);
            setNewCredentialName('');
            await loadCredentials();
            setSuccessMessage('Credencial cadastrada. Clique em "Conectar Conta Azul" na credencial para autenticar.');
        } catch (error) {
            console.error('Erro ao cadastrar credencial:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Erro ao cadastrar credencial');
        } finally {
            setIsCreating(false);
        }
    };

    const handleConnectContaAzul = async (credential: TenantCredential) => {
        if (!currentTenant?.tenantId || !credential?.id) {
            setErrorMessage('Tenant ou credencial não encontrado.');
            return;
        }
        setIsConnecting(true);
        setErrorMessage(null);
        try {
            await contaAzulAuthService.initiateAuth(currentTenant.tenantId, credential.id);
        } catch (error) {
            console.error('Erro ao iniciar autenticação:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Erro ao iniciar autenticação');
            setIsConnecting(false);
        }
    };

    const handleToggleCredential = async (credential: TenantCredential) => {
        if (!credential.id) return;

        try {
            await credentialService.update(credential.id, {
                is_active: !credential.isActive,
            });
            await loadCredentials();
        } catch (error) {
            console.error('Erro ao atualizar credencial:', error);
            setErrorMessage('Erro ao atualizar credencial');
        }
    };

    const handleDeleteCredential = async (credential: TenantCredential) => {
        if (!credential.id) return;
        
        if (!window.confirm(`Tem certeza que deseja remover a credencial "${credential.credentialName}"?`)) {
            return;
        }

        try {
            await credentialService.delete(credential.id);
            await loadCredentials();
            setSuccessMessage('Credencial removida com sucesso');
        } catch (error) {
            console.error('Erro ao deletar credencial:', error);
            setErrorMessage('Erro ao deletar credencial');
        }
    };

    const handleReauthenticate = async (credential: TenantCredential) => {
        if (!currentTenant?.tenantId || !credential.id) {
            setErrorMessage('Não é possível reautenticar esta credencial. Informações insuficientes.');
            return;
        }
        setIsConnecting(true);
        setErrorMessage(null);
        try {
            await contaAzulAuthService.initiateAuth(currentTenant.tenantId, credential.id);
        } catch (error) {
            console.error('Erro ao iniciar reautenticação:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Erro ao iniciar reautenticação');
            setIsConnecting(false);
        }
    };

    // Função auxiliar para determinar se credencial precisa reautenticação
    const needsReauthentication = (credential: TenantCredential): boolean => {
        return credential.revokedAt !== null && credential.revokedAt !== undefined;
    };

    // Se não há tenant selecionado
    if (!currentTenant?.tenantId) {
        return (
            <div className="p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-yellow-800">
                        <AlertCircle size={20} />
                        <p>Por favor, selecione um cliente para gerenciar as credenciais.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Credenciais Conta Azul</h1>
                    <p className="text-gray-600 mt-1">Cliente: {currentTenant.tenantName}</p>
                </div>
                <Button
                    onClick={() => setShowAddCredentialModal(true)}
                    className="flex items-center gap-2"
                >
                    <Plus size={18} />
                    Adicionar Credencial
                </Button>
            </div>

            {/* Mensagens de sucesso/erro */}
            {successMessage && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-800"
                >
                    <CheckCircle2 size={20} />
                    <p>{successMessage}</p>
                    <button
                        onClick={() => setSuccessMessage(null)}
                        className="ml-auto text-green-600 hover:text-green-800"
                    >
                        <XCircle size={18} />
                    </button>
                </motion.div>
            )}

            {errorMessage && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-800"
                >
                    <AlertCircle size={20} />
                    <p>{errorMessage}</p>
                    <button
                        onClick={() => setErrorMessage(null)}
                        className="ml-auto text-red-600 hover:text-red-800"
                    >
                        <XCircle size={18} />
                    </button>
                </motion.div>
            )}

            {/* Lista de Credenciais */}
            {isLoadingCredentials ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : contaAzulCredentials.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
                    <Lock size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma credencial cadastrada</h3>
                    <p className="text-gray-600 mb-4">Adicione uma credencial Conta Azul para começar</p>
                    <Button onClick={() => setShowAddCredentialModal(true)}>
                        <Plus size={18} className="mr-2" />
                        Adicionar Primeira Credencial
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {contaAzulCredentials.map((credential) => (
                        <motion.div
                            key={credential.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    {/* Aviso visual quando credencial precisa reautenticação */}
                                    {needsReauthentication(credential) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mb-3 bg-orange-50 border border-orange-200 rounded-lg p-3"
                                        >
                                            <div className="flex items-start gap-2">
                                                <AlertCircle size={18} className="text-orange-600 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-orange-800">
                                                        Esta credencial foi revogada e precisa ser reautenticada
                                                    </p>
                                                    <p className="text-xs text-orange-700 mt-1">
                                                        O token de acesso expirou ou foi revogado pela Conta Azul. 
                                                        Clique em "Reautenticar" para renovar o acesso.
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {credential.credentialName || 'Sem nome'}
                                        </h3>
                                        {needsReauthentication(credential) ? (
                                            <span 
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded"
                                                title="Credencial revogada - precisa reautenticação"
                                            >
                                                <AlertCircle size={12} />
                                                Revogada
                                            </span>
                                        ) : credential.isActive ? (
                                            <span 
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded"
                                                title="Credencial ativa e funcionando"
                                            >
                                                <CheckCircle2 size={12} />
                                                Ativa
                                            </span>
                                        ) : (
                                            <span 
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded"
                                                title="Credencial desativada manualmente"
                                            >
                                                <XCircle size={12} />
                                                Inativa
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-600 space-y-1">
                                        <p>ID: {credential.id}</p>
                                        {credential.lastAuthenticatedAt && (
                                            <p>Última autenticação: {new Date(credential.lastAuthenticatedAt).toLocaleString('pt-BR')}</p>
                                        )}
                                        {credential.revokedAt && (
                                            <p className="text-orange-700 font-medium">
                                                Revogada em: {new Date(credential.revokedAt).toLocaleString('pt-BR')}
                                            </p>
                                        )}
                                        {credential.lastSyncAt && (
                                            <p>Última sincronização: {new Date(credential.lastSyncAt).toLocaleString('pt-BR')}</p>
                                        )}
                                        <p>Criada em: {new Date(credential.createdAt).toLocaleString('pt-BR')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Conectar Conta Azul - credencial inativa e não revogada (nunca conectou ou desativada) */}
                                    {!credential.isActive && !credential.revokedAt && (
                                        <button
                                            onClick={() => handleConnectContaAzul(credential)}
                                            disabled={isConnecting}
                                            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                            title="Conectar credencial na Conta Azul"
                                        >
                                            <ExternalLink size={14} className={isConnecting ? 'animate-spin' : ''} />
                                            Conectar Conta Azul
                                        </button>
                                    )}
                                    {/* Reautenticar - credencial revogada */}
                                    {needsReauthentication(credential) && (
                                        <button
                                            onClick={() => handleReauthenticate(credential)}
                                            disabled={isConnecting}
                                            className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                            title="Reautenticar credencial na Conta Azul"
                                        >
                                            <RefreshCw size={14} className={isConnecting ? 'animate-spin' : ''} />
                                            Reautenticar
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleToggleCredential(credential)}
                                        className={`p-2 rounded-lg transition-colors ${
                                            credential.isActive
                                                ? 'text-gray-600 hover:bg-gray-100'
                                                : 'text-green-600 hover:bg-green-50'
                                        }`}
                                        title={credential.isActive ? 'Desativar' : 'Ativar'}
                                    >
                                        {credential.isActive ? <PowerOff size={18} /> : <Power size={18} />}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteCredential(credential)}
                                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                        title="Remover"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Modal para Adicionar Credencial */}
            <AnimatePresence>
                {showAddCredentialModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                        onClick={() => !isCreating && setShowAddCredentialModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-semibold mb-4">Nova credencial Conta Azul</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Nome da Credencial *
                                    </label>
                                    <input
                                        type="text"
                                        value={newCredentialName}
                                        onChange={(e) => setNewCredentialName(e.target.value)}
                                        placeholder='Ex: "Matriz SP", "Filial RJ"'
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                        disabled={isCreating}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Este nome será usado para identificar a credencial no Data Warehouse.
                                    </p>
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-sm text-blue-800">
                                        Após cadastrar, a credencial aparecerá na lista. Clique em &quot;Conectar Conta Azul&quot; nela para realizar a autenticação na Conta Azul.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <Button
                                    onClick={handleCreateCredential}
                                    disabled={!newCredentialName.trim() || isCreating}
                                    isLoading={isCreating}
                                    className="flex-1"
                                >
                                    Cadastrar
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setShowAddCredentialModal(false)}
                                    disabled={isCreating}
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Credentials;
