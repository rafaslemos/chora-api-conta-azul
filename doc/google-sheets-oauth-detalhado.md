# Autenticação Google Sheets - Opção B (OAuth Próprio) - Detalhamento Completo

## Visão Geral

Este documento detalha como implementar autenticação OAuth 2.0 própria para Google Sheets, seguindo o mesmo padrão já utilizado para Conta Azul no sistema.

## 1. Configuração Inicial no Google Cloud Console

### Passo 1: Criar Projeto e Credenciais

1. Acessar [Google Cloud Console](https://console.cloud.google.com/)
2. Criar novo projeto ou selecionar existente
3. Ir em **APIs & Services** → **Credentials**
4. Clicar em **Create Credentials** → **OAuth client ID**
5. Configurar OAuth consent screen (se ainda não configurado):
   - Tipo: External
   - App name: "BPO Integração"
   - User support email: seu email
   - Developer contact: seu email
   - Scopes necessários:
     - `https://www.googleapis.com/auth/spreadsheets.readonly` (ler planilhas)
     - `https://www.googleapis.com/auth/spreadsheets` (se precisar escrever)
6. Criar OAuth Client ID:
   - Application type: **Web application**
   - Name: "BPO Web Client"
   - Authorized redirect URIs:
     - `http://localhost:5173/auth/google-sheets/callback` (dev)
     - `https://seu-dominio.com/auth/google-sheets/callback` (prod)
7. Salvar **Client ID** e **Client Secret**

### Variáveis de Ambiente

```env
VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=seu-client-secret
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google-sheets/callback
```

## 2. Estrutura de Arquivos

```
services/
  ├── googleSheetsAuthService.ts  (novo)
  └── googleSheetsApiService.ts   (novo)

pages/
  ├── GoogleSheetsCallback.tsx     (novo)
  └── SheetsIntegrationWizard.tsx  (modificar para incluir botão de autenticação)

lib/
  └── googleSheets.ts              (novo - helper para API)
```

## 3. Serviço de Autenticação Google Sheets

**`services/googleSheetsAuthService.ts`** (novo arquivo)

```typescript
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI || 
  `${window.location.origin}/auth/google-sheets/callback`;
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/spreadsheets' // Se precisar escrever
].join(' ');

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface StateData {
  csrf: string;
  tenantId: string;
  sheetId?: string; // Opcional: se já souber qual planilha
}

export class GoogleSheetsAuthService {
  /**
   * Gera state aleatório para proteção CSRF
   */
  private generateState(): string {
    return crypto.randomUUID();
  }

  /**
   * Codifica state (CSRF + tenantId + sheetId opcional)
   */
  private encodeState(csrf: string, tenantId: string, sheetId?: string): string {
    const stateData: StateData = { csrf, tenantId, sheetId };
    return btoa(JSON.stringify(stateData));
  }

  /**
   * Decodifica state
   */
  decodeState(state: string): StateData | null {
    try {
      return JSON.parse(atob(state)) as StateData;
    } catch (error) {
      console.error('Erro ao decodificar state:', error);
      return null;
    }
  }

  /**
   * Inicia fluxo OAuth redirecionando para Google
   * @param tenantId - ID do tenant
   * @param sheetId - ID da planilha (opcional, se já souber)
   */
  initiateAuth(tenantId: string, sheetId?: string): void {
    const csrf = this.generateState();
    const state = this.encodeState(csrf, tenantId, sheetId);
    
    // Salvar state no localStorage para validação posterior
    localStorage.setItem('google_sheets_auth_state', state);

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: GOOGLE_SCOPES,
      access_type: 'offline', // IMPORTANTE: necessário para receber refresh_token
      prompt: 'consent', // Força consentimento para garantir refresh_token
      state: state,
    });

    const url = `${GOOGLE_AUTH_URL}?${params.toString()}`;
    window.location.href = url;
  }

  /**
   * Troca authorization code por tokens
   */
  async exchangeCodeForToken(code: string): Promise<GoogleTokenResponse> {
    const body = new URLSearchParams({
      code: code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao trocar code por token: ${response.status} ${errorText}`);
      }

      const data: GoogleTokenResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Erro ao trocar token:', error);
      throw error;
    }
  }

  /**
   * Renova access_token usando refresh_token
   */
  async refreshToken(refreshToken: string): Promise<GoogleTokenResponse> {
    const body = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao renovar token: ${response.status} ${errorText}`);
    }

    const data: GoogleTokenResponse = await response.json();
    
    // IMPORTANTE: Google pode não retornar refresh_token na renovação
    // Se não retornar, manter o refresh_token existente
    return data;
  }
}

export const googleSheetsAuthService = new GoogleSheetsAuthService();
```

## 4. Página de Callback

**`pages/GoogleSheetsCallback.tsx`** (novo arquivo, similar ao ContaAzulCallback.tsx)

```typescript
import React, { useEffect, useState } from 'react';
import { googleSheetsAuthService } from '../services/googleSheetsAuthService';
import { credentialService } from '../services/credentialService';

const GoogleSheetsCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processando autenticação com Google Sheets...');
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      // Capturar parâmetros da URL (mesma estratégia do ContaAzulCallback)
      let searchParams: URLSearchParams | null = null;

      if (window.location.search) {
        searchParams = new URLSearchParams(window.location.search);
      } else if (window.location.hash && window.location.hash.includes('?')) {
        searchParams = new URLSearchParams(window.location.hash.split('?')[1]);
      }

      if (!searchParams) {
        setStatus('error');
        setMessage('Parâmetros de autenticação não encontrados.');
        return;
      }

      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setMessage(`Erro na autenticação: ${error}`);
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setMessage('Parâmetros de autenticação inválidos.');
        return;
      }

      // Validar state (CSRF protection)
      const savedState = localStorage.getItem('google_sheets_auth_state');
      if (state !== savedState) {
        setStatus('error');
        setMessage('Erro de segurança: identificador de sessão inválido.');
        return;
      }

      // Decodificar state para extrair tenantId
      const stateData = googleSheetsAuthService.decodeState(state);
      if (!stateData || !stateData.tenantId) {
        setStatus('error');
        setMessage('Erro ao processar dados de autenticação.');
        return;
      }

      setTenantId(stateData.tenantId);
      localStorage.removeItem('google_sheets_auth_state');

      try {
        // Trocar code por tokens
        const tokenData = await googleSheetsAuthService.exchangeCodeForToken(code);

        // Calcular data de expiração
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

        // Salvar credenciais (usando mesma estrutura do Conta Azul)
        await credentialService.save(stateData.tenantId, 'GOOGLE_SHEETS', {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expires_in,
          is_active: true,
        });

        // Se tiver sheetId no state, salvar no config
        if (stateData.sheetId) {
          const existing = await credentialService.get(stateData.tenantId, 'GOOGLE_SHEETS');
          if (existing) {
            await credentialService.update(stateData.tenantId, 'GOOGLE_SHEETS', {
              config: {
                ...existing.config,
                sheet_id: stateData.sheetId,
                scopes: tokenData.scope.split(' '),
              },
            });
          }
        }

        setStatus('success');
        setMessage('Autenticação concluída com sucesso!');
        
        // Redirecionar para wizard de integração
        setTimeout(() => {
          window.location.href = `#/sheets-integration/wizard?tenantId=${stateData.tenantId}&success=true`;
        }, 1500);
      } catch (error) {
        setStatus('error');
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        setMessage(`Erro: ${errorMessage}`);
      }
    };

    processCallback();
  }, []);

  // UI similar ao ContaAzulCallback.tsx
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
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleSheetsCallback;
```

## 5. Atualização do Schema do Banco

**Adicionar 'GOOGLE_SHEETS' ao CHECK constraint:**

```sql
-- Atualizar constraint em tenant_credentials
ALTER TABLE public.tenant_credentials
DROP CONSTRAINT IF EXISTS tenant_credentials_platform_check;

ALTER TABLE public.tenant_credentials
ADD CONSTRAINT tenant_credentials_platform_check 
CHECK (platform IN ('OLIST', 'CONTA_AZUL', 'HOTMART', 'MERCADO_LIVRE', 'SHOPEE', 'GOOGLE_SHEETS'));
```

**Atualizar types.ts:**
```typescript
export type PlatformType = 'OLIST' | 'CONTA_AZUL' | 'MERCADO_LIVRE' | 'SHOPEE' | 'HOTMART' | 'GOOGLE_SHEETS';
```

## 6. Serviço para Acessar Planilhas

**`services/googleSheetsApiService.ts`** (novo arquivo)

```typescript
import { credentialService } from './credentialService';
import { googleSheetsAuthService } from './googleSheetsAuthService';

export interface SheetRow {
  [column: string]: string | number;
}

export interface SheetData {
  range: string;
  values: any[][];
}

export class GoogleSheetsApiService {
  /**
   * Obtém token válido (renova se necessário)
   */
  private async getValidToken(tenantId: string): Promise<string> {
    const cred = await credentialService.getDecrypted(tenantId, 'GOOGLE_SHEETS');
    
    if (!cred || !cred.accessToken) {
      throw new Error('Credenciais do Google Sheets não encontradas. Reautentique.');
    }

    // Verificar se token está expirado
    const isExpired = await credentialService.isTokenExpired(tenantId, 'GOOGLE_SHEETS');
    
    if (isExpired && cred.refreshToken) {
      // Renovar token
      const newTokenData = await googleSheetsAuthService.refreshToken(cred.refreshToken);
      
      // Atualizar no banco
      await credentialService.update(tenantId, 'GOOGLE_SHEETS', {
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token || cred.refreshToken, // Manter se não retornar
        expires_in: newTokenData.expires_in,
      });

      return newTokenData.access_token;
    }

    return cred.accessToken;
  }

  /**
   * Lê dados de uma planilha
   */
  async readSheet(
    tenantId: string, 
    spreadsheetId: string, 
    range: string
  ): Promise<SheetData> {
    const token = await this.getValidToken(tenantId);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token inválido, tentar renovar
        const cred = await credentialService.getDecrypted(tenantId, 'GOOGLE_SHEETS');
        if (cred?.refreshToken) {
          const newToken = await this.getValidToken(tenantId);
          return this.readSheet(tenantId, spreadsheetId, range); // Retry
        }
      }
      throw new Error(`Erro ao ler planilha: ${response.status} ${await response.text()}`);
    }

    return await response.json();
  }

  /**
   * Obtém metadados da planilha
   */
  async getSheetMetadata(tenantId: string, spreadsheetId: string) {
    const token = await this.getValidToken(tenantId);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao obter metadados: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Extrai ID da planilha de uma URL
   */
  extractSheetId(url: string): string | null {
    const patterns = [
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)\/edit/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }
}

export const googleSheetsApiService = new GoogleSheetsApiService();
```

## 7. Integração no Wizard

**Modificar `pages/SheetsIntegrationWizard.tsx`:**

```typescript
// No passo 1, adicionar botão de autenticação
const Step1: React.FC = () => {
  const [sheetUrl, setSheetUrl] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Verificar se já tem credenciais
    checkAuth();
  }, [tenantId]);

  const checkAuth = async () => {
    const cred = await credentialService.get(tenantId, 'GOOGLE_SHEETS');
    setIsAuthenticated(!!cred && cred.isActive);
  };

  const handleAuthenticate = () => {
    // Extrair sheetId da URL se já informada
    const sheetId = googleSheetsApiService.extractSheetId(sheetUrl);
    googleSheetsAuthService.initiateAuth(tenantId, sheetId);
  };

  return (
    <div>
      <h2>Passo 1: Conectar Google Sheets</h2>
      
      {!isAuthenticated ? (
        <div>
          <p>Primeiro, você precisa autorizar o acesso ao Google Sheets.</p>
          <button onClick={handleAuthenticate}>
            Conectar com Google
          </button>
        </div>
      ) : (
        <div>
          <p>✅ Conectado ao Google Sheets</p>
          <input
            type="text"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="Cole a URL da planilha"
          />
        </div>
      )}
    </div>
  );
};
```

## 8. Edge Function para Renovação Automática (Opcional)

**`supabase/functions/refresh-google-token/index.ts`** (similar ao get-valid-token)

```typescript
// Similar ao get-valid-token, mas para Google Sheets
// Pode ser chamado periodicamente via cron job ou quando necessário
```

## 9. Fluxo Completo Visual

```
1. Usuário acessa wizard de integração
   ↓
2. Clica em "Conectar com Google"
   ↓
3. Redirecionado para Google OAuth
   ↓
4. Usuário autoriza acesso
   ↓
5. Google redireciona para /auth/google-sheets/callback?code=xxx&state=yyy
   ↓
6. GoogleSheetsCallback.tsx processa:
   - Valida state (CSRF)
   - Troca code por tokens
   - Salva tokens criptografados em tenant_credentials
   ↓
7. Redireciona de volta para wizard
   ↓
8. Wizard continua com configuração da planilha
   ↓
9. Quando precisar ler planilha:
   - googleSheetsApiService.getValidToken() verifica expiração
   - Se expirado, renova usando refresh_token
   - Faz requisição à API do Google Sheets
```

## 10. Vantagens da Opção B

- ✅ **Controle total** sobre autenticação
- ✅ **Não depende do n8n** para acessar planilhas
- ✅ **Renovação automática** de tokens
- ✅ **Mesmo padrão** já usado para Conta Azul
- ✅ **Segurança** com criptografia de tokens

## 11. Desvantagens

- ❌ **Mais código** para manter
- ❌ **Requer configuração** no Google Cloud Console
- ❌ **Precisa gerenciar** renovação de tokens manualmente

## 12. Comparação: Opção A vs Opção B

| Aspecto | Opção A (n8n) | Opção B (OAuth Próprio) |
|---------|---------------|-------------------------|
| Complexidade | Baixa | Média |
| Dependências | n8n | Google Cloud Console |
| Controle | Limitado | Total |
| Manutenção | n8n cuida | Nossa responsabilidade |
| Renovação de tokens | Automática (n8n) | Manual (nosso código) |
| Acesso direto às planilhas | Não | Sim |
| Recomendação | MVP | Produção avançada |

## 13. Recomendação

**Para MVP:** Usar Opção A (n8n) - mais rápido de implementar, menos código para manter.

**Para Produção Avançada:** Migrar para Opção B se:
- Precisar de acesso direto às planilhas sem passar pelo n8n
- Quiser maior controle sobre o processo de autenticação
- Precisar de funcionalidades específicas que n8n não oferece

## 14. Próximos Passos para Implementação

1. Configurar projeto no Google Cloud Console
2. Criar `googleSheetsAuthService.ts`
3. Criar `GoogleSheetsCallback.tsx`
4. Criar `googleSheetsApiService.ts`
5. Atualizar schema do banco (adicionar GOOGLE_SHEETS)
6. Integrar no wizard de integração
7. Testar fluxo completo de autenticação
8. Implementar renovação automática de tokens

