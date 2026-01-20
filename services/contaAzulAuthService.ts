
// ⚠️ SEGURANÇA: CLIENT_SECRET foi removido do frontend
// Agora a troca de tokens é feita via Edge Function
const CA_CLIENT_ID = '4ja4m506f6f6s4t02g1q6hace7';
// Usar variável de ambiente ou fallback para rota dedicada de callback
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
    credentialName?: string; // Nome amigável da credencial
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
     * Encodes state data (CSRF + tenantId + credentialName) into a single string
     */
    private encodeState(csrf: string, tenantId: string, credentialName?: string): string {
        const stateData: StateData = { csrf, tenantId, credentialName };
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
            console.error('Error decoding state:', error);
            return null;
        }
    }

    /**
     * Initiates the OAuth flow by redirecting to Conta Azul
     * @param tenantId - ID do tenant para associar as credenciais
     * @param credentialName - Nome amigável da credencial (ex: "Matriz SP")
     */
    initiateAuth(tenantId: string, credentialName?: string): void {
        const csrf = this.generateState();
        const state = this.encodeState(csrf, tenantId, credentialName);
        
        // Save state to validate later
        localStorage.setItem('ca_auth_state', state);

        // Normalizar a URL de redirecionamento para garantir consistência
        const normalizedRedirectUri = this.getNormalizedRedirectUri();

        // Log para debug - mostrar qual URL está sendo enviada
        // @ts-ignore - import.meta.env é válido em Vite
        const envVar = import.meta.env.VITE_CONTA_AZUL_REDIRECT_URI || 'não definida (usando fallback)';
        console.log('[ContaAzulAuth] Iniciando autenticação:', {
            redirect_uri: normalizedRedirectUri,
            client_id: CA_CLIENT_ID,
            origin: window.location.origin,
            env_var: envVar,
            credential_name: credentialName
        });

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: CA_CLIENT_ID,
            redirect_uri: normalizedRedirectUri,
            state: state,
            scope: SCOPE
        });

        const url = `${CA_AUTH_URL}?${params.toString()}`;

        // Redirect directly (no popup)
        window.location.href = url;
    }

    /**
     * Exchanges authorization code for tokens via Edge Function (seguro)
     * @param code - Authorization code recebido da Conta Azul
     * @param redirectUri - Redirect URI usado na autenticação
     * @param tenantId - ID do tenant
     * @param credentialName - Nome amigável da credencial
     */
    async exchangeCodeForToken(
        code: string, 
        redirectUri: string, 
        tenantId: string, 
        credentialName: string
    ): Promise<ContaAzulExchangeResponse> {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Supabase não está configurado. Verifique as variáveis de ambiente.');
        }

        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/exchange-conta-azul-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    code,
                    redirect_uri: redirectUri,
                    tenant_id: tenantId,
                    credential_name: credentialName,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
                throw new Error(errorData.error || `Erro ao trocar token: ${response.status}`);
            }

            const data: ContaAzulExchangeResponse = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Falha ao trocar token');
            }

            return data;
        } catch (error) {
            console.error('Error exchanging token:', error);
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
