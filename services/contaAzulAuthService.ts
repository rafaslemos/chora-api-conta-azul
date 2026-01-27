
// ⚠️ SEGURANÇA: CLIENT_SECRET foi removido do frontend
// Agora a troca de tokens é feita via API proxy (que usa Edge Function internamente)
// Client ID será buscado do banco de dados via configService
import { getContaAzulClientId } from './configService';
import { logger } from './logger';
import { supabase } from '../lib/supabase';
// 
// IMPORTANTE: A URL de redirecionamento deve ser configurada SEM HASH (#)
// porque a Conta Azul redireciona para URLs diretas (sem hash).
// 
// Formato correto no .env.local:
//   VITE_CONTA_AZUL_REDIRECT_URI=https://seu-dominio.com/auth/conta-azul/callback
//   (produção) ou http://localhost:5173/auth/conta-azul/callback (desenvolvimento)
//
// ❌ NÃO usar: https://seu-dominio.com/#/auth/conta-azul/callback
//
// A URL deve estar cadastrada EXATAMENTE IGUAL no app da Conta Azul
// @ts-ignore
const CA_REDIRECT_URI = import.meta.env.VITE_CONTA_AZUL_REDIRECT_URI || `${window.location.origin}/auth/conta-azul/callback`;
const CA_AUTH_URL = 'https://auth.contaazul.com/login';
const SCOPE = 'openid profile aws.cognito.signin.user.admin';
const FETCH_TIMEOUT_MS = 15000; // 15 segundos

/**
 * Helper function para fazer fetch com timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Timeout ao fazer requisição para ${url} após ${timeoutMs}ms`);
        }
        throw error;
    }
}

// @ts-ignore
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface ContaAzulExchangeResponse {
    success: boolean;
    credential_id?: string;
    credential_name?: string;
    tenant_id?: string;
    message?: string;
    error?: string;
}

export interface StateData {
    csrf: string;
    tenantId: string;
    credentialName?: string; // Manter para compatibilidade
    credentialId?: string;   // Novo campo: UUID da credencial
}

export class ContaAzulAuthService {
    /**
     * Normaliza a URL de redirecionamento (remove trailing slash se necessário)
     * Garante consistência entre initiateAuth e exchangeCodeForToken
     */
    private normalizeRedirectUri(uri: string): string {
        // Remover trailing slash, exceto para URLs raiz específicas
        if (uri.endsWith('/') && uri !== 'http://localhost:5173/' && uri !== 'https://bpo-v1.vercel.app/') {
            return uri.slice(0, -1);
        }
        return uri;
    }

    /**
     * Obtém o redirect_uri normalizado para uso consistente
     * Garante que initiateAuth e exchangeCodeForToken usem exatamente o mesmo valor
     */
    private getNormalizedRedirectUri(): string {
        return this.normalizeRedirectUri(CA_REDIRECT_URI);
    }

    /**
     * Generates a random state for CSRF protection
     */
    private generateState(): string {
        return crypto.randomUUID();
    }

    /**
     * Encodes state data (CSRF + tenantId + credentialName/credentialId) into a single string
     */
    private encodeState(csrf: string, tenantId: string, credentialName?: string, credentialId?: string): string {
        const stateData: StateData = { csrf, tenantId, credentialName, credentialId };
        return btoa(JSON.stringify(stateData));
    }

    /**
     * Decodes state string back to StateData
     */
    decodeState(state: string): StateData | null {
        try {
            const decoded = JSON.parse(atob(state)) as StateData;
            return decoded;
        } catch (error) {
            logger.error('Erro ao decodificar state', error instanceof Error ? error : undefined, { context: 'oauth' }, 'contaAzulAuthService.ts');
            return null;
        }
    }

    /**
     * Initiates the OAuth flow by redirecting to Conta Azul
     * @param tenantId - ID do tenant para associar as credenciais
     * @param credentialId - UUID da credencial já criada (novo fluxo) ou credentialName para compatibilidade
     */
    async initiateAuth(tenantId: string, credentialIdOrName: string): Promise<void> {
        // Buscar Client ID do banco de dados
        const clientId = await getContaAzulClientId();
        
        if (!clientId) {
            throw new Error('Client ID da Conta Azul não configurado. Configure no banco de dados (app_core.app_config) antes de usar.');
        }
        
        const csrf = this.generateState();
        // Verificar se é UUID (credentialId) ou string (credentialName para compatibilidade)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(credentialIdOrName);
        const state = isUuid 
            ? this.encodeState(csrf, tenantId, undefined, credentialIdOrName)
            : this.encodeState(csrf, tenantId, credentialIdOrName);
        
        // Save state to validate later
        localStorage.setItem('ca_auth_state', state);

        // Normalizar a URL de redirecionamento para garantir consistência
        const normalizedRedirectUri = this.getNormalizedRedirectUri();

        // Log para debug - mostrar qual URL está sendo enviada
        logger.debug('Iniciando autenticação Conta Azul', {
            redirect_uri: normalizedRedirectUri,
            client_id: clientId,
            origin: window.location.origin,
            credential_id: isUuid ? credentialIdOrName : undefined,
            credential_name: isUuid ? undefined : credentialIdOrName
        }, 'contaAzulAuthService.ts');

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: normalizedRedirectUri,
            state: state,
            scope: SCOPE
        });

        const url = `${CA_AUTH_URL}?${params.toString()}`;

        // Redirect directly (no popup)
        window.location.href = url;
    }

    /**
     * Exchanges authorization code for tokens via API proxy (seguro)
     * A API valida o JWT do usuário e repassa para a Edge Function com service role
     * @param code - Authorization code recebido da Conta Azul
     * @param redirectUri - Redirect URI usado na autenticação
     * @param tenantId - ID do tenant
     * @param credentialIdOrName - UUID da credencial (novo fluxo) ou nome da credencial (compatibilidade)
     */
    async exchangeCodeForToken(
        code: string, 
        redirectUri: string, 
        tenantId: string, 
        credentialIdOrName: string
    ): Promise<ContaAzulExchangeResponse> {
        // Obter sessão do usuário para enviar JWT
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.access_token) {
            throw new Error('Sessão não encontrada. Faça login novamente.');
        }

        // Verificar se é UUID (credentialId) ou string (credentialName para compatibilidade)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(credentialIdOrName);
        const requestBody: any = {
            code,
            redirect_uri: redirectUri,
            tenant_id: tenantId,
        };
        
        if (isUuid) {
            requestBody.credential_id = credentialIdOrName;
        } else {
            requestBody.credential_name = credentialIdOrName;
        }

        try {
            // Chamar nossa API proxy (same-origin, sem CORS)
            const apiUrl = '/api/auth/conta-azul/exchange';
            const response = await fetchWithTimeout(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(requestBody),
            }, FETCH_TIMEOUT_MS);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
                
                // Se for 401, a sessão pode ter expirado
                if (response.status === 401) {
                    throw new Error('Sessão expirada. Faça login novamente.');
                }
                
                throw new Error(errorData.error || `Erro ao trocar token: ${response.status}`);
            }

            const data: ContaAzulExchangeResponse = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Falha ao trocar token');
            }

            return data;
        } catch (error) {
            logger.error('Erro ao trocar token', error instanceof Error ? error : undefined, { context: 'oauth' }, 'contaAzulAuthService.ts');
            throw error;
        }
    }

    /**
     * Refreshes the access token using the refresh token
     * NOTA: Esta função deve ser chamada via Edge Function no futuro para manter segurança
     * Por enquanto, mantida para compatibilidade, mas recomenda-se mover para backend
     */
    async refreshToken(refreshToken: string): Promise<any> {
        // ⚠️ ATENÇÃO: Esta função ainda usa CLIENT_SECRET no frontend
        // Deve ser migrada para Edge Function no futuro
        throw new Error('refreshToken deve ser chamado via Edge Function get-valid-token. Não use esta função diretamente.');
    }
}

export const contaAzulAuthService = new ContaAzulAuthService();
