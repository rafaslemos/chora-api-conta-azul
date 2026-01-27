import React, { useEffect, useState, useRef } from 'react';
import { contaAzulAuthService } from '../services/contaAzulAuthService';
import { credentialService } from '../services/credentialService';
import { supabase } from '../lib/supabase';

// Helper para navegação que funciona dentro e fora do Router
const navigateTo = (path: string) => {
    // Sempre usar HashRouter (adicionar # se não tiver)
    const hashPath = path.startsWith('#') ? path : `#${path}`;
    
    // Usar window.location.href completo para fazer um redirecionamento real
    // Isso garante que o App.tsx não continue renderizando o callback
    const baseUrl = window.location.origin;
    const newUrl = `${baseUrl}${hashPath}`;
    window.location.href = newUrl;
};

const ContaAzulCallback: React.FC = () => {
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [message, setMessage] = useState('Processando autenticação com Conta Azul...');
    const [tenantId, setTenantId] = useState<string | null>(null);
    const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

    // Helper para criar timeout com cleanup automático
    // Previne memory leaks e atualizações de estado após unmount
    const createTimeout = (callback: () => void, delay: number) => {
        const timeoutId = setTimeout(() => {
            callback();
            // Remover da lista após execução
            timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId);
        }, delay);
        timeoutRefs.current.push(timeoutId);
        return timeoutId;
    };

    useEffect(() => {
        const processCallback = async () => {
            // Estratégia de captura de parâmetros OAuth
            // Priorizar window.location.search (mais confiável para OAuth, funciona mesmo fora do Router)
            // Fallback para location.search do React Router e window.location.hash
            
            let searchParams: URLSearchParams | null = null;
            let source = '';

            // 1. Tentar window.location.search primeiro (PRIMÁRIO - mais confiável para OAuth)
            if (window.location.search) {
                searchParams = new URLSearchParams(window.location.search);
                if (searchParams.get('code') || searchParams.get('error')) {
                    source = 'window.location.search';
                }
            }

            // 2. Fallback: tentar window.location.hash (caso esteja no hash do React Router)
            if (!searchParams || (!searchParams.get('code') && !searchParams.get('error'))) {
                if (window.location.hash && window.location.hash.includes('?')) {
                    const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
                    if (hashParams.get('code') || hashParams.get('error')) {
                        searchParams = hashParams;
                        source = 'window.location.hash';
                    }
                }
            }

            // Se ainda não encontrou parâmetros
            if (!searchParams || (!searchParams.get('code') && !searchParams.get('error'))) {
                setStatus('error');
                setMessage('Parâmetros de autenticação não encontrados na URL.');
                createTimeout(() => {
                    navigateTo('/credentials?error=' + encodeURIComponent('Parâmetros de autenticação não encontrados na URL'));
                }, 2000);
                return;
            }

            const code = searchParams.get('code');
            const state = searchParams.get('state');
            const error = searchParams.get('error');
            const errorDescription = searchParams.get('error_description');

            // Se houver erro na URL
            if (error) {
                setStatus('error');
                setMessage(`Erro na autenticação: ${errorDescription || error}`);
                createTimeout(() => {
                    navigateTo('/credentials?error=' + encodeURIComponent(errorDescription || error));
                }, 2000);
                return;
            }

            if (!code || !state) {
                setStatus('error');
                setMessage('Parâmetros de autenticação inválidos.');
                createTimeout(() => {
                    navigateTo('/credentials?error=' + encodeURIComponent('Parâmetros de autenticação inválidos'));
                }, 2000);
                return;
            }

            // Validar state para segurança (CSRF) e extrair tenantId
            const savedState = localStorage.getItem('ca_auth_state');
            if (state !== savedState) {
                setStatus('error');
                setMessage('Erro de segurança: identificador de sessão inválido.');
                createTimeout(() => {
                    navigateTo('/credentials?error=' + encodeURIComponent('Erro de segurança: identificador de sessão inválido'));
                }, 2000);
                return;
            }

            // Decodificar state para extrair tenantId e credentialId/credentialName
            const stateData = contaAzulAuthService.decodeState(state);
            if (!stateData || !stateData.tenantId) {
                setStatus('error');
                setMessage('Erro ao processar dados de autenticação.');
                createTimeout(() => {
                    navigateTo('/credentials?error=' + encodeURIComponent('Erro ao processar dados de autenticação'));
                }, 2000);
                return;
            }

            // NOVO FLUXO: Verificar se credentialId foi fornecido (prioridade)
            // FLUXO LEGADO: Se não tiver credentialId, verificar credentialName
            if (!stateData.credentialId && (!stateData.credentialName || stateData.credentialName.trim() === '')) {
                setStatus('error');
                setMessage('Credencial não identificada. Por favor, inicie o fluxo de autenticação novamente.');
                createTimeout(() => {
                    navigateTo(`/credentials?error=${encodeURIComponent('Credencial não identificada')}&tenantId=${stateData.tenantId}`);
                }, 2000);
                return;
            }

            // Salvar tenantId para usar no botão de redirecionamento
            setTenantId(stateData.tenantId);

            // Limpar state salvo
            localStorage.removeItem('ca_auth_state');

            // Verificar se há sessão ativa antes de trocar o code
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError || !session?.access_token) {
                setStatus('error');
                setMessage('Sessão não encontrada. Faça login para conectar a Conta Azul.');
                createTimeout(() => {
                    // Redirecionar para login com redirect de volta ao callback
                    const callbackUrl = encodeURIComponent(window.location.href);
                    navigateTo(`/login?redirect=${callbackUrl}`);
                }, 2000);
                return;
            }

            // Normalizar redirect URI (deve ser o mesmo usado em initiateAuth)
            // @ts-ignore
            const redirectUri = import.meta.env.VITE_CONTA_AZUL_REDIRECT_URI || `${window.location.origin}/auth/conta-azul/callback`;
            const normalizedRedirectUri = redirectUri.endsWith('/') && redirectUri !== 'http://localhost:5173/' 
                ? redirectUri.slice(0, -1) 
                : redirectUri;

            try {
                // Trocar code por token via API proxy (que valida JWT e chama Edge Function)
                // Usar credentialId se disponível (novo fluxo), senão usar credentialName (legado)
                const credentialIdOrName = stateData.credentialId || stateData.credentialName!.trim();
                const result = await contaAzulAuthService.exchangeCodeForToken(
                    code,
                    normalizedRedirectUri,
                    stateData.tenantId,
                    credentialIdOrName
                );

                if (!result.success) {
                    throw new Error(result.error || 'Falha ao autenticar');
                }

                setStatus('success');
                setMessage(`Autenticação concluída com sucesso! Credencial "${result.credential_name}" criada.`);
                
                // Redirecionar para credentials com mensagem de sucesso e tenantId
                const redirectUrl = `/credentials?success=${encodeURIComponent(`Credencial "${result.credential_name}" conectada com sucesso!`)}&tenantId=${stateData.tenantId}`;
                
                createTimeout(() => {
                    navigateTo(redirectUrl);
                }, 1500);
            } catch (error) {
                setStatus('error');
                const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao autenticar';
                
                // Se for erro de sessão (401), redirecionar para login
                if (errorMessage.includes('Sessão') || errorMessage.includes('login')) {
                    setMessage(`Erro: ${errorMessage}`);
                    createTimeout(() => {
                        const callbackUrl = encodeURIComponent(window.location.href);
                        navigateTo(`/login?redirect=${callbackUrl}`);
                    }, 2000);
                    return;
                }
                
                setMessage(`Erro: ${errorMessage}`);
                createTimeout(() => {
                    // Se tiver tenantId, incluir na URL de erro também
                    const tenantIdParam = stateData?.tenantId ? `&tenantId=${stateData.tenantId}` : '';
                    const errorUrl = '/credentials?error=' + encodeURIComponent(errorMessage) + tenantIdParam;
                    navigateTo(errorUrl);
                }, 2000);
            }
        };

        processCallback();

        // Cleanup: limpar todos os timeouts quando o componente desmontar
        // Previne memory leaks e atualizações de estado após unmount
        return () => {
            timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
            timeoutRefs.current = [];
        };
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
                {status === 'processing' && (
                    <>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <h2 className="text-xl font-semibold mb-2">Autenticando...</h2>
                        <p className="text-gray-600">{message}</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold mb-2 text-green-700">Sucesso!</h2>
                        <p className="text-gray-600 mb-4">{message}</p>
                        {tenantId && (
                            <button
                                onClick={() => navigateTo(`/credentials?success=Autenticado com sucesso na Conta Azul!&tenantId=${tenantId}`)}
                                className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                            >
                                Ir para Credenciais
                            </button>
                        )}
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold mb-2 text-red-700">Erro</h2>
                        <p className="text-gray-600">{message}</p>
                        <button
                            onClick={() => navigateTo('/credentials')}
                            className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                        >
                            Voltar para Credenciais
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default ContaAzulCallback;
